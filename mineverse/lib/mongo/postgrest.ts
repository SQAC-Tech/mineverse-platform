/* eslint-disable @typescript-eslint/no-explicit-any -- see "Typed the way the call sites read" below. */
import type { Collection, Document, Filter, Sort } from 'mongodb';
import { mongoDb } from './client';
import { RELATIONS, PRIMARY_KEY, DATE_COLUMNS } from './relations';

/**
 * The slice of PostgREST that this codebase actually uses, spoken to MongoDB.
 *
 * There are 371 `supabaseServer.from(...)` call sites across 78 files. Porting
 * them one by one during a live event is not a migration, it is a rewrite with
 * an audience. So the query builder moves instead: every call site keeps its
 * exact shape — `.select().eq().order().single()`, `{ data, error }` out — and
 * only `lib/supabase/server.ts` changes what it points at.
 *
 * ## Faithful where the app can tell the difference
 *
 * The error codes are the contract, not a detail. Nineteen places branch on
 * `code === '23505'` to turn a duplicate insert into "already claimed" rather
 * than a 500; ten check `PGRST116` to treat "no rows" as an empty state. A shim
 * that returned its own error shapes would compile, pass a smoke test, and then
 * hand teams a server error the first time two of them clicked at once.
 *
 * ## Where it deliberately stops
 *
 * Embedded selects resolve one level deep, which is every join this app makes.
 * `.or()` handles the flat `col.op.value,col.op.value` form. Anything outside
 * that throws rather than returning wrong rows quietly — a loud failure during
 * a port is worth more than a query that silently drops half its results.
 */

export interface PostgrestError {
  code: string;
  message: string;
  details: string;
  hint: string;
}

/**
 * Typed the way the call sites read, not the way the rows are shaped.
 *
 * `data` is `any[]` for a list query and `any` for `single()`, and the
 * distinction is load-bearing: `any` gives a `.map(row => ...)` callback no
 * contextual type, so `noImplicitAny` rejects it in 39 places that compiled
 * fine against the generated Supabase types. `any[]` supplies that context.
 *
 * Rebuilding real row types from MongoDB is worth doing later; doing it inside
 * the migration would mean 78 files failing to compile for reasons unrelated
 * to whether the data moved.
 */
export interface PostgrestResponse<T> {
  data: T;
  error: PostgrestError | null;
  count: number | null;
  status: number;
  statusText: string;
}

function pgError(code: string, message: string, details = ''): PostgrestError {
  return { code, message, details, hint: '' };
}

/** MongoDB signals a unique-index collision as 11000; Postgres calls it 23505. */
function translateMongoError(error: unknown): PostgrestError {
  const err = error as { code?: number; message?: string; keyValue?: Record<string, unknown> };
  if (err?.code === 11000) {
    const keys = Object.keys(err.keyValue ?? {}).join(', ');
    return pgError('23505', `duplicate key value violates unique constraint (${keys})`, keys);
  }
  return pgError('MONGO_ERROR', err?.message ?? String(error));
}

/**
 * A `select()` string, split into plain columns and embedded relations.
 *
 * `'*, rounds(id, name), teams(team_code)'` becomes `['*']` plus two embeds.
 * Written as a scanner rather than a regex because the nested parentheses in
 * `payments (amount, status)` defeat anything simpler, and a mis-parse here
 * shows up as a missing join three screens away.
 */
interface Embed {
  table: string;
  alias: string;
  columns: string[];
  inner: boolean;
}

function parseSelect(select: string): { columns: string[]; embeds: Embed[] } {
  const columns: string[] = [];
  const embeds: Embed[] = [];
  let index = 0;

  while (index < select.length) {
    while (index < select.length && /[\s,]/.test(select[index])) index += 1;
    if (index >= select.length) break;

    let token = '';
    while (index < select.length && !/[,(]/.test(select[index])) {
      token += select[index];
      index += 1;
    }
    token = token.trim();

    if (select[index] === '(') {
      let depth = 1;
      index += 1;
      let body = '';
      while (index < select.length && depth > 0) {
        if (select[index] === '(') depth += 1;
        else if (select[index] === ')') depth -= 1;
        if (depth > 0) body += select[index];
        index += 1;
      }

      // `teams!inner(...)` filters the parent rows to those with a match;
      // `teams!fk_name(...)` just disambiguates and can be ignored.
      const inner = token.includes('!inner');
      const name = token.split('!')[0].trim();
      const alias = name;

      embeds.push({
        table: name,
        alias,
        columns: body.split(',').map((column) => column.trim()).filter(Boolean),
        inner,
      });
      continue;
    }

    if (token) columns.push(token);
  }

  return { columns, embeds };
}

/** `{ id: 1, team_id: 1 }` for a column list, or `undefined` for `*`. */
function projectionFor(columns: string[]): Document | undefined {
  if (columns.length === 0 || columns.includes('*')) return undefined;
  const projection: Document = {};
  for (const column of columns) {
    // `count` and aggregate syntax never appear in this codebase's selects.
    const name = column.split(':').pop()!.trim();
    if (name) projection[name] = 1;
  }
  return projection;
}

/** Strips the `_id` this shim adds, so rows look exactly as PostgREST returned them. */
function clean<T extends Document>(doc: T | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as Document;
  // Tables whose primary key is not a single column keep `_id` as their only
  // identity; dropping it there would lose the row's handle entirely.
  return (rest as T) ?? null;
}

type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'cs';

function condition(op: Op, value: unknown): unknown {
  switch (op) {
    case 'eq':
      return value;
    case 'neq':
      return { $ne: value };
    case 'gt':
      return { $gt: value };
    case 'gte':
      return { $gte: value };
    case 'lt':
      return { $lt: value };
    case 'lte':
      return { $lte: value };
    case 'in':
      return { $in: value };
    case 'cs':
      return { $all: Array.isArray(value) ? value : [value] };
    case 'is':
      // PostgREST's `is` takes null/true/false only.
      return value === null ? { $in: [null] } : value;
    case 'like':
    case 'ilike': {
      const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
      return { $regex: `^${pattern}$`, $options: op === 'ilike' ? 'i' : '' };
    }
    default:
      return value;
  }
}

/**
 * Coerces a filter value to match how the column is stored.
 *
 * Dates live as BSON dates, and the app passes ISO strings — `new Date()` on
 * both sides of a comparison agrees, a Date against a string never does. This
 * is why `ends_at < now` would have quietly matched nothing and left every
 * round open forever.
 */
function coerceValue(table: string, column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (!(DATE_COLUMNS[table] ?? []).includes(column)) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

function coerceRow(table: string, row: Document): Document {
  const dates = DATE_COLUMNS[table] ?? [];
  if (dates.length === 0) return row;
  const out: Document = { ...row };
  for (const column of dates) {
    const value = out[column];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) out[column] = parsed;
    }
  }
  return out;
}

type Mutation =
  | { kind: 'select' }
  | { kind: 'insert'; rows: Document[] }
  | { kind: 'update'; patch: Document }
  | { kind: 'upsert'; rows: Document[]; onConflict?: string }
  | { kind: 'delete' };

class QueryBuilder<T = any[]> implements PromiseLike<PostgrestResponse<T>> {
  private criteria: Filter<Document> = {};
  private andFilters: Filter<Document>[] = [];
  private sort: Sort = {};
  private limitCount: number | null = null;
  private skipCount = 0;
  private selectString: string | null = null;
  private wantCount = false;
  private headOnly = false;
  private rowMode: 'many' | 'single' | 'maybe' = 'many';
  private mutation: Mutation = { kind: 'select' };

  constructor(private table: string) {}

  private where(column: string, op: Op, value: unknown) {
    const coerced = op === 'in' && Array.isArray(value)
      ? value.map((entry) => coerceValue(this.table, column, entry))
      : coerceValue(this.table, column, value);
    const clause = condition(op, coerced);

    // Two filters on one column must both apply. Assigning over the first is
    // how a `gte`/`lte` window silently becomes an open-ended range.
    if (column in this.criteria) this.andFilters.push({ [column]: clause });
    else (this.criteria as Document)[column] = clause;
    return this;
  }

  select(select = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.selectString = select;
    if (options?.count) this.wantCount = true;
    if (options?.head) this.headOnly = true;
    return this;
  }

  eq(column: string, value: unknown) { return this.where(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.where(column, 'neq', value); }
  gt(column: string, value: unknown) { return this.where(column, 'gt', value); }
  gte(column: string, value: unknown) { return this.where(column, 'gte', value); }
  lt(column: string, value: unknown) { return this.where(column, 'lt', value); }
  lte(column: string, value: unknown) { return this.where(column, 'lte', value); }
  like(column: string, value: string) { return this.where(column, 'like', value); }
  ilike(column: string, value: string) { return this.where(column, 'ilike', value); }
  is(column: string, value: unknown) { return this.where(column, 'is', value); }
  in(column: string, values: unknown[]) { return this.where(column, 'in', values); }
  contains(column: string, value: unknown) { return this.where(column, 'cs', value); }

  match(criteria: Record<string, unknown>) {
    for (const [column, value] of Object.entries(criteria)) this.where(column, 'eq', value);
    return this;
  }

  filter(column: string, op: string, value: unknown) {
    return this.where(column, op as Op, value);
  }

  not(column: string, op: string, value: unknown) {
    const coerced = coerceValue(this.table, column, value);
    const negated = op === 'is' && value === null
      ? { $ne: null }
      : { $not: condition(op as Op, coerced) as Document };
    if (column in this.criteria) this.andFilters.push({ [column]: negated });
    else (this.criteria as Document)[column] = negated;
    return this;
  }

  /** `or('a.eq.1,b.is.null')` — the flat form, which is the only one used here. */
  or(expression: string) {
    const clauses = expression.split(',').map((part) => {
      const [column, op, ...rest] = part.split('.');
      const raw = rest.join('.');
      const value = raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : raw;
      return { [column]: condition(op as Op, coerceValue(this.table, column, value)) };
    });
    this.andFilters.push({ $or: clauses } as Filter<Document>);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    (this.sort as Document)[column] = options?.ascending === false ? -1 : 1;
    return this;
  }

  limit(count: number) { this.limitCount = count; return this; }

  range(from: number, to: number) {
    this.skipCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  // Terminal, and typed as a single row rather than a list.
  single(): PromiseLike<PostgrestResponse<any>> {
    this.rowMode = 'single';
    this.limitCount = 2;
    return this as unknown as PromiseLike<PostgrestResponse<any>>;
  }

  maybeSingle(): PromiseLike<PostgrestResponse<any>> {
    this.rowMode = 'maybe';
    this.limitCount = 2;
    return this as unknown as PromiseLike<PostgrestResponse<any>>;
  }

  insert(rows: Document | Document[]) {
    this.mutation = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(patch: Document) { this.mutation = { kind: 'update', patch }; return this; }

  upsert(rows: Document | Document[], options?: { onConflict?: string }) {
    this.mutation = {
      kind: 'upsert',
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: options?.onConflict,
    };
    return this;
  }

  delete() { this.mutation = { kind: 'delete' }; return this; }

  private compiledFilter(): Filter<Document> {
    if (this.andFilters.length === 0) return this.criteria;
    return { $and: [this.criteria, ...this.andFilters] } as Filter<Document>;
  }

  /**
   * Resolves one level of embedded relations.
   *
   * A child row carries the foreign key, so `submissions` embedding `teams`
   * looks up by the FK it holds; a parent embedding its children (`teams` with
   * `members(*)`) searches the child table for rows pointing back. Both
   * directions appear in this codebase, and which one applies is decided from
   * the generated relation map rather than guessed from the name.
   */
  private async resolveEmbeds(rows: Document[], embeds: Embed[]): Promise<Document[]> {
    if (embeds.length === 0 || rows.length === 0) return rows;
    const db = await mongoDb();

    for (const embed of embeds) {
      const outward = (RELATIONS[this.table] ?? []).find((relation) => relation.table === embed.table);
      const projection = projectionFor(embed.columns);

      if (outward) {
        const ids = [...new Set(rows.map((row) => row[outward.column]).filter((id) => id != null))];
        const related = await db
          .collection(embed.table)
          .find({ [outward.ref]: { $in: ids } }, { projection })
          .toArray();
        const byId = new Map(related.map((doc) => [doc[outward.ref], clean(doc)]));
        for (const row of rows) row[embed.alias] = byId.get(row[outward.column]) ?? null;
        continue;
      }

      const inward = (RELATIONS[embed.table] ?? []).find((relation) => relation.table === this.table);
      if (!inward) {
        throw new Error(`No relation between ${this.table} and ${embed.table}. Add it to lib/mongo/relations.ts.`);
      }

      const ids = [...new Set(rows.map((row) => row[inward.ref]).filter((id) => id != null))];
      const related = await db
        .collection(embed.table)
        .find({ [inward.column]: { $in: ids } }, { projection })
        .toArray();

      const grouped = new Map<unknown, Document[]>();
      for (const doc of related) {
        const key = doc[inward.column];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(clean(doc)!);
      }
      for (const row of rows) row[embed.alias] = grouped.get(row[inward.ref]) ?? [];
    }

    // `!inner` drops parents with nothing on the other side, matching an inner join.
    const required = embeds.filter((embed) => embed.inner);
    if (required.length === 0) return rows;
    return rows.filter((row) =>
      required.every((embed) => {
        const value = row[embed.alias];
        return Array.isArray(value) ? value.length > 0 : value != null;
      }),
    );
  }

  private async run(): Promise<PostgrestResponse<T>> {
    const db = await mongoDb();
    const collection: Collection<Document> = db.collection(this.table);
    const filter = this.compiledFilter();
    const { columns, embeds } = parseSelect(this.selectString ?? '*');

    let rows: Document[] = [];
    let count: number | null = null;

    switch (this.mutation.kind) {
      case 'insert':
      case 'upsert': {
        const primary = PRIMARY_KEY[this.table];
        const prepared = this.mutation.rows.map((row) => {
          const doc = coerceRow(this.table, row);
          // Postgres filled these with `gen_random_uuid()` / `now()` defaults.
          if (primary && doc[primary] == null) doc[primary] = crypto.randomUUID();
          if (primary && doc[primary] != null) doc._id = doc[primary];
          if ('created_at' in doc && doc.created_at == null) doc.created_at = new Date();
          return doc;
        });

        if (this.mutation.kind === 'insert') {
          await collection.insertMany(prepared, { ordered: true });
        } else {
          const keys = this.mutation.onConflict?.split(',').map((key) => key.trim());
          for (const doc of prepared) {
            // Without an explicit conflict target, the primary key is the target —
            // which is what `upsert` means in Postgres too.
            const target = keys && keys.length > 0
              ? Object.fromEntries(keys.map((key) => [key, doc[key]]))
              : { _id: doc._id };
            const { _id, ...rest } = doc;
            await collection.updateOne(target, { $set: rest }, { upsert: true });
          }
        }
        rows = prepared;
        break;
      }

      case 'update': {
        const patch = coerceRow(this.table, this.mutation.patch);
        // Returning the rows costs an extra read, so it is only paid for when
        // the caller chained `.select()` and will actually look at them.
        if (this.selectString !== null) {
          const targets = await collection.find(filter, { projection: { _id: 1 } }).toArray();
          await collection.updateMany(filter, { $set: patch });
          rows = await collection.find({ _id: { $in: targets.map((doc) => doc._id) } }).toArray();
        } else {
          await collection.updateMany(filter, { $set: patch });
        }
        break;
      }

      case 'delete': {
        if (this.selectString !== null) rows = await collection.find(filter).toArray();
        await collection.deleteMany(filter);
        break;
      }

      case 'select': {
        if (this.wantCount) count = await collection.countDocuments(filter);
        if (this.headOnly) break;

        let cursor = collection.find(filter, { projection: projectionFor(columns) });
        if (Object.keys(this.sort).length > 0) cursor = cursor.sort(this.sort);
        if (this.skipCount > 0) cursor = cursor.skip(this.skipCount);
        if (this.limitCount !== null) cursor = cursor.limit(this.limitCount);
        rows = await cursor.toArray();
        break;
      }
    }

    rows = await this.resolveEmbeds(rows, embeds);
    const cleaned = rows.map((row) => clean(row)!) as Document[];

    if (this.rowMode === 'single') {
      if (cleaned.length === 0) {
        return {
          data: null as T,
          error: pgError('PGRST116', 'JSON object requested, multiple (or no) rows returned'),
          count,
          status: 406,
          statusText: 'Not Acceptable',
        };
      }
      return { data: cleaned[0] as T, error: null, count, status: 200, statusText: 'OK' };
    }

    if (this.rowMode === 'maybe') {
      return { data: (cleaned[0] ?? null) as T, error: null, count, status: 200, statusText: 'OK' };
    }

    return {
      data: (this.headOnly ? null : cleaned) as T,
      error: null,
      count,
      status: 200,
      statusText: 'OK',
    };
  }

  then<R1 = PostgrestResponse<T>, R2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run()
      .catch((error): PostgrestResponse<T> => {
        const translated = translateMongoError(error);
        // A `single()` that blew up must still hand back `data: null`, or the
        // 83 call sites that destructure it would read a property of an array.
        const data = (this.rowMode === 'many' ? [] : null) as T;
        return { data, error: translated, count: null, status: 500, statusText: 'Error' };
      })
      .then(onfulfilled, onrejected);
  }
}

/**
 * A drop-in stand-in for the supabase-js server client.
 *
 * Only `.from()` and `.rpc()` are implemented, because only those are used —
 * this app never touched Supabase Auth or Storage from the server.
 */
export const mongoPostgrest = {
  from<T = any[]>(table: string) {
    return new QueryBuilder<T>(table);
  },

  async rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<PostgrestResponse<T>> {
    const { callRpc } = await import('./rpc');
    try {
      const data = await callRpc(name, args);
      return { data: data as T, error: null, count: null, status: 200, statusText: 'OK' };
    } catch (error) {
      const err = error as { pgCode?: string; message?: string };
      return {
        data: null as T,
        error: pgError(err.pgCode ?? 'P0001', err.message ?? String(error)),
        count: null,
        status: 400,
        statusText: 'Bad Request',
      };
    }
  },
};

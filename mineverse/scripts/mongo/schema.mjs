/**
 * The Postgres schema, restated in terms MongoDB can enforce.
 *
 * Most of this is derived at runtime from the `openapi.json` that sits beside
 * the dump — PostgREST describes every table, every column format, every
 * primary key and every foreign key in there, so the column half of this file
 * cannot drift from what was actually backed up.
 *
 * What PostgREST does *not* publish is UNIQUE constraints, and those are the
 * half that matters most: `resource_ledger (team_id, idempotency_key)` is the
 * only thing standing between this event and paying every team twice. Those
 * are listed explicitly below, extracted from `supabase/migrations`, and the
 * migrator verifies each one against the dumped rows before it builds the
 * index — if a constraint here is wrong, the data says so immediately rather
 * than the index silently failing to apply.
 */

/**
 * UNIQUE constraints, table -> list of column tuples.
 *
 * Extracted from the migration SQL rather than typed from memory. Tables that
 * no longer exist (`structures`, `offline_results`) are omitted; tables that
 * exist but are empty are kept, because an empty table still needs its index
 * before the first row lands.
 */
export const UNIQUE_CONSTRAINTS = {
  teams: [['team_code'], ['qr_token']],
  members: [['team_id', 'email'], ['college_email'], ['registration_no']],
  payments: [['team_id'], ['transaction_id']],
  attendance_checkpoints: [['code']],
  attendance_records: [['team_id', 'checkpoint_id']],
  attendance_member_records: [['attendance_record_id', 'member_id']],
  team_round_access: [['team_id', 'round_id']],
  questions: [['round_id', 'order_index']],
  submissions: [['team_id', 'question_id'], ['final_award_ledger_id']],
  resource_ledger: [['team_id', 'idempotency_key']],
  crafting_log: [['team_id', 'item'], ['team_id', 'idempotency_key']],
  choice_decisions: [['team_id', 'choice_key']],
  grading_items: [['submission_id', 'revision']],
  team_event_effects: [['world_event_id', 'team_id']],
  manual_adjustments: [['team_id', 'idempotency_key']],
  proctor_sessions: [['team_id', 'round_id', 'device_id']],
  screening_questions: [['order_index']],
  screening_attempts: [['team_id']],
  relay_screening_attempts: [['team_id']],
  item_uses: [['transaction_id']],
  pvp_match_teams: [['match_id', 'team_id']],
  pvp_match_questions: [['match_id', 'display_order']],
  pvp_match_submissions: [
    ['team_id', 'idempotency_key'],
    ['match_id', 'team_id', 'match_question_id', 'revision'],
  ],
  pvp_results: [['match_id'], ['winner_team_id'], ['loser_team_id']],
  day2_event_instances: [['idempotency_key']],
  day2_event_effects: [['event_id', 'team_id'], ['team_id', 'idempotency_key']],
  day2_manual_adjustments: [['team_id', 'idempotency_key']],
  day2_reconciliations: [['team_id', 'idempotency_key']],
  day2_offline_results: [['team_id', 'activity_key'], ['team_id', 'idempotency_key']],
};

/**
 * Postgres partial unique indexes, and what became of them.
 *
 * `create unique index ... where <predicate>` has a direct MongoDB equivalent
 * in `partialFilterExpression`, but only for a restricted grammar: equality,
 * `$exists`, `$type`, the range operators, and a top-level `$and`. `$in` and
 * `$ne` are not accepted.
 *
 * So the two constraints whose predicate is an `$in` cannot be expressed as an
 * index at all. They are recorded here as `app_enforced` so that they show up
 * in the migration report as work the application layer now owns, rather than
 * quietly disappearing between the two databases — which is exactly how a
 * "one active match per team" rule turns into two live matches.
 */
export const PARTIAL_UNIQUE = {
  guardian_battles: [
    { keys: ['team_id', 'guardian_name', 'round_id'], filter: { status: 'won' } },
  ],
  world_events: [
    { keys: ['event_key', 'round_id'], filter: { status: 'active' } },
  ],
  day2_event_instances: [
    { keys: ['event_key'], filter: { event_key: 'chorus_fruit_blessing', status: 'active' } },
  ],
  grading_runs: [
    {
      keys: ['round_id'],
      app_enforced: "where state in ('queued','running') — partialFilterExpression rejects $in",
    },
  ],
  pvp_match_teams: [
    {
      keys: ['team_id'],
      app_enforced: "where status in ('pending','live') — partialFilterExpression rejects $in",
    },
  ],
};

/**
 * Column formats PostgREST reports for date-like columns.
 *
 * These arrive in the dump as ISO strings. Left as strings they would sort
 * lexically and compare against `new Date()` as never-equal, so every
 * "is this round over" and "what did we grant in the last hour" query would be
 * wrong in a way that still returns rows.
 */
const DATE_FORMATS = new Set(['timestamp with time zone', 'timestamp without time zone', 'date']);

/** Formats that must stay numbers even if PostgREST hands them over as strings. */
const NUMERIC_FORMATS = new Set(['bigint', 'integer', 'numeric', 'double precision', 'real', 'smallint']);

/**
 * Reads the PostgREST OpenAPI document into a per-table description.
 *
 * `required` in that document is Postgres's NOT NULL, which is the fact the
 * unique-index logic needs: a nullable unique column has to become a partial
 * index, because Postgres lets a thousand rows share a NULL and MongoDB counts
 * them all as the same key.
 */
export function buildSchema(openapi) {
  const definitions = openapi.definitions ?? openapi.components?.schemas ?? {};
  const schema = {};

  for (const [table, def] of Object.entries(definitions)) {
    const properties = def.properties ?? {};
    const required = new Set(def.required ?? []);
    const columns = {};
    const dates = [];
    const numbers = [];
    const primaryKey = [];
    const foreignKeys = [];

    for (const [column, prop] of Object.entries(properties)) {
      const format = prop.format ?? 'text';
      const description = prop.description ?? '';

      columns[column] = { format, nullable: !required.has(column) };

      if (DATE_FORMATS.has(format)) dates.push(column);
      if (NUMERIC_FORMATS.has(format)) numbers.push(column);
      if (description.includes('<pk/>')) primaryKey.push(column);

      const fk = /<fk table='([^']+)' column='([^']+)'\/>/.exec(description);
      if (fk) foreignKeys.push({ column, table: fk[1], column_ref: fk[2] });
    }

    schema[table] = { table, columns, dates, numbers, primaryKey, foreignKeys };
  }

  return schema;
}

/**
 * The index specifications for one table, unique constraints included.
 *
 * Nullable columns in a unique constraint pick up a `$type` partial filter.
 * `$exists: true` would not do: a column that is present and explicitly `null`
 * exists, and PostgREST writes those out as `null` rather than omitting them,
 * so every unpaid submission would collide on `final_award_ledger_id: null`.
 */
export function indexesFor(table, schema) {
  const table_schema = schema[table];
  if (!table_schema) return { indexes: [], app_enforced: [] };

  const indexes = [];
  const app_enforced = [];

  for (const keys of UNIQUE_CONSTRAINTS[table] ?? []) {
    const nullable = keys.filter((key) => table_schema.columns[key]?.nullable);
    const spec = {
      key: Object.fromEntries(keys.map((key) => [key, 1])),
      name: `uq_${table}_${keys.join('_')}`.slice(0, 120),
      unique: true,
    };

    if (nullable.length > 0) {
      spec.partialFilterExpression = Object.fromEntries(
        nullable.map((key) => [key, { $type: mongoTypeFor(table_schema.columns[key].format) }]),
      );
    }

    indexes.push(spec);
  }

  for (const partial of PARTIAL_UNIQUE[table] ?? []) {
    if (partial.app_enforced) {
      app_enforced.push({ table, keys: partial.keys, note: partial.app_enforced });
      // Still worth a plain index: the rule is now a query the app runs on
      // every insert, and it should not be a collection scan.
      indexes.push({
        key: Object.fromEntries(partial.keys.map((key) => [key, 1])),
        name: `ix_${table}_${partial.keys.join('_')}`.slice(0, 120),
      });
      continue;
    }

    indexes.push({
      key: Object.fromEntries(partial.keys.map((key) => [key, 1])),
      name: `uq_${table}_${partial.keys.join('_')}_partial`.slice(0, 120),
      unique: true,
      partialFilterExpression: partial.filter,
    });
  }

  // Foreign keys are how nearly every read in this app filters — resources by
  // team, submissions by team, the ledger feed by team. Postgres had these
  // indexed as a side effect of the constraint; MongoDB has no constraint to
  // ride on, so they are declared.
  for (const fk of table_schema.foreignKeys) {
    const name = `ix_${table}_${fk.column}`.slice(0, 120);
    if (indexes.some((index) => index.name === name)) continue;
    indexes.push({ key: { [fk.column]: 1 }, name });
  }

  return { indexes, app_enforced };
}

function mongoTypeFor(format) {
  if (format === 'uuid' || format === 'text') return 'string';
  if (NUMERIC_FORMATS.has(format)) return 'number';
  if (DATE_FORMATS.has(format)) return 'date';
  return 'string';
}

/**
 * One dumped row, in the shape it should land in MongoDB.
 *
 * ## Why the UUIDs stay strings
 *
 * The obvious move is to turn every `id` into an `ObjectId`, and it would be a
 * mistake. Half the identifiers in this database are load-bearing *outside* it:
 * `resource_ledger.idempotency_key` is a v5 UUID computed from a submission id
 * by `awardKeyFor`, and the grading code recomputes it to decide whether a team
 * has already been paid. Remap the ids and every one of those keys stops
 * matching its own history — the ledger would accept a second payout for work
 * it had already paid for. Strings preserve every reference, in both databases,
 * for free.
 */
export function coerceRow(row, table_schema) {
  const out = {};

  for (const [column, value] of Object.entries(row)) {
    const format = table_schema?.columns[column]?.format;

    if (value !== null && value !== undefined && DATE_FORMATS.has(format)) {
      const parsed = new Date(value);
      out[column] = Number.isNaN(parsed.getTime()) ? value : parsed;
      continue;
    }

    if (value !== null && typeof value === 'string' && NUMERIC_FORMATS.has(format)) {
      const parsed = Number(value);
      out[column] = Number.isFinite(parsed) ? parsed : value;
      continue;
    }

    out[column] = value;
  }

  // A single-column primary key becomes `_id`, so the uniqueness Postgres
  // guaranteed is guaranteed here too and a re-run of the migration cannot
  // double-insert. The original column is kept: application code, and every
  // foreign key in the other 47 tables, still refers to it by name.
  const [pk, ...rest] = table_schema?.primaryKey ?? [];
  if (pk && rest.length === 0 && out[pk] !== null && out[pk] !== undefined) {
    out._id = out[pk];
  }

  return out;
}

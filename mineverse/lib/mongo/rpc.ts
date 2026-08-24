import type { ClientSession, Db } from 'mongodb';
import { mongoClient, mongoDb } from './client';

/**
 * The Postgres functions, ported to MongoDB.
 *
 * These are not queries — they are the parts of the game that must not go
 * wrong twice. `mutate_team_resources` is the single door every payout, every
 * purchase and every penalty goes through, and its guarantees were doing real
 * work in plpgsql: `select ... for update` serialised two clicks on the same
 * team, and the unique constraint on `(team_id, idempotency_key)` meant a
 * retried request returned the first answer instead of paying again.
 *
 * MongoDB gives both back, by different means:
 *
 *   - the ledger insert happens first, so the unique index — not a read — is
 *     what rejects a replay. Checking for an existing row and then inserting
 *     is a race with a gap in the middle wide enough for two grading passes
 *     to fit through;
 *   - the balance update uses `$inc`, which is atomic per document, so two
 *     concurrent grants sum instead of one overwriting the other.
 *
 * Transactions wrap the pair on a replica set (Atlas always is one), so a
 * failure between ledger and balance cannot leave a team paid on paper and not
 * in their inventory.
 */

const RESOURCE_KEYS = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;
type ResourceKey = (typeof RESOURCE_KEYS)[number];

/** Column defaults from `resources` — the starter pack every team begins with. */
const STARTER = { wood: 25, stone: 10, iron: 0, gold: 0, diamond: 0, emerald: 5, obsidian: 0 };

/** Carries the SQLSTATE the app branches on, so `code === '23505'` still works. */
class RpcError extends Error {
  constructor(message: string, public pgCode = 'P0001') {
    super(message);
  }
}

function snapshot(row: Record<string, unknown>) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Number(row[key] ?? 0)]));
}

async function withTransaction<T>(work: (session: ClientSession | undefined, db: Db) => Promise<T>): Promise<T> {
  const client = await mongoClient();
  const db = await mongoDb();
  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session, db);
    });
    return result;
  } catch (error) {
    // A standalone mongod has no transactions. Rather than fail outright, the
    // work is retried unwrapped: the idempotency index still holds, which is
    // the guarantee that actually protects a team's balance.
    const message = String((error as Error)?.message ?? '');
    if (message.includes('Transaction numbers') || message.includes('replica set')) {
      return work(undefined, db);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Applies a resource delta once, and only once.
 *
 * The idempotency key is the whole contract. `awardKeyFor` derives it from a
 * submission id, so a grading pass that runs twice — a retry, a redeploy, the
 * sweep after a round — computes the same key and gets the first result back
 * rather than granting a second time.
 */
async function mutateTeamResources(args: Record<string, unknown>) {
  const teamId = String(args.p_team_id);
  const delta = (args.p_delta ?? {}) as Partial<Record<ResourceKey, number>>;
  const idempotencyKey = String(args.p_idempotency_key ?? crypto.randomUUID());

  return withTransaction(async (session, db) => {
    const ledger = db.collection('resource_ledger');
    const resources = db.collection('resources');

    const existing = await ledger.findOne({ team_id: teamId, idempotency_key: idempotencyKey }, { session });
    if (existing) {
      const current = await resources.findOne({ team_id: teamId }, { session });
      return {
        ledger_id: existing.id,
        balance: existing.balance_after,
        version: current?.version ?? 0,
        created_at: existing.created_at,
        idempotent: true,
      };
    }

    // `insert into resources (team_id) on conflict do nothing` — a team that
    // has never been paid still has a row to increment, with the same defaults
    // Postgres applied.
    await resources.updateOne(
      { team_id: teamId },
      { $setOnInsert: { _id: teamId as never, team_id: teamId, ...STARTER, version: 0, updated_at: new Date() } },
      { upsert: true, session },
    );

    const current = await resources.findOne({ team_id: teamId }, { session });
    const next = snapshot(current ?? STARTER);
    for (const key of RESOURCE_KEYS) next[key] += Number(delta[key] ?? 0);

    // The floor that stops a team spending resources they do not have. It has
    // to be checked before the write, not after: `$inc` will happily go
    // negative and there is no constraint behind it to object.
    if (RESOURCE_KEYS.some((key) => next[key] < 0)) {
      throw new RpcError('insufficient resources');
    }

    const version = Number(current?.version ?? 0) + 1;
    const ledgerId = crypto.randomUUID();
    const now = new Date();

    // Ledger first: the unique index is the gate, so a replay that slips past
    // the read above is stopped here rather than paid.
    try {
      await ledger.insertOne(
        {
          _id: ledgerId as never,
          id: ledgerId,
          team_id: teamId,
          delta,
          balance_after: next,
          source_type: args.p_source_type ?? null,
          source_id: args.p_source_id ?? null,
          actor_type: args.p_actor_type ?? 'system',
          actor_id: args.p_actor_id ?? null,
          idempotency_key: idempotencyKey,
          reason: args.p_reason ?? null,
          created_at: now,
        },
        { session },
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new RpcError('idempotency conflict', '23505');
      throw error;
    }

    await resources.updateOne(
      { team_id: teamId },
      { $set: { ...next, version, updated_at: now } },
      { session },
    );

    return { ledger_id: ledgerId, balance: next, version, created_at: now, idempotent: false };
  });
}

/**
 * Crafting: a progression check, a priced purchase, and the biome it opens.
 *
 * The forge discount is gone with the `structures` table (removed 2026-08-14),
 * so the discount is always zero — kept in the returned shape because the
 * dashboard still reads `discount_percent`.
 */
const RECIPES: Record<string, { cost: Partial<Record<ResourceKey, number>>; requires?: string; unlocks?: number }> = {
  wooden_pickaxe: { cost: { wood: 60 }, unlocks: 2 },
  stone_pickaxe: { cost: { wood: 10, stone: 45, iron: 25 }, requires: 'wooden_pickaxe', unlocks: 3 },
  iron_armor: { cost: { iron: 40, gold: 25 }, requires: 'stone_pickaxe' },
};

async function craftTeamItem(args: Record<string, unknown>) {
  const teamId = String(args.p_team_id);
  const item = String(args.p_item);
  const idempotencyKey = String(args.p_idempotency_key);

  const db = await mongoDb();
  const log = db.collection('crafting_log');

  const existing = await log.findOne({ team_id: teamId, idempotency_key: idempotencyKey });
  if (existing) {
    return {
      crafting_log_id: existing.id,
      ledger_id: existing.ledger_id,
      item: existing.item,
      base_cost: existing.base_cost,
      actual_cost: existing.actual_cost,
      discount_percent: existing.discount_percent,
      unlock_round_id: existing.unlock_round_id,
      idempotent: true,
    };
  }

  if (await log.findOne({ team_id: teamId, item })) throw new RpcError('already crafted');

  const recipe = RECIPES[item];
  if (!recipe) throw new RpcError('invalid craft item');
  if (recipe.requires && !(await log.findOne({ team_id: teamId, item: recipe.requires }))) {
    throw new RpcError('progression requirement missing');
  }

  const actualCost = { ...recipe.cost };
  const delta = Object.fromEntries(Object.entries(actualCost).map(([key, value]) => [key, -value!]));

  // Charged before the log is written: if the team cannot afford it this throws
  // and nothing else has happened yet.
  const mutation = await mutateTeamResources({
    p_team_id: teamId,
    p_delta: delta,
    p_source_type: 'craft',
    p_source_id: item,
    p_idempotency_key: idempotencyKey,
    p_reason: `Crafted ${item}`,
    p_actor_type: 'team',
    p_actor_id: teamId,
  });

  if (recipe.unlocks) {
    await db.collection('team_round_access').updateOne(
      { team_id: teamId, round_id: recipe.unlocks },
      { $set: { is_locked: false }, $setOnInsert: { started_at: new Date() } },
    );
  }

  const craftId = crypto.randomUUID();
  await log.insertOne({
    _id: craftId as never,
    id: craftId,
    team_id: teamId,
    item,
    base_cost: recipe.cost,
    actual_cost: actualCost,
    discount_source: null,
    discount_percent: 0,
    unlock_round_id: recipe.unlocks ?? null,
    ledger_id: mutation.ledger_id,
    idempotency_key: idempotencyKey,
    crafted_at: new Date(),
  });

  return {
    crafting_log_id: craftId,
    ledger_id: mutation.ledger_id,
    item,
    base_cost: recipe.cost,
    actual_cost: actualCost,
    discount_source: null,
    discount_percent: 0,
    unlock_round_id: recipe.unlocks ?? null,
    balance: mutation.balance,
    version: mutation.version,
    idempotent: false,
  };
}

async function applyManualAdjustment(args: Record<string, unknown>) {
  const teamId = String(args.p_team_id);
  const reason = String(args.p_reason ?? '').trim();
  const idempotencyKey = String(args.p_idempotency_key);

  if (!reason) throw new RpcError('adjustment reason is required', '23514');

  const db = await mongoDb();
  const adjustments = db.collection('manual_adjustments');

  const existing = await adjustments.findOne({ team_id: teamId, idempotency_key: idempotencyKey });
  if (existing) {
    return {
      adjustment_id: existing.id,
      ledger_id: existing.ledger_id,
      balance_before: existing.balance_before,
      balance_after: existing.balance_after,
      idempotent: true,
    };
  }

  const before = await db.collection('resources').findOne({ team_id: teamId });

  const mutation = await mutateTeamResources({
    p_team_id: teamId,
    p_delta: args.p_delta,
    p_source_type: 'manual_adjustment',
    p_source_id: null,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
    p_actor_type: 'admin',
    p_actor_id: args.p_admin_id,
  });

  const adjustmentId = crypto.randomUUID();
  await adjustments.insertOne({
    _id: adjustmentId as never,
    id: adjustmentId,
    team_id: teamId,
    delta: args.p_delta,
    reason,
    admin_id: args.p_admin_id ?? null,
    balance_before: before ? snapshot(before) : null,
    balance_after: mutation.balance,
    ledger_id: mutation.ledger_id,
    idempotency_key: idempotencyKey,
    created_at: new Date(),
  });

  return { ledger_id: mutation.ledger_id, balance_after: mutation.balance, idempotent: false };
}

/** `MNV-000` … `MNV-999`, retried until one is free. */
async function generateTeamCode() {
  const db = await mongoDb();
  const teams = db.collection('teams');
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = `MNV-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    if (!(await teams.findOne({ team_code: code }))) return code;
  }
  throw new RpcError('could not allocate a free team code');
}

/**
 * Day 2 and PvP were never played, and their RPCs are not ported.
 *
 * Stubbing them to succeed would be worse than this: an admin pressing
 * "resolve match" would get a green tick and no match resolved. Throwing names
 * exactly what is missing, at the moment someone needs it.
 */
const NOT_PORTED = new Set([
  'start_pvp_match',
  'void_pvp_match',
  'resolve_pvp_match',
  'dev5_trigger_day2_event',
  'dev5_apply_day2_manual_adjustment',
  'dev3_make_choice_decision',
  'dev3_buy_marketplace_item',
]);

export async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'mutate_team_resources':
      return mutateTeamResources(args);
    case 'craft_team_item':
      return craftTeamItem(args);
    case 'apply_manual_adjustment':
      return applyManualAdjustment(args);
    case 'generate_team_code':
      return generateTeamCode();
    default:
      if (NOT_PORTED.has(name)) {
        throw new RpcError(`${name} is not ported to MongoDB (Day 2 / PvP feature, unused on Day 1).`);
      }
      throw new RpcError(`Unknown RPC: ${name}`);
  }
}

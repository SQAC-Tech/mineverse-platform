import { mongoPostgrest } from '@/lib/mongo/postgrest';

/**
 * The server-side database handle. Now MongoDB, behind the old name.
 *
 * 371 call sites in 78 files import this, and every one of them speaks
 * PostgREST — `.from().select().eq().single()`, `{ data, error }` back. Rather
 * than rewrite them, `lib/mongo/postgrest.ts` implements that surface against
 * MongoDB and this module points at it. The export keeps its name so nothing
 * downstream has to change, and so the diff of this migration is readable.
 *
 * The Postgres functions live in `lib/mongo/rpc.ts`. `mutate_team_resources`
 * matters most: it is the one door every payout goes through, and its
 * idempotency is what stopped this event paying teams twice.
 */
/**
 * Typed loosely on purpose.
 *
 * The generated `Database` types described Postgres tables that this client no
 * longer talks to. Re-deriving them from MongoDB is worth doing, but not in the
 * same change that moves the data — a type error in one of 78 files would stop
 * the migration for a reason that has nothing to do with whether it works.
 */
export const supabaseServer = mongoPostgrest;

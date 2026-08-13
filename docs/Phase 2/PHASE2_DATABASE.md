# MINEVERSE — Phase 2 Database Engineering Document

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 1 Gameplay Schema and Mutation Rules

**Prerequisite:** Phase 1 schema and service-role, deny-all RLS pattern  
**Mechanics source:** `../event details/Mineverse_Full_Event_Details.md`

This document is a schema contract, not permission to edit Phase 1 migrations. Phase 2 uses three append-only, ordered migrations so each developer can work independently.

## 1. Migration order and ownership

| Order | File | Owner | Tables / responsibility |
|---:|---|---|---|
| 01 | `20260714_01_dev4_questions_resources_crafting.sql` | Dev 4 | questions, submissions, resources, resource_ledger, crafting_log |
| 02 | `20260714_02_dev3_guardians_structures.sql` | Dev 3 | structures, guardian_battles, transactions, choice_decisions, team_game_state |
| 03 | `20260714_03_dev5_grading_events_ops.sql` | Dev 5 | grading_runs/items, world_events/effects, offline_results, online PvP matches/results, manual_adjustments |

Migrations must be additive, use `IF NOT EXISTS` only where it is genuinely safe, and be applied in a clean staging database before event-day use. Generate Supabase types only through a coordinated foundation update; individual Phase 2 developers do not modify `types/**`.

## 2. Entity map

```
teams ──< submissions >── questions ──> rounds
  │             │
  │             └── grading_items ──> grading_runs
  ├── resources ──< resource_ledger
  ├── crafting_log
  ├── structures ──< structure_repairs
  ├── guardian_battles
  ├── transactions ──< item_uses
  ├── choice_decisions
  ├── team_game_state
  ├── team_event_effects >── world_events
  ├── offline_results
  └── pvp_results
```

The online PvP subtree is `pvp_matches` → `pvp_match_teams`, `pvp_match_questions`, and `pvp_match_submissions`, with a resolved `pvp_results` projection. It supplements the entity map above.

All team-owned rows reference `teams(id)` with `ON DELETE CASCADE`. Round-owned rows reference the existing `rounds(id)`. Phase 1 round state remains authoritative.

## 3. Table specifications

### 3.1 Questions and submissions (Dev 4)

`questions` stores `round_id`, type, public prompt, display order, optional language/runtime metadata, reward JSON, auto-grade strategy, rubric, expected answer, and hidden test cases. The answer/rubric/test fields are never selected for team responses. Unique `(round_id, order_index)` prevents ambiguous ordering.

`submissions` has one current row per `(team_id, question_id)`. Required fields are answer/code/language as applicable, `revision`, `status` (`draft`, `submitted`, `locked`, `graded`, `manual_review`), `submitted_at`, `locked_at`, `final_score`, `graded_by`, `graded_revision`, and feedback. A unique final-grade reference prevents the same revision being awarded twice. Keeping a separate submission revision history is recommended if answer-dispute replay is needed.

### 3.2 Resources and ledger (Dev 4)

`resources` is the current balance projection: Wood, Stone, Iron, Gold, Diamond, Emerald, Obsidian, `updated_at`, and optimistic version. It is seeded for eligible teams with the canonical starting inventory.

`resource_ledger` is append-only and has: id, team, signed JSON resource delta, balance-after snapshot, source type, source id, actor type/id, idempotency key, created timestamp, and a human-readable reason. It has a unique `(team_id, idempotency_key)` and indexes on team/time and source. A balance must be derived only from successful, locked ledger operations.

### 3.3 Crafting (Dev 4)

`crafting_log` records team, item, calculated base cost, discounted actual cost, active discount source, resulting unlock/state, source ledger entry, and timestamp. Unique `(team_id, item)` prevents duplicate progression crafting. Phase 2 items are Wooden Pickaxe, Stone Pickaxe, and Iron Armor; Diamond Pickaxe is reserved for Phase 3.

### 3.4 Structures and guardians (Dev 3)

`structures` stores one base selection per team/round, type, state (`active`, `damaged`, `repaired`, `upgraded`, `consumed`), built/updated timestamps, and the upgrade lineage. A partial unique index on `(team_id, round_id)` for base choices enforces one free choice; upgrades modify the row or reference its base, not a second contradictory active choice.

`guardian_battles` stores team, round, guardian name, attempt number, status, question-set version, started/completed times, score, retry-after, victory reward ledger reference, defeat penalty ledger reference, and consumed-item references. Constraints enforce one claimed victory per team/guardian/round and let failed attempts remain auditable.

`transactions` and `item_uses` separate purchase from consumption. This supports a totem/retry token/strength/revival item being bought now and used later exactly once. `choice_decisions` has unique `(team_id, choice_key)` and records selected option, resource delta ledger reference, and timestamp.

`team_game_state` is the Phase 2 handoff row: Nether Core count, armor/PvP eligibility, `qualified_for_day2`, qualification freeze id/time, and optional elimination reason. It is not a public leaderboard score.

### 3.5 Grading, events, and operations (Dev 5)

`grading_runs` records round, state (`queued`, `running`, `completed`, `failed`, `cancelled`), initiated admin, cursor/batch metadata, provider/model metadata, error, and timestamps. Only one active run per round is allowed.

`grading_items` records submission/revision, run, deterministic or rubric path, raw provider metadata (protected), validated result, state, error, final score, and resulting ledger reference. Unique `(submission_id, revision)` ensures exactly-once finalization.

`world_events` records canonical event key, round, targeted teams or all-teams scope, effect, start/end, trigger admin, and lifecycle. `team_event_effects` is the derived per-team modifier/protection outcome and expires naturally; it does not overwrite historical awards.

`offline_results` records a volunteer-verified physical-game result: team, canonical activity, round, award, volunteer/admin identity, idempotency key, ledger reference, and notes.

Online Round 3 PvP uses a durable match model, not a bracket. `pvp_matches` stores the approved question-pack version, status (`draft`, `live`, `resolved`, `expired`, `cancelled`, `voided`), server start/deadline/resolution timestamps, created/started/resolved/voided admin ids, void reason, replay-of id, and audit correlation id. `pvp_match_teams` stores exactly two distinct teams per match, their eligibility snapshot, completion timestamp, and winner/loser outcome. `pvp_match_questions` stores the sealed pack snapshot and display order; expected answers/test data remain server-only. `pvp_match_submissions` records revisions/validation state without exposing opponent data.

`pvp_results` is the immutable resolved projection used by qualification: match id, winner team, loser team, winner elapsed milliseconds, award ledger id, resolution time, and source. Qualification reads a team as PvP-eligible only when it is the stored winner. The projection is created only by the match-resolution transaction; an online match never uses a browser-supplied outcome. `manual_adjustments` requires the admin, non-empty reason, requested delta, ledger reference, and confirmation time.

## 4. Atomic mutation contract

Every resource-changing API path calls one server-side RPC/transaction that:

1. Locks the team resource row.
2. Checks and records the idempotency key before mutating.
3. Validates sufficient balance for a cost, never allowing a negative balance.
4. Applies score scaling and any active modifier using the documented rounding rule.
5. Updates `resources` and inserts `resource_ledger` in the same transaction.
6. Returns the resulting balance and the immutable ledger id.

No route handler may update `resources` directly. Award sources include final grading, guardian victory, offline result, marketplace bundle, and manual adjustment. Deduction sources include craft, purchase, guardian penalty, world event, repair, choice, and manual adjustment. A grader override changes only the difference between the already-final score and the replacement score.

## 5. Rule enforcement

| Rule | Database/application enforcement |
|---|---|
| One submission per team/question | unique `(team_id, question_id)` plus revision/final-grade guard |
| No post-lock revision | API verifies Phase 1 round/access; `locked_at` is immutable after set |
| One base structure per relevant round | partial unique base-choice index |
| Guardian victory claimed once | unique successful claim index |
| One event/choice result per team | unique team/event and team/choice keys |
| No duplicate offline payout | unique team/activity/round/idempotency key |
| PvP is exactly a private duel | exactly two distinct `pvp_match_teams` per match; no public join route or bracket table |
| No concurrent or duplicate PvP result | partial unique active-match team index; unique final Round 3 result per team; unique resolved match id |
| Fair PvP timing | server `started_at`/completion timestamps only; sealed pack snapshot and result transaction compares elapsed milliseconds |
| Qualification cannot drift | qualification confirmation is immutable once frozen; an override is a new audited decision |

## 6. RLS, indexes, and retention

Follow Phase 1: enable RLS on every new table and create no direct browser policy. The service role is used only in authenticated server routes. Index the operational lookups: question round/order; submission team/question and round/status; ledger team/created; event round/window; grading run state; guardian team/round; and qualification state. Keep ledger, grading, and admin audit records through the event and post-event review; they are not disposable cache data.

## 7. Seed and data-handling rules

- Seed questions only after organizers approve final content, expected answers, rubric, supported languages, and hidden cases.
- Seed no production answer keys into a public client bundle, README, or test fixture accessible to attendees.
- Seed initial resources once with a conflict-safe insert.
- Configure world-event definitions in a server-only canonical catalog; the database logs a triggered instance, not a mutable rule template.
- Exercise migrations against a copy of Phase 1 before applying to the event project.

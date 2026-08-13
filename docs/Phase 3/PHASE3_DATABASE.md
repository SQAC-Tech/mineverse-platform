# MINEVERSE — Phase 3 Database Engineering Document

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 2 Portal, Final Boss & Winner-Certification Schema

**Prerequisite:** Phase 1 schema and Phase 2 Day 1 gameplay schema are applied.  
**Rule:** Phase 3 migrations are additive. Do not edit Phase 1/2 migration files or replace their resource ledger contract.

## 1. Migration order and ownership

| Order | File | Owner | Responsibility |
|---:|---|---|---|
| 04 | `20260714_04_dev3_portal_boss_winner.sql` | Dev 3 | portal state, boss attempts, winner claims/certifications |
| 05 | `20260714_05_dev4_end_questions_crafting.sql` | Dev 4 | Round 5 question metadata, submission extensions, Diamond Pickaxe craft state |
| 06 | `20260714_06_dev5_day2_ops.sql` | Dev 5 | offline Day 2 results, event instances/effects, reconciliation/manual audit |

The number prefix assumes the Phase 2 `01–03` migration sequence. Confirm actual migration timestamps/names before implementation and preserve ordering rather than copying these literal names blindly.

## 2. Entity map

```
Phase 2 team_game_state ──< portal_progress ──< portal_activity_results
              │
              ├──< final_boss_attempts ──< final_boss_answers
              │             └── winner_claims ──< winner_certifications
              │
              ├──< submissions >── questions (Round 5)
              ├── crafting_log (Diamond Pickaxe)
              ├── resources ──< resource_ledger
              ├──< team_event_effects >── world_events
              └──< day2_reconciliations
```

The frozen Phase 2 `qualified_for_day2` field remains the admission authority. Phase 3 reads it; it does not reset it.

## 3. Tables and constraints

### 3.1 Portal progress and verified activities (Dev 3/5)

`portal_progress` is one row per team and includes: team id, qualification snapshot/decision id, Nether Core count (read from the Phase 2 `team_game_state` handoff), portal-fragment count, verified Diamond count at evaluation, state (`locked`, `collecting`, `ready`, `repaired`), repaired timestamp, and repair ledger/reference ids. A unique team key prevents duplicate portal state.

`portal_activity_results` records only operator-verified Round 4 results: team, canonical activity key, activity kind (`individual`, `pvp`), outcome, award JSON, Portal Fragment delta, operator/volunteer identity, idempotency key, source ledger id, and timestamp. Unique `(team_id, activity_key, idempotency_key)` stops retries; a stricter unique team/activity rule is used for activities that may be played only once.

Portal repair is an atomic state transition. It locks the progress and resource rows, verifies the Nether Core ×1, at least one Portal Fragment, and 15 Diamonds, sets `repaired_at` once, and writes the unlock/audit reference. It does not consume the core, fragment, or diamonds unless a later organizer-approved rule explicitly changes the mechanics.

### 3.2 Final Boss attempts (Dev 3)

`final_boss_attempts` records team, configured boss-pack version, status (`started`, `submitted`, `victory`, `defeat`, `invalidated`), attempt number, starts/submits/completes timestamps, cooldown-until, score summary, validation/provider metadata, and links to reward/penalty ledger rows if any. Constraints allow unlimited attempts but one active attempt per team and a unique valid victory claim per team.

`final_boss_answers` stores attempt, question id/version, encrypted/protected answer or code reference, grading result, and evaluator metadata. Hidden question content and test cases remain server-only. It is not directly readable by attendee clients.

An attempt can start only if the team is qualified, portal repaired, Diamond Pickaxe crafted, and not inside cooldown. A defeat writes `cooldown_until = server_now + 3 minutes`; a victory is final for that team.

### 3.3 Winner claims and certification (Dev 3)

`winner_claims` captures every valid boss-victory candidate: team, attempt id, server completion timestamp with high precision, claim state (`provisional`, `superseded`, `pending_tiebreak`, `certified`, `rejected`), rule-validation snapshot, and created time. A partial unique index permits at most one current provisional candidate, acquired transactionally by earliest valid timestamp.

`winner_certifications` is immutable decision history: certification id, winning team, claim id, state (`certified`, `pending_tiebreak`, `overturned`), verifier, reason, final ordering snapshot, decision time, and linked reconciliation. Corrections create a new certified/overturned audit row; they never overwrite history.

### 3.4 Round 5 questions and crafting (Dev 4)

Use Phase 2 `questions` and `submissions` rather than creating parallel copies. Extend only as needed for Round 5: a server-only question-pack version, logic-puzzle selection metadata, execution runtime/version, and a final-question visibility window. Enforce seven organizer-approved questions: 3 coding, 2 logic, and 2 debug/output.

`crafting_log` gains the `diamond_pickaxe` item only through an additive enum/check migration. It records base/actual cost, active Forge discount if one persists, source ledger entry, and unlock timestamp. Unique `(team_id, item)` prevents a second Diamond Pickaxe.

### 3.5 Events and reconciliation (Dev 5)

Phase 2 `world_events`/`team_event_effects` are extended or reused with canonical Day 2 keys: `chorus_fruit_blessing`, `enderman_ambush`, and `dragons_fury`. A `dragons_fury` instance deducts 10 Diamonds from each targeted qualified team whose boss-attempt state shows no started Final Boss attempt (the “weakened” flag); protected teams record a zero-effect protection entry. An event instance stores start/end, target scope, initiator, lifecycle, effect snapshot, and source audit. The +2 Emerald modifier is tied to each qualifying coding award within the stored window; it cannot retroactively replay past rewards.

`day2_reconciliations` records an operator’s final check: team, resource/ledger version inspected, portal status, Diamond Pickaxe status, boss status, discrepancies, resolver, state, and timestamps. It is a prerequisite link for champion certification, not a mutable score table.

`day2_manual_adjustments` uses the Phase 2 ledger pattern and requires an authenticated admin, non-empty reason, approval/confirmation state, idempotency key, delta, balance-after, and ledger id.

## 4. Shared atomic operations

| Operation | Transactional requirement |
|---|---|
| Record offline result | Validate qualified team + canonical activity; apply award once through resource RPC; insert outcome and ledger link together. |
| Repair portal | Lock progress/resources; verify Nether Core, Portal Fragment, and Diamonds; set repaired exactly once; create audit/unlock reference. |
| Craft Diamond Pickaxe | Validate portal state/progression; deduct full calculated cost once; log craft and unlock boss together. |
| Resolve boss | Lock active attempt; verify server-side score/time; set victory or cooldown; insert candidate claim for victory in one transaction. |
| Certify winner | Recheck immutable prerequisite snapshots and reconciliation; insert certification without overwriting previous history. |

All resource modifications call the Phase 2 resource/ledger RPC. No route handler may update a balance directly. Reused idempotency keys return the prior completed result and never produce a second ledger row.

## 5. RLS, indexes, and retention

Enable RLS on every new table and create no browser direct-access policy. API routes use Phase 1 service-role access after session/scope validation. Index: portal by team/state, activity by team/time, boss attempt by team/status/cooldown, winner claim by state/completed time, certification by state/time, and reconciliation by team/state. Retain boss answers, ledger references, and winner certification records through post-event dispute resolution.

## 6. Seed and configuration rules

- Organizers approve Round 5 question content, logic variants, allowed Piston runtimes, boss packs, and test cases before a server-only seed.
- The Insta lollipop/soap activity gets a configuration record only if organizers set an explicit award; do not fabricate a default.
- Portal requirement is exactly Nether Core ×1, 1 Portal Fragment, and 15 Diamonds.
- Diamond Pickaxe cost is exactly 25 Iron, 20 Gold, 100 Diamonds, and 10 Emeralds before any persisted Forge discount policy.
- Dragon’s Fury is a canonical Day 2 event key (`dragons_fury`): -10 Diamonds unless the team has started at least one Final Boss attempt. It uses the same event-instance model as Chorus/Enderman; no separate weakening table exists.

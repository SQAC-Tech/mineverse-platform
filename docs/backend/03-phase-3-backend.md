# Phase 3 Backend — Day 2 Gameplay (planning stage — builds after Phase 2)

**Status: not built yet.** This translates `../Phase 3/PHASE3_MASTER.md`, `PHASE3_API.md`, and `PHASE3_DATABASE.md`. Same rule as the Phase 2 doc: when you need an exact field name or edge case, go to those files — this is the plain-language tour.

Read [00-how-the-backend-works.md](./00-how-the-backend-works.md), [01-phase-1-backend.md](./01-phase-1-backend.md), and [02-phase-2-backend.md](./02-phase-2-backend.md) first. **Phase 3 changes nothing about the stack.** It reuses Phase 1's cookies and Phase 2's resource ledger contract exactly. It is purely additive — new tables, new routes, zero edits to Phase 1 or Phase 2 migration files.

## What Phase 3 actually is, in one sentence

Day 2 has 2 rounds (Round 4 Nether Portal Repair, Round 5 The End), reachable **only** by teams Phase 2 marked `qualified_for_day2`, ending in a Final Boss fight where the first team to win — server-timestamped, to the millisecond — is the certified champion.

## The single most important rule of Phase 3

> **Every Day 2 team-facing route checks `qualified_for_day2` (the flag Phase 2 froze) before doing anything else, server-side.** A non-qualified team gets a generic `403 DAY2_NOT_QUALIFIED` and learns nothing else — not who did qualify, not why they didn't.

This check happens on literally every route under `/team/day2/**`, `/team/portal`, `/team/final-boss/**` — never assume the frontend hiding a locked-out UI is enough.

## Who owns what

| Dev | Owns | Does NOT own |
|---|---|---|
| **Dev 3** | Portal repair state, the End Merchant one-time choice, the entire Final Boss lifecycle (start/submit/resolve/cooldown), the Day 2 access gate, winner certification | Round 5 question delivery/submissions/crafting, offline result entry, event triggers |
| **Dev 4** | Round 5 question delivery + submissions (reusing Phase 2's `questions`/`submissions` tables), the resources read model, Diamond Pickaxe crafting, the final leaderboard view | Portal/boss domain, all organizer operations |
| **Dev 5** | Recording Round 4's offline/physical results, Round 5 grading operations, triggering Chorus Fruit Blessing / Enderman Ambush / Dragon's Fury, final reconciliation before certification | Team-facing question/boss UI, craft logic |

## New database tables (three more migrations, additive on top of Phase 2's)

```
Phase 2's team_game_state (already has: Nether Core count, qualified_for_day2)
  │
  ├──< portal_progress ──< portal_activity_results     [Dev 3 state / Dev 5 records results]
  ├──< final_boss_attempts ──< final_boss_answers        [Dev 3]
  │         └── winner_claims ──< winner_certifications  [Dev 3]
  ├──< submissions >── questions (Round 5, reused from Phase 2) [Dev 4]
  ├── crafting_log gains the diamond_pickaxe item          [Dev 4]
  ├──< team_event_effects >── world_events (reused, new keys) [Dev 5]
  └──< day2_reconciliations                                [Dev 5]
```

Reuse, don't duplicate: Round 5 questions live in Phase 2's existing `questions`/`submissions` tables (extended with a Round-5-specific version/visibility window), not a parallel copy. Same for the resource ledger — Phase 3 never invents a second balance system, it calls the exact same Phase 2 award/deduct function.

## The Day 2 flow, stage by stage

### 1. Portal repair (Round 4 — entirely offline/volunteer-run)

Round 4's actual mini-games (Crack the Code, Cup Flip, Memory Challenge, etc.) are physically run by volunteers — **the platform never runs them live**. Its job is to record the *verified result* and track whether the portal is repaired:

```
GET /team/portal
  → { state: "collecting", nether_core: 1, portal_fragments: 1,
      diamonds: 12, diamonds_needed: 3, repaired_at: null }
      (nether_core comes from the Day-1 PvP handoff — Phase 2's winner award)

Volunteer records a game result at the table
  → POST /admin/day2/offline/results
      { activity, team, outcome, award, volunteer_identity, idempotency_key }
      pays exactly once per (team, activity)

POST /team/portal/repair  (team-initiated, once they believe they qualify)
  → accepts NO resource counts from the client at all — the server alone
    checks: Nether Core x1 + at least 1 Portal Fragment + 15 Diamonds
  → 422 PORTAL_REQUIREMENTS_UNMET (names the missing piece) if short
  → otherwise sets repaired_at once, atomically
  → repeating the call again returns 409 PORTAL_ALREADY_REPAIRED
        or the original idempotent success — repair does NOT consume the
        Nether Core/Fragment/Diamonds under the current event rule
```

### 2. Round 5 — The End (team-facing coding/logic/debug questions)

Same mechanism as Phase 2's question rounds (`GET /rounds/[round_id]/questions`, `POST /submissions`), gated additionally on Day 2 qualification and portal repair. Seven organizer-approved questions: 3 coding, 2 logic, 2 debug/output. The **End Merchant** is a one-time optional trade (`GET/POST /team/choices/**`, extended for Round 5): trade 5 Emeralds → 18 Diamonds, or 12 Diamonds → 4 Emeralds, or skip — server validates the team can afford it and that they haven't already chosen.

### 3. Craft the Diamond Pickaxe, unlock the Final Boss

```
POST /team/craft { item: "diamond_pickaxe" }
  cost: 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds
  → same atomic craft function as Phase 2 (validate → deduct → log → unlock)
  → 422 if short on resources, 403 if Day 2 gate not met, 409 if already crafted
```

### 4. Final Boss — the actual winner-decision code, read this one twice

```
GET /team/final-boss
  → current availability, active attempt (if any), cooldown, victory state

POST /team/final-boss/attempts
  → validates: qualified_for_day2, portal repaired, Diamond Pickaxe crafted,
    Round 5 active, no active cooldown
  → returns an attempt id + ONLY that attempt's active question — never
    future boss packs, never hidden test cases

POST /team/final-boss/attempts/[id]/submit
  → validates ownership of the attempt, that it hasn't expired, that it
    hasn't already been submitted (one submission per attempt)
  → routes scoring through the same grading path as everything else
  → DEFEAT: writes cooldown_until = server_now + 3 minutes, returns retry_after
  → VICTORY: writes a completion record — but this is only "provisional,"
    never a self-certified win (see next step)
```

**Winner determination is deliberately a two-step process** — a victorious attempt does not immediately declare a global winner:

```
Every valid boss victory creates a row in winner_claims:
  { team, attempt_id, server completion timestamp (millisecond precision),
    state: 'provisional' }

A partial unique index allows AT MOST ONE current 'provisional' claim,
acquired transactionally by whichever valid victory has the EARLIEST
server timestamp — this is what makes "first team to win" actually mean
first, even if two victories are written to the database milliseconds apart.

If two completion timestamps are truly, exactly identical (astronomically
rare, but planned for): BOTH records freeze in a 'pending_tiebreak' state,
and a human organizer makes the final call through an explicit,
audited tie-break decision. The system never silently picks one by
sorting on a client-supplied clock.

An admin then reviews reconciliation (below) and calls
POST /admin/winner/... to move a claim to 'certified' — this creates
an immutable winner_certifications row. A later correction is a NEW
certified/overturned row, appended to history — it never edits or
deletes a past certification.
```

### 5. World events specific to Day 2

Same trigger mechanism as Phase 2 (`POST /admin/day2/events/trigger`), three new canonical keys only:

- `chorus_fruit_blessing` — +2 Emeralds per qualifying coding submission, but *only* within a fixed 5-minute server window; it can never retroactively apply to answers submitted before or after that window.
- `enderman_ambush` — an immediate, atomic -8 Diamonds.
- `dragons_fury` — -10 Diamonds, but **only** for teams whose `final_boss_attempts` shows no attempt has been *started* yet (win or lose — starting counts as "weakened"). A team that has already attempted the boss is protected and gets a recorded zero-effect entry instead of a silent no-op, so the audit trail is complete either way.

### 6. Reconciliation, before certifying anyone

Before an admin can certify a winner, `day2_reconciliations` records one operator's final sanity check per team: resource ledger version, portal status, Diamond Pickaxe status, and boss status, all cross-checked. This is a deliberate manual gate — winner certification is not allowed to be a fully automatic process on the platform's biggest, highest-stakes moment.

## Error shape

Same structured-code pattern as Phase 2:

```json
{ "success": false, "error": { "code": "FINAL_BOSS_LOCKED", "message": "Craft the Diamond Pickaxe to unlock the Final Boss." } }
```

## Realtime + polling

Same "notification, not authority" pattern: `portal_progress_changed`, `day2_resource_changed`, `day2_event_started`, `day2_event_expired`, `final_boss_resolved`, `winner_provisional`, `winner_certified` are all just "go re-fetch" signals. Every active team/admin view also polls at least every 10 seconds. None of these broadcasts ever carry answer data.

## Shared/frozen files

Same list as Phase 1 and 2, **plus every Phase-2-owned file** — Phase 3 must not edit Phase 1 or Phase 2's routes, components, or migrations. Integration happens exclusively through documented API responses and the shared resource-ledger function.

## Before you start building

`../event details/Mineverse_Full_Event_Details.md` is still the ground truth for every reward number and rule, same as Phase 2.

# MINEVERSE — Phase 3 API Guide
## Day 2 Portal, The End, Final Boss & Results Endpoints

**Base path:** `/api`  
**Team auth:** Phase 1 `session_token` cookie  
**Admin auth:** Phase 1 `panel_session` cookie with `admin` scope  
**Mutation rule:** Resource/state-changing endpoints require a validated idempotency key and return the prior result when retried.

Every team endpoint checks `qualified_for_day2` server-side before any other Day 2 read or mutation. All team/resource identifiers come from the session, never from the request body.

## 1. Day 2 state and portal APIs — Dev 3

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/team/day2/status` | Qualified status, carried inventory summary, portal/boss/certification state |
| GET | `/team/portal` | Read verified Portal Repair progress and missing requirements |
| POST | `/team/portal/repair` | Atomically repair when requirements are satisfied |
| GET/POST | `/team/choices/**` | Read and commit the one End Merchant choice |
| GET | `/team/final-boss` | Current boss availability, active attempt, cooldown, victory state |
| POST | `/team/final-boss/attempts` | Start a valid Final Boss attempt |
| POST | `/team/final-boss/attempts/[id]/submit` | Submit an active boss attempt |
| GET/POST | `/admin/winner/**` | Candidate review, reconciliation, certification, tie-break resolution/export |

### 1.1 `GET /team/day2/status`

Returns a safe summary only for the current qualified team: resource balance/version, portal state, Round 5 availability, Diamond Pickaxe state, boss state/cooldown, and certified result if published. A non-qualified session receives `403 DAY2_NOT_QUALIFIED`; it does not learn the qualified list.

### 1.2 `GET /team/portal` and `POST /team/portal/repair`

The read endpoint returns verified progress such as:

```json
{
  "success": true,
  "data": {
    "state": "collecting",
    "nether_core": 1,
    "portal_fragments": 1,
    "diamonds": 12,
    "diamonds_needed": 3,
    "repaired_at": null
  }
}
```

The repair endpoint accepts no resource counts from the client. It atomically checks the Nether Core ×1 (from the Day 1 PvP handoff), 1 fragment, and 15 Diamonds, returns `422 PORTAL_REQUIREMENTS_UNMET` (naming the missing requirement) if needed, and otherwise returns repaired state/time. Repeat repair returns `409 PORTAL_ALREADY_REPAIRED` or the original idempotent response. Repair does not consume its requirements under the current event rule.

### 1.3 End Merchant choice

The existing team-choice family is extended by Dev 3 for Round 5. It accepts one canonical option and no client-supplied effect: trade 5 Emeralds for 18 Diamonds; trade 12 Diamonds for 4 Emeralds; or ignore with no cost/reward. The server validates Day 2/round state, sufficient resources for a trade, a one-choice-per-team rule, and idempotency. It returns `409` for a completed choice.

### 1.4 Final Boss attempt flow

`POST /team/final-boss/attempts` has no trusted team or score fields. It validates qualification, repaired portal, Diamond Pickaxe craft, active Round 5, and cooldown. Success returns an attempt id and only the active question payload. It never exposes hidden tests or future boss packs.

`POST /team/final-boss/attempts/[id]/submit` accepts the typed/code answers associated with that active attempt. The server validates ownership, expiry, and one-time submission; then routes controlled scoring through the approved grading path. A defeat returns a server `retry_after`; a victory returns a provisional completion record, never a self-certified champion. `429` is reserved for cooldown.

## 2. The End question, resource, and craft APIs — Dev 4

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/rounds/[round_id]/questions` | Reused Phase 2 endpoint; safe Round 5 question delivery |
| GET/POST | `/submissions/**` | Reused Phase 2 submission lifecycle for Round 5 |
| GET | `/team/resources` | Reused balance/modifier read model |
| GET | `/team/resources/history` | Reused paginated ledger history |
| GET | `/team/craft/recipes` | Shows Diamond Pickaxe eligibility/cost |
| POST | `/team/craft` | Crafts `diamond_pickaxe` atomically |
| GET | `/leaderboard?scope=final` | Read-only final standings after publication rules permit it |

The existing endpoint families retain their Phase 2 authorization and hidden-answer guarantees. Round 5 calls add Day 2 qualification and portal-repaired checks. Craft request payload remains `{ "item": "diamond_pickaxe" }`; the server derives all cost, discount, and progression state. It returns `422` for insufficient resources, `403` for unmet Day 2 gate, and `409` if already crafted.

## 3. Day 2 admin operations — Dev 5

| Method | Endpoint | Purpose |
|---|---|---|
| POST/GET | `/admin/day2/offline/**` | Record/review Round 4 individual and PvP outcomes |
| POST/GET | `/admin/day2/grade/**` | Create/resume/status Round 5 grading runs and manual review |
| POST/GET | `/admin/day2/events/**` | Trigger/status/expire Chorus Fruit Blessing and Enderman Ambush |
| POST/GET | `/admin/day2/resources/**` | Audited manual adjustment and ledger lookup |
| POST/GET | `/admin/day2/reconciliation/**` | Verify final team states prior to winner certification |

### 3.1 Offline results

`POST /admin/day2/offline/results` accepts canonical activity key, current qualified team(s), individual/PvP outcome, configured award, volunteer identity, notes, and idempotency key. The server validates the exact activity/outcome rule and creates one linked ledger result. It rejects a team that is not Day 2 qualified or a duplicate activity outcome.

### 3.2 Grading and events

Grading endpoints keep Phase 2’s durable run semantics: lock through existing round controls first, create/resume a run, expose provider/manual-review state, and apply score deltas once. Do not use fire-and-forget provider work.

`POST /admin/day2/events/trigger` accepts only `chorus_fruit_blessing`, `enderman_ambush`, or `dragons_fury` and valid current-round scope. It persists event state before broadcast. The positive modifier applies only to qualifying coding awards within the five-minute server window; the ambush uses atomic immediate deductions. `dragons_fury` deducts 10 Diamonds only from targeted teams with no started Final Boss attempt (server-read weakened flag); protected teams get a recorded zero-effect entry.

### 3.3 Reconciliation and winner routes

An admin reconciliation records resource ledger version, portal repair, Diamond Pickaxe, and boss state for a team. Dev 3’s `/admin/winner/**` routes consume that record to certify a winner. Resource adjustment cannot set portal, boss, or winner state.

## 4. Error envelope

```json
{
  "success": false,
  "error": {
    "code": "FINAL_BOSS_LOCKED",
    "message": "Craft the Diamond Pickaxe to unlock the Final Boss."
  }
}
```

| Status | Examples |
|---:|---|
| 400 | Invalid payload, unknown canonical activity/event, invalid state transition |
| 401 | Missing/invalid session or panel cookie |
| 403 | Not qualified, wrong admin scope, Day 2 route access denied |
| 404 | Entity absent or hidden from caller |
| 409 | Already repaired/crafted/claimed, duplicate logical action, stale version |
| 422 | Missing portal requirements, insufficient resources, unmet boss prerequisite |
| 429 | Boss cooldown or endpoint rate limit |
| 500 | Unexpected error; provider/internal detail stays server-side |

## 5. Realtime and polling

Broadcast names include `portal_progress_changed`, `day2_resource_changed`, `day2_event_started`, `day2_event_expired`, `final_boss_resolved`, `winner_provisional`, and `winner_certified`. Notifications contain no answer data. Every team and admin view re-fetches authoritative status after a notification and polls at least every ten seconds during active operations.

# MINEVERSE — Phase 2 API Guide

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 1 Gameplay Endpoints

**Base path:** `/api`  
**Team auth:** Phase 1 `session_token` cookie  
**Admin auth:** Phase 1 `panel_session` cookie, `scope=admin`  
**Data access:** server routes only; service-role Supabase client; deny-all RLS

Every mutating request uses Zod validation. Resource-affecting requests require an `Idempotency-Key` request header (UUID) or a body `idempotency_key` validated as UUID; retrying the same request returns the original completed result.

## 1. Team round APIs — Dev 4

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/rounds/[round_id]/questions` | Safe question list for an active, unlocked team round |
| GET | `/submissions/me?round_id=` | Current team’s submissions/status for a round |
| POST | `/submissions` | Create or revise a submission while the round is open |
| GET | `/team/resources` | Current balance, active modifiers, version, server timestamp |
| GET | `/team/resources/history?cursor=` | Paginated ledger rows for current team |
| GET | `/team/craft/recipes` | Available recipes, discounted display costs, eligibility |
| POST | `/team/craft` | Atomically craft a progression item |
| GET | `/leaderboard` | Organizer-approved public, non-sensitive ranking |
| GET/POST | `/team/pvp/**` | Read the current private match, submit its answers, and retrieve the final result |

### 1.1 `GET /rounds/[round_id]/questions`

The server derives team id from the cookie and verifies the Phase 1 round/access record. Response contains only public fields and team state:

```json
{
  "success": true,
  "data": {
    "round_id": 2,
    "ends_at": "2026-07-14T07:00:00Z",
    "questions": [{
      "id": "uuid",
      "type": "aptitude",
      "content": "...",
      "order_index": 1,
      "submission_status": "draft"
    }]
  }
}
```

Expected failures: `401` missing/invalid team session; `403` team has no access, round locked, or expired; `404` unknown round. Expected answers, rubric, reward internals, and test cases are never returned.

### 1.2 `POST /submissions`

```json
{
  "question_id": "uuid",
  "answer_text": "optional text",
  "code": null,
  "language": null
}
```

The request proves the question belongs to the active round, validates the type-specific answer, and stores a new revision. It returns `200` with `submission_id`, `revision`, and `status: "submitted"`; it never self-awards a resource. `409` means an idempotency/revision conflict, and `403` means the answer is no longer editable.

### 1.3 `GET /team/resources` and history

Current balance returns all canonical resources, active event modifiers with an expiry, and the ledger version. History returns signed deltas, source/reason, balance-after, and timestamps—not another team’s data or protected grader metadata. Clients may subscribe to Realtime but must poll this endpoint every ten seconds during gameplay.

### 1.4 `POST /team/craft`

```json
{ "item": "stone_pickaxe" }
```

The server validates the item, round/progression, base craft state, structure discount, sufficient resources, and idempotency. Success returns the actual cost, ledger id, resulting balance, and unlocked state. `400` indicates invalid item/state; `409` an already-crafted item or stale version; `422` insufficient resources. The documented recipe remains authoritative: Wooden Pickaxe 60 Wood; Stone Pickaxe 10 Wood + 45 Stone + 25 Iron; Iron Armor 40 Iron + 25 Gold.

### 1.5 Private Round 3 PvP match

`GET /team/pvp/current` returns only the authenticated team’s active or latest resolved match. Before `live`, it exposes status and a display-safe countdown only. During `live`, it returns the server-snapshotted prompt/order for that team’s match, server deadline, own submission state, and no answer key, opponent identity, opponent answers, or opponent progress. `POST /team/pvp/submissions` accepts one answer for a visible match question and an idempotency key; the server verifies membership, `live` status, deadline, and that the question belongs to the match before recording it.

The server records a team’s completion only when every required answer in the selected pack is correct. It resolves winner/loser from server completion times; the shortest elapsed time wins. `GET /team/pvp/current` returns the final result and own award only after resolution. Clients must not calculate the result or completion time. A `409` covers no active match, already-final answer, or duplicate final PvP result; a `403` covers a team attempting to access another match or a non-live pack.

## 2. Strategy APIs — Dev 3

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/team/guardian/**` | Read, start, submit, and resolve guardian attempts |
| GET/POST | `/team/structures/**` | Read base choices, build free structure, upgrade, repair, use TNT ability |
| GET/POST | `/team/marketplace/**` | Browse, purchase, and use a server-defined item |
| GET/POST | `/team/choices/**` | Read and commit one Ancient Shrine/Piglin Merchant choice |
| GET/POST | `/admin/qualification/**` | Review eligibility, confirm/freeze/export Day 2 qualification |

Guardian/structure/marketplace/choice routes all require team session, appropriate active round, and idempotency for mutations. Guardian start/submit responses may include only the team’s active question data; no unseen guardian packs or answer keys. An active cooldown returns `429` with `retry_after`. A claimed reward/used consumable returns `409`.

Qualification routes require the admin cookie. The confirmation request includes an explicit cutoff and reason; success returns a decision id and frozen qualified-team count. It must reject teams without Iron Armor and a winning online PvP result.

## 3. Admin game-operations APIs — Dev 5

| Method | Endpoint | Purpose |
|---|---|---|
| POST/GET | `/admin/grade/**` | Create/resume/status grading run; list manual review; apply audited override |
| POST/GET | `/admin/events/**` | Trigger/status/expire canonical world events |
| POST/GET | `/admin/offline/**` | Enter/review verified physical-game outcomes |
| POST/GET | `/admin/pvp/**` | Select teams, create/start/monitor/void private Round 3 PvP matches |
| POST/GET | `/admin/resources/**` | Audited manual adjustment and balance/ledger lookup |

These endpoints independently verify the `admin` panel scope; a page-level proxy is not sufficient. No endpoint accepts an admin identity supplied by the browser as authority.

### 3.1 Grading operations

`POST /admin/grade/runs` accepts `{ "round_id": 1 }` only after the existing Phase 1 round control has locked the round. It creates or returns a durable run and does not rely on fire-and-forget processing. `GET /admin/grade/runs/[id]` shows queue states, batch progress, failures, and manual-review counts. `POST /admin/grade/overrides` accepts a submission, target score, and non-empty reason; it writes only the resource delta from the previous final grade.

### 3.2 World events

`POST /admin/events/trigger` accepts a canonical event key and optional valid target scope, not a browser-defined arbitrary effect. The server checks the active round and writes state before broadcasting. Canonical keys are `heavy_rain`, `fertile_marsh`, `creeper_explosion`, `gold_rush`, `lava_eruption`, and `ghast_bombardment`. Choice events are not triggered here; Dev 3 owns their team decisions.

### 3.3 Offline results, PvP operations, and manual adjustments

`POST /admin/offline/results` records a volunteer-verified physical game. It accepts a canonical activity, team, award, operator/volunteer attribution, notes, and idempotency key; it pays once.

`POST /admin/pvp/matches` creates a private Round 3 draft with exactly two selected team ids and an organizer-approved pack id. The server rejects the same team twice, missing Iron Armor, unmet mandatory Guardian requirement, a team in another active match, a team with a final PvP result, inactive Round 3, or a pack not approved for PvP. It creates a sealed question snapshot and audit record, not a bracket node.

`POST /admin/pvp/matches/[id]/start` is the **Start PvP** action. It can be called only by an admin for a valid draft; the transaction sets server `started_at` and `deadline_at`, transitions the match to `live`, and notifies only the selected teams. `GET /admin/pvp/matches/[id]` exposes both teams’ safe operational status and completion timestamps. `POST /admin/pvp/matches/[id]/void` requires a non-empty reason; it never changes a resolved result. Expired, cancelled, or voided matches receive no automatic award. A replay uses a new match id linked to the voided match.

`POST /admin/resources/adjustments` accepts a signed resource delta and non-empty reason. The server logs before/after balances, authenticated admin, and ledger reference. This endpoint cannot set qualification status.

## 4. Error envelope and statuses

```json
{
  "success": false,
  "error": {
    "code": "ROUND_LOCKED",
    "message": "This round is no longer accepting submissions."
  }
}
```

| Status | Examples |
|---:|---|
| 400 | Invalid payload, invalid canonical item/event, incorrect state transition |
| 401 | Missing or invalid required cookie |
| 403 | Wrong panel scope, round/team access denied, protected action |
| 404 | Resource not found or not visible to caller |
| 409 | Already consumed/claimed/crafted, stale version, duplicate logical action |
| 422 | Insufficient resources or unmet progression requirement |
| 429 | Guardian cooldown or route rate limit |
| 500 | Unexpected server failure; protected details are logged, not returned |

## 5. Realtime notifications

Broadcasts are notifications, not authoritative state. Team clients re-fetch server data after any of: `resource_changed`, `grading_completed`, `world_event_started`, `world_event_expired`, `guardian_resolved`, `structure_changed`, `pvp_match_started`, `pvp_match_resolved`, and `round_changed`. Only match participants receive PvP notifications. A ten-second poll recovers from missed events; the live PvP screen polls its match status every five seconds. Admin clients likewise re-fetch grading/event/PvP status after a broadcast.

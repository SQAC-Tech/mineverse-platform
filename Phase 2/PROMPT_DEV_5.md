# PROMPT: Developer 5 — Grading, World Events & Admin Game Operations
## For: Codex / Claude Code / Antigravity

**Context:** Build the operator-facing gameplay services for MINEVERSE Phase 2 Day 1. Preserve Phase 1’s contracts: Next.js 16 App Router, Zod 4, service-role server access, and `panel_session` with `admin` scope. Never introduce `x-admin-key`, `NEXT_PUBLIC_ADMIN_SECRET`, or a separate admin-auth system.

You own deterministic/LLM grading, world-event triggers, offline result entry, private online PvP match operations, manual adjustments, and their admin operations UI. The Day 1 event rules in `../event details/Mineverse_Full_Event_Details.md` are authoritative.

## The zero-conflict contract

Do not edit frozen Phase 1 files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/layout.tsx`, or `components/ui/**`.

```
YOURS (DEV 5)
  supabase/migrations/20260714_03_dev5_grading_events_ops.sql
  app/api/admin/grade/**
  app/api/admin/events/**
  app/api/admin/offline/**
  app/api/admin/pvp/**
  app/api/admin/resources/**
  app/admin/game-ops/page.tsx
  components/admin/grading/**
  components/admin/event-ops/**
  lib/grading/**
  lib/gameplay/events/**
  tests/unit/dev5/**

NOT YOURS
  app/(game)/round/**, app/api/rounds/**, app/api/submissions/**,
  app/api/team/resources/**, app/api/team/craft/**, app/api/leaderboard/**,
  components/game/questions/**, components/game/resources/**,
  components/game/crafting/**, components/game/round-shell/** (Dev 4)
  app/api/team/guardian/**, app/api/team/structures/**,
  app/api/team/marketplace/**, app/api/team/choices/**,
  app/api/admin/qualification/**, components/game/guardian/**,
  components/game/structures/**, components/game/marketplace/**,
  components/game/qualification/** (Dev 3)
```

Use the owned nested component directories. Do not add a generic `components/admin/grading-dashboard.tsx`, and do not edit Dev 4’s game shell to add admin controls.

## Part A: Migration and operational audit

Create only the third ordered migration. It owns grading queue/run metadata, world-event records/effects, offline result records, online PvP match/result records, and manual-adjustment audit records. It may reference Dev 3/4 tables but may not redefine them.

Every operator action must record the admin identity, reason where applicable, affected team(s), immutable before/after resource deltas, correlation/idempotency key, and timestamp. Resource changes must call Dev 4’s atomic resource/ledger contract; do not issue direct balance updates.

## Part B: Grading pipeline

### B.1 Deterministic grading — `lib/grading/**`

Output prediction uses a documented normalized exact comparison. Code completion/coding uses Piston only for organizer-approved language/runtime versions, strict request validation, bounded input/output, and a server timeout. Do not promise that arbitrary code is safe. If Piston is unavailable, preserve the submission and mark it for manual review rather than awarding a guessed result.

Debugging may use deterministic checks only where the organizer has supplied an exact rubric; otherwise it is queued for rubric grading. Grading must be idempotent per submission revision, so retries do not grant resources twice.

### B.2 Rubric grading

Use Groq only from the server. The request includes the question, sanctioned rubric, and team answer—not secrets, other teams’ answers, or browser-controlled instructions. Require a schema-validated structured response, clamp scores to 0–100, and retain raw response metadata/error state for audit. A malformed or unavailable response goes to `manual_review`; it must never silently become a zero or success.

Process one durable grading run at a time per round. The API returns a run id/status; it does not rely on fire-and-forget work surviving a Vercel request. If a production queue is not available, the UI must support bounded operator-run batches and explicit resume/retry. Manual score overrides calculate only the resource delta from the prior final score and require a reason.

### B.3 Admin grading APIs and UI — `app/api/admin/grade/**`, `components/admin/grading/**`

Validate admin scope in each route. The flow is: lock the selected round via the existing Phase 1 round control → create grading run → process deterministic submissions → process rubric queue → expose completed/failed/manual-review counts → authorize corrections. Do not independently change the round state.

## Part C: World events and offline operations

### C.1 World events — `app/api/admin/events/**`

Enforce the active round and canonical definitions:

| Round | Event | Effect |
|---|---|---|
| 1 | Heavy Rain | Wood rewards from coding questions doubled for 5 minutes; guardian rewards excluded |
| 2 | Fertile Marsh | Iron rewards from coding questions doubled for 5 minutes |
| 2 | Creeper Explosion | -5 Wood, -5 Stone and structure damage; Bat Cave prevents resource loss and receives warning |
| 3 | Gold Rush | Gold rewards from coding questions doubled for 5 minutes |
| 3 | Lava Eruption | -10 Gold, -5 Iron unless protected by Bastion |
| 3 | Ghast Bombardment | Damage one eligible structure; repair is handled by Dev 3 |

Persist start/end and target state before broadcast. Broadcast is supplemental; team clients must recover with polling. Positive modifiers apply only to awards earned during their active window; they do not retroactively alter previous awards. Do not implement choice events here—Dev 3 owns those team decisions.

### C.2 Offline and manual operations — `app/api/admin/offline/**`, `app/api/admin/resources/**`, `components/admin/event-ops/**`

Record only volunteer-verified Round 2 and 3 physical-game outcomes. Each result is submitted with team, round, canonical game name, award, volunteer/organizer identity, and idempotency key. The system must prevent a repeated form submission from paying twice.

### C.3 Online PvP operations — `app/api/admin/pvp/**`, `components/admin/event-ops/**`

Build the organizer-only private-match control, not a bracket builder. The flow is select exactly two Round 3 teams → verify both have Iron Armor and are not in another active/final PvP record → choose an organizer-approved question pack and configured duration → create draft → press **Start PvP**. Starting must atomically snapshot the approved pack, set server start/deadline times, and notify only those two teams.

Show match status without exposing answer keys: draft, live, each team’s safe completion state, resolved, expired, cancelled, or voided. The server resolves the winner from verified correct completion time; award only the winning team once with Nether Core ×1, +20 Gold, +15 Iron, +25 Stone, +4 Emerald. Do not let an admin type a winner or reward for a normal online match. A void requires a reason and cannot overwrite a resolved match; replay creates a new linked match. Do not generate a public bracket, public queue, or automatic pairing.

Manual resource adjustments require a non-empty reason and show a before/after confirmation. They do not mark a team qualified; Dev 3 owns qualification confirmation. The operations UI must make irreversible/high-impact actions explicit, show the audit result, and provide a safe failure state.

## Part D: Acceptance criteria

- [ ] Every admin route verifies the Phase 1 admin cookie; no header-based admin secret is used.
- [ ] Grading is revision-aware, schema-validated, resumable, and cannot double-award resources.
- [ ] Groq/Piston failure is visible and recoverable through manual review; no silent success/failure occurs.
- [ ] World events use the event-detail timing/protection rules and only affect valid active awards/teams.
- [ ] Offline entry, PvP creation/start/resolve/void, and manual adjustments are idempotent and produce complete audit records.
- [ ] The implementation does not change a round’s lock state, qualification state, or Dev 3/4-owned files.

**Do not build team question pages, resource/crafting views, guardians, structures, marketplace, choices, team-side PvP screens/submissions, or qualification decisions.**

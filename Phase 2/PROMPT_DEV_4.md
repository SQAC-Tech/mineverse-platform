# PROMPT: Developer 4 — Questions, Round Shell, Resources, Crafting & Leaderboard
## For: Codex / Claude Code / Antigravity

**Context:** Build the team-facing core of MINEVERSE Phase 2 Day 1. Phase 1 remains unchanged: Next.js 16 App Router, React 19, Tailwind v4, Zod 4, service-role server routes, team `session_token`, and scoped `panel_session` cookies. `../event details/Mineverse_Full_Event_Details.md` is the event-rule source of truth.

You own question delivery/submission, the game round shell, read-only resource presentation/history, crafting, the public leaderboard, and the team side of private online PvP. You do not own guardians, marketplace, grading, PvP match operations, or any other admin workflow.

## The zero-conflict contract

Do not edit frozen Phase 1 files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/layout.tsx`, or `components/ui/**`.

```
YOURS (DEV 4)
  supabase/migrations/20260714_01_dev4_questions_resources_crafting.sql
  app/(game)/round/[round_id]/page.tsx
  app/(game)/round/[round_id]/layout.tsx
  app/leaderboard/page.tsx
  app/api/rounds/[round_id]/questions/route.ts
  app/api/submissions/**
  app/api/team/resources/**
  app/api/team/craft/**
  app/api/team/pvp/**
  app/api/leaderboard/route.ts
  components/game/questions/**
  components/game/resources/**
  components/game/crafting/**
  components/game/pvp/**
  components/game/round-shell/**
  lib/gameplay/questions/**
  lib/gameplay/resources/**
  lib/gameplay/crafting/**
  lib/gameplay/pvp/**
  tests/unit/dev4/**

NOT YOURS
  app/api/team/guardian/**, app/api/team/structures/**,
  app/api/team/marketplace/**, app/api/team/choices/**,
  app/api/admin/qualification/**, components/game/guardian/**,
  components/game/structures/**, components/game/marketplace/**,
  components/game/qualification/** (Dev 3)
  app/api/admin/grade/**, app/api/admin/events/**, app/api/admin/offline/**, app/api/admin/pvp/**,
  app/api/admin/resources/**, components/admin/grading/**,
  components/admin/event-ops/**, lib/grading/** (Dev 5)
```

Never create flat `components/game/*.tsx` files. The three owned subtrees are intentional: they allow Dev 3’s strategic components and Dev 5’s admin components to merge cleanly.

## Part A: Migration and data contracts

Create only the first ordered Phase 2 migration. It owns `questions`, `submissions`, `resources`, `resource_ledger`, `crafting_log`, and the indexes/constraints they require. Seed starting inventory for every eligible team: 25 Wood, 10 Stone, 0 Iron, 0 Gold, 0 Diamond, 5 Emerald, 0 Obsidian.

Requirements:

- Questions must keep answer/test-case data server-only; `GET /questions` selects an allowlist of safe fields.
- `submissions` has a unique `(team_id, question_id)` row and records revision/lock/grade state. A resubmission replaces the pending draft; it cannot double-award.
- Resource changes use one atomic RPC/service function which updates the balance and writes an append-only `resource_ledger` entry with a source, reference id, delta, resulting balance, actor, idempotency key, and timestamp.
- Crafting is a single atomic operation: validate progression, apply an active Forge discount with a deterministic rounding rule, deduct once, write `crafting_log`, and unlock the next round only on success.
- Phase 1 uses server routes, so enable RLS but retain deny-all for these new tables; do not create `auth.uid()` policies for team browser access.

## Part B: Team gameplay

### B.1 Question delivery — `app/api/rounds/[round_id]/questions/route.ts`

Authenticate the team from the existing session and verify: requested round exists, Phase 1 has it active, it is unlocked for this team, and its end time has not passed. Return only question id, type, prompt/content, display order, language options, time limit, and the team’s submission status. Never return expected answers, rubric, hidden test cases, or rewards that should remain hidden.

The Day 1 question counts must match the event brief: R1 2 crossword + 6 aptitude + 2 output; R2 5 aptitude + 1 debugging + 1 code completion + 1 output; R3 2 debugging + 2 coding. The two R3 physical games are not questions in this API.

### B.2 Submissions — `app/api/submissions/**`

Validate payloads with Zod per question type. Use an upsert only while the team’s access and the round are active/unlocked; after the lock, return a safe 403. Record a pending submission without rewarding it. The grading route owned by Dev 5 is the only authority that writes a final score and resource award.

Support `GET /api/submissions/me?round_id=` for the round shell. It returns the team’s own response, revision status, grading state, score/feedback when available, and no answer key.

### B.3 Round shell — `app/(game)/round/[round_id]/**`

Build a mobile-first shell containing the authoritative countdown (from server-provided `ends_at`), question list/status, draft preservation, manual refresh plus 10-second fallback polling, and the `components/game/resources/**` bar/history. Local storage may hold unsubmitted drafts only; the server submission is authoritative.

Integrate Dev 3 and Dev 5 through their endpoints or stable component boundaries, without editing their files. If an endpoint is unavailable, display a bounded unavailable state—not a duplicate implementation.

### B.4 Resources and crafting — `app/api/team/resources/**`, `app/api/team/craft/**`

Provide a current balance and paginated ledger history. Use Supabase Realtime only as an enhancement; poll every 10 seconds as the event-day fallback. The UI must clearly differentiate balance, active modifiers, and pending grading.

Recipes:

| Item | Base cost | Result |
|---|---|---|
| Wooden Pickaxe | 60 Wood | unlocks Round 2 |
| Stone Pickaxe | 10 Wood + 45 Stone + 25 Iron | unlocks Round 3 |
| Iron Armor | 40 Iron + 25 Gold | marks PvP eligibility; does not itself qualify a team |

The Forge reduces future crafting costs by 10%, or 20% after Master Forge. Document and implement a single rounding rule (round each discounted resource cost up) so client display and server deduction cannot disagree.

### B.5 Public leaderboard — `app/api/leaderboard/route.ts`, `app/leaderboard/page.tsx`

Use only organizer-approved, non-sensitive fields. Its ranking must not claim to determine qualification; qualification is Dev 3’s explicit audited admin decision after a winning online PvP result. Refresh every 30 seconds and display the last-updated timestamp.

### B.6 Private online PvP — `app/api/team/pvp/**`, `components/game/pvp/**`

Build only the selected team’s match view and answer-submit routes; Dev 5 owns selecting teams and the **Start PvP** control. `GET /api/team/pvp/current` must derive the team from the session and return no match until the team is selected. Before start, show a waiting state. Once the server reports `live`, show only the sealed match’s safe questions, server deadline, own answer states, and a display timer. Submit answers through the dedicated PvP route, with match membership, live/deadline, and idempotency checks on the server.

Never expose answer keys, rubric/test cases, opponent answers, opponent resource state, or a live opponent-progress feed. The server resolves correct completion and elapsed time; the UI displays the result after resolution and polls every five seconds while a match is active. A refresh/reconnect must return the same server state, never restart or locally resolve the match.

## Part C: Acceptance criteria

- [ ] No Phase 1 auth, admin layout, package, types, or dashboard files are edited.
- [ ] Answer keys/test cases are absent from every team response and client payload.
- [ ] Round and team-access checks happen before every read/write, and a locked round cannot be revised.
- [ ] A duplicate request or revised answer cannot change a resource balance twice.
- [ ] Starting inventory, question counts, recipe costs, and Forge discounts match the event brief.
- [ ] Every balance change is traceable through the ledger; Realtime has a polling fallback.
- [ ] A selected team can safely wait, play, reconnect to, and view one private PvP match without seeing opponent/answer-key data or calculating the result client-side.
- [ ] Your files use only the owned directories above and do not overlap Dev 3/5.

**Do not build guardian battles, structures, marketplace, choice events, LLM/Piston grading, world-event triggers, offline-result entry, admin PvP match controls, or qualification UI.**

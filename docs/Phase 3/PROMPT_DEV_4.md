# PROMPT: Developer 4 — The End Questions, Resources, Diamond Pickaxe & Final Standings

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## For: Codex / Claude Code / Antigravity

**Context:** Extend your established Phase 2 team-game ownership for MINEVERSE Phase 3 Day 2. Preserve Phase 1/2 contracts: Next.js 16, existing team session, service-role routes, server-only answers/test cases, deny-all RLS, and the append-only resource ledger. The event brief at `../event details/Mineverse_Full_Event_Details.md` is authoritative.

You own Round 5 question delivery/submissions, resources presentation/history, Diamond Pickaxe crafting, The End shell, and read-only final standings. You do not own Portal Repair state, Final Boss attempts/certification, offline results, grading operations, or Day 2 events.

## The zero-conflict contract

Do not edit frozen/shared files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `proxy.ts`, `app/dashboard/**`, `app/admin/layout.tsx`, or `components/ui/**`.

You extend only the Phase 2 paths that Dev 4 already owns, plus these new Phase 3 paths:

```
YOURS (DEV 4)
  supabase/migrations/20260714_05_dev4_end_questions_crafting.sql
  app/(game)/round/[round_id]/**                 # existing Dev 4 tree; extend for Round 5
  app/leaderboard/**                              # existing Dev 4 tree; extend safely
  app/api/rounds/[round_id]/questions/**          # existing Dev 4 route tree
  app/api/submissions/**                          # existing Dev 4 route tree
  app/api/team/resources/**                       # existing Dev 4 route tree
  app/api/team/craft/**                           # existing Dev 4 route tree
  app/api/leaderboard/**                          # existing Dev 4 route tree
  components/game/questions/**
  components/game/resources/**
  components/game/crafting/**
  components/game/round-shell/**
  components/day2/end-round/**
  lib/gameplay/questions/**
  lib/gameplay/resources/**
  lib/gameplay/crafting/**
  tests/unit/dev4-phase3/**

NOT YOURS
  app/(day2)/portal/**, app/(day2)/final-boss/**,
  app/api/team/day2/**, app/api/team/portal/**,
  app/api/team/final-boss/**, app/api/admin/winner/**,
  components/day2/portal/**, components/day2/final-boss/**,
  components/day2/winner/**, lib/day2/access/**, lib/day2/portal/**,
  lib/day2/final-boss/**, lib/day2/winner/** (Dev 3)
  app/api/admin/day2/**, app/admin/day2-ops/**,
  components/admin/day2-ops/**, lib/grading/**, lib/day2/events/** (Dev 5)
```

## Part A: Migration and question pack

Create only migration `05`. Extend Phase 2 tables additively for Round 5 question-pack versioning, logic-puzzle selection metadata, supported runtime metadata, and `diamond_pickaxe` craft state. Do not create a parallel resource/submission schema.

The organizer-approved Round 5 pack contains exactly seven questions:

| Type | Count | Reward |
|---|---:|---|
| Easy LeetCode coding | 3 | +12 Diamonds |
| Logic puzzle | 2 | +10 Diamonds, +3 Emeralds |
| Debug + output | 2 | +10 Diamonds, +2 Emeralds |

Choose only two logic puzzles from N-Queens, Missionaries & Cannibals, Tower of Hanoi, and Sudoku Logic. Store the selected version server-side; never return unselected variants, expected answers, rubrics, or hidden test cases to clients.

## Part B: The End round shell and submissions

Extend your existing round shell rather than creating a second gameplay route. In addition to existing team-session/round-access checks, Round 5 must require Dev 3’s server-provided portal-repaired state. The shell shows authoritative server countdown, question status, saved drafts, resource balance, active modifiers, and polling fallback. It may link to Dev 3’s Final Boss route but must not reimplement it.

Submission writes remain revision-aware. Only the final locked revision can receive a grade/resource award through Dev 5’s grader. Team response payloads stay safe: no answer keys, test cases, model feedback internals, or other-team information.

## Part C: Resources, Diamond Pickaxe, and final standings

Reuse the Phase 2 resource/ledger model. It must display Day 2 event effects and all portal/offline/coding changes after server re-fetch. Do not add direct client database access or a second balance table.

`POST /api/team/craft` for `diamond_pickaxe` validates Day 2 qualification, portal repair, one-time craft state, and cost before a single atomic deduction/log/unlock. Base cost is 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds. If a Forge discount remains eligible by the agreed persisted Phase 2 rule, calculate it server-side using the existing round-up convention and return both base and actual costs.

The public final leaderboard can show only organizer-approved information and must label the result provisional until Dev 3 publishes a certified winner. It must not rank/certify a champion itself. Refresh periodically and show last-updated time.

## Part D: Acceptance criteria

- [ ] Phase 2 Dev 4 paths are extended without touching Dev 3/5 paths or frozen files.
- [ ] Round 5 team API responses expose exactly the selected seven questions and no hidden answer/test/rubric data.
- [ ] Portal-repaired and qualified gates are server-enforced before Round 5 question/submission/craft actions.
- [ ] Revisions and grading cannot award resources twice; the ledger stays authoritative.
- [ ] Diamond Pickaxe uses the exact canonical cost and is crafted/unlocked once atomically.
- [ ] Final leaderboard remains read-only/informative until a Dev 3 certification is published.

**Do not build Portal Repair, Final Boss, winner certification, volunteer/offline result screens, event triggers, manual adjustments, or Dragon’s Fury.**

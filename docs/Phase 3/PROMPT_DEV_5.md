# PROMPT: Developer 5 — Day 2 Offline Operations, Grading, Events & Reconciliation
## For: Codex / Claude Code / Antigravity

**Context:** Extend your Phase 2 admin-operations ownership for MINEVERSE Phase 3 Day 2. Keep Phase 1’s scoped `panel_session` admin authentication, server-only provider access, service-role routes, Zod validation, deny-all RLS, and Phase 2’s atomic resource-ledger contract. The event brief at `../event details/Mineverse_Full_Event_Details.md` is authoritative.

You own Round 4 offline result entry, Round 5 grading operations, Chorus Fruit/Enderman event operations, Day 2 manual adjustments, and reconciliation console. You do not own portal/boss/team gameplay or winner certification.

## The zero-conflict contract

Do not edit frozen/shared files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `proxy.ts`, `app/dashboard/**`, `app/admin/layout.tsx`, or `components/ui/**`.

```
YOURS (DEV 5)
  supabase/migrations/20260714_06_dev5_day2_ops.sql
  app/admin/day2-ops/**
  app/api/admin/day2/offline/**
  app/api/admin/day2/grade/**
  app/api/admin/day2/events/**
  app/api/admin/day2/resources/**
  app/api/admin/day2/reconciliation/**
  components/admin/day2-ops/**
  lib/day2/events/**
  lib/day2/reconciliation/**
  lib/grading/**                                  # established Dev 5 tree, extend for Round 5
  tests/unit/dev5-phase3/**

NOT YOURS
  app/(day2)/portal/**, app/(day2)/final-boss/**,
  app/api/team/day2/**, app/api/team/portal/**,
  app/api/team/final-boss/**, app/api/admin/winner/**,
  components/day2/portal/**, components/day2/final-boss/**,
  components/day2/winner/**, lib/day2/access/**, lib/day2/portal/**,
  lib/day2/final-boss/**, lib/day2/winner/** (Dev 3)
  app/(game)/round/**, app/api/rounds/**, app/api/submissions/**,
  app/api/team/resources/**, app/api/team/craft/**, app/api/leaderboard/**,
  components/game/**, components/day2/end-round/**,
  lib/gameplay/questions/**, lib/gameplay/resources/**,
  lib/gameplay/crafting/** (Dev 4)
```

Do not add another portal-repair endpoint, final-boss endpoint, or winner-selection algorithm. Your role records verified prerequisites and provides reconciliation evidence to Dev 3.

## Part A: Migration and audit rules

Create only migration `06`. It adds Day 2 operational result, event, manual-adjustment, and reconciliation records, referencing Phase 2 ledger rows and Dev 3/4 state without redefining their tables. Every record stores authenticated admin identity, volunteer identity where relevant, action time, idempotency key, reason/notes, and linked resource ledger entry.

All resource changes call the shared Phase 2 atomic mutation path. Never directly update balances from an API route or a bulk admin action.

## Part B: Round 4 offline operations

Only Day 2-qualified teams may receive a Round 4 record. Use canonical activities/outcomes:

| Activity | Outcome / reward |
|---|---|
| Memory Challenge | +10 Diamonds, Portal Fragment ×1 |
| Spot the Difference | +8 Diamonds, +2 Emeralds |
| Insta lollipop and soap | No automatic reward; require organizer-configured award before entry |
| Crack the Code | Win +8 Diamonds/+1 Emerald; loss +3 Diamonds |
| Cup Flip | Win +8 Diamonds/+1 Emerald; loss +3 Diamonds/+1 Emerald |

The operation form requires team(s), activity, outcome, volunteer, and idempotency key. It confirms the calculated award before recording. A repeated submission must show the prior result without issuing a second award. After accepted entry, notify clients; Dev 3’s portal status recalculates by server re-fetch. Note: the Nether Core needed for portal repair comes from the Day 1 PvP handoff — it is never a Round 4 award, and no offline entry may grant one.

## Part C: Round 5 grading and events

Extend your durable Phase 2 grading machinery, preserving revision-aware idempotency and manual-review behavior. An existing Round 5 lock from the Phase 1 admin round control is a prerequisite. Deterministic code/output grading uses controlled Piston execution; logic/rubric grading uses schema-validated server-only Groq calls. Provider failures must remain visible/resumable manual-review states and must not award a speculative score.

Events:

- **Chorus Fruit Blessing:** five-minute server window; +2 Emeralds for every qualifying coding challenge solved in that window.
- **Enderman Ambush:** immediate -8 Diamonds for targeted qualified teams, atomically and once.
- **End Merchant:** this is a team choice owned by Dev 3’s domain/API integration. Do not create a second operator trigger/decision path; support only documented state visibility if needed.
- **Dragon’s Fury:** organizer-triggered late-game negative event (`dragons_fury`). Deduct 10 Diamonds atomically and once from each targeted qualified team that has **not** started a Final Boss attempt; teams with any started attempt are “weakened the Dragon” protected. Read the weakened flag server-side from Dev 3’s boss-attempt state; record a zero-effect protection entry for protected teams.

Persist an event instance before broadcasting. Team screens must remain correct through Dev 4’s polling/refetch path even if broadcast fails.

## Part D: Adjustments and reconciliation

Manual adjustments require non-empty reason, requested delta, before/after confirmation, admin identity, idempotency key, and ledger link. They cannot repair a portal, craft a Diamond Pickaxe, resolve Final Boss, or set a winner.

Reconciliation gathers authoritative evidence for a candidate team: qualification snapshot, ledger version/balance, portal repaired, Diamond Pickaxe crafted, final-boss outcome, unresolved adjustments, and operator notes. It creates a durable completed/blocked record. Dev 3’s winner route reads this result but you do not certify or override the champion.

## Part E: Acceptance criteria

- [ ] Every route independently verifies the Phase 1 admin cookie/scope; no public/header admin secret exists.
- [ ] Round 4 activity/outcome rewards match the event brief; unspecified lollipop/soap reward cannot be invented.
- [ ] All entries, event effects, grade awards, and adjustments are idempotent and resource-ledger linked.
- [ ] Provider failures are visible/manual-review states; no fire-and-forget grading dependency exists.
- [ ] Chorus/Enderman/Dragon’s Fury behavior uses server event windows and correct eligible/targeted teams; the Dragon’s Fury protection check reads only server-side boss-attempt state.
- [ ] Reconciliation is evidence-only and cannot select a winner or alter Dev 3/4 state.

**Do not build Portal Repair, Round 5 team UI/submissions, Diamond Pickaxe, Final Boss, champion certification, or live online PvP.**

# PROMPT: Developer 3 — Day 2 Access, Portal Repair, Final Boss & Winner Certification
## For: Codex / Claude Code / Antigravity

**Context:** Build the strategic/final-state domain for MINEVERSE Phase 3 Day 2. Phase 1 and Phase 2 are established contracts: Next.js 16, React 19, Tailwind v4, Zod 4, service-role API routes, Phase 1 team/admin cookies, and Phase 2’s resource ledger and qualification snapshot. The event brief at `../event details/Mineverse_Full_Event_Details.md` is authoritative.

You own qualification gating for Day 2, Portal Repair state, the End Merchant team choice, Final Boss attempts, and winner certification. You do not own Round 5 question delivery, Diamond Pickaxe crafting, grading operations, or offline volunteer entry.

## The zero-conflict contract

Do not edit frozen/shared files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `proxy.ts`, `app/dashboard/**`, `app/admin/layout.tsx`, `components/ui/**`, or another developer’s Phase 2 ownership paths.

```
YOURS (DEV 3)
  supabase/migrations/20260714_04_dev3_portal_boss_winner.sql
  app/(day2)/portal/page.tsx
  app/(day2)/final-boss/page.tsx
  app/api/team/day2/status/route.ts
  app/api/team/portal/**
  app/api/team/choices/**                         # established Dev 3 tree; extend for End Merchant
  app/api/team/final-boss/**
  app/api/admin/winner/**
  components/day2/portal/**
  components/day2/final-boss/**
  components/day2/winner/**
  lib/day2/access/**
  lib/day2/portal/**
  lib/day2/final-boss/**
  lib/day2/winner/**
  tests/unit/dev3-phase3/**

NOT YOURS
  app/(game)/round/**, app/api/rounds/**, app/api/submissions/**,
  app/api/team/resources/**, app/api/team/craft/**, app/api/leaderboard/**,
  components/game/**, components/day2/end-round/**, lib/gameplay/questions/**,
  lib/gameplay/crafting/** (Dev 4)
  app/api/admin/day2/**, app/admin/day2-ops/**,
  components/admin/day2-ops/**, lib/grading/**, lib/day2/events/** (Dev 5)
```

Do not add a page inside Dev 4’s game-round directory or a generic `components/day2/*.tsx` file. Use the owned nested directories exactly.

## Part A: Migration and access gate

Create only migration `04`. It may add portal progress/activity links, boss attempts/answers, winner claims/certifications, and handoff state needed by your routes. It references the Phase 2 qualified-team snapshot and resource ledger but must not rewrite them.

Every Day 2 route you own uses a single server-only guard that:

1. Reads the Phase 1 team session.
2. Reads the frozen Phase 2 `qualified_for_day2` state/decision.
3. Returns a safe `403 DAY2_NOT_QUALIFIED` if absent.
4. Optionally validates the requested active Round 4/5 state through the existing round controls.

Do not edit `proxy.ts` to add this behavior. Page/API guards make the decision authoritative and avoid a frozen-file conflict.

## Part B: Portal Repair

Round 4 activities are offline and are entered by Dev 5. Your team status/portal UI reads only verified results and shows these states: locked, collecting, fragment missing, diamonds needed, ready, and repaired.

`POST /api/team/portal/repair` has no client resource counts. In a transaction it verifies: qualified team, Nether Core ×1 (from the frozen Phase 2 `team_game_state` handoff), one Portal Fragment, and at least 15 Diamonds; then records exactly one repaired timestamp/unlock reference. Current event rules do **not** consume the core, fragment, or Diamonds. Reused idempotency returns the existing successful result. The portal UI states include “core missing” alongside fragment/diamond gaps.

The UI must make it clear that volunteers, not the team, record Memory Challenge, Spot the Difference, Insta lollipop/soap, Crack the Code, and Cup Flip outcomes. Do not implement a self-entry route.

## Part C: Final Boss

Final Boss access requires all of: qualified team, repaired portal, Diamond Pickaxe crafted, active Round 5, and no cooldown. It uses organizer-approved server-held question packs/test cases only.

- `POST /attempts` starts one active attempt and returns only active public question payload.
- `/submit` verifies attempt ownership/time/state, invokes the agreed controlled scoring path, and resolves the attempt once.
- Failure writes a three-minute server cooldown; retries are unlimited after expiry while the main timer continues.
- Any started attempt (win or lose) marks the team as having **weakened the Dragon** — Dev 5’s Dragon’s Fury event reads this boss-attempt state server-side; you expose no separate weakening route.
- Success writes immutable server completion timestamp, score/validation evidence, and one provisional winner candidate in the same transaction.
- No team is told it is champion merely because it won a boss attempt; certification is separate.

### End Merchant choice

Extend your established team-choice route/domain for the one Round 5 End Merchant decision. It is available only to a qualified team in the valid event/round state and records exactly one of: 5 Emeralds for 18 Diamonds; 12 Diamonds for 4 Emeralds; or ignore with no effect. Use the shared atomic ledger path and an idempotency key. Dev 5 may display operation/event state but does not implement a competing choice route.

## Part D: Winner certification

Admin-only routes review provisional candidates and require a Dev 5 reconciliation record. Certification rechecks: Phase 2 qualification snapshot, repaired portal, Diamond Pickaxe craft, valid boss victory, and candidate ordering. It writes immutable certification history with verifier, reason, decision time, and linked evidence.

Use server completion time at millisecond precision. A genuine equal timestamp must transition to `pending_tiebreak`; expose an organizer-only documented tie-break decision route. Do not fall back to browser time, team name, row id, or public leaderboard rank.

## Part E: Acceptance criteria

- [ ] Every owned Day 2 route performs server-side qualification checks without modifying `proxy.ts`.
- [ ] Portal Repair requires exactly Nether Core ×1, 1 Portal Fragment, and 15 Diamonds, occurs once, and does not consume them under current rules.
- [ ] Final Boss has no hidden test/answer leak, enforces prerequisites and three-minute cooldown, and stores immutable attempts.
- [ ] End Merchant is a single explicit, atomic team choice with the canonical costs/rewards.
- [ ] At most one earliest valid provisional claim is created transactionally; tie state is explicit.
- [ ] Champion certification is admin-scoped, evidence-linked, immutable, and distinct from a team’s boss victory response.
- [ ] No Dev 4/5-owned files are edited.

**Do not build Round 4 entry forms, Round 5 question/submission UI, Diamond Pickaxe craft, grading queues, or Day 2 event triggers (including the Dragon’s Fury trigger — Dev 5 owns it; you only own the boss-attempt state it reads).**

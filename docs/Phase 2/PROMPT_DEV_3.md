# PROMPT: Developer 3 — Guardians, Structures, Marketplace & Qualification

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## For: Codex / Claude Code / Antigravity

**Context:** You are building the Day 1 gameplay features of MINEVERSE Phase 2. Phase 1 is already complete and remains the authority for stack, auth, routes, and security: Next.js 16 App Router, React 19, Tailwind v4, Zod 4, service-role Supabase routes, team `session_token`, and scoped `panel_session` cookies.

Your scope is the strategic gameplay layer: guardian attempts, free structures and upgrades, marketplace items, Round 2/3 choice events, and the final Day 1 qualification decision. The event brief at `../event details/Mineverse_Full_Event_Details.md` is authoritative for mechanics.

## The zero-conflict contract

Do not edit these frozen/shared files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/layout.tsx`, or `components/ui/**`.

```
YOURS (DEV 3)
  supabase/migrations/20260714_02_dev3_guardians_structures.sql
  app/api/team/guardian/**
  app/api/team/structures/**
  app/api/team/marketplace/**
  app/api/team/choices/**
  app/api/admin/qualification/**
  app/qualification/page.tsx
  components/game/guardian/**
  components/game/structures/**
  components/game/marketplace/**
  components/game/qualification/**
  lib/gameplay/guardians/**
  lib/gameplay/structures/**
  lib/gameplay/marketplace/**
  lib/gameplay/qualification/**
  tests/unit/dev3/**

NOT YOURS
  app/(game)/round/**, app/api/rounds/**, app/api/submissions/**,
  app/api/team/resources/**, app/api/team/craft/**, app/api/leaderboard/**,
  components/game/questions/**, components/game/resources/**,
  components/game/crafting/**, components/game/round-shell/** (Dev 4)
  app/api/admin/grade/**, app/api/admin/events/**, app/api/admin/offline/**,
  app/api/admin/resources/**, components/admin/grading/**,
  components/admin/event-ops/**, lib/grading/** (Dev 5)
```

Do not create generic files such as `components/game/guardian-battle.tsx` or `components/game/marketplace.tsx`; use the owned directories above. Dev 4 consumes your APIs/components from the round shell without modifying them.

## Part A: Migration and persistent state

Create the second ordered migration only. It may create/alter the tables needed by your routes: `structures`, `guardian_battles`, `transactions`, team choice decisions, and Day 1 qualification state. It must also support:

- one free base structure choice per team per relevant round;
- active/damaged/repaired/upgraded structure states and a repair audit;
- one claimable guardian victory reward per team/guardian/round, unlimited failed retries, and `retry_after` cooldown;
- consumable marketplace inventory (Totem, Retry Token, Revival Potion, Strength Potion) with a recorded use;
- a durable Nether Core / qualification state for Phase 3;
- idempotency keys for all resource-affecting mutations.

Use the resource mutation RPC/ledger contract documented in `PHASE2_DATABASE.md`; do not write direct resource `UPDATE`s from route handlers. Keep RLS deny-all and access these tables only through server routes.

## Part B: Team APIs and UI

All team routes must retrieve the team identity from the Phase 1 session server-side. Every request must additionally verify the round is active, unlocked for that team, and correct for the requested action.

### B.1 Guardians — `app/api/team/guardian/**`

Implement a start/submit/status flow.

- **Forest Guardian (Round 1):** optional, one coding challenge; victory `+25 Wood, +10 Stone, +3 Emerald`; defeat `-8 Wood, -3 Stone`.
- **Skeleton Archer (Round 2):** five rapid-fire questions within five minutes; victory requires all five correct and awards `+20 Iron, +15 Stone, +3 Emerald`; defeat `-10 Iron, -10 Stone`.
- **Blaze Guardian (Round 3):** mandatory for the qualification workflow — a team must defeat it before it is PvP-eligible. Canonical spec (event brief; reward values still need organizer sign-off before seeding): 3 hard questions in 7 minutes, all correct to win; victory `+12 Iron, +10 Gold, +2 Emerald`; defeat `-8 Iron, -5 Gold`. It does **not** award the Nether Core — that is the PvP victory award.
- A defeat sets a three-minute cooldown. A retry token bypasses the cooldown; a totem prevents one defeat penalty; a strength potion increases only the next guardian victory reward by 20%. Guardian rewards are claimable once.

The UI must show the current state, safe countdown, attempted/claimed state, rewards/penalty, and a clear retry action. Never send answer keys or hidden test cases to the client.

### B.2 Structures — `app/api/team/structures/**`

Base structures are **free**, unlock after ten minutes in Round 2, and teams choose one per round.

| Round | Choice | Effect |
|---|---|---|
| 2 | Bat Cave | Reveal one bonus challenge; prevents Creeper Explosion loss through advance warning |
| 2 | Forge | 10% reduction on all future crafting costs for the event |
| 3 | Bastion | Protects against negative Round 3 events while active |
| 3 | TNT Storage | Once, skip one question and receive 50% of its reward |

Implement post-round upgrades only when their base structure is present. Persist the upgrade rather than creating contradictory duplicate structures: Echo Bat Cave (10 Stone + 10 Iron), Master Forge (15 Iron + 10 Stone), Reinforced Bastion (20 Iron + 10 Gold), Mega TNT Storage (15 Iron + 15 Gold). A damaged structure has no effect until repaired. Repair prices come from the event brief: Creeper damage costs 8 Stone; Ghast damage is Bastion 10 Iron + 5 Gold or TNT Storage 10 Stone + 8 Iron.

### B.3 Marketplace and choices — `app/api/team/marketplace/**`, `app/api/team/choices/**`

Expose only the canonical price list from the event brief. Purchases must atomically deduct Emeralds, record the transaction, and grant/record the effect exactly once. Hints are question-scoped and return an approach, never an answer.

Record one explicit decision for each choice event:

- **Ancient Shrine (after Round 2):** 10 Wood → 2 Emeralds; 5 Iron → 15 Stone; ignore → lose 5 Wood and 3 Stone.
- **Piglin Merchant (Round 3):** 10 Gold → 3 Emeralds; 4 Emeralds → 18 Gold; ignore → lose 5 Gold.

### B.4 Qualification — `app/api/admin/qualification/**`, `app/qualification/page.tsx`

This is an admin-scoped workflow, not an automatic public leaderboard calculation. A team is eligible only after Iron Armor is crafted and it has won its private online PvP match. The organizer confirms the top-50% cutoff, then the system freezes and exports the qualified list. The audit record must preserve: eligibility checks, match/result source, cutoff, confirmed-by, timestamp, and reason for any override. The team-facing result must be a clear qualified or thank-you message.

## Part C: Cross-owner integration

- Dev 4 owns question delivery and crafting. Use its documented question status and craft result; do not edit its routes or screens.
- Dev 5 owns world-event triggers, offline result entry, and admin PvP match operations. Read their persisted records/API responses; do not implement another event or result-entry route.
- If you need a UI integration point, document the component/API contract in your PR rather than editing Dev 4’s round shell or Dev 5’s admin operations UI.

## Part D: Acceptance criteria

- [ ] All routes use Phase 1 cookie auth and server-side team/scope checks; no admin header secret exists.
- [ ] Guardian retries, cooldowns, consumables, rewards, and penalties are idempotent and auditable.
- [ ] Structures are free to build; upgrades and repairs use exactly the event-detail costs.
- [ ] A damaged structure’s protection/ability is inactive until repair.
- [ ] Marketplace and choice events cannot be bought/selected twice or overdraw resources.
- [ ] Qualification requires Iron Armor plus a winning online PvP result, then an explicit organizer confirmation of the 50% cutoff.
- [ ] Your files do not overlap Dev 4 or Dev 5 ownership.

**Do not build Day 2, online PvP match creation/start/submission UI, the grading pipeline, question/submission screens, resource bar, or crafting UI.**

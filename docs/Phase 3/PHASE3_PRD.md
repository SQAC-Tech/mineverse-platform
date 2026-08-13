# MINEVERSE Platform — Phase 3 PRD

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 2: Portal Repair, The End & Final Boss

**Version:** 1.0  
**Date:** 2026-07-14  
**Scope:** Day 2 only — Round 4 Nether Portal Repair and Round 5 The End  
**Prerequisites:** Phase 1 complete; Phase 2 qualification, resources, structures, artifacts, and audit records frozen  
**Mechanics authority:** `../event details/Mineverse_Full_Event_Details.md`

## 1. Product outcome

Phase 3 lets only Day 1-qualified teams complete Day 2. The platform records offline Portal Repair progress, delivers and grades the final technical round, enables Diamond Pickaxe crafting, resolves Final Boss attempts, and creates an auditable champion record.

Phase 2 owns the Day 1 online private PvP match system and its frozen results. Phase 3 reads that Day 1 audit history only; it does not alter, replay, or extend those matches.

The result is not “highest overall score.” The authoritative event rule is: the first team to defeat the Final Boss after crafting the Diamond Pickaxe is the MINEVERSE Champion.

## 2. Platform contracts

| Area | Requirement |
|---|---|
| Stack | Continue Phase 1: Next.js 16 App Router, React 19, Tailwind v4, Zod 4, Supabase. |
| Team auth | Existing Phase 1 team `session_token`; team id is derived server-side. |
| Admin auth | Existing Phase 1 `panel_session` with `admin` scope; never a request header secret. |
| Day 2 gate | `qualified_for_day2` from the frozen Phase 2 decision is required for every team Day 2 route. |
| Storage | API routes use service role; RLS is enabled and deny-all for Phase 3 tables. |
| Integrity | All mutations use Phase 2’s atomic resource ledger/idempotency contract. |
| Time | Server time controls round availability, portal/boss eligibility, cooldowns, and winner order. |

## 3. Day 2 user flows

### 3.1 Qualified-team entry

On return, a qualified team sees its carried resources, structures, persistent items/artifacts, and a Day 2 status panel. A non-qualified team sees a thank-you outcome only; it cannot call a Day 2 API or discover other teams’ state. An administrator can review but not casually rewrite the Phase 2 qualification snapshot.

### 3.2 Round 4 — Nether Portal Repair

Round 4 is conducted fully offline. Volunteers run the activities and an authorized operator records results once per team/activity. Teams can view verified rewards and their portal progress but cannot self-report outcomes.

| Activity | Format | Canonical result |
|---|---|---|
| Memory Challenge | Individual | +10 Diamonds and Portal Fragment ×1 |
| Spot the Difference | Individual | +8 Diamonds, +2 Emeralds |
| Insta lollipop and soap | Individual | Organizer-configured award only; the event brief supplies no number |
| Crack the Code | Offline PvP | Win: +8 Diamonds, +1 Emerald; loss: +3 Diamonds |
| Cup Flip | Offline PvP | Win: +8 Diamonds, +1 Emerald; loss: +3 Diamonds, +1 Emerald |

Portal repair occurs automatically and atomically only after the team has the Nether Core ×1 (won in the Day 1 PvP and carried through the Phase 2 handoff), at least one Portal Fragment, and 15 Diamonds. Repair consumes none of the three unless organizers explicitly amend the event mechanics; it records an activation state/time and unlocks Round 5 access. The status must distinguish “awaiting results,” “core missing,” “fragment missing,” “diamonds needed,” and “portal repaired.”

### 3.3 Round 5 — The End

The End is approximately 60 minutes and contains seven questions: 3 easy LeetCode-level coding, 2 logic puzzles, and 2 debug/output questions. The logic-puzzle pool is N-Queens, Missionaries & Cannibals, Tower of Hanoi, and Sudoku Logic; organizers select two per event/round, and unselected answers remain inaccessible to teams.

| Type | Reward |
|---|---|
| Easy LeetCode coding | +12 Diamonds |
| Logic puzzle | +10 Diamonds, +3 Emeralds |
| Debug + output | +10 Diamonds, +2 Emeralds |

Teams may revise responses only while the server reports the round active/unlocked. Deterministic output/code grading uses the Phase 2 controlled pipeline; rubric answers remain pending until the organizer starts a durable grading run. Team UI must show the difference between submitted, graded, manual-review, and locked states.

### 3.4 Day 2 events and choice

| Event | Rule |
|---|---|
| Chorus Fruit Blessing | Five minutes; each qualifying coding challenge solved during the window receives +2 Emeralds. |
| Enderman Ambush | Immediate -8 Diamonds per targeted qualified team. |
| End Merchant | One explicit choice per team: 5 Emeralds → 18 Diamonds; 12 Diamonds → 4 Emeralds; ignore → no effect. |
| Dragon’s Fury | Late-game negative event, organizer-triggered during the final phase of Round 5. -10 Diamonds per qualified team that has **not** weakened the Dragon. Weakened = the team has started at least one Final Boss attempt (win or lose). |

Events are written before broadcast and are recoverable through polling. The backend defines qualifying question types and event window; no client timestamp decides the reward.

### 3.5 Diamond Pickaxe and Final Boss

Diamond Pickaxe requires 25 Iron, 20 Gold, 100 Diamonds, and 10 Emeralds. A successful atomic craft records the exact cost/discount state and unlocks Final Boss access. A team without a repaired portal or Diamond Pickaxe cannot start a boss attempt.

The Final Boss uses organizer-approved LeetCode/HackerRank-style questions with server-held test cases. Retries are unlimited; each defeat starts a three-minute cooldown while the main Round 5 timer continues. A victory records server completion time, attempt id, verified score/test results, and a provisional winner claim in one transaction.

### 3.6 Winner certification

The earliest valid Final Boss victory is provisional until an admin reconciliation confirms the team is qualified, portal-repaired, Diamond-Pickaxe-crafted, and has a valid boss outcome. Certification freezes champion, runner-up ordering (if shown), decision time, verifier, and linked ledger/boss records. A tie or dispute creates a `pending_tiebreak` state and requires documented organizer resolution; no automatic client-side tie break exists.

## 4. Roles and ownership

| Owner | Scope |
|---|---|
| Dev 3 | Day 2 access gate, Portal Repair state, End Merchant choice, Final Boss attempt/resolve flow, champion certification domain/UI. |
| Dev 4 | Round 5 safe question delivery, submissions, resources views, Diamond Pickaxe craft, The End shell and final public leaderboard. |
| Dev 5 | Offline result entry, Round 5 grading operations, Day 2 world-event operations, manual audit/reconciliation console. |

The separate prompts specify exactly owned files and must be followed to avoid merge conflicts.

## 5. Non-functional requirements

- Do not leak answer keys, hidden test cases, exact boss packs, provider secrets, or another team’s private state.
- Idempotency is mandatory for every reward, deduction, portal repair, craft, boss resolution, and certification action.
- Realtime is optional enhancement; every client has a server fetch/poll fallback.
- The database persists audit records sufficient to replay a disputed resource change or winner determination.
- Error messages are safe and actionable to the relevant role; provider details remain server logs only.

## 6. Environment additions

The frozen Phase 1 environment validation layer must be extended only through a coordinated foundation decision before implementation.

```env
FINAL_BOSS_COOLDOWN_MINUTES=3
PORTAL_DIAMOND_REQUIREMENT=15
PORTAL_FRAGMENT_REQUIREMENT=1
PORTAL_NETHER_CORE_REQUIREMENT=1
DAY2_WORLD_EVENT_DURATION_MINUTES=5
FINAL_BOSS_TIE_TOLERANCE_MS=0
```

Existing Groq/Piston configuration is reused. No environment variable may carry an admin secret to the browser.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Unqualified access | Server-side qualification gate on every Day 2 route and mutation. |
| Duplicate volunteer entry | Idempotency key + unique team/activity/round result + ledger source reference. |
| Final Boss race | Server timestamp and transactional provisional-winner claim; certification afterwards. |
| Provider failure | Persist manual-review state, offer audited admin fallback, never guess an award. |
| Ambiguous event mechanics | Treat unspecified values as organizer configuration, not invented defaults. |
| Tie/dispute | Freeze candidate records and require a signed organizer decision. |

## 8. Explicit exclusions

Phase 3 does not build a new or extended live online PvP engine, new user/panel auth, registration/payment/attendance, a new database authorization model, or a replacement of Phase 1/2 dashboard/round controls. Round 4 PvP-labelled games remain volunteer-run offline. Dragon’s Fury **is** in scope (see §3.4); “weakening” requires no separate mechanic — it reads the existing boss-attempt state.

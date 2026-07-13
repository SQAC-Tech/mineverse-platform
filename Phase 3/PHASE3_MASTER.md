# MINEVERSE — Phase 3 Master Plan
## Day 2: Nether Portal Repair, The End & Winner Certification

**Status:** Planning / documentation only  
**Depends on:** Phase 1 platform contracts and Phase 2’s frozen Day 1 handoff  
**Authoritative event source:** `../event details/Mineverse_Full_Event_Details.md`

Phase 3 delivers Day 2 without rebuilding Phase 1/2 systems. It consumes the organizer-confirmed qualified-team list, resource ledger, structures, consumed items, and Day 1 artifacts. Its outcome is a single certified champion: the first qualified team to defeat the Final Boss after crafting the Diamond Pickaxe.

## 1. Canonical decisions

| Topic | Decision |
|---|---|
| Day 2 admission | Only a Phase 2 `qualified_for_day2` team may access Day 2 routes or receive Day 2 awards. The Phase 2 decision is read-only here. |
| Round 4 | Nether Portal Repair is entirely offline/volunteer-run, including Crack the Code and Cup Flip. The platform records verified results, artifacts, and portal state; it does not run the mini-games live. Phase 2’s Day 1 online PvP results are read-only history here. |
| Round 5 | The End is team-facing coding, logic, debugging, and output challenges, followed by a Final Boss unlock. |
| Winner | First valid, server-recorded Final Boss victory wins. A leaderboard is informative only; it never chooses the winner. |
| Tie handling | Persist server completion timestamps at millisecond precision. If truly identical, freeze both records and require an organizer-certified tie-break decision; never silently sort by a client clock. |
| Dragon’s Fury | In scope as a Day 2 negative world event, triggered by organizers in the late-game phase of Round 5. Effect: -10 Diamonds unless the team has weakened the Dragon. Weakened = the team has started at least one Final Boss attempt (win or lose); Dev 3’s boss-attempt state is the weakened flag. |
| Auth and data | Reuse Phase 1 cookies, service-role API routes, deny-all RLS, and Phase 2’s atomic resource ledger. No new auth or public admin key. |

## 2. Day 2 rules captured by the platform

| Stage | Duration | Platform responsibility | Required outcome |
|---|---:|---|---|
| Welcome back | 20 min | Validate qualified list and show carried inventory | Day 2 team access confirmed |
| Round 4 — Nether Portal Repair | about 60 min | Record offline game outcomes, Portal Fragment, Diamonds, and repair status | Nether Core ×1 (Day 1 PvP) + 1 Portal Fragment + 15 Diamonds activates portal |
| Round 5 — The End | 60–70 min | Deliver 3 coding, 2 logic, 2 debug/output questions; track resources and Diamond Pickaxe | Diamond Pickaxe unlocks Final Boss |
| Final Boss | within Round 5 | Start/submit/resolve attempts, cooldown, and immutable completion time | Earliest valid victory is champion |
| Results | 30 min | Reconcile ledger, certify winner, publish final standings | Organizer-approved final record |

Round 4 rewards: Memory Challenge grants +10 Diamonds and one Portal Fragment; Spot the Difference grants +8 Diamonds and +2 Emeralds; Insta lollipop and soap is an offline activity with an organizer-configured award; Crack the Code and Cup Flip are offline PvP games (+8 Diamonds/+1 Emerald on a win; +3 Diamonds on a loss, plus +1 Emerald for Cup Flip loss). No assumptions about an unspecified award may be made without an organizer configuration entry.

Round 5 rewards: coding +12 Diamonds; logic +10 Diamonds and +3 Emeralds; debug/output +10 Diamonds and +2 Emeralds. Chorus Fruit Blessing awards +2 Emeralds for each qualifying coding challenge during its five-minute window. Enderman Ambush immediately removes 8 Diamonds. Dragon’s Fury (late-game) removes 10 Diamonds from teams that have not yet started a Final Boss attempt. End Merchant is a one-time explicit choice. Diamond Pickaxe cost is 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds.

## 3. Delivery ownership

| Owner | Owns | Does not own |
|---|---|---|
| Dev 3 | Portal-state rules, End Merchant choice, Final Boss lifecycle, boss UI, Day 2 access guard, winner certification domain | Round 5 question shell/submissions/crafting and organizer offline/event operations |
| Dev 4 | Round 5 question delivery/submissions, resources read model, Diamond Pickaxe crafting, The End round shell and final leaderboard view | Portal/boss domain and organizer operations |
| Dev 5 | Offline Round 4 result entry, Day 2 grading operations, Chorus/Enderman event operations, End Merchant operations support, final reconciliation/admin console | Team question/boss UI and craft logic |

The detailed, non-overlapping path lists in `PROMPT_DEV_3.md`, `PROMPT_DEV_4.md`, and `PROMPT_DEV_5.md` are binding.

## 4. Checklist

### 4.1 Handoff and data integrity

| # | Work item | Owner | Status |
|---|---|---|---|
| 1 | Verify qualified-team snapshot and copy no mutable Day 1 state | Dev 3 | Not started |
| 2 | Apply three ordered Phase 3 migrations with no edits to Phase 2 migrations | Dev 3/4/5 | Not started |
| 3 | Preserve all Day 2 awards/deductions in the existing resource ledger contract | All | Not started |
| 4 | Seed only organizer-approved Round 5 questions, logic variants, and Final Boss packs | Dev 4/3 | Not started |

### 4.2 Team experience

| # | Work item | Owner | Status |
|---|---|---|---|
| 5 | Block non-qualified teams and present safe Day 2 access states | Dev 3 | Not started |
| 6 | Record and display Portal Repair progress from verified offline results | Dev 3/5 | Not started |
| 7 | Deliver/lock/grade Round 5 questions without leaking answer keys | Dev 4/5 | Not started |
| 8 | Craft Diamond Pickaxe atomically and unlock Final Boss once | Dev 4 | Not started |
| 9 | Resolve Final Boss attempts with cooldown and immutable victory timestamp | Dev 3 | Not started |

### 4.3 Operations and closeout

| # | Work item | Owner | Status |
|---|---|---|---|
| 10 | Enter Round 4 individual/PvP results with idempotency and attribution | Dev 5 | Not started |
| 11 | Trigger/expire Day 2 world events with polling fallback | Dev 5 | Not started |
| 12 | Reconcile resources, certify winner, and export final audit package | Dev 3/5 | Not started |

## 5. Merge-conflict contract

Shared/frozen files are still off limits: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/layout.tsx`, `components/ui/**`, and all Phase 2-owned paths. Cross-owner integration uses documented APIs, database contracts, and owned component subtrees—not edits in another developer’s tree.

## 6. Acceptance gates

- Non-qualified teams cannot access or mutate Day 2 gameplay.
- A Round 4 result, portal repair, craft, boss attempt, or winner certification cannot produce duplicate resource or state changes.
- Portal repair needs the Nether Core, the Portal Fragment, and the 15-Diamond threshold; Diamond Pickaxe needs its complete cost.
- Only a server-timestamped, valid Final Boss victory can create a provisional winner.
- All provider/offline-event failures have a visible manual recovery path.
- Event-day rehearsal covers the exact winner-certification flow and emergency tie handling.

**Last updated:** 2026-07-14

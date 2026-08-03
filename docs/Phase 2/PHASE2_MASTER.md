# MINEVERSE — Phase 2 Master Plan
## Day 1 Gameplay Engine (Rounds 1–3)

**Status:** Implemented; pending organizer question content  
**Depends on:** Phase 1 foundation, auth, dashboard, round controls, and database schema  
**Authoritative event source:** `../event details/Mineverse_Full_Event_Details.md`

Phase 2 adds Day 1 gameplay without changing Phase 1’s stack or security model: Next.js 16 App Router, React 19, Tailwind v4, Zod 4, Supabase service-role access only, team `session_token`, and scoped `panel_session` cookies. Day 2 is explicitly out of scope.

## 1. Canonical decisions

| Topic | Decision |
|---|---|
| Event scope | Round 1 Forest, Round 2 Cave, Round 3 Mountain only. Day 2 belongs to Phase 3. |
| Team access | Reuse Phase 1 team JWT and the round state already controlled at `/admin/rounds`. No new login/auth mechanism. |
| Admin access | Reuse Phase 1 `panel_session` with `admin` scope. Never introduce `x-admin-key` or client-exposed admin secrets. |
| Database access | Browser clients use API routes; server routes use the Phase 1 service-role client. Phase 2 tables remain deny-all under RLS. |
| Physical games | Volunteer-run offline. The platform records a verified result and the audited resource award. |
| Round 3 PvP | Online private question duel for two organizer-selected, Iron-Armor-eligible teams. Admin presses **Start PvP**; no public queue, auto-pairing, or bracket UI exists. |
| Grading | Deterministic questions are graded immediately or at the grading checkpoint. Rubric/semantic answers are queued for Groq with an admin manual fallback. |
| Resource mutations | Every award, deduction, craft, purchase, repair, event effect, and override is atomic and writes a resource ledger entry. |
| Source of mechanics | Event-detail rewards, costs, and rules override older Phase 2 copy. Where the event brief is intentionally non-numeric (for example, free structures), the backend must not invent a cost. |

## 2. Day 1 rules captured by the platform

| Round | Duration | Platform challenges | Offline / special flow | Progression |
|---|---:|---|---|---|
| 1 — Forest & Grasslands | 40–45 min | 2 crossword, 6 aptitude, 2 output prediction | Optional Forest Guardian; Heavy Rain once for 5 min | Craft Wooden Pickaxe: 60 Wood |
| 2 — Cave Biome | 60 min | 5 aptitude, 1 debugging, 1 code completion, 1 output prediction | 2 offline games, optional third if time; Skeleton Archer; free choice of Bat Cave or Forge after 10 min | Craft Stone Pickaxe: 10 Wood + 45 Stone + 25 Iron |
| 3 — Mountain Biome | 70 min | 2 debugging, 2 coding | 2 physical games; mandatory Blaze Guardian; private online PvP | Craft Iron Armor: 40 Iron + 25 Gold, then win PvP; top 50% qualify |

Important mechanics: structures are free to build; their upgrades have the costs in the event brief. Creeper Explosion damages a built structure (repair is 8 Stone) unless the team has a Bat Cave, which also prevents the resource loss. Ghast Bombardment damages a randomly selected structure; repair costs depend on the structure. Guardian rewards are claimable only once, while failed attempts use a three-minute cooldown.

## 3. Delivery ownership

| Owner | Owns | Does not own |
|---|---|---|
| Dev 3 | Guardians, structures, marketplace, choice events, qualification state | Round shell, submissions, resources/crafting, grading/admin operations |
| Dev 4 | Questions/submissions, game-round shell, resource read model, crafting, public leaderboard, private PvP team UI/API | Guardians, structures, marketplace, grading/admin operations |
| Dev 5 | Auto/LLM grading, world-event operations, offline result entry, admin PvP match operations, admin overrides and operations UI | Team game UI, crafting, guardian/marketplace UI |

Read the corresponding `PROMPT_DEV_3.md`, `PROMPT_DEV_4.md`, and `PROMPT_DEV_5.md` before implementation. Their file lists are the merge-conflict contract.

The selected-team Round 3 design, state rules, and failure handling are specified in `PHASE2_PVP.md`; it is the PvP contract for all three owners.

## 4. Checklist

Status audited against the code and the live Supabase project on 2026-08-03.

### 4.1 Data and safety

| # | Work item | Owner | Status |
|---|---|---|---|
| 1 | Apply the three ordered, owner-specific Phase 2 migrations | Dev 3/4/5 | ✅ Applied (01, 02, 03 + 04 grants, 05 Dev 3 RPCs, 06 guardian packs) |
| 2 | Seed only organizer-approved questions; do not put answer keys in client responses | Dev 4 | ⚠️ Blocked on organizer content — `questions` is empty. Delivery/serialization is safe and tested. |
| 3 | Create an append-only resource ledger and make every mutation idempotent | Dev 4/5 | ✅ Verified against the live database |
| 4 | Persist guardian attempts, item usage, repairs, trades, and qualification decisions | Dev 3 | ✅ |
| 5 | Keep Phase 2 tables server-only under deny-all RLS | Dev 4 | ✅ RLS on all 32 tables; RPC `EXECUTE` revoked from `anon`/`authenticated` |

### 4.2 Team gameplay

| # | Work item | Owner | Status |
|---|---|---|---|
| 6 | Display only questions available to the authenticated team in an active, unlocked round | Dev 4 | ✅ Guardian pack questions excluded from the round list |
| 7 | Save/revise submissions until the round locks; never double-award an edited answer | Dev 4 | ✅ Unique `(submission_id, revision)` in `grading_items` |
| 8 | Show resources, ledger history, timer, question status, and active modifiers | Dev 4 | ✅ Modifiers now sourced from `team_event_effects` |
| 9 | Craft required progression items atomically, applying Forge discounts correctly | Dev 4 | ✅ Rehearsed: 45 stone → 41 at 10% Forge discount |
| 10 | Implement guardian, structure, marketplace, choice-event, and qualification experiences | Dev 3 | ✅ Guardian grading wired; purchase/choice made atomic; costs reconciled to the event brief |

### 4.3 Organizer operations

| # | Work item | Owner | Status |
|---|---|---|---|
| 11 | Grade deterministic submissions and queue rubric grading with validated structured output | Dev 5 | ✅ Deterministic path complete; answers with no key park in `manual_review`. LLM/Groq path not wired — manual review is the fallback. |
| 12 | Trigger/expire world events and broadcast state with polling fallback | Dev 5 | ✅ Trigger/list/expire; broadcast still polling-only |
| 13 | Enter offline results, operate online PvP matches, and make manual resource adjustments with an audit reason | Dev 5 | ✅ |
| 13a | Select two eligible teams, choose a sealed PvP pack, and start/void/replay an online PvP match | Dev 5 | ✅ Rehearsed end to end |
| 13b | Show only the selected team its active PvP match, safe questions, server timer, and final result | Dev 4 | ✅ |
| 14 | Determine and freeze the qualified Day 2 list after the organizer confirms the cutoff | Dev 3 | ✅ |

### 4.4 Known remaining work

- **Question content is unseeded.** Every round, guardian, and PvP pack needs organizer-approved questions with `expected_answer` keys before any flow produces a score. This is a content gate, not a code gate.
- **No LLM grading provider.** `grading_items.path = 'rubric'` parks answers for manual review; the Groq call described in the PRD is not implemented.
- **Realtime broadcasts are not emitted.** Clients rely on the documented ten-second poll.
- **Panel tokens carry no admin identity.** Audit columns record the neutral actor `panel-admin`; widen the JWT payload for per-admin attribution.

## 5. Merge-conflict contract

After the Phase 1 foundation, do not edit shared/frozen files: `package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/layout.tsx`, and `components/ui/**`.

Each owner creates files only in its named subtree. Shared behavior crosses boundaries through documented HTTP responses and database contracts, never by editing another developer’s component, route, or helper. The only shared review points are the migration order, API guide, and PRD; those are documentation changes agreed before code changes.

## 6. Acceptance gates

- Phase 1 auth and round locks work unchanged for every Phase 2 route.
- An edited or retried action cannot award, deduct, or consume an item twice.
- At least one full team flow is rehearsed: Round 1 submission → grade → Heavy Rain → Guardian → craft.
- At least one operator flow is rehearsed: lock → grade → select teams → Start PvP → resolve/void if needed → qualification export.
- All Day 1 mechanics match the event-detail source, including free structures and the selected-team online PvP question duel.
- Phase 3 receives a stable qualified-team flag, resources, structures, upgrades, artifacts (including the Nether Core count, which Phase 3's portal repair requires), and audit history.

**Last updated:** 2026-08-03

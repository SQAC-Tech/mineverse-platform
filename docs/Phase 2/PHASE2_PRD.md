# MINEVERSE Platform — Phase 2 PRD

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 1 Gameplay Engine: Rounds, Resources, Grading & Operations

**Version:** 3.0  
**Date:** 2026-07-14  
**Scope:** Day 1 only — Forest, Cave, and Mountain biomes  
**Prerequisite:** Phase 1 is complete  
**Mechanics authority:** `../event details/Mineverse_Full_Event_Details.md`

## 1. Product outcome

Phase 2 turns the Phase 1 dashboard and round controls into a reliable Day 1 game. A payment-verified team can enter an unlocked round, solve questions, see audited resources, make strategic decisions, and progress by crafting. Organizers can lock a round, grade it, trigger verified world events, enter offline results, and confirm Day 2 qualification.

Phase 2 does not build Day 2, a public matchmaking queue, automatic tournament brackets, new authentication, registration, payment, attendance, or a replacement dashboard/admin shell. It does include the private, organizer-started Round 3 online PvP described below.

## 2. Non-negotiable platform contracts

| Area | Requirement |
|---|---|
| Stack | Continue Phase 1: Next.js 16 App Router, React 19, Tailwind v4, Zod 4, Supabase. No Next 14 patterns. |
| Team auth | Existing `session_token` cookie; routes derive team identity on the server. |
| Admin auth | Existing `panel_session` cookie with `admin` scope. No `x-admin-key` and no public admin secret. |
| Data access | API routes use the Phase 1 service-role client. Phase 2 tables are deny-all under RLS; browser clients do not query them directly. |
| Time | The server determines active/locked state from Phase 1 round controls. Client timers are display-only. |
| Auditability | Every balance mutation and organizer action is idempotent and attributable. |
| Realtime | Realtime broadcasts improve the experience; ten-second polling is the fallback. |

## 3. Day 1 gameplay requirements

### 3.1 Round 1 — Forest & Grasslands

**Duration:** 40–45 minutes. Teams complete 2 crossword, 6 aptitude, and 2 output-prediction questions. Crossword rewards are +10 Wood; aptitude rewards +8 Wood and +5 Stone; output-prediction rewards +6 Wood and +1 Emerald.

The optional Forest Guardian can be attempted during the round. Success awards +25 Wood, +10 Stone, +3 Emerald; failure costs -8 Wood, -3 Stone. Failed attempts have a three-minute cooldown; success is claimable once. Heavy Rain occurs once for five minutes and doubles Wood rewards from coding questions only, never guardian rewards. A 60-Wood Wooden Pickaxe unlocks Round 2.

### 3.2 Round 2 — Cave Biome

**Duration:** 60 minutes. Platform questions: 5 aptitude (+8 Stone, +2 Iron each), 1 debugging, 1 code completion, 1 output prediction (+6 Stone, +5 Iron each). Two offline games are conducted, and a third is optional; each awarded game grants +4 Stone and +10 Iron.

The Skeleton Archer has five rapid-fire questions in five minutes. All five must be correct for +20 Iron, +15 Stone, +3 Emerald; failure costs -10 Iron, -10 Stone. Structures unlock after ten minutes and are free: choose Bat Cave or Forge. Fertile Marsh doubles qualifying Iron rewards for five minutes. Creeper Explosion costs -5 Wood and -5 Stone, damages a structure, and is prevented for teams with Bat Cave; the repair costs 8 Stone. The Stone Pickaxe costs 10 Wood, 45 Stone, and 25 Iron. After the round, the Ancient Shrine choice and structure upgrades are available.

### 3.3 Round 3 — Mountain Biome and qualification

**Duration:** 70 minutes. Platform questions are 2 debugging (+6 Iron, +3 Gold) and 2 coding (+5 Iron, +12 Gold, +1 Emerald); 2 physical games are recorded offline (+8 Iron, +6 Gold each).

Teams choose a free Bastion or TNT Storage. Gold Rush doubles qualifying Gold rewards for five minutes. Lava Eruption costs -10 Gold, -5 Iron unless a Bastion protects the team. Ghast Bombardment damages one structure; Dev 3’s repair rules govern recovery. The Piglin Merchant choice is recorded once per team. Iron Armor costs 40 Iron and 25 Gold and is required before a private online PvP match. The mandatory Blaze Guardian and a winning PvP result are part of eligibility; only organizer-confirmed top 50% of eligible teams advance to Day 2. The outcome must be frozen and auditable, not inferred from a public leaderboard.

## 4. Game systems

### 4.1 Questions and submissions

- Questions are available only to the authenticated team while its round is active and unlocked.
- Responses can be revised while open. A lock, expiration, or force-submit freezes the final revision.
- The client never receives expected answers, rubric internals, or hidden code test cases.
- Deterministic questions are graded through a controlled server pipeline. Rubric answers are queued for review.

### 4.2 Resources and ledger

Starting inventory is 25 Wood, 10 Stone, 0 Iron, 0 Gold, 0 Diamond, 5 Emerald, and 0 Obsidian. A resource ledger is the source for history and incident recovery. The resource balance is a projection; it must always agree with the recorded, idempotent mutations.

Full or partial score rewards are rounded using a single documented rule. Active world-event multipliers apply only to the award being calculated during the event window. Purchases, crafting, penalties, repairs, consumables, manual adjustments, and grader corrections use the same atomic mutation contract.

### 4.3 Structures, marketplace, guardians, and choices

Base structures are free. Bat Cave/Forge are Round 2 choices; Bastion/TNT Storage are Round 3 choices. Their upgrades, repairs, damage, and usage must persist. Marketplace items are the exact event-detail price list; consumables record a purchase and a separate one-time use. Choice events are explicit decisions, not automatic random deductions.

### 4.4 Offline activities and online PvP

Round 2/3 physical games remain volunteer-run offline. The platform accepts a verified operator outcome, applies the configured award once, and records volunteer/organizer attribution and reason.

Round 3 PvP is online, but it is **not** a public free-for-all, public queue, or auto-generated bracket. It is a private two-team question duel. An authorized organizer selects exactly two distinct Iron-Armor-eligible teams, chooses an approved PvP question pack, and presses **Start PvP**. The match is visible only to those two teams and the organizer; no other team can join or view its questions, answers, or progress.

Both teams receive the same server-snapshotted question set only when the server starts the match. The server owns `started_at`, deadline, answer validation, final-correct submission time, and result. The winner is the team that correctly completes the organizer-configured pack in the least server-measured time, matching the event brief. The pack size and time limit are organizer configuration rather than invented constants. A client timer is display-only; Realtime may notify clients, while polling provides recovery.

One team may be in only one active match and may receive only one final Round 3 PvP result. Admins cannot start a match with an ineligible, duplicated, or already-resolved team. If both teams do not finish, a disconnect occurs, or an organizer detects an issue, the match is marked `expired`, `cancelled`, or `voided` with a reason; a replay is a new audited match, never an overwrite. There is no automatic winner on a client timestamp or reconnect.

On a valid win, the atomic PvP award is Nether Core ×1, +20 Gold, +15 Iron, +25 Stone, and +4 Emerald, as stated in the event brief. The losing team receives no fabricated PvP victory award and does not satisfy the normal “win PvP to advance” qualification condition. A winning match result produces the immutable PvP evidence used by qualification; Dev 3 still performs the explicit, auditable top-50% cutoff confirmation. This allows selected-team starts without requiring a bracket UI.

## 5. Grading and operations

| Stage | Required behavior |
|---|---|
| Deterministic grading | Normalized exact checks or bounded Piston execution for organizer-approved questions. Failures become manual review. |
| Rubric grading | Server-only Groq call, strict schema validation, score clamp 0–100, persisted run status and error state. |
| Resource award | Award exactly once per final submission revision; a manual override applies only the delta from the existing final score. |
| Checkpoint | Admin uses Phase 1 controls to close the round, then starts/resumes a durable grading run. |
| Manual fallback | Admin can review, score, and document the reason without bypassing the audit ledger. |

## 6. Roles and deliverables

| Owner | Deliverables |
|---|---|
| Dev 3 | Guardians, structures, marketplace, choices, qualification workflow and state. |
| Dev 4 | Question/submission APIs, round shell, resource view/ledger, crafting, leaderboard, team-side private PvP match experience. |
| Dev 5 | Deterministic/LLM grading, world events, offline result entry, PvP match operations, manual adjustments, operator UI. |

Detailed owned paths are in `PROMPT_DEV_3.md`, `PROMPT_DEV_4.md`, and `PROMPT_DEV_5.md`; they are binding for merge safety.

## 7. Environment additions

All are validated by the already-frozen Phase 1 environment layer before any implementation relies on them.

```env
GROQ_API_KEY=
GROQ_MODEL=
PISTON_API_URL=
GRADING_BATCH_SIZE=20
GRADING_RATE_LIMIT_PER_MIN=20
GUARDIAN_COOLDOWN_MINUTES=3
WORLD_EVENT_DURATION_MINUTES=5
```

No client-visible secret or admin key is allowed.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Grader/provider unavailable | Persist status, send to manual review, and never award from an unverified result. |
| Duplicate browser/admin requests | Idempotency keys plus a unique mutation reference/ledger record. |
| Realtime outage | Server read plus 10-second polling remains correct. |
| Incorrect game mechanics | Event-detail document is the source of truth; scenario tests cover each event/structure/guardian. |
| Resource dispute | Append-only ledger and organizer action audit support replay and correction. |
| PvP fairness or reconnect | Server-owned start/completion times and answer checks; sealed per-match question snapshots; polling fallback; void/replay flow with audit reason. |

## 9. Phase 3 handoff

Phase 3 receives the immutable Day 1 qualification decision, final balance and ledger, crafted items, structures/upgrades/damage state, consumable state, guardian outcomes/artifacts, offline-game audit records, and online PvP match/result audit records. The **Nether Core count is a functional requirement, not decoration**: Phase 3's portal repair checks Nether Core ×1 (alongside the Portal Fragment and 15 Diamonds), so the PvP award and `team_game_state` core count must be handed off accurately. Day 2 questions, Portal Repair, The End, Diamond Pickaxe, and final winner logic are excluded here.

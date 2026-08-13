# Round 2 — Cave Biome

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.

## Purpose

Round 2 expands the core loop with technical questions, an optional Guardian, a reward window, the marketplace, a post-round trade, and Stone Pickaxe crafting. There are no eliminations.

**Duration:** 60 minutes  
**Unlock requirement:** Wooden Pickaxe crafted.  
**Completion gate:** Craft the Stone Pickaxe (10 Wood, 45 Stone, 25 Iron).

## Question area

Show eight platform questions and their state: `not started`, `saved`, `submitted`, `graded`, `manual review`, or `locked`.

| Question type | Count | Answer/input needed | Reward on correct answer |
|---|---:|---|---|
| Aptitude | 5 | Selected or typed answer, as configured | 8 Stone + 2 Iron |
| Debugging | 1 | Corrected code or identified fix | 6 Stone + 5 Iron |
| Code completion | 1 | Missing code completion | 6 Stone + 5 Iron |
| Output prediction | 1 | Fixed program output | 6 Stone + 5 Iron |

Questions are submitted during the active round. Technical answers can remain in a grading or manual-review state; no client-side score or reward is assumed.

## Offline games

Offline games happen in the room and the platform knows nothing about them — there is no activity list, no award table, and no screen for them. An organizer decides what a team earned and grants it on `/admin/resources`.

The only frontend consequence: the team sees a ledger entry labelled **Organizer grant** with the reason the organizer typed. The round flow still places the offline games after Debugging, Code Completion and Output Prediction, with aptitude following, but that is a scheduling matter, not a UI one.

## Guardian: Skeleton Archer

The Skeleton Archer is optional and can be challenged during Round 2. It is a Rapid Fire attempt: five questions in five minutes, and all five must be correct to win.

- Win: +20 Iron, +15 Stone, +3 Emerald.
- Loss: −10 Iron, −10 Stone.
- Loss starts a server-controlled 3-minute cooldown; retries are unlimited after it ends.
- Victory reward is claimable once only.
- Show a server-driven attempt deadline and cooldown; the main round timer does not pause.

## World events

| Event | Effect | Special handling |
|---|---|---|
| Fertile Marsh | For 5 minutes, coding-question Iron rewards are doubled | Show event window and remaining server time |

No event in this round costs a team anything, so there is no "damaged", "protected" or "absorbed" state to render.

## Trader choice event: Ancient Shrine

After Cave Biome completion, every team must make exactly one irreversible choice:

| Choice | Result |
|---|---|
| Offer 10 Wood | +2 Emeralds |
| Offer 5 Iron | +15 Stone |
| Ignore | −5 Wood, −3 Stone |

The choice must present all consequences before confirmation and show the committed result afterwards. The server prevents a second choice.

## Crafting and common features

| Craft | Cost | Result |
|---|---|---|
| Stone Pickaxe | 10 Wood + 45 Stone + 25 Iron | Unlocks Round 3 / Mountain Biome |

Also include the shared inventory, auditable resource history, Marketplace access, active round timer, and lock/error states. Marketplace purchases and consumable use are separate actions.

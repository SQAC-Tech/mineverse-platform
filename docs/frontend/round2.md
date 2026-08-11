# Round 2 — Cave Biome

## Purpose

Round 2 expands the core loop with technical questions, offline-game rewards, an optional Guardian, the first structure choice, world events, a post-round trade, and Stone Pickaxe crafting. There are no eliminations.

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

Offline games are not team-submitted platform questions. A volunteer/organizer records the result and the team sees the verified result in its resource history.

| Activity | Availability | Award |
|---|---|---|
| Cup Stacking | Conducted offline | 4 Stone + 10 Iron |
| Dice total prediction | Conducted offline | 4 Stone + 10 Iron |
| Find the ball under a cup | Only if time permits | 4 Stone + 10 Iron |

The round flow places offline games after Debugging, Code Completion, and Output Prediction; aptitude follows the offline games. The frontend needs to reflect that offline outcomes are recorded by staff, not self-reported by a team.

## Guardian: Skeleton Archer

The Skeleton Archer is optional and can be challenged during Round 2. It is a Rapid Fire attempt: five questions in five minutes, and all five must be correct to win.

- Win: +20 Iron, +15 Stone, +3 Emerald.
- Loss: −10 Iron, −10 Stone.
- Loss starts a server-controlled 3-minute cooldown; retries are unlimited after it ends.
- Victory reward is claimable once only.
- Show a server-driven attempt deadline and cooldown; the main round timer does not pause.

## Structures

Structures become available after the first 10 minutes. A team chooses one base structure for free; it cannot select both.

| Structure | Effect | Required frontend information |
|---|---|---|
| Bat Cave | Reveals one bonus challenge | Built status, revealed challenge, active/damaged state |
| Forge | Reduces all future crafting costs by 10% | Built status and discounted recipe costs |

After the round, the selected structure may be upgraded:

| Upgrade | Cost | New effect |
|---|---|---|
| Echo Bat Cave | 10 Stone + 10 Iron | Reveals 2 bonus challenges instead of 1 |
| Master Forge | 15 Iron + 10 Stone | Reduces future crafting costs by 20% |

If a Forge exists, every relevant recipe must display the same server-calculated discounted cost that will be charged. Each discounted resource cost is rounded up.

## World events

| Event | Effect | Special handling |
|---|---|---|
| Fertile Marsh | For 5 minutes, coding-question Iron rewards are doubled | Show event window and remaining server time |
| Creeper Explosion | −5 Wood and −5 Stone; the built structure is damaged | Bat Cave protects its team: no resource loss |

A damaged structure must visibly show that its ability is inactive until repaired. Creeper-damaged structures cost 8 Stone to repair.

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


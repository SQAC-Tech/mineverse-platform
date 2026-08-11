# Round 3 — Mountain Biome

## Purpose

Round 3 is the only elimination round. Teams earn Iron and Gold, defeat the mandatory Blaze Guardian, craft Iron Armor, then take part in an organizer-created private PvP duel. Winning PvP awards the Nether Core and makes the team eligible for Day 2 qualification; only the top 50% of teams qualify.

**Duration:** 70 minutes  
**Unlock requirement:** Stone Pickaxe crafted.  
**PvP eligibility:** Blaze Guardian defeated and Iron Armor crafted.

## Question area

Show six challenges, with save/submit/graded/manual-review/locked states as applicable.

| Question/activity type | Count | Answer/input needed | Reward |
|---|---:|---|---|
| Debugging | 2 | Corrected code or identified fix | 6 Iron + 3 Gold |
| Coding | 2 | Code submission, evaluated against the configured grader | 5 Iron + 12 Gold + 1 Emerald |
| Physical games | 2 | Staff-recorded offline result | 8 Iron + 6 Gold |

The physical games are Bounce the Ball into the Cup and Odd/Even Marble Guess. They are recorded by staff only; teams can view the verified outcome and award.

## Mandatory guardian: Blaze Guardian

The Guardian can be attempted at any point, but must be defeated before PvP eligibility. One attempt contains three hard questions, has a seven-minute server-controlled deadline, and needs all three correct answers to win.

- Win: +12 Iron, +10 Gold, +2 Emerald.
- Loss: −8 Iron, −5 Gold.
- A loss starts a 3-minute server-controlled cooldown; retries are unlimited after it ends.
- Win reward can be claimed once only.
- Show the Guardian requirement as incomplete or satisfied in the PvP eligibility status.

## Structures

A team chooses one base structure.

| Structure | Effect | Constraints |
|---|---|---|
| Bastion | Blocks 1 negative Round 3 event | Permanent while active |
| TNT Storage | Skip 1 question for 50% of that question's reward | One use only |

The frontend must show the selected structure, active/damaged state, and remaining use for TNT Storage. Before a question skip is committed, show the target question and the reduced reward. The server decides whether the action is allowed and applies the result.

Post-round upgrades:

| Upgrade | Cost | New effect |
|---|---|---|
| Reinforced Bastion | 20 Iron + 10 Gold | Blocks 2 negative events instead of 1 |
| Mega TNT Storage | 15 Iron + 15 Gold | Skips 2 questions instead of 1 |

## World events and merchant choice

| Event | Effect | Protection / repair |
|---|---|---|
| Gold Rush | For 5 minutes, coding-question Gold rewards are doubled | Show active window and remaining server time |
| Lava Eruption | −10 Gold, −5 Iron | Bastion prevents the loss while active |
| Ghast Bombardment | A randomly selected structure is damaged | Bastion repair: 10 Iron + 5 Gold; TNT Storage repair: 10 Stone + 8 Iron |

The Piglin Merchant is a one-time irreversible choice:

| Choice | Result |
|---|---|
| Trade 10 Gold | +3 Emeralds |
| Trade 4 Emeralds | +18 Gold |
| Ignore | −5 Gold |

## Crafting, PvP, and qualification

| Craft | Cost | Result |
|---|---|---|
| Iron Armor | 40 Iron + 25 Gold | Enables PvP eligibility once Blaze Guardian is also defeated |

PvP is a private two-team online duel started by an organizer. The team frontend must support only these states:

- `not eligible`: explain whether Blaze Guardian, Iron Armor, or active-round requirement is missing.
- `eligible / waiting`: selected teams wait; no question pack or opponent details are exposed.
- `live`: show the server deadline, the sealed shared pack, and the team's own responses only.
- `resolved`, `expired`, `cancelled`, or `voided`: show the safe server result.

The PvP pack uses word unscramble, Minecraft trivia, and cipher questions. The fastest team to have every required answer verified correct wins. A team must never see opponent answers, progress, completion time before resolution, answer keys, or hidden tests.

PvP victory: Nether Core ×1, +20 Gold, +15 Iron, +25 Stone, +4 Emerald. The completed PvP result feeds the organizer-controlled top-50% Day 2 qualification decision; the player view must distinguish a PvP win from final Day 2 qualification.

## Shared features

Include inventory and resource history, Marketplace access, active timer, server-enforced round lock, and protected resource/crafting mutations. Marketplace buying and using an owned consumable are separate actions.


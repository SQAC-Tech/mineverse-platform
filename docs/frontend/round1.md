# Round 1 — Forest & Grasslands

## Purpose

Round 1 introduces the Mineverse loop: teams solve questions, earn resources, may attempt an optional guardian, and craft the Wooden Pickaxe to unlock Round 2. There are no eliminations.

**Duration:** 40–45 minutes  
**Unlock requirement:** Round 1 is active for the team.  
**Completion gate:** Craft the Wooden Pickaxe (60 Wood).

## Question area

Show 10 platform questions, with a visible per-question state: `not started`, `saved`, `submitted`, `graded`, or `locked`.

| Question type | Count | Answer/input needed | Reward on correct answer |
|---|---:|---|---|
| Crossword | 2 | Crossword entries/word answers | 10 Wood |
| Aptitude | 6 | Selected or typed answer, as configured | 8 Wood + 5 Stone |
| Output prediction | 2 | Fixed program output | 6 Wood + 1 Emerald |

Teams can save and revise responses only while the round is active. Correctness and rewards must come from the server/grading flow; the browser must not calculate or grant rewards itself.

## Guardian: Forest Guardian

This is optional and may be opened at any point during Round 1. Its state must show `not attempted`, `attempt active`, `won`, or `cooldown`.

- Win: +25 Wood, +10 Stone, +3 Emerald.
- Loss: −8 Wood, −3 Stone.
- A loss starts a server-controlled 3-minute cooldown; retries are unlimited after it ends.
- A Guardian reward can be claimed once only.
- The main round timer continues during attempts and cooldowns.

## Additional round features

### Heavy Rain world event

The event occurs once and lasts 5 minutes. During its active server-defined window, Wood rewards from coding questions are doubled. Guardian rewards are not doubled.

The frontend must show whether the event is inactive, active (with remaining server time), or finished, plus the effect that applies. It must refresh from the server so a missed realtime event cannot cause stale reward messaging.

### Resources and crafting

Always expose the team inventory and resource history for Wood, Stone, Iron, Gold, Diamond, Emerald, and Obsidian. Each history entry should identify the source of the change (question, guardian, event, craft, purchase, or organizer adjustment).

| Craft | Cost | Result |
|---|---|---|
| Wooden Pickaxe | 60 Wood | Unlocks Round 2 / Wetlands access |

The craft action asks the server to re-check the current inventory and round state. After success, show the crafted status and the Round 2 unlock outcome. The cost is deducted only by the server.

## Structure availability

No structure can be built in Round 1.

## Required functional states

- Round locked, active, completed, or expired.
- Question submission/grading state without exposing answer keys.
- Guardian availability, result, and cooldown.
- Heavy Rain inactive/active/finished state.
- Current inventory, resource-change history, and Wooden Pickaxe eligibility.
- Clear server error and loading states for every mutation.


# Round 5 — The End (Final Round)

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.

## Purpose

Round 5 is the final technical round. Qualified teams with a repaired portal solve final challenges, earn Diamonds and Emeralds, craft the Diamond Pickaxe, unlock the Final Boss, and attempt to defeat it. The earliest valid Final Boss victory wins Mineverse after organizer certification.

**Duration:** approximately 60–70 minutes  
**Access requirement:** Qualified for Day 2 and Nether Portal repaired.  
**Final gate:** Craft Diamond Pickaxe, then defeat Final Boss.

## Question area

Show seven questions. Each needs a safe status: `not started`, `saved`, `submitted`, `graded`, `manual review`, or `locked`. Responses can be revised only while the server reports Round 5 active.

| Question type | Count | Answer/input needed | Reward on correct answer |
|---|---:|---|---|
| Easy LeetCode-level coding | 3 | Code submission, evaluated by configured grader/test cases | 12 Diamonds |
| Logic puzzle | 2 | Configured puzzle answer/solution | 10 Diamonds + 3 Emeralds |
| Debug + output | 2 | Corrected code and/or fixed output | 10 Diamonds + 2 Emeralds |

Organizers select two logic puzzles from N-Queens, Missionaries & Cannibals, Tower of Hanoi, and Sudoku Logic. Teams receive only the selected puzzles, never the unselected pool or answer keys.

## World events and choice event

| Event | Effect | Required frontend state |
|---|---|---|
| Chorus Fruit Blessing | For 5 minutes, each qualifying coding challenge solved receives +2 Emeralds | Active window and server-controlled remaining time |
| Enderman Ambush | Immediate −8 Diamonds | Applied result in resource history |
| Dragon's Fury | Late game: −10 Diamonds unless the team has weakened the Dragon | Show whether the team is protected and the applied/no-effect result |

Starting at least one Final Boss attempt, regardless of win or loss, permanently marks the team as having **weakened the Dragon**. The UI should use the server state for this flag.

The End Merchant is a one-time irreversible choice:

| Choice | Result |
|---|---|
| Trade 5 Emeralds | +18 Diamonds |
| Trade 12 Diamonds | +4 Emeralds |
| Ignore | No reward and no penalty |

Show all outcomes before confirmation, then display the committed choice. The server rejects repeated choices.

## Diamond Pickaxe crafting

| Craft | Cost | Result |
|---|---|---|
| Diamond Pickaxe | 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds | Unlocks Final Boss attempts |

The frontend displays current balances and eligibility, then asks the server to validate and craft. After success, show a durable crafted state and Final Boss access. The UI must not independently deduct resources or assume a successful craft.

## Final Boss

Final Boss access is locked until the portal is repaired and the Diamond Pickaxe is crafted. The boss uses organizer-approved LeetCode/HackerRank-style problems with server-held test cases.

| Boss state | What the frontend must show |
|---|---|
| Locked | Missing requirement: portal repair, Diamond Pickaxe, or active round |
| Attempt in progress | Current authorized boss prompts, own submission state, and server deadline if configured |
| Defeat / cooldown | Applied result and a server-controlled 3-minute retry countdown |
| Retry available | Unlimited retry action while the main timer continues |
| Victory | Provisional successful boss result and completion time; not an automatic champion declaration |

Never expose future boss packs, answer keys, hidden test cases, another team’s attempt, or the global winner decision before certification.

## Winner and shared features

The first valid Final Boss victory becomes a provisional winner claim. Organizers certify the champion only after verifying qualification, portal repair, Diamond Pickaxe craft, and boss outcome. Team-facing copy must distinguish `boss defeated`, `provisional result`, `pending tiebreak/dispute`, and `champion certified`.

Include shared inventory and resource history, Marketplace access, current timer, grading/manual-review states, and safe loading/error handling. Marketplace purchase and consumable use remain separate actions.

# Round 4 — Nether Portal Repair (Pre-Final)

## Purpose

Round 4 is a Day 2, offline-only round for teams qualified after Round 3. It records staff-run activities, tracks Portal Repair requirements, and unlocks Round 5 after the portal is repaired. There are no team-entered coding questions or self-report forms.

**Duration:** approximately 60 minutes  
**Access requirement:** Team is qualified for Day 2.  
**Completion gate:** Nether Portal repaired.

## Offline activity records

Volunteers/operators enter one verified result per team per activity. Teams can only see their recorded result, award, and resulting inventory change.

| Activity | Format | Result / reward |
|---|---|---|
| Memory Challenge | Individual offline activity | +10 Diamonds, Portal Fragment ×1 |
| Spot the Difference | Individual offline activity | +8 Diamonds, +2 Emeralds |
| Insta lollipop and soap | Individual offline activity | Organizer-configured reward; no fixed award in the event rules |
| Crack the Code | Offline PvP activity | Win: +8 Diamonds, +1 Emerald; loss: +3 Diamonds |
| Cup Flip | Offline PvP activity | Win: +8 Diamonds, +1 Emerald; loss: +3 Diamonds, +1 Emerald |

Repeated operator submission must not double-pay. The operator experience needs the previously recorded result, not a second reward action.

## Portal Repair status and action

The player-facing status must clearly identify each requirement:

| Requirement | Required amount |
|---|---:|
| Nether Core | 1 |
| Portal Fragment | 1 |
| Diamonds | 15 |

Show these portal states:

- `locked`: team is not qualified for Day 2 or Round 4 is unavailable.
- `collecting`: offline activities are still being recorded.
- `missing core`, `missing fragment`, or `diamonds needed`: show the exact outstanding requirement.
- `ready to repair`: all requirements are present.
- `repaired`: record the server repair time and Round 5 availability.

When ready, **Repair Portal** asks the server to verify and finalize the repair. Nether Core, Portal Fragment, and Diamonds are checked but not consumed. The client does not submit resource counts or decide eligibility.

## Additional features

- Day 2 carried inventory: Wood, Stone, Iron, Gold, Diamond, Emerald, Obsidian, structures, upgrades, and persistent artifacts must display as read-only carried state until a permitted action changes them.
- Resource history must show every verified Round 4 reward and portal-repair record.
- Round 4 has no Guardian, buildable structure, marketplace-specific rule, online question submission, or team-side PvP interface.
- Non-qualified teams see an outcome/thank-you state only and cannot access Day 2 actions or private team data.


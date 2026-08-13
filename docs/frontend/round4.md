# Round 4 — Nether Portal Repair (Pre-Final)

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.

## Purpose

Round 4 is a Day 2 round for teams qualified after Round 3. The physical games happen in the room; **the only thing the platform does in this round is the Nether Portal repair**, which unlocks Round 5. There are no team-entered coding questions and no self-report forms.

**Duration:** approximately 60 minutes  
**Access requirement:** Team is qualified for Day 2.  
**Completion gate:** Nether Portal repaired.

## Where the Diamonds and the Portal Fragment come from

Memory Challenge, Spot the Difference, Crack the Code, Cup Flip and the rest are run and judged entirely off the platform. There is no activity list in the product, no award table, and no result-entry screen.

An organizer grants what a team earned on `/admin/resources`, which also grants the two portal artifacts that are not resources:

- **Portal Fragment** — a checkbox on that form.
- **Nether Core** — a checkbox on that form, for a team that did not win one in Day 1 PvP.

The team sees each grant as an **Organizer grant** entry in its resource history, with the reason the organizer typed. Granting twice is inert, so a repeated submission cannot double-pay.

## Portal Repair status and action

The player-facing status must clearly identify each requirement:

| Requirement | Required amount |
|---|---:|
| Nether Core | 1 |
| Portal Fragment | 1 |
| Diamonds | 15 |

Show these portal states:

- `locked`: team is not qualified for Day 2 or Round 4 is unavailable.
- `collecting`: the team is still short of at least one requirement.
- `missing core`, `missing fragment`, or `diamonds needed`: show the exact outstanding requirement.
- `ready to repair`: all requirements are present.
- `repaired`: record the server repair time and Round 5 availability.

When ready, **Repair Portal** asks the server to verify and finalize the repair. Nether Core, Portal Fragment, and Diamonds are checked but not consumed. The client does not submit resource counts or decide eligibility.

## Additional features

- Day 2 carried inventory: Wood, Stone, Iron, Gold, Diamond, Emerald, Obsidian, crafted items, and persistent artifacts must display as read-only carried state until a permitted action changes them.
- Resource history must show every organizer grant and the portal-repair record.
- Round 4 has no Guardian, marketplace-specific rule, online question submission, or team-side PvP interface.
- Non-qualified teams see an outcome/thank-you state only and cannot access Day 2 actions or private team data.

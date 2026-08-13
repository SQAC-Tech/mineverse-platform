# Team Dashboard — Frontend Functional Specification

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.

## Purpose

The dashboard is the authenticated team’s central status page. It tells the team what round is available, where to continue, what they own, what is required next, and which event actions need attention. It does not expose another team’s private answers, inventory, guardian attempts, PvP status, or resources.

## Access and identity

- Available only to an authenticated team session.
- Show the current team name and team code/identifier required by the event.
- Derive the team identity from the server-side session; do not accept a browser-provided team ID as authority.
- A non-qualified team returning on Day 2 sees its final Day 1 outcome only, with no access to Day 2 gameplay actions.

## Core dashboard data

The dashboard needs one current server-backed team snapshot containing:

| Data group | What to show |
|---|---|
| Event state | Current event day, active round, server time, and round availability |
| Round progress | Each round’s `locked`, `active`, `completed`, or `expired` state and its entry action |
| Inventory | Wood, Stone, Iron, Gold, Diamond, Emerald, and Obsidian balances |
| Crafted items | Wooden Pickaxe, Stone Pickaxe, Iron Armor, Diamond Pickaxe |
| Persistent artifacts | Nether Core, Portal Fragment, and Nether Portal repair status |
| Important eligibility | Current round gate, PvP eligibility, Day 2 qualification, and Final Boss eligibility |
| Resource ledger | Paginated history of rewards, crafts, purchases, trades, and organizer grants |

All balances, timers, eligibility, and progression status are server-authoritative. Realtime updates can improve responsiveness, but the dashboard must poll/refetch as a fallback.

## Round progress and navigation

The dashboard lists all five rounds with the relevant purpose and the team’s actual state.

| Round | Entry / progress condition to display |
|---|---|
| Round 1 — Forest & Grasslands | Active by organizer control; craft Wooden Pickaxe to complete |
| Round 2 — Cave Biome | Requires Wooden Pickaxe; craft Stone Pickaxe to complete |
| Round 3 — Mountain Biome | Requires Stone Pickaxe; defeat Blaze Guardian, craft Iron Armor, then complete PvP |
| Round 4 — Nether Portal Repair | Requires Day 2 qualification; repair the portal. The physical games are off-platform |
| Round 5 — The End | Requires Day 2 qualification and repaired portal; craft Diamond Pickaxe and defeat Final Boss |

For every round card/state, show the specific reason entry is unavailable instead of only a generic lock. Examples include missing crafted item, inactive round, missing Guardian victory, not selected/eligible for PvP, not qualified for Day 2, or portal not repaired.

The entry action must take the team only to an allowed area. Locked rounds cannot be opened by client-only navigation; the destination also re-checks access on the server.

## Live information and alerts

Show server-generated, team-relevant alerts only:

- Active world event, its effect, and remaining server-controlled duration.
- Guardian cooldown or Guardian retry availability.
- Pending one-time choice event: Ancient Shrine, Piglin Merchant, or End Merchant.
- Pending PvP selection/waiting state, active private PvP, or safe resolved result.
- Organizer grants credited to the team, with the organizer's stated reason.
- Portal repair readiness and missing requirements.
- Diamond Pickaxe eligibility and Final Boss cooldown/attempt result.

An alert is informational or links to the corresponding allowed feature. It must not apply rewards, losses, crafting, or a choice merely by being displayed.

## Marketplace access

The dashboard provides access to the Marketplace throughout the event when the server permits it. It must show only canonical items, owned consumables, current Emerald balance, and the result of a completed action.

| Item/action | Required behavior |
|---|---|
| Resource bundles and hint | Purchase is one server-validated action |
| Totem of Undying, Guardian Retry Token, Revival Potion, Strength Potion | Purchase and use are separate server-validated actions |

The dashboard must refresh inventory and resource history after a completed purchase or consumable use. It must not guess affordability or apply a local balance mutation as the final result.

## Required dashboard states

- Initial loading, successful snapshot, stale/reconnecting update, and safe fetch failure.
- No active round / event waiting state.
- Active-round countdown based on server timestamps.
- Locked, active, completed, and expired state for each round.
- Empty resource-history state and paginated history state.
- Day 1-qualified, not-qualified, and Day 2 progression state.
- Provisional Final Boss result, pending tiebreak/dispute, and certified champion state when applicable.

## Security and correctness boundaries

- Never render answer keys, hidden tests, another team’s state, raw grading rubric, or organizer-only controls.
- Do not use dashboard state as permission to perform an action; every linked page and API mutation independently validates team identity, round status, resources, cooldowns, and one-time-use constraints.
- Treat a client timer as display-only. Round deadlines, event windows, Guardian cooldowns, PvP completion time, and Final Boss ordering come from the server.
- Every resource-changing action must refresh from the resulting server snapshot or ledger entry so the displayed history remains auditable.

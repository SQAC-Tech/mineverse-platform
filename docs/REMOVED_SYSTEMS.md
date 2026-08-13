# Removed systems

**Effective 14 August 2026.** Three systems were taken out of the MINEVERSE platform. Every
other document in `docs/` predates this change; where one of them describes something below,
this file wins.

Migration: `mineverse/supabase/migrations/20260814_01_remove_structures_negative_events_offline.sql`
(applied to the live project).

---

## 1. Structures — removed entirely

Bat Cave, Forge, Bastion and TNT Storage are gone, along with building, upgrading, repairing,
and everything that depended on them.

| Was | Now |
|---|---|
| `structures`, `structure_repairs` tables | dropped |
| `POST/GET /api/team/structures`, `/build`, `/upgrade`, `/repair` | deleted |
| `lib/gameplay/structures/service.ts`, `components/game/structures/StructureManager.tsx` | deleted |
| `RoundConfig.structures` | field removed |
| Forge −10% / Master Forge −20% crafting discount | removed; base cost is the cost |
| TNT Storage question skip | removed |

`craft_team_item` no longer reads `structures`. `crafting_log.discount_source` and
`discount_percent` remain as columns so historical rows keep their meaning, but new crafts
always write `null` / `0`. The craft API still returns `actual_cost`; it now equals
`base_cost`.

## 2. Negative world events — removed

No event, on either day, can take resources from a team or damage anything a team owns.

**Removed:** Creeper Explosion, Lava Eruption, Ghast Bombardment (Day 1); Enderman Ambush,
Dragon's Fury (Day 2).

**Kept — all reward multipliers:**

| Event | Round | Effect |
|---|---|---|
| Heavy Rain | 1 | Wood ×2 for 5 minutes |
| Fertile Marsh | 2 | Iron ×2 for 5 minutes |
| Gold Rush | 3 | Gold ×2 for 5 minutes |
| Chorus Fruit Blessing | 5 | +2 Emerald per qualifying solve, 5-minute window |

`WorldEventKind` is now only `'modifier'`. The `world_events` and `day2_event_instances`
event-key CHECK constraints were tightened to the surviving keys, so an old key is rejected at
the database, not just in the catalog. `team_event_effects.protection` was dropped — with no
penalty there is nothing to absorb. The "Dragon's Fury protection" concept (a team that had
started a Final Boss attempt was spared) no longer exists.

Triggering an event writes an effect row per eligible team and moves no balance; the
multiplier is applied when the answer is graded.

## 3. Offline games — no longer a platform concept

The physical games still happen. The platform records nothing about them.

| Was | Now |
|---|---|
| `offline_results`, `day2_offline_results` tables | dropped |
| `record_offline_result`, `dev5_record_round4_offline_result` RPCs | dropped |
| `/api/admin/offline/results`, `/api/admin/day2/offline/results` | deleted |
| `/admin/offline` screen, "Offline Games" nav item | deleted |
| `ROUND4_AWARDS` catalog (`lib/day2/events/offline.ts`) | deleted; the delta helpers moved to `lib/day2/events/resources.ts` |
| Day 2 Ops "Round 4 Offline Entry" panel | removed |

There is no fixed award table any more — Memory Challenge, Spot the Difference, Crack the
Code, Cup Flip and the rest have no platform-side value. Organizers decide what a team earned
and hand it over through the one screen below.

### The replacement: `/admin/resources` — "Grant Resources"

One form. Pick a team, enter any combination of resources (negative numbers take resources
back), give a reason, submit. It writes to the same audited `resource_ledger` as in-game
earnings, through `apply_manual_adjustment`, and shows the team's balance and full ledger
alongside.

It also grants the two **portal artifacts**, which are not resources and so cannot be handed
over as a delta:

- **Portal Fragment** — `day2_portal_fragments`. Used to come from the Memory Challenge result.
- **Nether Core** — `team_game_state.nether_core_count`. Normally won in Day 1 PvP; the grant
  tops a team up to one and never reduces a count.

Without these, `POST /api/team/portal/repair` can never succeed and Round 5 stays locked.

---

## Consequences worth knowing

- **Round 4 on the platform is only the Nether Portal repair.** Everything else in that hour
  is off-platform.
- **The `ChoicePanel` no longer renders for Round 5.** It reads the Day 1 `CHOICES` catalog,
  which has no `end_merchant` entry, so it was drawing an empty panel. The End Merchant still
  has its own route (`/api/team/choices/end-merchant`) and still needs a surface of its own.
- **A team's balance can now only go down** through crafting, marketplace purchases, choice
  events, or an explicit organizer grant with a negative delta.

# Dashboard

## One screen, never a scrollbar

`/dashboard` is a fixed three-row grid — chrome, stage, inventory — sized to the
viewport and clipped. Nothing on the page scrolls. Anything that needs more room
opens as a card over it and scrolls inside itself.

```
┌─ dash__top ────────────────────────────────────────────────────┐
│ wordmark          team · day/round          dev flag · log out │
├─ dash__stage ──────────────────────────────────────────────────┤
│                        ENTER WORLD                             │
│                   ✧ OPEN MINEVERSE MAP ✧                       │
│                         RULEBOOK                               │
│  Steve                EXPLORE ◆ COMPLETE ◆ …                   │
├─ dash__foot ───────────────────────────────────────────────────┤
│                   nine slots, centred                          │
└────────────────────────────────────────────────────────────────┘
```

Steve is `position: absolute` at the bottom-left of the stage rather than a grid
cell. As a centred cell he floated in the middle of the sky, and he pushed the
actions off-centre; pinned to the floor he stands on the terrain and the buttons
stay centred on the page. There is deliberately no idle bob — a bobbing
character reads as hovering, which is the thing being fixed — so a contact
shadow under his feet does that work instead.

The two actions are stacked, not side by side. `--cta` on `.dash__centre` is the
primary button's width; the secondary is capped at half of it but sized to its
own label, because a forced half-width left the word swimming in a long empty
bar. Each caption is spaced to the button it belongs to rather than sitting
equidistant between two, so `.dash__centre` has `gap: 0` and the spacing is done
with margins.

The grid column is written `minmax(0, 1fr)` rather than left implicit. An `auto`
column sizes to its widest child's max-content, so the top bar's chips made the
grid wider than the viewport and `overflow: hidden` silently clipped the right
edge instead of letting anything shrink.

| Piece | File | Shows |
|---|---|---|
| Everything above | `dashboard-shell.tsx` | layout and polling |
| Steve | `steve-avatar.tsx` + `gear.ts` | the tier the team has actually reached |
| Inventory | `components/game/inventory/Hotbar.tsx` | the same nine slots the rounds draw |
| Map | `world-map.tsx` | one pin per round, the only way into a round |
| Rulebook | `rulebook.tsx` | rules, rounds, question types, recipes, prices |

`resource-ledger.tsx` is still here but nothing imports it — the Resource History
button was removed from the footer. It works; it just has no entry point. Delete
it or give it one.

The chrome uses the Nether palette from `.round-ui--nether` in round-ui.css —
blackstone panels, dull crimson edges, one ember accent — rather than a second
idea of what the Nether looks like.

All of it reads one snapshot from `GET /api/dashboard/data`, polled every 10s and
refetched on the `round_status` broadcast an admin sends when unlocking a round.
That route is deliberately one query set rather than the dashboard fanning out to
`/api/team/craft/recipes`, `/day2/status` and the rest — those guard on Day 2
qualification and return 403s a status page should not treat as errors.

## Steve

`public/steve-progression.webp` is one sheet of five frames, moved with
`background-position`. `background-size: 500%` lays it out five viewports wide,
so frame *n* sits at `n / 4 * 100%`.

The supplied art was not evenly spaced — the aura on the last two frames made
them wider and taller — so the sheet was re-cut before use. Each figure was
measured at `alpha >= 250`, which excludes the glow and finds the body, then
composited onto a common 460×640 tile aligned on the feet line and the body
centre. Without that, crafting a tier made Steve jump sideways and sink.

`gear.ts` picks the frame, and picks it only from state the server owns: four
rows of `crafting_log` plus the Day 2 portal repair.

| Frame | Earned by | Caption |
|---|---|---|
| 0 | nothing yet, or `wooden_pickaxe` | `No gear crafted yet` / `Wooden Pickaxe` |
| 1 | `stone_pickaxe` | `Stone Pickaxe` |
| 2 | `iron_armor` | `Stone Pickaxe · Iron Armor` |
| 3 | portal repaired | `Iron Armor · Portal repaired` |
| 4 | `diamond_pickaxe` | `Diamond Pickaxe` |

The ladder is monotonic — a team granted the Diamond Pickaxe without the Stone
one does not fall back to frame 0.

There is no empty-handed frame, so frame 0 draws a wooden pickaxe even before a
team has crafted one. The caption is the part that has to be true, and it reads
"No gear crafted yet". `tests/unit/dashboard/gear.test.ts` holds that line.

## Pages with no way in

The rail of link cards was removed, which leaves three routes unreachable from
the dashboard:

| Route | Reachable from |
|---|---|
| `/leaderboard` | nothing |
| `/qualification` | nothing |
| `/portal` | only `FinalBossUI`, which is itself behind the portal |

They all work. Someone has to decide how teams get to them — a link in the round
shells, an announcement with the URL, or bringing the cards back.

PvP and the Marketplace were never dashboard destinations here in the first
place: they are round-scoped panels inside `CustomRoundShell` / `CaveRoundShell`
with no standalone routes.

## What is derived, not restated

The rulebook prints the event's rules, and every number in it is imported rather
than typed out again:

- rounds, objectives and crafts — `lib/gameplay/round-config.ts`
- recipes and costs — `lib/gameplay/crafting/rules.ts`
- guardian rewards, penalties and timers — `lib/gameplay/guardians/config.ts`
- marketplace prices — `lib/gameplay/marketplace/catalog.ts`
- languages a coding question accepts — `lib/gameplay/code/runtimes.ts`

`catalog.ts` was created for this. The prices existed twice — `MARKETPLACE_ITEMS`
in `marketplace/service.ts`, which charges the team, and a private `ITEMS` array
in `MarketplaceStore.tsx`, which told the team what it would be charged — with
nothing keeping them equal. The rulebook would have been a third copy. All three
now read one table, and `tests/unit/dashboard/marketplace-catalog.test.ts` fails
if a literal price reappears in either consumer.

## Round state

`/api/dashboard/data` returns one normalized shape per round:

| Field | Meaning |
|---|---|
| `can_enter` | Pin is clickable — `!is_locked && round_status === 'active'`, or dev unlock |
| `unlocked_by_dev_mode` | Only enterable because the dev flag is on |
| `completed_at` | Pin reads "Replay" |
| `ends_at` | Unused since the countdown was removed |

Round 0 — the pre-event screening qualifier — is filtered out of the "active
round" search. It has no day and no biome, and it was winning that search and
putting `ROUND 0 · Screening` on the bar during the event.

## Access

Everything here is display-only. Dashboard state is never permission to act:
every round page calls `requireRoundAccess(roundId)`, which delegates to the same
`verifyTeamRoundAccess` the round APIs use, and every mutation re-validates on
its own. A chip that is stale is a cosmetic bug, not a way in.

## Dev mode

```
NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS=true
```

Unlocks every round without an admin unlocking them. Read in one place
(`lib/gameplay/dev-mode.ts`) and honoured by the server-side access checks, so
the pins and the API always agree. It bypasses **only** the round lock — a valid
team session is still required, and resource mutations, idempotency and grading
are untouched. A `DEV MODE` chip sits in the top bar the whole time the flag is
on, and each map pin says `DEV UNLOCKED`.

**Never set this in production.**

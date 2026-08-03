# UI system

One blocky component kit, two surfaces: the admin panel and the gameplay rounds.

## Files

| File | Role |
|---|---|
| `app/theme-kit.css` | All component classes (`.n-panel`, `.n-btn`, `.n-table`, `.n-pill`, `.n-input`…). Scoped `:is(.nether, .biome)` so both surfaces share one implementation. |
| `app/admin/nether.css` | Nether Portal palette for the admin panel. Tokens only. |
| `app/(game)/round/biome.css` | Four round palettes plus the resource-chip styles. Tokens only. |
| `components/admin/nether-ui.tsx` | React primitives: `Panel`, `Btn`, `Pill`, `StatTile`, `Table`, `Field`, `Grid`, `Loading`, `Empty`, `PageTitle`, `apiCall`. |
| `lib/gameplay/round-config.ts` | What each round *is*: biome, objective, and which panels it shows. |

Adding a surface means adding a token block and appending it to the `:is()`
selector — never copying the component CSS.

## Palettes

| Surface | Class | Feel |
|---|---|---|
| Admin | `.nether` | Void purple, lava orange |
| Round 1 | `.biome-forest` | Oak, leaves, daylight green |
| Round 2 | `.biome-cave` | Deepslate grey, torchlight |
| Round 3 | `.biome-mountain` | Iron and gold ore |
| Round 4 | `.biome-nether` | Matches the admin palette |

Every palette defines the same token names, so the contrast rule from
`docs/DESIGN and images/D.md` holds everywhere: text on an accent surface flips
to `--text-onLava` (near-black); text on a dark panel uses `--text-onDark`.

## Round composition

`RoundShell` reads `ROUND_CONFIGS[roundId]` and mounts only what that round has:

| Round | Craft | Guardian | Structures | Choice | Market | PvP |
|---|---|---|---|---|---|---|
| 1 Forest | Wooden Pickaxe | Forest Guardian (optional) | — | — | — | — |
| 2 Cave | Stone Pickaxe | Skeleton Archer (optional) | Bat Cave / Forge | Ancient Shrine | ✓ | — |
| 3 Mountain | Iron Armor | Blaze Guardian (**mandatory**) | Bastion / TNT Storage | Piglin Merchant | ✓ | ✓ |
| 4 Nether | — | — | — | — | — | — |

Adding a round is one entry in `round-config.ts` plus one palette class.

## State handling

Every panel covers loading, empty, error, and busy. Beyond that:

- **One refresh token.** Any successful mutation bumps `refreshToken` in
  `RoundShell`; every child takes it as a prop and refetches. A craft updates the
  resource bar, a guardian win updates crafting eligibility — no manual reload.
- **Network loss never blanks the screen.** A failed poll sets an `offline` /
  `stale` flag and keeps the last known data. Only a first-load failure shows a
  full error state.
- **Drafts are local-first.** Question answers persist to `localStorage` per
  round+question and are cleared only once the server confirms the submission.
- **Server clock wins.** Timers render from `ends_at` / `deadline_at`, never from
  a client-side countdown that could drift or be tampered with.
- **Error codes become sentences.** Each panel maps API codes
  (`ROUND_LOCKED`, `ALREADY_BUILT`, `COOLDOWN`, `NO_QUESTIONS`, `INSUFFICIENT_FUNDS`…)
  to copy a competing team can act on.
- **Destructive actions confirm.** Choice events and PvP voids require an explicit
  confirm; choices state plainly that they cannot be replayed.
- **Passive items show no button.** Totem, Retry Token and Strength Potion are spent
  by the server at the right moment, so the inventory does not offer a Use action
  that would mislead.

## Endpoints added for the UI

Both were missing, which is why the panels could not be state-aware:

- `GET /api/team/structures?round_id=` — the team's chosen structure, its state,
  and the catalog with upgrade/repair costs.
- `GET /api/team/choices?choice_key=` — choice catalog with server-side deltas
  plus whether this team already decided.

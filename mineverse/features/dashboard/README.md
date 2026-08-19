# Dashboard → Rounds flow

## Sequence

1. `/dashboard` renders `VideoBackground` over a static `background1.webp`.
2. Clicking Steve opens the **map modal**. That modal is the round navigation:
   one biome button per round, revealed as the previous round completes, each
   driven by `can_enter` from `/api/dashboard/data`.
3. Choosing a biome plays `transition1.mp4` and then routes to `/round<id>`.

`round-portals.tsx` — an overlay of cards laid over
`transitioin_from_dashboard_to_fourseason.mp4` — was the previous design. The
slider and that video were removed in `c351930` and the component was left
imported but never rendered, along with the dev-mode banner inside it. Both are
gone now; the banner moved to `progress-panel.tsx` where it can actually be seen.

## What is on the screen

| Piece | File | Shows |
|---|---|---|
| Stats HUD (top right) | `video-background.tsx` | team name and the seven resource balances |
| Progress panel (top left) | `progress-panel.tsx` | crafted items, PvP eligibility, Day 2 status, portal requirements, the dev-mode warning, and links to `/portal`, `/qualification` and `/leaderboard` |
| Map modal | `video-background.tsx` | the biome buttons that enter each round |
| Resource history | `resource-ledger.tsx` | paginated `resource_ledger`, opened from the progress panel |

All of them read one snapshot from `GET /api/dashboard/data`. That route is
deliberately a single query set rather than the dashboard fanning out to
`/api/team/craft/recipes`, `/day2/status` and the rest — those guard on Day 2
qualification and return 403s that a status page should not be treating as
errors.

Everything here is display-only. Dashboard state is never permission to act:
each linked page and every mutation re-checks on the server.

## Dev mode

Set in `.env.local`:

```
NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS=true
```

This unlocks every round without an admin unlocking them in round control. It
is read in one place (`lib/gameplay/dev-mode.ts`) and honoured by both server-side
access checks, so the button state and the API always agree:

- `lib/gameplay/questions/access.ts` — Dev 4 routes (questions, submissions)
- `lib/gameplay/utils/access.ts` — Dev 3 routes (guardians, structures, marketplace, choices)
- `lib/gameplay/round-access.ts` — the round pages themselves

It bypasses **only the round lock**. A valid team session is still required, and
resource mutations, idempotency, and grading are untouched. The progress panel
shows a "Dev mode" warning while the flag is on, so it is never ambiguous.

**Never set this in production.** It is opt-in and absent by default; the server
logs a warning on every bypass.

## Round state

`/api/dashboard/data` returns one normalized shape per round so the UI does not have
to recombine round status and per-team lock state:

| Field | Meaning |
|---|---|
| `can_enter` | Card is clickable — `!is_locked && round_status === 'active'`, or dev unlock |
| `unlocked_by_dev_mode` | Only enterable because the dev flag is on |
| `completed_at` | Card shows "Replay" instead of "Enter" |

The dashboard polls this every 10s and also refetches on the `round_status`
broadcast an admin sends when unlocking a round.

## Access

Every round page calls `requireRoundAccess(roundId)` before rendering anything. It
redirects to `/login` without a session and to `/dashboard` without access, and it
delegates to `verifyTeamRoundAccess` — the same helper the round APIs use — so a
page and the endpoints it calls cannot disagree about who is let in.

That is a redirect for the sake of the user, not a security boundary. Every
mutation re-validates on its own.

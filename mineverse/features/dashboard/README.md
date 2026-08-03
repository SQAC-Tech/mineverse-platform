# Dashboard → Rounds flow

## Sequence

1. `/dashboard` renders `VideoBackground`, which loops `dashvid.mp4` with a crossfade.
2. Dragging the slider to the right end crossfades **straight into `transitioin_from_dashboard_to_fourseason.mp4`**.
3. When it ends it holds on its final frame — the four-season screen — and the four
   `RoundPortals` cards fade in over the video's four panels.
4. Each card routes to `/round/<id>`, which renders the Phase 2 `RoundShell`
   (questions, resources, crafting, and the PvP panel on round 3).

The old `vid2.mp4` hand-off and its "Play Video 3" button were removed — there is
one transition now, not two.

## Aligning the portals with the video

`round-portals.tsx` positions each card by the horizontal centre of its panel:

```ts
const PANEL_CENTERS_PCT = [16.5, 38.5, 61.5, 83.5];
```

These are percentages of viewport width. If `transitioin_from_dashboard_to_fourseason.mp4` is re-cut and the panels
move, adjust these four numbers — nothing else needs to change. Vertical position
is `bottom: 11%` on `.portal-card`.

Below 900px wide the overlay becomes a scrollable vertical stack instead, because
the video panels are too small to sit cards on.

## Dev mode

Set in `.env.local`:

```
NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS=true
```

This unlocks all four rounds without an admin unlocking them in round control. It
is read in one place (`lib/gameplay/dev-mode.ts`) and honoured by both server-side
access checks, so the button state and the API always agree:

- `lib/gameplay/questions/access.ts` — Dev 4 routes (questions, submissions)
- `lib/gameplay/utils/access.ts` — Dev 3 routes (guardians, structures, marketplace, choices)

It bypasses **only the round lock**. A valid team session is still required, and
resource mutations, idempotency, and grading are untouched. Cards unlocked this way
show a `dev unlock` badge and the screen shows a "Dev mode" banner, so it is never
ambiguous whether the flag is on.

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

## Note

`app/round1/page.tsx` is the pre-Phase-2 prototype with hardcoded questions. Nothing
links to it any more — the portals go to `/round/1`. It is left in place rather than
deleted in case its visuals are still wanted.

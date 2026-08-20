'use client';

import { STEVE_FRAMES, type Loadout } from '@/features/dashboard/gear';

interface SteveAvatarProps {
  loadout: Loadout;
}

/**
 * The team's character, at the tier the team has actually reached.
 *
 * One sheet, five frames, moved with `background-position`. Each frame is an
 * equal fifth of the sheet, so with `background-size: 500%` the nth frame sits
 * at `n / (frames - 1) * 100%` — 0%, 25%, 50%, 75%, 100%. The sheet was
 * re-cut so the figures share a feet line and a centre; without that the glow on
 * the last two frames would make Steve jump when a team crafted its way up.
 *
 * The frame is art and the caption is the record. Frame 0 draws a wooden
 * pickaxe because there is no empty-handed frame, so a team with nothing crafted
 * reads "No gear crafted yet" underneath rather than a claim to a pickaxe.
 */
export function SteveAvatar({ loadout }: SteveAvatarProps) {
  return (
    <div
      className="steve"
      role="img"
      aria-label={`${loadout.title}: ${loadout.caption}`}
      style={{ backgroundPositionX: `${(loadout.frame / (STEVE_FRAMES - 1)) * 100}%` }}
    />
  );
}

'use client';

import './hotbar.css';
import { RESOURCE_META, type ResourceKey } from '@/components/game/custom-round-ui/round-presentation';

interface HotbarProps {
  /** Live balances. A missing key reads as zero, never as an empty slot. */
  balance: Partial<Record<ResourceKey, number>> | null | undefined;
  /** 1–9. The highlighted slot; purely cosmetic, as in the game. */
  activeSlot?: number;
  onSelect?: (slot: number) => void;
  /** Caps the bar's width so nine slots stay square. */
  maxWidth?: string;
}

/**
 * The nine-slot inventory, one component for the rounds and the dashboard.
 *
 * Seven resources in `RESOURCE_META` order, then two empty slots — the shape is
 * the game's, not the data's, so the bar does not reflow when a team is holding
 * nothing. Both round shells drew this markup separately before; they now render
 * this, so the dashboard genuinely shows the same inventory rather than one that
 * looks like it.
 */
export function Hotbar({ balance, activeSlot, onSelect, maxWidth }: HotbarProps) {
  return (
    <div
      className="mv-hotbar"
      aria-label="Inventory hotbar"
      style={maxWidth ? ({ ['--hb-max' as string]: maxWidth } as React.CSSProperties) : undefined}
    >
      {Array.from({ length: 9 }).map((_, index) => {
        const slot = index + 1;
        const item = RESOURCE_META[index];
        const count = item ? balance?.[item.key] ?? 0 : 0;

        return (
          <button
            key={item?.key ?? `empty-${slot}`}
            type="button"
            title={item?.label ?? 'Empty slot'}
            aria-label={item ? `${item.label}: ${count}` : 'Empty inventory slot'}
            className={activeSlot === slot ? 'mv-slot mv-slot--active' : 'mv-slot'}
            onClick={() => onSelect?.(slot)}
          >
            {item && (
              <>
                <img src={item.icon} alt="" />
                <b>{count}</b>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

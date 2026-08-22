'use client';

import './hotbar.css';
import { RESOURCE_META, type ResourceKey } from '@/components/game/custom-round-ui/round-presentation';

interface HotbarProps {
  /** Live balances. A missing key reads as zero, never as an empty slot. */
  balance: Partial<Record<ResourceKey, number>> | null | undefined;
  /** Crafted items to display */
  crafted?: { item: string; label: string; crafted: boolean }[];
  /** 1–N. The highlighted slot; purely cosmetic, as in the game. */
  activeSlot?: number;
  onSelect?: (slot: number) => void;
  /** Caps the bar's width so slots stay square. */
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
export function Hotbar({ balance, activeSlot, onSelect, maxWidth, crafted = [] }: HotbarProps) {
  // Combine base resources and any successfully crafted items
  const craftedAcquired = crafted.filter(c => c.crafted);
  const totalSlots = Math.max(9, RESOURCE_META.length + craftedAcquired.length);
  
  return (
    <div
      className="mv-hotbar"
      aria-label="Inventory hotbar"
      style={maxWidth ? ({ ['--hb-max' as string]: maxWidth, gridTemplateColumns: `repeat(${totalSlots}, 1fr)` } as React.CSSProperties) : { gridTemplateColumns: `repeat(${totalSlots}, minmax(40px, 1fr))` }}
    >
      {Array.from({ length: totalSlots }).map((_, index) => {
        const slot = index + 1;
        const resourceItem = index < RESOURCE_META.length ? RESOURCE_META[index] : null;
        const craftedIndex = index - RESOURCE_META.length;
        const craftedItem = craftedIndex >= 0 && craftedIndex < craftedAcquired.length ? craftedAcquired[craftedIndex] : null;
        
        let icon = null;
        let count: number | string = '';
        let label = 'Empty slot';
        
        if (resourceItem) {
          icon = resourceItem.icon;
          count = balance?.[resourceItem.key] ?? 0;
          label = `${resourceItem.label}: ${count}`;
        } else if (craftedItem) {
          icon = `/${craftedItem.item}.jpg`;
          count = 1;
          label = craftedItem.label;
        }

        return (
          <button
            key={resourceItem?.key ?? craftedItem?.item ?? `empty-${slot}`}
            type="button"
            title={label}
            aria-label={label}
            className={activeSlot === slot ? 'mv-slot mv-slot--active' : 'mv-slot'}
            onClick={() => onSelect?.(slot)}
          >
            {icon && (
              <>
                <img src={icon} alt="" />
                <b>{count}</b>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

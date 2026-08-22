import React from 'react';
import { Trophy } from 'lucide-react';
import type { ResourceKey } from '@/components/game/custom-round-ui/round-presentation';
import { RESOURCE_META } from '@/components/game/custom-round-ui/round-presentation';
import './round-ui.css';

interface CraftingRecipe {
  item: string;
  label: string;
  cost: Partial<Record<ResourceKey, number>>;
  costText: string;
  unlockRoundId?: number | null;
}

interface MinecraftCraftingTableProps {
  craft: CraftingRecipe;
  canCraft: boolean;
  crafting: boolean;
  craftShortfall: { key: string; short: number }[];
  onCraft: () => void;
}

export function MinecraftCraftingTable({ craft, canCraft, crafting, craftShortfall, onCraft }: MinecraftCraftingTableProps) {
  // Distribute the cost items across the 9 grid slots for a visual effect
  const gridItems: { icon: string; count: number; key: string }[] = [];
  
  Object.entries(craft.cost).forEach(([key, need]) => {
    const meta = RESOURCE_META.find(r => r.key === key);
    if (meta && typeof need === 'number' && need > 0) {
      gridItems.push({ icon: meta.icon, count: need, key });
    }
  });

  return (
    <div className="mc-crafting-table" aria-label="Minecraft Crafting Table">
      <div className="mc-grid-container">
        <p className="mc-crafting-title">Crafting</p>
        <div className="mc-grid">
          {Array.from({ length: 9 }).map((_, index) => {
            const item = gridItems[index]; // Place them in order for now
            return (
              <div key={index} className="mc-slot">
                {item && (
                  <>
                    <img src={item.icon} alt={item.key} title={`${item.count} ${item.key}`} />
                    <span className="mc-slot-count">{item.count}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mc-arrow">
        <div className="mc-arrow-inner"></div>
      </div>
      
      <div className="mc-result-container">
        <button 
          className="mc-slot mc-slot-result"
          disabled={!canCraft || crafting}
          onClick={onCraft}
          title={crafting ? 'Crafting...' : canCraft ? `Craft ${craft.label}` : `Need ${craftShortfall.map(s => `${s.short} ${s.key}`).join(', ')}`}
        >
          <img src={`/${craft.item}.jpg`} alt={craft.label} />
        </button>
        <div className="mc-result-meta">
          <p className="mc-result-label">{craft.label}</p>
          <p className="mc-result-cost">{craft.costText}</p>
        </div>
      </div>
    </div>
  );
}

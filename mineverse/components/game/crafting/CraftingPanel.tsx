'use client';

import { useEffect, useState } from 'react';

interface Recipe {
  item: 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_armor';
  label: string;
  actual_cost: Record<string, number>;
  discount_percent: number;
  discount_source: string | null;
  crafted: boolean;
}

export function CraftingPanel({ onCrafted }: { onCrafted: () => void | Promise<void> }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [crafting, setCrafting] = useState<string | null>(null);

  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/team/craft/recipes', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRecipes(json.data.recipes ?? []);
      else setError(json.error?.message ?? 'Crafting unavailable');
    } catch {
      setError('Crafting unavailable');
    }
  };

  useEffect(() => {
    void fetchRecipes();
  }, []);

  const craft = async (item: Recipe['item']) => {
    setCrafting(item);
    setError(null);
    try {
      const res = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'Craft failed');
        return;
      }
      await fetchRecipes();
      await onCrafted();
    } catch {
      setError('Craft failed');
    } finally {
      setCrafting(null);
    }
  };

  return (
    <section className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-lg font-semibold text-white">Crafting</h2>
      <p className="mt-1 text-xs text-zinc-500">Forge discounts round each resource cost up.</p>
      {error ? <div className="mt-3 rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-100">{error}</div> : null}
      <div className="mt-3 flex flex-col gap-3">
        {recipes.map((recipe) => (
          <div key={recipe.item} className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-zinc-100">{recipe.label}</h3>
              {recipe.crafted ? <span className="text-xs text-emerald-300">Crafted</span> : null}
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              {Object.entries(recipe.actual_cost).map(([key, value]) => `${value} ${key}`).join(' + ')}
            </div>
            {recipe.discount_percent > 0 ? <div className="mt-1 text-xs text-amber-200">{recipe.discount_percent}% {recipe.discount_source}</div> : null}
            <button
              type="button"
              onClick={() => craft(recipe.item)}
              disabled={recipe.crafted || crafting === recipe.item}
              className="mt-3 w-full rounded bg-amber-700 px-3 py-2 text-sm text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {crafting === recipe.item ? 'Crafting...' : recipe.crafted ? 'Done' : 'Craft'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
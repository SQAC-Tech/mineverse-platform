'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Hammer, Check, AlertTriangle, Lock } from 'lucide-react';
import { Panel, Btn, Pill, Loading } from '@/components/admin/nether-ui';

interface Recipe {
  item: 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_armor';
  label: string;
  actual_cost: Record<string, number>;
  base_cost?: Record<string, number>;
  crafted: boolean;
  /** Present when the API reports the progression gate is unmet. */
  locked?: boolean;
}

interface CraftingPanelProps {
  onCrafted: () => void | Promise<void>;
  refreshToken?: number;
}

export function CraftingPanel({ onCrafted, refreshToken }: CraftingPanelProps) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crafting, setCrafting] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await fetch('/api/team/craft/recipes', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) { setRecipes(json.data.recipes ?? []); setError(null); }
      else setError(json.error?.message ?? 'Crafting is unavailable.');
    } catch {
      setError('Could not reach the server.');
    }
  }, []);

  useEffect(() => { void fetchRecipes(); }, [fetchRecipes, refreshToken]);

  const craft = async (recipe: Recipe) => {
    setCrafting(recipe.item);
    setError(null);
    try {
      const res = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: recipe.item }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(craftErrorCopy(json.error?.code, json.error?.message, recipe.label));
        return;
      }

      toast.success(`${recipe.label} crafted`);
      await fetchRecipes();
      await onCrafted();
    } catch {
      setError('Could not reach the server. Nothing was spent.');
    } finally {
      setCrafting(null);
    }
  };

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Hammer size={13} /> Crafting</span>}
      subtitle="Each item is crafted once, and unlocks the next stage"
    >
      {error && (
        <div
          style={{
            display: 'flex', gap: 8, padding: 9, marginBottom: 10, fontSize: 10.5,
            background: 'rgb(from var(--accent-danger) r g b / 45%)',
            border: '1px solid #a3324a', color: '#ff9db0',
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {!recipes ? (
        <Loading label="Loading recipes" />
      ) : recipes.length === 0 ? (
        <div className="n-empty">No recipes available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recipes.map((recipe) => (
            <div
              key={recipe.item}
              style={{
                padding: 10,
                background: 'var(--bg-void)',
                border: `1px solid ${recipe.crafted ? 'rgb(74 222 128 / 45%)' : 'rgb(from var(--accent-muted) r g b / 25%)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11 }}>{recipe.label}</span>
                {recipe.crafted && <Pill tone="ok"><Check size={10} /> crafted</Pill>}
              </div>

              <div className="n-panel-sub n-mono" style={{ marginBottom: 9 }}>
                {Object.entries(recipe.actual_cost).map(([k, v]) => `${v} ${k}`).join(' + ')}
              </div>

              {!recipe.crafted && (
                <Btn
                  variant="primary"
                  small
                  style={{ width: '100%' }}
                  disabled={crafting !== null}
                  onClick={() => craft(recipe)}
                >
                  {crafting === recipe.item ? 'Crafting…' : <><Hammer size={11} /> Craft</>}
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function craftErrorCopy(code?: string, message?: string, label?: string) {
  const text = (message ?? '').toLowerCase();
  if (text.includes('progression')) return `Craft the previous item before ${label ?? 'this one'}.`;
  if (text.includes('already crafted')) return 'You have already crafted this.';
  if (text.includes('insufficient') || code === 'INSUFFICIENT_RESOURCES') return 'Not enough resources yet — keep answering questions.';
  return message ?? code ?? 'Craft failed.';
}

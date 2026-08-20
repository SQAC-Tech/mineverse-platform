'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Hammer, Check, Lock, X } from 'lucide-react';

import {
  CRAFT_ORDER,
  CRAFT_RECIPES,
  craftAvailability,
  type CraftItem,
} from '@/lib/gameplay/crafting/rules';
import { resourceMeta } from '@/components/game/custom-round-ui/round-presentation';
import { ItemIcon } from '@/components/game/inventory/ItemIcon';

/**
 * The crafting table in the corner of the dashboard, and the grid it opens.
 *
 * Crafting is not round-scoped: `POST /api/team/craft` only requires a session,
 * and `craft_team_item` in the database enforces the cost, the one-per-team
 * rule and the prerequisite chain. So a team can craft from the dashboard as
 * well as mid-round, and the server is what decides either way.
 *
 * The grid shows *why* a recipe is unavailable. The old panel had a `locked`
 * flag that the API never actually sets, so every recipe looked craftable and a
 * team only found out by pressing the button and getting an error. The gates in
 * `rules.ts` mirror the RPC so the reason can be stated up front.
 */

interface CraftingTableProps {
  /** Live balances, for the shortfall readout. */
  balance: Record<string, number>;
  /** Items already in the crafting log. */
  crafted: string[];
  qualifiedForDay2: boolean;
  portalRepaired: boolean;
  /** Refetch the dashboard snapshot after a successful craft. */
  onCrafted: () => void | Promise<void>;
}

export function CraftingTable(props: CraftingTableProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ct-block"
        onClick={() => setOpen(true)}
        aria-label="Open the crafting table"
        title="Crafting table"
      >
        {/* The rendered block from public/, trimmed of its transparent padding.
            A CSS cube was here first; the real art reads better at this size. */}
        <img className="ct-block__art" src="/crafting-table.webp" alt="" aria-hidden="true" />
        <span className="ct-block__label">CRAFT</span>
      </button>

      {open && <CraftingGrid {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

// ───────────────────────────────────────────────────────── the grid

function CraftingGrid({
  balance,
  crafted,
  qualifiedForDay2,
  portalRepaired,
  onCrafted,
  onClose,
}: CraftingTableProps & { onClose: () => void }) {
  const [selected, setSelected] = useState<CraftItem>(() => {
    // Open on the first thing the team has not made yet, not always on the
    // wooden pickaxe a Day 2 team crafted hours ago.
    const owned = new Set(crafted);
    return CRAFT_ORDER.find((item) => !owned.has(item)) ?? CRAFT_ORDER[0];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const context = useMemo(
    () => ({ crafted, balance, qualifiedForDay2, portalRepaired }),
    [crafted, balance, qualifiedForDay2, portalRepaired],
  );

  const recipe = CRAFT_RECIPES[selected];
  const state = craftAvailability(selected, context);

  /* The nine slots. A recipe is a bag of ingredients, not a shaped pattern, so
     they fill the grid in reading order rather than pretending to be a real
     Minecraft layout the server would check. */
  const slots = useMemo(() => {
    const entries = Object.entries(recipe.base_cost).map(([key, need]) => ({ key, need: Number(need ?? 0) }));
    return Array.from({ length: 9 }, (_, index) => entries[index] ?? null);
  }, [recipe]);

  const craft = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: selected }),
      });
      const payload = await response.json();

      if (!payload.success) {
        setError(craftError(payload.error?.code, payload.error?.message, recipe.label));
        return;
      }

      toast.success(`${recipe.label} crafted`);
      await onCrafted();
    } catch {
      // The request never landed, so nothing was spent — say so, because the
      // alternative reading is that resources vanished.
      setError('Could not reach the server. Nothing was spent.');
    } finally {
      setBusy(false);
    }
  }, [selected, recipe.label, onCrafted]);

  return (
    <div className="ct__backdrop" onClick={onClose} role="presentation">
      <div
        className="ct"
        role="dialog"
        aria-modal="true"
        aria-label="Crafting"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ct__head">
          <Hammer size={15} aria-hidden="true" />
          <b>CRAFTING</b>
          <button ref={closeRef} type="button" className="ct__close" onClick={onClose} aria-label="Close crafting">
            <X size={15} />
          </button>
        </header>

        <div className="ct__body">
          <nav className="ct__recipes" aria-label="Recipes">
            {CRAFT_ORDER.map((item) => {
              const entry = CRAFT_RECIPES[item];
              const status = craftAvailability(item, context);
              return (
                <button
                  key={item}
                  type="button"
                  className={item === selected ? 'ct__recipe ct__recipe--on' : 'ct__recipe'}
                  onClick={() => {
                    setSelected(item);
                    setError(null);
                  }}
                  aria-current={item === selected}
                >
                  <span className="ct__recipe-name">{entry.label}</span>
                  {status.crafted ? (
                    <Check size={12} className="ct__ok" aria-label="Crafted" />
                  ) : status.locked ? (
                    <Lock size={11} className="ct__lock" aria-label="Locked" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="ct__bench">
            <div className="ct__grid" aria-label={`${recipe.label} ingredients`}>
              {slots.map((slot, index) => {
                const meta = slot ? resourceMeta(slot.key) : null;
                const held = slot ? balance[slot.key] ?? 0 : 0;
                const short = slot ? held < slot.need : false;
                return (
                  <div
                    key={slot?.key ?? `empty-${index}`}
                    className={short ? 'ct-slot ct-slot--short' : 'ct-slot'}
                    title={slot ? `${meta?.label ?? slot.key}: need ${slot.need}, have ${held}` : undefined}
                  >
                    {slot && (
                      <>
                        {meta && <img src={meta.icon} alt="" />}
                        <b>{slot.need}</b>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ct__arrow" aria-hidden="true" />

            <div className="ct__result">
              <div className={state.crafted ? 'ct-slot ct-slot--done' : 'ct-slot'}>
                <ItemIcon item={selected} className="ct__result-icon" />
              </div>
              <span className="ct__result-name">{recipe.label}</span>
            </div>
          </div>
        </div>

        <footer className="ct__foot">
          {state.crafted ? (
            <p className="ct__status ct__status--done">
              <Check size={12} /> ALREADY CRAFTED
            </p>
          ) : state.locked ? (
            <p className="ct__status ct__status--locked">
              <Lock size={12} /> {state.blockedBy.join(' · ')}
            </p>
          ) : state.shortfall.length > 0 ? (
            <p className="ct__status ct__status--short">
              NEED{' '}
              {state.shortfall
                .map((entry) => `${entry.short} ${resourceMeta(entry.key)?.label ?? entry.key}`)
                .join(', ')}
            </p>
          ) : (
            <p className="ct__status">READY &middot; SPENDS THE INGREDIENTS</p>
          )}

          {error && <p className="ct__error">{error}</p>}

          <button type="button" className="ct__craft" disabled={!state.canCraft || busy} onClick={() => void craft()}>
            <Hammer size={13} /> {busy ? 'CRAFTING…' : 'CRAFT'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * The RPC's failure modes, in words a team can act on.
 *
 * Worth stating precisely: `INSUFFICIENT_RESOURCES` and a network failure both
 * leave the team's balance untouched, and a team that is not told that will
 * assume it just lost the ingredients.
 */
function craftError(code: string | undefined, message: string | undefined, label: string) {
  switch (code) {
    case 'INSUFFICIENT_RESOURCES':
      return `Not enough resources for the ${label}. Nothing was spent.`;
    case 'ALREADY_CRAFTED':
      return `${label} has already been crafted.`;
    case 'PROGRESSION_REQUIRED':
      return `Craft the previous item before the ${label}.`;
    case 'DAY2_NOT_QUALIFIED':
      return 'Your team has not qualified for Day 2.';
    case 'PORTAL_NOT_REPAIRED':
      return 'Repair the Nether Portal before crafting this.';
    case 'INVALID_ITEM':
      return 'That is not a craftable item.';
    case 'UNAUTHORIZED':
      return 'Your session expired. Log in again.';
    default:
      return message ?? 'Crafting failed. Nothing was spent.';
  }
}

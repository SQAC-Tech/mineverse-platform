'use client';

import { ArrowRight, Check, Flag } from 'lucide-react';
import { MinecraftCraftingTable } from './MinecraftCraftingTable';
import type { ResourceKey } from './round-presentation';

interface RoundCraftPromptProps {
  roundName: string;
  craft: {
    item: string;
    label: string;
    cost: Partial<Record<ResourceKey, number>>;
    costText: string;
    unlockRoundId?: number | null;
  };
  /** True once this round's item is in the crafting log. */
  crafted: boolean;
  canCraft: boolean;
  crafting: boolean;
  craftShortfall: { key: string; short: number }[];
  onCraft: () => void;
  onContinue: () => void;
}

/**
 * The card a team sees the moment they hand a round in.
 *
 * The crafting table used to live inside the round as a floating button, which
 * put it in competition with the questions: it was on screen for the whole
 * timed hour, and a team could equally finish the round having never noticed
 * it — and then be stopped at the next biome by a pickaxe they never made.
 *
 * Submitting is the right moment to ask. The round is over so nothing is being
 * taken away from it, the resources the round paid out are already banked, and
 * crafting is the one thing standing between here and the next biome. Crafting
 * is session-scoped rather than round-scoped, so a closed round does not stop
 * it — this asks after the paper is sealed precisely because it still can.
 *
 * Skipping stays possible. A team that cannot afford the recipe yet has to be
 * able to leave, and the dashboard carries the same bench.
 */
export function RoundCraftPrompt({
  roundName,
  craft,
  crafted,
  canCraft,
  crafting,
  craftShortfall,
  onCraft,
  onContinue,
}: RoundCraftPromptProps) {
  return (
    /* `round-ui__modal` is the overlay every other dialog in the round uses —
       fixed, z-30, dimmed. An invented class name here rendered the card inline
       at the bottom of a 100dvh, overflow-hidden container, so finishing the
       round appeared to do nothing at all. */
    <div className="round-ui__modal" role="presentation">
      <div className="round-ui__panel round-ui__confirm rcp" role="dialog" aria-modal="true" aria-label="Craft before moving on">
        <p className="rcp__eyebrow">
          <Flag size={13} aria-hidden="true" /> {roundName} submitted
        </p>

        {crafted ? (
          <>
            <h2 className="rcp__title">
              <Check size={17} aria-hidden="true" /> {craft.label} crafted
            </h2>
            <p className="rcp__body">
              {craft.unlockRoundId
                ? 'The next biome is open to you. An organizer will unlock it when the round begins.'
                : 'Your gear is up to date.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="rcp__title">Craft the {craft.label}</h2>
            <p className="rcp__body">
              {craft.unlockRoundId
                ? `You cannot enter the next biome without it. It costs ${craft.costText}.`
                : `It costs ${craft.costText}.`}
            </p>

            <div className="rcp__bench">
              <MinecraftCraftingTable
                craft={craft as Parameters<typeof MinecraftCraftingTable>[0]['craft']}
                canCraft={canCraft}
                crafting={crafting}
                craftShortfall={craftShortfall}
                onCraft={onCraft}
              />
            </div>

            {!canCraft && craftShortfall.length > 0 && (
              <p className="rcp__short">
                Short by {craftShortfall.map((entry) => `${entry.short} ${entry.key}`).join(', ')}. Earn the rest and
                craft it from the dashboard bench -- the next biome stays shut until you do.
              </p>
            )}
          </>
        )}

        <div className="round-ui__confirm-actions">
          <button type="button" className="round-ui__btn round-ui__btn--go" onClick={onContinue}>
            {crafted ? 'Back to dashboard' : 'Craft later on the dashboard'} <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

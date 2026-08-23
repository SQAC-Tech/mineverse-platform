'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { ROUND_CONFIGS } from '@/lib/gameplay/round-config';
import { CRAFT_RECIPES, type CraftItem } from '@/lib/gameplay/crafting/rules';
import { GUARDIANS, type GuardianName } from '@/lib/gameplay/guardians/config';
import { marketplaceList } from '@/lib/gameplay/marketplace/catalog';
import { RUNTIMES } from '@/lib/gameplay/code/runtimes';
import { RESOURCE_META, deltaText, resourceMeta } from '@/components/game/custom-round-ui/round-presentation';

/**
 * The event rulebook, as a tome a team can open from the dashboard.
 *
 * Almost nothing here is written down twice: the rounds come from
 * `ROUND_CONFIGS`, the recipes from `CRAFT_RECIPES`, the guardian numbers from
 * `GUARDIANS`, the prices from the marketplace catalog and the languages from
 * `RUNTIMES`. A rulebook that restated them would be wrong the first time any
 * of those changed, and a team reading a wrong price is worse than a team
 * reading no price.
 *
 * The dashboard behind it never scrolls; this card does, on its own.
 */

interface RulebookProps {
  onClose: () => void;
}

type ChapterId = 'basics' | 'rounds' | 'questions' | 'crafting' | 'guardians' | 'market' | 'conduct';

const CHAPTERS: Array<{ id: ChapterId; label: string; glyph: string }> = [
  { id: 'basics', label: 'How it works', glyph: '📖' },
  { id: 'rounds', label: 'The rounds', glyph: '🗺️' },
  { id: 'questions', label: 'Question types', glyph: '💻' },
  { id: 'crafting', label: 'Resources & crafting', glyph: '⛏️' },
  { id: 'guardians', label: 'Guardians & events', glyph: '⚔️' },
  { id: 'market', label: 'Marketplace', glyph: '💚' },
  { id: 'conduct', label: 'Rules of play', glyph: '📜' },
];

/** Starting balances, from the event brief's Starting Inventory table. */
const STARTING_INVENTORY: Array<[string, number]> = [
  ['wood', 25],
  ['stone', 10],
  ['iron', 0],
  ['gold', 0],
  ['diamond', 0],
  ['emerald', 5],
  ['obsidian', 0],
];

const QUESTION_TYPES: Array<{ label: string; body: string }> = [
  { label: 'Crossword', body: 'A themed grid of programming terms. Fill every cell; partial grids score partial resources.' },
  { label: 'Aptitude', body: 'Timed reasoning and quantitative questions. One attempt each, no negative marking.' },
  { label: 'Output prediction', body: 'Read a program and state exactly what it prints. Whitespace is normalised; spelling is not.' },
  { label: 'Debugging', body: 'A program that almost works. Find the fault and submit a version that passes every test.' },
  { label: 'Code completion', body: 'A partly written solution with the core logic missing. Finish it in any offered language.' },
  { label: 'Coding', body: 'A full problem statement, LeetCode style. Read from standard input, print to standard output.' },
  { label: 'Logic puzzle', body: 'Reasoning problems with a single defensible answer. Show the answer, not the working.' },
];

export function Rulebook({ onClose }: RulebookProps) {
  const [chapter, setChapter] = useState<ChapterId>('basics');
  const pageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const chapterIndex = CHAPTERS.findIndex((entry) => entry.id === chapter);
  const turn = (step: number) => {
    const next = CHAPTERS[chapterIndex + step];
    if (next) setChapter(next.id);
  };

  // A new chapter starts at its top, not wherever the last one was scrolled to.
  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
  }, [chapter]);

  /**
   * Focus the close button once, when the book opens.
   *
   * This used to share an effect with the Escape listener, keyed on `onClose` —
   * and the dashboard passes `onClose={() => setShowRules(false)}`, a fresh
   * function on every one of its renders. So every ten-second poll re-ran the
   * effect and re-focused the button, and focusing scrolls an element into
   * view: the page jumped back to the top under whoever was reading it.
   *
   * `preventScroll` is belt and braces — nothing should scroll on a focus we
   * only take once, but the cost of being wrong here is the bug we just had.
   */
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  // Kept separate, and keyed on `onClose` because it genuinely calls it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rb__backdrop" onClick={onClose} role="presentation">
      <div
        className="rb"
        role="dialog"
        aria-modal="true"
        aria-label="Mineverse rulebook"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rb__spine" aria-hidden="true" />

        <nav className="rb__index" aria-label="Rulebook chapters">
          <div className="rb__index-title">RULEBOOK</div>
          {CHAPTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === chapter ? 'rb__tab rb__tab--on' : 'rb__tab'}
              onClick={() => setChapter(entry.id)}
              aria-current={entry.id === chapter}
            >
              <span aria-hidden="true">{entry.glyph}</span>
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="rb__page" ref={pageRef} tabIndex={0}>
          {chapter === 'basics' && <Basics />}
          {chapter === 'rounds' && <Rounds />}
          {chapter === 'questions' && <Questions />}
          {chapter === 'crafting' && <Crafting />}
          {chapter === 'guardians' && <Guardians />}
          {chapter === 'market' && <Market />}
          {chapter === 'conduct' && <Conduct />}

          {/* Turning a page beats hunting the spine for the next ribbon. */}
          <nav className="rb__turn" aria-label="Turn the page">
            <button
              type="button"
              className="rb__turn-btn"
              onClick={() => turn(-1)}
              disabled={chapterIndex === 0}
            >
              <ChevronLeft size={13} aria-hidden="true" />
              {CHAPTERS[chapterIndex - 1]?.label ?? 'Back'}
            </button>

            <span className="rb__turn-where">
              {chapterIndex + 1} / {CHAPTERS.length}
            </span>

            <button
              type="button"
              className="rb__turn-btn"
              onClick={() => turn(1)}
              disabled={chapterIndex === CHAPTERS.length - 1}
            >
              {CHAPTERS[chapterIndex + 1]?.label ?? 'Next'}
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </nav>
        </div>

        <button ref={closeRef} type="button" className="rb__close" onClick={onClose} aria-label="Close the rulebook">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── chapters

function Basics() {
  return (
    <>
      <h2 className="rb__h">How Mineverse works</h2>
      <p className="rb__p">
        Your team of 2–3 moves through four biomes by solving coding, debugging and logic challenges. Every correct
        answer pays out resources. Resources buy gear. Gear opens the next biome. The first team to craft the Diamond
        Pickaxe and beat the Final Boss wins.
      </p>

      <h3 className="rb__h3">The loop, every round</h3>
      <ol className="rb__ol">
        <li>Solve the round&apos;s challenges before the timer runs out.</li>
        <li>Collect the resources those answers pay.</li>
        <li>Take on the round&apos;s Guardian for a bonus — optional, except in Round 3.</li>
        <li>Catch a World Event: a five-minute window that doubles one resource.</li>
        <li>Spend Emeralds at the Marketplace on hints, bundles or power-ups.</li>
        <li>Craft the gear that unlocks the next biome.</li>
      </ol>

      <h3 className="rb__h3">You start with</h3>
      <div className="rb__grid">
        {STARTING_INVENTORY.map(([key, amount]) => {
          const meta = resourceMeta(key);
          return (
            <div key={key} className="rb__chip">
              {meta && <img src={meta.icon} alt="" />}
              <b>{amount}</b>
              <span>{meta?.label ?? key}</span>
            </div>
          );
        })}
      </div>
      <p className="rb__note">
        Balances are live. Whatever the inventory bar on your dashboard says is what the server will let you spend.
      </p>
    </>
  );
}

function Rounds() {
  const rounds = Object.values(ROUND_CONFIGS).sort((a, b) => a.id - b.id);

  return (
    <>
      <h2 className="rb__h">The rounds</h2>
      <p className="rb__p">
        Five rounds across two days. A round opens only when the organizers unlock it — a locked biome on your map is
        not a fault.
      </p>

      {rounds.map((round) => (
        <section key={round.id} className="rb__block">
          <div className="rb__block-head">
            <b>
              Round {round.id} — {round.name}
            </b>
            <span>{round.id <= 3 ? 'Day 1' : 'Day 2'}</span>
          </div>
          <p className="rb__p">{round.tagline}.</p>
          <p className="rb__p rb__p--tight">
            <em>Objective:</em> {round.objective}
          </p>
          <div className="rb__tags">
            {round.craft && <span className="rb__tag">Craft: {CRAFT_RECIPES[round.craft].label}</span>}
            {round.guardian && (
              <span className="rb__tag">
                {round.guardian.mandatory ? 'Guardian (required)' : 'Guardian (optional)'}
              </span>
            )}
            {round.marketplace && <span className="rb__tag">Marketplace open</span>}
            {round.pvp && <span className="rb__tag rb__tag--warn">PvP duel</span>}
            {round.id === 3 && <span className="rb__tag rb__tag--warn">Elimination — top 50% advance</span>}
          </div>
        </section>
      ))}

      <p className="rb__note">
        Round 4 is played in the hall, not on the platform. Volunteers run the games and an organizer credits what you
        earn; the platform only handles the Nether Portal repair.
      </p>
    </>
  );
}

function Questions() {
  const languages = Object.values(RUNTIMES).map((runtime) => runtime.label);

  return (
    <>
      <h2 className="rb__h">Question types</h2>
      <p className="rb__p">Every question states what it pays before you answer it. Nothing is ever deducted for a wrong answer.</p>

      {QUESTION_TYPES.map((entry) => (
        <section key={entry.label} className="rb__block">
          <div className="rb__block-head">
            <b>{entry.label}</b>
          </div>
          <p className="rb__p rb__p--tight">{entry.body}</p>
        </section>
      ))}

      <h3 className="rb__h3">Writing code</h3>
      <p className="rb__p">
        Coding, debugging and code-completion questions all open a full editor. You may answer in any of{' '}
        <b>{languages.join(', ')}</b> — pick one per question, and the language you submit in is the language you are
        graded in.
      </p>
      <ul className="rb__ul">
        <li>
          <b>Two sample cases</b> are shown with the question, and you can run against them as often as you like.
        </li>
        <li>
          <b>Three hidden cases</b> decide the score. They are never shown, before or after.
        </li>
        <li>Run your own input in the console before you submit.</li>
        <li>Output is compared with trailing spaces and line endings ignored — nothing else.</li>
        <li>The editor autosaves per question, per team. Refreshing does not lose your work.</li>
      </ul>
    </>
  );
}

function Crafting() {
  const items = Object.keys(CRAFT_RECIPES) as CraftItem[];

  return (
    <>
      <h2 className="rb__h">Resources & crafting</h2>

      <div className="rb__grid">
        {RESOURCE_META.map((meta) => (
          <div key={meta.key} className="rb__chip">
            <img src={meta.icon} alt="" />
            <span>{meta.label}</span>
          </div>
        ))}
      </div>

      <p className="rb__p">
        Resources come from answers, guardians, world events and trades. Every change is written to your resource
        history — open it from the dashboard if a balance ever looks wrong.
      </p>

      <h3 className="rb__h3">Recipes</h3>
      {items.map((item) => {
        const recipe = CRAFT_RECIPES[item];
        return (
          <section key={item} className="rb__block">
            <div className="rb__block-head">
              <b>{recipe.label}</b>
              {recipe.unlock_round_id && <span>Unlocks Round {recipe.unlock_round_id}</span>}
              {recipe.marks_pvp_eligible && <span>Required for PvP</span>}
            </div>
            <div className="rb__cost">
              {Object.entries(recipe.base_cost).map(([key, value]) => {
                const meta = resourceMeta(key);
                return (
                  <span key={key} className="rb__chip rb__chip--sm">
                    {meta && <img src={meta.icon} alt="" />}
                    <b>{value}</b>
                    <span>{meta?.label ?? key}</span>
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="rb__note">
        Crafting spends the resources immediately and cannot be undone. Craft when you have the round&apos;s target, not
        before — the next biome will not open without it.
      </p>
    </>
  );
}

function Guardians() {
  const names = Object.keys(GUARDIANS) as GuardianName[];

  return (
    <>
      <h2 className="rb__h">Guardians</h2>
      <p className="rb__p">
        A guardian is a timed, higher-difficulty challenge with a bonus attached. Beating one pays out; losing one costs
        you. Only the Blaze Guardian in Round 3 is compulsory.
      </p>

      {names.map((name) => {
        const guardian = GUARDIANS[name];
        const label = name.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
        return (
          <section key={name} className="rb__block">
            <div className="rb__block-head">
              <b>{label}</b>
              <span>Round {guardian.round_id}</span>
            </div>
            <p className="rb__p rb__p--tight">
              <em>Win:</em> {deltaText(guardian.victoryReward)}
            </p>
            <p className="rb__p rb__p--tight">
              <em>Lose:</em> {deltaText(guardian.defeatPenalty)}
            </p>
            <p className="rb__p rb__p--tight">
              <em>Time:</em>{' '}
              {guardian.timeLimitSeconds ? `${Math.round(guardian.timeLimitSeconds / 60)} minutes` : 'the round timer'}
            </p>
          </section>
        );
      })}

      <h2 className="rb__h" style={{ marginTop: 22 }}>
        World events
      </h2>
      <p className="rb__p">
        Organizers open a five-minute window that doubles one resource — Heavy Rain, Fertile Marsh, Gold Rush, Chorus
        Fruit Blessing. Events only ever give. <b>Nothing in Mineverse can take resources away except a guardian defeat
        or something you chose to spend.</b>
      </p>

      <h3 className="rb__h3">Choice events</h3>
      <p className="rb__p">
        The Ancient Shrine (Round 2), the Piglin Merchant (Round 3) and the End Merchant (Round 5) each offer a one-time
        trade of one resource for another. Once taken, a choice is final.
      </p>
    </>
  );
}

function Market() {
  return (
    <>
      <h2 className="rb__h">Marketplace</h2>
      <p className="rb__p">
        A wandering Villager Merchant trades for Emeralds, from Round 2 onward. Prices are fixed and do not change
        during the event.
      </p>

      <table className="rb__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Cost</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {marketplaceList().map((entry) => (
            <tr key={entry.item}>
              <td>{entry.label}</td>
              <td className="rb__price">{entry.costEmerald} 💚</td>
              <td>{entry.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="rb__note">
        A hint explains the approach — sort first, then two pointers — and never gives the answer, the hidden tests or
        the expected output.
      </p>
    </>
  );
}

function Conduct() {
  return (
    <>
      <h2 className="rb__h">Rules of play</h2>

      <h3 className="rb__h3">Teams</h3>
      <ul className="rb__ul">
        <li>2 to 3 members, fixed for the whole event. No substitutions after check-in.</li>
        <li>One team account. Everyone shares the same login and the same inventory.</li>
        <li>Your team code is your identity at every desk — keep it with you.</li>
      </ul>

      <h3 className="rb__h3">Fair play</h3>
      <ul className="rb__ul">
        <li>No help from anyone outside your team, in the hall or online.</li>
        <li>No AI assistants during a round. Rounds are proctored and tab switches are recorded.</li>
        <li>Do not share questions, answers or test cases with another team. Both teams lose the points.</li>
        <li>Nothing is gained by attacking the platform. Report anything you find to an organizer — we would rather thank you.</li>
      </ul>

      <h3 className="rb__h3">Timing</h3>
      <ul className="rb__ul">
        <li>A round closes on its timer. The editor goes read-only and late submissions are not graded.</li>
        <li>Buffer time between rounds is for grading and resource verification, not for extra attempts.</li>
        <li>If you lose connection, log back in — your answers are saved as you type.</li>
      </ul>

      <h3 className="rb__h3">Scoring & disputes</h3>
      <ul className="rb__ul">
        <li>Objective answers are graded automatically. Written answers are graded by an organizer.</li>
        <li>Your resource history is the record. Raise anything that looks wrong with an organizer during buffer time.</li>
        <li>Round 3 eliminates the bottom half. Round 5 is decided by who beats the Final Boss first.</li>
        <li>Organizer decisions on grading and conduct are final.</li>
      </ul>
    </>
  );
}

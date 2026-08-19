'use client';

import Link from 'next/link';
import { Check, Lock, ScrollText, Swords, Flame, Trophy, BarChart3, Wrench } from 'lucide-react';
import type { CraftedItem, DashboardProgress } from '@/features/dashboard/types';

interface ProgressPanelProps {
  crafted: CraftedItem[];
  progress: DashboardProgress | null;
  devUnlock: boolean;
  onOpenLedger: () => void;
}

/**
 * The team's carried progress: what it has crafted, and what Day 2 is waiting on.
 *
 * The dashboard used to show resource balances and nothing else, so a team could
 * not tell what it had built, whether it had qualified, or what the portal was
 * still short of. The spec asks for the *specific* reason something is
 * unavailable rather than a generic lock, which is why the portal row lists what
 * is missing by name.
 */
export function ProgressPanel({ crafted, progress, devUnlock, onOpenLedger }: ProgressPanelProps) {
  const portal = progress?.portal;
  const qualified = progress?.qualified_for_day2 ?? false;

  return (
    <div className="progress-panel">
      <div className="progress-panel__title">EQUIPMENT</div>

      {crafted.length === 0 && <div className="progress-panel__empty">Loading…</div>}

      {crafted.map((item) => (
        <div key={item.item} className="progress-panel__row">
          {item.crafted ? (
            <Check size={11} style={{ color: '#55dd77', flexShrink: 0 }} />
          ) : (
            <Lock size={11} style={{ color: '#777777', flexShrink: 0 }} />
          )}
          <span style={{ color: item.crafted ? '#ffffff' : '#888888' }}>{item.label}</span>
        </div>
      ))}

      {progress && (
        <>
          <div className="progress-panel__title" style={{ marginTop: '8px' }}>
            STATUS
          </div>

          <div className="progress-panel__row">
            <Swords size={11} style={{ color: progress.pvp_eligible ? '#55dd77' : '#777777', flexShrink: 0 }} />
            <span style={{ color: progress.pvp_eligible ? '#ffffff' : '#888888' }}>
              {progress.pvp_eligible ? 'PvP eligible' : 'PvP needs Iron Armor'}
            </span>
          </div>

          <div className="progress-panel__row">
            <Trophy size={11} style={{ color: qualified ? '#55dd77' : '#777777', flexShrink: 0 }} />
            <span style={{ color: qualified ? '#ffffff' : '#888888' }}>
              {qualified ? 'Qualified for Day 2' : progress.elimination_reason || 'Day 2 not decided yet'}
            </span>
          </div>

          {/* Day 2 only. Before qualification the portal is noise, not information. */}
          {qualified && portal && (
            <div className="progress-panel__row" style={{ alignItems: 'flex-start' }}>
              <Flame
                size={11}
                style={{ color: portal.is_repaired ? '#55dd77' : '#ffaa00', flexShrink: 0, marginTop: '2px' }}
              />
              <span style={{ color: portal.is_repaired ? '#ffffff' : '#cccccc' }}>
                {portal.is_repaired
                  ? 'Nether Portal repaired'
                  : portal.state === 'ready'
                    ? 'Portal ready to repair'
                    : `Portal needs ${portal.missing.join(', ')}`}
              </span>
            </div>
          )}
        </>
      )}

      {qualified && (
        <Link href="/portal" className="progress-panel__link">
          <Flame size={10} /> NETHER PORTAL
        </Link>
      )}

      <button type="button" onClick={onOpenLedger} className="progress-panel__link">
        <ScrollText size={10} /> RESOURCE HISTORY
      </button>

      {/* /qualification and /leaderboard both worked and neither had a single
          inbound link anywhere in the app. */}
      <Link href="/qualification" className="progress-panel__link">
        <Trophy size={10} /> QUALIFICATION
      </Link>

      <Link href="/leaderboard" className="progress-panel__link">
        <BarChart3 size={10} /> LEADERBOARD
      </Link>

      {/* This warning used to live in the round-portals overlay, which was never
          rendered — so an accidentally-deployed dev flag showed nothing at all. */}
      {devUnlock && (
        <div className="progress-panel__dev">
          <Wrench size={10} /> DEV MODE — ROUNDS UNLOCKED
        </div>
      )}

      <style>{`
        .progress-panel {
          position: absolute;
          top: 40px;
          left: 30px;
          z-index: 10;
          background: rgba(40, 40, 40, 0.88);
          border: 3px solid #555;
          border-top-color: #888;
          border-left-color: #888;
          border-bottom-color: #222;
          border-right-color: #222;
          padding: 12px 14px;
          font-family: var(--font-minecraft), system-ui, sans-serif;
          color: #ffffff;
          text-shadow: 2px 2px 0 #000;
          box-shadow: 0 8px 24px rgba(0,0,0,0.8);
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 200px;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
        }
        .progress-panel__title {
          font-size: 9px;
          letter-spacing: 1px;
          color: #aaaaaa;
          border-bottom: 2px solid #555;
          padding-bottom: 5px;
        }
        .progress-panel__row {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 10px;
          line-height: 1.35;
        }
        .progress-panel__empty { font-size: 10px; color: #888888; }
        .progress-panel__link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 4px;
          padding: 6px 8px;
          border: 2px solid #6a6a6a;
          border-top-color: #8f8f8f;
          border-left-color: #8f8f8f;
          border-bottom-color: #2a2a2a;
          border-right-color: #2a2a2a;
          background: rgba(70, 70, 70, 0.9);
          color: #ffff55;
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 1px;
          text-decoration: none;
          cursor: pointer;
        }
        .progress-panel__link:hover { background: rgba(96,96,96,0.95); color: #ffffff; }
        .progress-panel__dev {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 4px;
          padding: 5px 8px;
          border: 1px solid rgba(255,190,60,0.6);
          background: rgba(255,170,0,0.14);
          color: rgba(255,205,110,0.98);
          font-size: 8px;
          letter-spacing: 1px;
        }

        /* The logo sits top-left and the portals take the lower half, so on a
           short or narrow screen this panel gets out of the way entirely. */
        @media (max-width: 900px), (max-height: 620px) {
          .progress-panel { display: none; }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';

export interface LedgerEntry {
  id: string;
  delta: Partial<Record<string, number>>;
  reason?: string | null;
  source_type?: string | null;
  created_at: string;
}

interface NotificationTrayProps {
  entries: LedgerEntry[];
  pendingGrading: boolean;
  /** Per-round key so the unseen count does not bleed between rounds. */
  storageKey: string;
}

const SOURCE_LABELS: Record<string, string> = {
  question: 'Question',
  guardian: 'Guardian',
  event: 'World event',
  craft: 'Crafting',
  purchase: 'Marketplace',
  choice: 'Trader choice',
  admin: 'Organizer grant',
  adjustment: 'Organizer grant',
};

function sourceLabel(entry: LedgerEntry) {
  if (entry.reason) return entry.reason;
  const key = entry.source_type ?? '';
  return SOURCE_LABELS[key] ?? 'Inventory updated';
}

function deltaParts(delta: LedgerEntry['delta']) {
  return Object.entries(delta ?? {})
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([resource, value]) => ({ resource, value: value as number }));
}

export function NotificationTray({ entries, pendingGrading, storageKey }: NotificationTrayProps) {
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  // The newest entry at mount counts as already seen, so opening a round does
  // not present the whole ledger as unread.
  useEffect(() => {
    setSeenId(window.localStorage.getItem(storageKey));
  }, [storageKey]);

  const seenIndex = seenId ? entries.findIndex((entry) => entry.id === seenId) : -1;
  const unseen = seenId === null ? 0 : seenIndex === -1 ? entries.length : seenIndex;

  const markSeen = () => {
    const newest = entries[0]?.id ?? null;
    setSeenId(newest);
    if (newest) window.localStorage.setItem(storageKey, newest);
  };

  const toggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen) markSeen();
      return !wasOpen;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onClick = (event: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const badge = unseen > 0 ? String(Math.min(unseen, 9)) : pendingGrading ? '•' : null;

  return (
    <div className="nt" ref={trayRef}>
      <button
        className="round-ui__panel round-ui__panel--glass round-ui__icon-btn"
        type="button"
        aria-label={unseen > 0 ? `Notifications, ${unseen} new` : 'Notifications'}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell size={22} aria-hidden="true" />
        {badge && <em className="round-ui__dot">{badge}</em>}
      </button>

      {open && (
        <div className="round-ui__panel nt__panel" role="dialog" aria-label="Notifications">
          <header className="nt__head">
            <p className="round-ui__panel-title">Notifications</p>
            <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>
              <X size={15} />
            </button>
          </header>

          {pendingGrading && (
            <p className="nt__pending">Some answers are still being graded — rewards land here when they are.</p>
          )}

          <p className="nt__section">Resource history</p>

          {entries.length === 0 ? (
            <p className="nt__empty">No resource changes yet. Awards, penalties and purchases show up here.</p>
          ) : (
            <ul className="nt__list">
              {entries.map((entry) => {
                const parts = deltaParts(entry.delta);
                return (
                  <li key={entry.id} className="nt__item">
                    <div className="nt__item-head">
                      <span className="nt__source">{sourceLabel(entry)}</span>
                      <time dateTime={entry.created_at}>
                        {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    <div className="nt__deltas">
                      {parts.length === 0 ? (
                        <span className="nt__delta">Inventory updated</span>
                      ) : parts.map(({ resource, value }) => (
                        <span key={resource} className={value > 0 ? 'nt__delta nt__delta--up' : 'nt__delta nt__delta--down'}>
                          {value > 0 ? '+' : ''}{value} {resource}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

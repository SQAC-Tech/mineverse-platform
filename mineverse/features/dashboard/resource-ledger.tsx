'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ScrollText } from 'lucide-react';
import type { LedgerEntry } from '@/features/dashboard/types';

const RESOURCE_ORDER = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;

const RESOURCE_COLORS: Record<string, string> = {
  wood: '#c8a87a',
  stone: '#aaaaaa',
  iron: '#d8d8d8',
  gold: '#ffaa00',
  diamond: '#55ffff',
  emerald: '#55ff55',
  obsidian: '#9966cc',
};

const SOURCE_LABELS: Record<string, string> = {
  question: 'Question reward',
  guardian: 'Guardian',
  craft: 'Crafting',
  marketplace: 'Marketplace',
  choice: 'Choice event',
  pvp: 'PvP',
  admin_grant: 'Organizer grant',
  world_event: 'World event',
};

function sourceLabel(entry: LedgerEntry) {
  return SOURCE_LABELS[entry.source_type] ?? entry.source_type.replace(/_/g, ' ');
}

/** `+12 Iron, −5 Gold` — the ledger's whole point is that it is legible. */
function deltaParts(delta: Record<string, number> | null) {
  if (!delta) return [];
  return RESOURCE_ORDER.filter((key) => Number(delta[key] ?? 0) !== 0).map((key) => ({
    key,
    amount: Number(delta[key]),
  }));
}

export function ResourceLedger({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (after: string | null) => {
    setLoading(true);
    try {
      const url = after
        ? `/api/team/resources/history?limit=25&cursor=${encodeURIComponent(after)}`
        : '/api/team/resources/history?limit=25';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        // Append, never replace — "Load more" is paging, not refetching.
        setEntries((previous) => (after ? [...previous, ...json.data.entries] : json.data.entries));
        setCursor(json.data.next_cursor ?? null);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Resource history"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 620px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(40,40,40,0.97)',
          border: '3px solid #555',
          borderTopColor: '#888',
          borderLeftColor: '#888',
          borderBottomColor: '#222',
          borderRightColor: '#222',
          fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 16px',
            borderBottom: '2px solid #555',
            fontSize: '12px',
            letterSpacing: '1px',
            color: '#ffff55',
          }}
        >
          <ScrollText size={14} /> RESOURCE HISTORY
          <button
            type="button"
            onClick={onClose}
            aria-label="Close resource history"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {entries.length === 0 && !loading && (
            <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: '11px', color: '#aaaaaa' }}>
              {failed
                ? 'Could not load your history. It will reappear on the next refresh.'
                : 'Nothing yet. Rewards, crafts, purchases and organizer grants all show up here.'}
            </p>
          )}

          {entries.map((entry) => {
            const parts = deltaParts(entry.delta);
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '11px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#ffffff' }}>{sourceLabel(entry)}</div>
                  {entry.reason && (
                    <div style={{ color: '#aaaaaa', fontSize: '10px', marginTop: '3px', wordBreak: 'break-word' }}>
                      {entry.reason}
                    </div>
                  )}
                  <div style={{ color: '#888888', fontSize: '9px', marginTop: '3px' }}>
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  {parts.length === 0 ? (
                    <span style={{ color: '#888888', fontSize: '10px' }}>—</span>
                  ) : (
                    parts.map(({ key, amount }) => (
                      <span key={key} style={{ color: RESOURCE_COLORS[key] ?? '#ffffff', whiteSpace: 'nowrap' }}>
                        {amount > 0 ? '+' : '−'}
                        {Math.abs(amount)} {key.toUpperCase()}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(cursor || loading) && (
          <div style={{ padding: '10px 16px', borderTop: '2px solid #555' }}>
            <button
              type="button"
              disabled={loading || !cursor}
              onClick={() => cursor && void load(cursor)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(70,70,70,0.9)',
                border: '2px solid #6a6a6a',
                borderTopColor: '#8f8f8f',
                borderLeftColor: '#8f8f8f',
                borderBottomColor: '#2a2a2a',
                borderRightColor: '#2a2a2a',
                color: loading ? '#888888' : '#ffff55',
                fontFamily: 'inherit',
                fontSize: '10px',
                letterSpacing: '1px',
                cursor: loading || !cursor ? 'default' : 'pointer',
              }}
            >
              {loading ? 'LOADING…' : 'LOAD MORE'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

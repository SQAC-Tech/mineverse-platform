'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Dices, Plus } from 'lucide-react';
import { Panel, Btn, Table, Empty, Loading, PageTitle, apiCall, Field, uuid } from '@/components/admin/nether-ui';

type ResourceDelta = Partial<Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>>;

type OfflineActivity = {
  key: string;
  label: string;
  round_id: number;
  day: number;
  award: ResourceDelta | null;
  note?: string;
};

/**
 * Canonical physical-game catalog from `docs/event details/Mineverse_Full_Event_Details.md`.
 * Where the brief is deliberately non-numeric the award is left null so the
 * operator enters what the organizers decided on the day, rather than the UI
 * inventing a value.
 */
const ACTIVITIES: OfflineActivity[] = [
  { key: 'cup_stacking', label: 'Cup Stacking', round_id: 2, day: 1, award: { stone: 4, iron: 10 } },
  { key: 'dice_total_guess', label: 'Dice total guess', round_id: 2, day: 1, award: { stone: 4, iron: 10 } },
  { key: 'cup_ball_guess', label: 'Ball under the cup', round_id: 2, day: 1, award: { stone: 4, iron: 10 }, note: 'Optional third game' },
  { key: 'ball_bounce', label: 'Bounce the ball into the cup', round_id: 3, day: 1, award: { iron: 8, gold: 6 } },
  { key: 'marble_odd_even', label: 'Marbles odd or even', round_id: 3, day: 1, award: { iron: 8, gold: 6 } },
  { key: 'memory_challenge', label: 'Memory challenge', round_id: 4, day: 2, award: { diamond: 10 }, note: 'Also grants Portal Fragment ×1' },
  { key: 'spot_the_difference', label: 'Spot the Difference', round_id: 4, day: 2, award: { diamond: 8, emerald: 2 } },
  { key: 'lollipop_soap', label: 'Lollipop and soap', round_id: 4, day: 2, award: null, note: 'Organizer-configured on the day' },
  { key: 'crack_the_code_win', label: 'Crack the code — win', round_id: 4, day: 2, award: { diamond: 8, emerald: 1 } },
  { key: 'crack_the_code_loss', label: 'Crack the code — loss', round_id: 4, day: 2, award: { diamond: 3 } },
  { key: 'cup_flip_win', label: 'Cup flip — win', round_id: 4, day: 2, award: { diamond: 8, emerald: 1 } },
  { key: 'cup_flip_loss', label: 'Cup flip — loss', round_id: 4, day: 2, award: { diamond: 3, emerald: 1 } },
];

const RESOURCES = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;

type TeamRow = { id: string; team_code: string; team_name: string; is_payment_verified: boolean };
type ResultRow = {
  id: string;
  team_id: string;
  round_id: number;
  activity: string;
  award: ResourceDelta;
  volunteer_name: string | null;
  notes: string | null;
  created_at: string;
  teams?: { team_code: string; team_name: string } | null;
};

export default function AdminOfflinePage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [teamId, setTeamId] = useState('');
  const [activityKey, setActivityKey] = useState(ACTIVITIES[0].key);
  const [award, setAward] = useState<ResourceDelta>(ACTIVITIES[0].award ?? {});
  const [volunteer, setVolunteer] = useState('');
  const [notes, setNotes] = useState('');

  const activity = ACTIVITIES.find((a) => a.key === activityKey) ?? ACTIVITIES[0];

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      apiCall<TeamRow[]>('/api/admin/teams'),
      apiCall<{ results: ResultRow[] }>('/api/admin/offline/results'),
    ]);
    if (t.ok) setTeams((t.data ?? []).filter((x) => x.is_payment_verified));
    if (r.ok) setResults(r.data.results ?? []);
    else toast.error(r.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pickActivity = (key: string) => {
    setActivityKey(key);
    const next = ACTIVITIES.find((a) => a.key === key);
    setAward(next?.award ?? {});
  };

  const totalAward = Object.entries(award).filter(([, v]) => Number(v) !== 0);

  const submit = async () => {
    if (!teamId) { toast.error('Select a team'); return; }
    if (totalAward.length === 0) { toast.error('Award cannot be empty'); return; }

    setBusy(true);
    const res = await apiCall('/api/admin/offline/results', {
      method: 'POST',
      body: JSON.stringify({
        team_id: teamId,
        round_id: activity.round_id,
        activity: activity.key,
        award: Object.fromEntries(totalAward.map(([k, v]) => [k, Number(v)])),
        volunteer_name: volunteer.trim() || undefined,
        notes: notes.trim() || undefined,
        // A fresh key per submission; the server also enforces one payout per
        // team/activity/round, so a double-click cannot pay twice.
        idempotency_key: uuid(),
      }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Result recorded and resources awarded');
      setTeamId('');
      setNotes('');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Offline games"
        subtitle="Volunteer-verified physical results. Each activity pays a team once per round — a retry is inert."
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <Panel title="Record a result" subtitle="Awards from the event brief are prefilled and editable">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Team">
              <select className="n-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.team_code} — {t.team_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Activity" hint={`Round ${activity.round_id} · Day ${activity.day}${activity.note ? ` · ${activity.note}` : ''}`}>
              <select className="n-select" value={activityKey} onChange={(e) => pickActivity(e.target.value)}>
                <optgroup label="Day 1">
                  {ACTIVITIES.filter((a) => a.day === 1).map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Day 2">
                  {ACTIVITIES.filter((a) => a.day === 2).map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </optgroup>
              </select>
            </Field>

            {activity.award === null && (
              <p className="n-panel-sub" style={{ color: 'var(--warn)' }}>
                The brief sets no fixed award for this game — enter what the organizers decided.
              </p>
            )}

            <div>
              <span className="n-label">Award</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6 }}>
                {RESOURCES.map((key) => (
                  <label key={key}>
                    <span className="n-panel-sub" style={{ display: 'block', marginBottom: 3 }}>{key}</span>
                    <input
                      type="number"
                      className="n-input"
                      value={award[key] ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAward((prev) => {
                          const next = { ...prev };
                          if (raw === '') delete next[key];
                          else next[key] = Number(raw);
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <Field label="Volunteer (optional)">
              <input className="n-input" value={volunteer} onChange={(e) => setVolunteer(e.target.value)} placeholder="Who verified it" />
            </Field>

            <Field label="Notes (optional)">
              <input className="n-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <Btn variant="primary" disabled={busy || !teamId} onClick={submit}>
              <Plus size={12} /> {busy ? 'Recording…' : 'Record result'}
            </Btn>
          </div>
        </Panel>

        <Panel title={`Recorded (${results?.length ?? 0})`} subtitle="Most recent first">
          {!results ? (
            <Loading label="Loading results" />
          ) : (
            <Table head={['Team', 'Activity', 'Award', 'By', 'When']}>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="n-mono">{r.teams?.team_code ?? r.team_id.slice(0, 8)}</div>
                    <div className="n-panel-sub">R{r.round_id}</div>
                  </td>
                  <td>{ACTIVITIES.find((a) => a.key === r.activity)?.label ?? r.activity}</td>
                  <td className="n-mono">
                    {Object.entries(r.award ?? {}).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ') || '—'}
                  </td>
                  <td className="n-panel-sub">{r.volunteer_name || '—'}</td>
                  <td className="n-panel-sub">{new Date(r.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <Empty colSpan={5}>
                  <Dices size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
                  <div>No offline results recorded yet</div>
                </Empty>
              )}
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}

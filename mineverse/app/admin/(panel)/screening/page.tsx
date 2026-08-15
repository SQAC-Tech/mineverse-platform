'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Award, Clock, Download, Mail, RefreshCw, RotateCcw, Send, Trophy, Users,
} from 'lucide-react';
import {
  Panel, Btn, Table, Empty, Loading, PageTitle, Grid, StatTile, Pill, apiCall,
} from '@/components/admin/nether-ui';

interface RankedTeam {
  team_id: string;
  team_code: string;
  team_name: string;
  rank: number;
  total_score: number;
  raw_score: number;
  bonus_points: number;
  correct_count: number;
  submitted_at: string | null;
  auto_submitted: boolean;
  status: string;
  result: 'shortlisted' | 'rejected' | null;
}

interface Data {
  window: { starts_at: string | null; ends_at: string | null; state: string };
  config: { duration_minutes: number; question_count: number; grant: Record<string, number> };
  stats: { eligible_teams: number; in_progress: number; submitted: number; not_started: number; swept: number };
  ranked: RankedTeam[];
  preview: { cut: number; contested: RankedTeam[]; committed: boolean } | null;
  mail: Record<string, number>;
  committed: boolean;
}

function ist(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function ScreeningAdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [cut, setCut] = useState(20);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'commit' | 'clear' | 'announce' | 'results'>(null);

  const load = useCallback(async () => {
    const res = await apiCall<Data>(`/api/admin/screening?cut=${cut}`);
    if (res.ok) setData(res.data);
    else toast.error(res.message);
  }, [cut]);

  useEffect(() => { void load(); }, [load]);

  // Live enough to watch the window without hammering the ranking query.
  useEffect(() => {
    const poll = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(poll);
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await apiCall<Record<string, number>>('/api/admin/screening', {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) { toast.error(res.message); return; }

    if (action === 'send_announcement') {
      toast.success(`Announcement: ${res.data.sent} sent, ${res.data.skipped} already had it, ${res.data.failed} failed.`);
    } else if (action === 'commit_shortlist') {
      toast.success(`Shortlist frozen — ${res.data.shortlisted} in, ${res.data.rejected} out, ${res.data.granted} granted resources.`);
    } else {
      toast.success('Done.');
    }
    void load();
  };

  const exportCsv = () => {
    if (!data) return;
    const header = 'rank,team_code,team_name,total_score,raw_score,bonus,correct,submitted_at,auto_submitted,result';
    const body = data.ranked
      .map((team) => [
        team.rank, team.team_code, JSON.stringify(team.team_name), team.total_score, team.raw_score,
        team.bonus_points, team.correct_count, team.submitted_at ?? '', team.auto_submitted, team.result ?? '',
      ].join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screening-ranking-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const contested = data?.preview?.contested ?? [];
  const cutScore = useMemo(() => data?.ranked[cut - 1]?.total_score ?? null, [data, cut]);

  if (!data) return <Loading label="Loading screening" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle
        title="Screening Round"
        subtitle={`${data.config.question_count} questions · ${data.config.duration_minutes} minutes · window ${ist(data.window.starts_at)} → ${ist(data.window.ends_at)} IST`}
        actions={<Btn onClick={() => void load()}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={170}>
        <StatTile label="Window" value={<Pill tone={data.window.state === 'open' ? 'live' : data.window.state === 'closed' ? 'ok' : 'idle'}>{data.window.state}</Pill>} icon={<Clock size={14} />} />
        <StatTile label="Eligible teams" value={data.stats.eligible_teams} hint="Payment verified" icon={<Users size={14} />} />
        <StatTile label="Submitted" value={data.stats.submitted} icon={<Trophy size={14} />} />
        <StatTile label="Sitting it now" value={data.stats.in_progress} icon={<Clock size={14} />} />
        <StatTile label="Not started" value={data.stats.not_started} icon={<AlertTriangle size={14} />} />
      </Grid>

      <Panel
        title="Shortlist"
        subtitle={
          data.committed
            ? 'Frozen. Clear it before changing anything — the result mails read from this list.'
            : 'Preview first. Committing freezes the list and grants opening resources.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
              Take top
              <input
                type="number"
                min={1}
                max={data.ranked.length || 1}
                value={cut}
                onChange={(event) => setCut(Math.max(1, Number(event.target.value) || 1))}
                disabled={data.committed}
                className="n-input"
                style={{ width: 74 }}
              />
            </label>
            {data.committed ? (
              <Btn variant="danger" small disabled={busy} onClick={() => setConfirm('clear')}>
                <RotateCcw size={11} /> Clear shortlist
              </Btn>
            ) : (
              <Btn variant="primary" small disabled={busy || data.ranked.length === 0} onClick={() => setConfirm('commit')}>
                <Award size={11} /> Commit top {cut}
              </Btn>
            )}
            <Btn small onClick={exportCsv}><Download size={11} /> CSV</Btn>
          </div>
        }
      >
        {/* The one thing a human should actually look at before committing. */}
        {!data.committed && contested.length > 1 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--warn, #f2c14e)', borderLeft: '3px solid var(--warn, #f2c14e)', fontSize: 11.5, lineHeight: 1.55 }}>
            <strong>{contested.length} teams are tied on {cutScore} points across the cut line.</strong>{' '}
            They are separated by who submitted first — {contested.filter((t) => t.rank <= cut).length} of
            them make it. Check the submit times below before you commit.
          </div>
        )}

        <Table head={['#', 'Team', 'Score', 'Correct', 'Submitted', 'Result', '']}>
          {data.ranked.length === 0 ? (
            <Empty colSpan={7}>Nothing submitted yet. Teams appear here as they hand in.</Empty>
          ) : (
            data.ranked.map((team) => {
              const inCut = data.committed ? team.result === 'shortlisted' : team.rank <= cut;
              const onBoundary = !data.committed && contested.some((t) => t.team_id === team.team_id) && contested.length > 1;
              return (
                <tr
                  key={team.team_id}
                  style={{
                    // A left stripe rather than a row tint: the cut is a property
                    // of the row, not a severity.
                    boxShadow: inCut ? 'inset 3px 0 0 var(--ok, #4ade80)' : 'inset 3px 0 0 transparent',
                    opacity: inCut ? 1 : 0.72,
                  }}
                >
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{team.rank}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{team.team_code}</div>
                    <div className="n-panel-sub">{team.team_name}</div>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{team.total_score}</strong>
                    <div className="n-panel-sub">
                      {team.raw_score}
                      {team.bonus_points > 0 ? ` + ${team.bonus_points} bonus` : ''}
                    </div>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{team.correct_count}</td>
                  <td>
                    <span className="n-panel-sub">{ist(team.submitted_at)}</span>
                    {team.auto_submitted && (
                      <div className="n-panel-sub" style={{ fontSize: 10 }}>ran out of time</div>
                    )}
                    {onBoundary && <div style={{ fontSize: 10, color: 'var(--warn, #f2c14e)' }}>tied at the line</div>}
                  </td>
                  <td>
                    {data.committed ? (
                      <Pill tone={team.result === 'shortlisted' ? 'ok' : 'idle'}>{team.result}</Pill>
                    ) : (
                      <Pill tone={inCut ? 'live' : 'idle'}>{inCut ? 'would take' : 'would cut'}</Pill>
                    )}
                  </td>
                  <td>
                    {!data.committed && (
                      <Btn
                        small
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Delete ${team.team_code}'s attempt? They can then sit the paper again. Only do this for a genuine technical failure.`)) {
                            void act('reset_attempt', { team_id: team.team_id });
                          }
                        }}
                      >
                        Reset
                      </Btn>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </Table>
      </Panel>

      <Panel
        title="Email"
        subtitle="Every send skips teams that already received that mail, so a second click is safe."
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn variant="primary" disabled={busy || data.mail.announcement_pending === 0} onClick={() => setConfirm('announce')}>
            <Send size={12} /> Announce the round ({data.mail.announcement_pending} pending)
          </Btn>
          <Btn
            variant="primary"
            disabled={busy || !data.committed || (data.mail.shortlisted_pending + data.mail.rejected_pending === 0)}
            onClick={() => setConfirm('results')}
          >
            <Mail size={12} /> Send results ({data.mail.shortlisted_pending} in, {data.mail.rejected_pending} out)
          </Btn>
          <span className="n-panel-sub">
            {data.mail.announcement_sent} announced · {data.mail.results_sent} results sent
          </span>
        </div>
        {!data.committed && (
          <p className="n-panel-sub" style={{ marginTop: 10 }}>
            Result mails unlock once a shortlist is committed — they read from the frozen list, not
            from a live sort.
          </p>
        )}
      </Panel>

      {confirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(0,0,0,0.72)',
          }}
        >
          <div className="n-panel" style={{ maxWidth: 460, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="n-panel-title">
              {confirm === 'commit' && `Freeze the top ${cut}?`}
              {confirm === 'clear' && 'Clear the committed shortlist?'}
              {confirm === 'announce' && `Email ${data.mail.announcement_pending} teams?`}
              {confirm === 'results' && `Email ${data.mail.shortlisted_pending + data.mail.rejected_pending} teams their result?`}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              {confirm === 'commit' && (
                <>
                  {cut} teams go through and {Math.max(0, data.ranked.length - cut)} do not. Each
                  qualifier is granted{' '}
                  {Object.entries(data.config.grant).map(([key, value]) => `${value} ${key}`).join(', ') || 'nothing'}.
                  {contested.length > 1 && ` ${contested.length} teams are tied at the line.`}
                </>
              )}
              {confirm === 'clear' && 'The list unfreezes and result mails are blocked again. Resources already granted are not taken back — re-committing will not double-pay.'}
              {confirm === 'announce' && 'Goes to the team lead of every payment-verified team that has not had it yet. This cannot be unsent.'}
              {confirm === 'results' && 'Congratulations to those in, and the sorry note to those out. This cannot be unsent.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setConfirm(null)} disabled={busy}>Cancel</Btn>
              <Btn
                variant={confirm === 'clear' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() => {
                  if (confirm === 'commit') void act('commit_shortlist', { cut });
                  if (confirm === 'clear') void act('clear_shortlist');
                  if (confirm === 'announce') void act('send_announcement');
                  if (confirm === 'results') void act('send_results');
                }}
              >
                {busy ? 'Working…' : 'Yes, do it'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

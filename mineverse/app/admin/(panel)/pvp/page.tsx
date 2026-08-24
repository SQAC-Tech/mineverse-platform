'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Swords, Ban, Trophy, Clock } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Field, Grid, StatTile } from '@/components/admin/nether-ui';
import { startPoll } from '@/lib/client/poll';

/**
 * The duel, from the desk.
 *
 * This page used to be where duels were made: pick two teams from a dropdown,
 * create a draft, press Start, press Resolve. None of that exists any more —
 * teams pair themselves the moment two of them press ENTER PVP, the match
 * starts in the same transaction, and the first team to submit grades both
 * sides and pays the winner.
 *
 * So this is now a window rather than a control panel. The only thing an
 * organiser can still do is void a specific match that has gone wrong, and the
 * only thing worth watching is the queue — because a team sitting in it alone
 * means an odd number entered and somebody has nobody to fight.
 */

type MatchTeam = {
  team_id: string;
  outcome: string | null;
  correct_count: number | null;
  elapsed_ms: number | null;
  teams?: { team_code: string; team_name: string } | null;
};

type MatchRow = {
  id: string;
  status: string;
  pack_id: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  winner_team_id: string | null;
  created_at: string;
  pvp_match_teams?: MatchTeam[];
};

type MatchDetail = MatchRow & {
  question_count: number;
  void_reason: string | null;
  teams: Array<
    MatchTeam & {
      status: string;
      completion_at: string | null;
      eligibility_snapshot: Record<string, unknown>;
    }
  >;
};

type QueueRow = {
  team_id: string;
  year_label: string | null;
  rank_score: number | null;
  joined_at: string;
  teams?: { team_code: string; team_name: string } | null;
};

function waitedFor(since: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** The two sides of a duel as one cell, so the list reads without opening rows. */
function TeamsCell({ match }: { match: MatchRow }) {
  const teams = match.pvp_match_teams ?? [];
  if (teams.length === 0) return <span className="n-panel-sub">—</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {teams.map((team, index) => {
        const won = match.winner_team_id === team.team_id;
        return (
          <span key={team.team_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {index > 0 && <span className="n-panel-sub" style={{ marginRight: 3 }}>vs</span>}
            {won && <Trophy size={11} style={{ color: 'var(--ok, #6cc244)' }} aria-label="winner" />}
            <span className="n-mono" style={won ? { color: 'var(--ok, #6cc244)' } : undefined}>
              {team.teams?.team_code ?? team.team_id.slice(0, 8)}
            </span>
            {team.correct_count != null && (
              <span className="n-panel-sub">({team.correct_count})</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function AdminPvpPage() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Redrawn every second so the queue's waiting times tick rather than sitting
  // at whatever they were when the last poll landed.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await apiCall<{ matches: MatchRow[]; queue: QueueRow[] }>('/api/admin/pvp/matches');
    if (res.ok) {
      setMatches(res.data.matches ?? []);
      setQueue(res.data.queue ?? []);
    } else {
      toast.error(res.message);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await apiCall<MatchDetail>(`/api/admin/pvp/matches/${id}`);
    if (res.ok) setDetail(res.data);
    else toast.error(res.message);
  }, []);

  useEffect(() => {
    void load();
    return startPoll(() => void load(), 30_000);
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  // A live match needs a tighter refresh than the list.
  useEffect(() => {
    if (!detail || detail.status !== 'live') return;
    return startPoll(() => void loadDetail(detail.id), 15_000);
  }, [detail, loadDetail]);

  const doVoid = async () => {
    if (!voidTarget || !voidReason.trim()) { toast.error('A reason is required'); return; }
    setBusy(true);
    const res = await apiCall(`/api/admin/pvp/matches/${voidTarget}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: voidReason.trim() }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Match voided — no award issued, both teams freed for a replay');
      setVoidTarget(null); setVoidReason('');
      void load();
      if (detail) void loadDetail(detail.id);
    } else {
      toast.error(res.message);
    }
  };

  const resolved = (matches ?? []).filter((m) => m.status === 'resolved').length;
  const live = (matches ?? []).filter((m) => m.status === 'live').length;

  return (
    <>
      <PageTitle
        title="PvP duels"
        subtitle="Teams pair themselves and finish their own matches. Nothing here starts or decides a duel — void is the only control."
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={180}>
        <StatTile label="Waiting" value={queue.length} hint="In the queue, unpaired" />
        <StatTile label="Live" value={live} />
        <StatTile label="Resolved" value={resolved} />
        <StatTile label="Total duels" value={matches?.length ?? 0} />
      </Grid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel
          title={`Waiting to be paired (${queue.length})`}
          subtitle="Paired automatically by year, then by standing"
        >
          {queue.length === 0 ? (
            <Empty>
              <Clock size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>Nobody is waiting</div>
            </Empty>
          ) : (
            <>
              <Table head={['Team', 'Year', 'Score', 'Waiting']}>
                {queue.map((row) => (
                  <tr key={row.team_id}>
                    <td>
                      <div className="n-mono">{row.teams?.team_code ?? row.team_id.slice(0, 8)}</div>
                      <div className="n-panel-sub">{row.teams?.team_name ?? ''}</div>
                    </td>
                    <td className="n-panel-sub">{row.year_label ?? '—'}</td>
                    <td className="n-mono">{row.rank_score ?? 0}</td>
                    <td className="n-mono">{waitedFor(row.joined_at)}</td>
                  </tr>
                ))}
              </Table>
              {/*
                * The one thing this page is actually for.
                *
                * Pairing needs two, so an odd queue always leaves exactly one
                * team with nobody to fight. They are not stuck — the next team
                * to enter takes them — but if nobody else is coming, that is a
                * team standing at a screen waiting for something that will
                * never happen, and only the desk can see it.
                */}
              {queue.length % 2 === 1 && (
                <p className="n-panel-sub" style={{ marginTop: 10, color: 'var(--warn)' }}>
                  Odd number waiting — one team will stay unpaired until another enters.
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Match detail"
          subtitle={detail ? detail.id : 'Select a match below'}
          actions={
            detail && (
              <>
                <Pill tone={statusTone(detail.status)}>{detail.status}</Pill>
                {/*
                  * Start and Resolve are gone, deliberately.
                  *
                  * The duel runs itself: teams are paired the moment two of them
                  * press ENTER PVP, the match starts inside that same
                  * transaction, and the first team to press SUBMIT grades both
                  * sides and pays the winner. An organiser pressing Start on a
                  * duel that has already begun, or Resolve on one the teams are
                  * still playing, could only interfere with it.
                  *
                  * Void stays. It is not part of the flow — it is the way out
                  * when a specific match has gone wrong (a team walked out, a
                  * browser died mid-duel) and both sides need to be freed for a
                  * replay. It costs a typed reason.
                  */}
                {detail.status !== 'resolved' && detail.status !== 'voided' && (
                  <Btn small variant="danger" disabled={busy} onClick={() => setVoidTarget(detail.id)}>
                    <Ban size={11} /> Void
                  </Btn>
                )}
              </>
            )
          }
        >
          {!detail ? (
            <Empty>
              <Swords size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>No match selected</div>
            </Empty>
          ) : (
            <>
              <div className="n-panel-sub" style={{ marginBottom: 10 }}>
                {detail.question_count} sealed questions
                {detail.deadline_at && ` · deadline ${new Date(detail.deadline_at).toLocaleTimeString()}`}
              </div>

              <Table head={['Team', 'Correct', 'Elapsed', 'Outcome']}>
                {detail.teams.map((team) => (
                  <tr key={team.team_id}>
                    <td>
                      <div className="n-mono">{team.teams?.team_code ?? team.team_id.slice(0, 8)}</div>
                      <div className="n-panel-sub">{team.teams?.team_name ?? ''}</div>
                    </td>
                    <td className="n-mono">
                      {team.correct_count != null ? `${team.correct_count} / ${detail.question_count}` : '—'}
                    </td>
                    <td className="n-mono">{team.elapsed_ms != null ? `${(team.elapsed_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td>{team.outcome ? <Pill tone={team.outcome === 'won' ? 'ok' : 'danger'}>{team.outcome}</Pill> : '—'}</td>
                  </tr>
                ))}
              </Table>

              {detail.void_reason && (
                <p style={{ marginTop: 10, fontSize: 12.5, color: '#ff9db0' }}>Voided: {detail.void_reason}</p>
              )}

              {detail.status === 'live' && (
                <p className="n-panel-sub" style={{ marginTop: 10 }}>
                  Running now. It ends when either team presses SUBMIT, or when the deadline passes —
                  whichever comes first. Scores appear here once it does.
                </p>
              )}

              {detail.status === 'resolved' && (
                <p className="n-panel-sub" style={{ marginTop: 10 }}>
                  Decided on answers first, then on the faster last correct answer. The winner has already
                  been paid the portal materials and a Nether Core.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`All duels (${matches?.length ?? 0})`}>
          {!matches ? (
            <Loading label="Loading duels" />
          ) : (
            <Table head={['Teams', 'Status', 'Started', 'Resolved', '']}>
              {matches.map((match) => (
                <tr key={match.id}>
                  <td><TeamsCell match={match} /></td>
                  <td><Pill tone={statusTone(match.status)}>{match.status}</Pill></td>
                  <td className="n-panel-sub">{match.started_at ? new Date(match.started_at).toLocaleTimeString() : '—'}</td>
                  <td className="n-panel-sub">{match.resolved_at ? new Date(match.resolved_at).toLocaleTimeString() : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Btn small onClick={() => loadDetail(match.id)}>Open</Btn>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && <Empty colSpan={5}>No duels yet</Empty>}
            </Table>
          )}
        </Panel>
      </div>

      {voidTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgb(0 0 0 / 72%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setVoidTarget(null)}
        >
          <div className="n-panel" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="n-panel-head"><div className="n-panel-title">Void match</div></div>
            <div className="n-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="n-panel-sub">
                Voiding issues no award and frees both teams for a replay. A resolved match can never be voided.
              </p>
              <Field label="Reason (required)">
                <textarea className="n-textarea" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setVoidTarget(null)}>Cancel</Btn>
                <Btn variant="danger" disabled={busy || !voidReason.trim()} onClick={doVoid}>Void match</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

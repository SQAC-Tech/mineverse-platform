'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowUp, Award, Check, Clock, Download, Mail, RefreshCw, RotateCcw, Send, Trophy, Users,
} from 'lucide-react';
import {
  Panel, Btn, Table, Empty, Loading, PageTitle, Grid, StatTile, Pill, apiCall,
} from '@/components/admin/nether-ui';
import { startPoll } from '@/lib/client/poll';

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
  /** Seconds on the relay. The key the cut is actually decided on. */
  relay_seconds: number | null;
  /** 1 = all first years, 2 = everyone else. The cut is made per year. */
  year: 1 | 2;
  /** Position inside this team's own year — what the per-year cut slices. */
  year_rank: number;
  result: 'shortlisted' | 'rejected' | null;
}

interface RsvpState {
  team_id: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
}

interface PuzzleDetail {
  id: number;
  title: string;
  solved: boolean;
  solved_at: string | null;
  tries: number;
  answer: string | null;
}

interface AttemptDetail {
  team_id: string;
  team_code: string;
  team_name: string;
  status: 'in_progress' | 'submitted' | 'expired';
  started_at: string;
  submitted_at: string | null;
  auto_submitted: boolean;
  total_score: number;
  correct_count: number;
  elapsed_seconds: number;
  tries: number;
  year: number | null;
  word_assigned: string | null;
  image_assigned: string | null;
  puzzles: PuzzleDetail[];
}

/** What one `run()` in lib/screening/mailer.ts reports back. */
interface MailRunSummary {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  /** Teams the run did not reach before its time budget ran out. */
  remaining: number;
}

/**
 * Every mutating action's response, loosely.
 *
 * `shortlisted` and `rejected` are counts on a commit and whole runs on a
 * send, so the shape genuinely differs per action and the call sites narrow it.
 */
interface ActionData {
  sent?: number;
  skipped?: number;
  failed?: number;
  errors?: string[];
  granted?: number;
  unlocked?: number;
  confirmed?: boolean;
  with_access?: number;
  shortlisted?: number | MailRunSummary;
  rejected?: number | MailRunSummary;
  promoted?: Array<{ team_id: string; team_code: string; team_name: string; year: 1 | 2 }>;
  parity?: string | null;
}

interface MailLogEntry {
  id: string;
  at: string;
  email_type: string;
  provider: string;
  recipient: string;
  status: string;
  error: string | null;
  team_code: string | null;
  team_name: string | null;
}

interface Data {
  window: { starts_at: string | null; ends_at: string | null; state: string };
  config: { duration_minutes: number; question_count: number; grant: Record<string, number>; max_score: number };
  stats: { eligible_teams: number; in_progress: number; submitted: number; not_started: number; swept: number };
  ranked: RankedTeam[];
  attempts: AttemptDetail[];
  preview: {
    cut: { year1: number; year2: number };
    contested: RankedTeam[];
    committed: boolean;
    available: { year1: number; year2: number };
    problems: string[];
  } | null;
  mail: Record<string, number>;
  mail_log: MailLogEntry[];
  rsvp: RsvpState[];
  committed: boolean;
}

function mmss(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
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
  // Two cuts, one per year. 30/18 is the split the event was planned around:
  // both even, so PvP pairs inside each year with nobody left over.
  const [cut1, setCut1] = useState(30);
  const [cut2, setCut2] = useState(18);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'commit' | 'clear' | 'announce' | 'results'>(null);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiCall<Data>(`/api/admin/screening?cut1=${cut1}&cut2=${cut2}`);
    if (res.ok) setData(res.data);
    else toast.error(res.message);
  }, [cut1, cut2]);

  useEffect(() => { void load(); }, [load]);

  // Live enough to watch the window without hammering the ranking query.
  useEffect(() => {
    return startPoll(() => void load(), 20_000);
  }, [load]);

  /**
   * A failure gets its own toast rather than a clause inside the success one.
   *
   * Every run has reported `errors` all along and nothing ever displayed them,
   * so a send where three of ninety bounced looked exactly like a clean one.
   * The mail log panel keeps the detail after this fades.
   */
  const reportRun = (label: string, run: MailRunSummary | undefined) => {
    if (!run) return;
    toast.success(`${label}: ${run.sent} sent, ${run.skipped} skipped, ${run.failed} failed.`);
    if (run.failed > 0) {
      toast.error(`${label} — ${run.failed} failed: ${(run.errors ?? []).slice(0, 3).join(' · ')}`);
    }
    // Not an error. Sends are paced five seconds apart, so a long list runs out
    // of request time before it runs out of teams — pressing again resumes.
    if (run.remaining > 0) {
      toast.warning(`${label}: ${run.remaining} still to go. Press the button again to continue.`);
    }
  };

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await apiCall<ActionData>('/api/admin/screening', {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) { toast.error(res.message); return; }

    if (action === 'send_announcement') {
      reportRun('Announcement', res.data as MailRunSummary);
    } else if (action === 'send_results') {
      // Two runs, reported separately — a clean congratulations run and a
      // rejection run that half-failed is not one number.
      reportRun('Shortlisted', res.data.shortlisted as MailRunSummary);
      reportRun('Rejected', res.data.rejected as MailRunSummary);
    } else if (action === 'commit_shortlist') {
      toast.success(`Shortlist frozen — ${res.data.shortlisted} in, ${res.data.rejected} out, ${res.data.granted} granted resources.`);
      toast.warning('Round 1 is open to nobody yet. It unlocks per team as you mark each RSVP.');
    } else if (action === 'promote_teams') {
      const promoted = res.data.promoted as Array<{ team_code: string }>;
      toast.success(
        promoted.length === 0
          ? 'Already on the shortlist — nothing to do.'
          : `${promoted.map((team) => team.team_code).join(', ')} promoted. Press "Send results" to mail them; the teams already mailed are skipped.`,
      );
      if (res.data.parity) toast.warning(res.data.parity as string);
    } else if (action === 'set_rsvp') {
      // The number that matters is how many can actually start Round 1.
      toast.success(
        res.data.confirmed
          ? `RSVP confirmed — Round 1 now open to ${res.data.with_access} teams.`
          : `RSVP cleared — Round 1 access withdrawn, ${res.data.with_access} teams remain.`,
      );
    } else {
      toast.success('Done.');
    }
    void load();
  };

  const download = (name: string, header: string, rows: string[]) => {
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!data) return;
    download(
      'screening-ranking',
      'rank,team_code,team_name,total_score,raw_score,bonus,correct,relay_seconds,submitted_at,auto_submitted,result',
      data.ranked.map((team) => [
        team.rank, team.team_code, JSON.stringify(team.team_name), team.total_score, team.raw_score,
        team.bonus_points, team.correct_count, team.relay_seconds ?? '',
        team.submitted_at ?? '', team.auto_submitted, team.result ?? '',
      ].join(',')),
    );
  };

  /**
   * The answers themselves, one row per team per puzzle.
   *
   * Long form rather than a column per puzzle: it survives a fourth puzzle
   * being added, and it is the shape a spreadsheet can pivot.
   */
  const exportAnswers = () => {
    if (!data) return;
    download(
      'screening-answers',
      'team_code,team_name,status,year,word_assigned,image_assigned,puzzle,solved,tries,answer,solved_at',
      data.attempts.flatMap((attempt) =>
        attempt.puzzles.map((puzzle) => [
          attempt.team_code, JSON.stringify(attempt.team_name), attempt.status, attempt.year ?? '',
          attempt.word_assigned ?? '', JSON.stringify(attempt.image_assigned ?? ''), puzzle.id,
          puzzle.solved, puzzle.tries, JSON.stringify(puzzle.answer ?? ''), puzzle.solved_at ?? '',
        ].join(',')),
      ),
    );
  };

  const contested = data?.preview?.contested ?? [];
  const problems = data?.preview?.problems ?? [];
  const available = data?.preview?.available ?? { year1: 0, year2: 0 };

  /** Which teams the current cut would take, by id — drives the row stripe. */
  const inCutIds = useMemo(() => {
    const ranked = data?.ranked ?? [];
    const take = (year: 1 | 2, n: number) =>
      ranked.filter((t) => t.year === year).slice(0, n).map((t) => t.team_id);
    return new Set([...take(1, cut1), ...take(2, cut2)]);
  }, [data, cut1, cut2]);

  const rsvpByTeam = useMemo(
    () => new Map((data?.rsvp ?? []).map((row) => [row.team_id, row])),
    [data],
  );
  const rsvpCount = useMemo(
    () => (data?.rsvp ?? []).filter((row) => row.confirmed_at).length,
    [data],
  );
  const mailFailures = useMemo(
    () => (data?.mail_log ?? []).filter((entry) => entry.status !== 'sent').length,
    [data],
  );

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
        {/* Only meaningful once a shortlist exists — before that nobody has a
            seat to confirm. */}
        {data.committed && (
          <StatTile
            label="RSVP confirmed"
            value={`${rsvpCount} / ${data.rsvp.length}`}
            hint="Round 1 is open to exactly these teams"
            icon={<Check size={14} />}
          />
        )}
      </Grid>

      <Panel
        title="Shortlist"
        subtitle={
          data.committed
            ? 'Frozen. Round 1 opens to a team the moment you mark its RSVP, and closes again if you unmark it.'
            : 'Cut each year separately, and keep both even — PvP pairs inside a year. Committing freezes the list, opens Round 1 to it, and grants opening resources.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Two cuts, because PvP pairs inside a year. Stepped by 2 so the
                arrows cannot walk into an odd count. */}
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
              1st yr
              <input
                type="number" min={0} step={2} max={available.year1 || undefined}
                value={cut1}
                onChange={(event) => setCut1(Math.max(0, Number(event.target.value) || 0))}
                disabled={data.committed}
                className="n-input" style={{ width: 64 }}
              />
              <span className="n-panel-sub">of {available.year1}</span>
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
              2nd yr
              <input
                type="number" min={0} step={2} max={available.year2 || undefined}
                value={cut2}
                onChange={(event) => setCut2(Math.max(0, Number(event.target.value) || 0))}
                disabled={data.committed}
                className="n-input" style={{ width: 64 }}
              />
              <span className="n-panel-sub">of {available.year2}</span>
            </label>
            {data.committed ? (
              <Btn variant="danger" small disabled={busy} onClick={() => setConfirm('clear')}>
                <RotateCcw size={11} /> Clear shortlist
              </Btn>
            ) : (
              <Btn
                variant="primary" small
                disabled={busy || data.ranked.length === 0 || problems.length > 0}
                onClick={() => setConfirm('commit')}
              >
                <Award size={11} /> Commit {cut1 + cut2} ({cut1}+{cut2})
              </Btn>
            )}
            <Btn small onClick={exportCsv}><Download size={11} /> CSV</Btn>
          </div>
        }
      >
        {/* The state that looks fine and is not: a frozen list where nothing has
            been confirmed means Round 1 is open to nobody. */}
        {data.committed && rsvpCount === 0 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--warn, #f2c14e)', borderLeft: '3px solid var(--warn, #f2c14e)', fontSize: 11.5, lineHeight: 1.55 }}>
            <strong>No RSVPs marked yet, so Round 1 is open to nobody.</strong>{' '}
            Access is granted per team as you mark each reply below. A team that arrives without
            having replied can be let in by marking it here.
          </div>
        )}

        {/* Blocks the commit. An odd year is the failure this screen exists to
            prevent, and it is invisible in a merged table. */}
        {!data.committed && problems.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--danger, #f87171)', borderLeft: '3px solid var(--danger, #f87171)', fontSize: 11.5, lineHeight: 1.55 }}>
            {problems.map((problem) => <div key={problem}>{problem}</div>)}
          </div>
        )}

        {/* The one thing a human should actually look at before committing. */}
        {!data.committed && contested.length > 1 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--warn, #f2c14e)', borderLeft: '3px solid var(--warn, #f2c14e)', fontSize: 11.5, lineHeight: 1.55 }}>
            <strong>{contested.length} teams sit on the same score across a year&rsquo;s cut line.</strong>{' '}
            They are separated by relay time — {contested.filter((t) => inCutIds.has(t.team_id)).length} of
            them make it. Check the relay times below before you commit.
          </div>
        )}

        <Table head={['#', 'Yr', 'Team', 'Score', 'Correct', 'Relay time', 'RSVP', 'Result', '']}>
          {data.ranked.length === 0 ? (
            <Empty colSpan={9}>Nothing submitted yet. Teams appear here as they hand in.</Empty>
          ) : (
            data.ranked.map((team) => {
              const inCut = data.committed ? team.result === 'shortlisted' : inCutIds.has(team.team_id);
              const onBoundary = !data.committed && contested.some((t) => t.team_id === team.team_id) && contested.length > 1;
              const rsvp = rsvpByTeam.get(team.team_id);
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
                  {/* Rank within the year, because that is what the cut slices.
                      The overall position is kept underneath so the merged
                      ordering is still readable. */}
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{team.year_rank}</strong>
                    <div className="n-panel-sub" style={{ fontSize: 10 }}>#{team.rank}</div>
                  </td>
                  <td>
                    <Pill tone={team.year === 1 ? 'live' : 'idle'}>{team.year === 1 ? '1st' : '2nd'}</Pill>
                  </td>
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
                  {/* The tiebreak, spelled out. Nearly every team full-clears,
                      so this column is what the cut is really made on. */}
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {team.relay_seconds === null ? (
                      <span className="n-panel-sub">not timed</span>
                    ) : (
                      <strong>{mmss(team.relay_seconds)}</strong>
                    )}
                    {onBoundary && <div style={{ fontSize: 10, color: 'var(--warn, #f2c14e)' }}>tied at the line</div>}
                  </td>
                  {/*
                    RSVP, entered by hand from the Google Form replies. Only a
                    committed shortlist has anything to confirm — before that
                    there is no seat to hold.
                  */}
                  <td>
                    {data.committed && team.result === 'shortlisted' ? (
                      <Btn
                        small
                        variant={rsvp?.confirmed_at ? 'primary' : undefined}
                        disabled={busy}
                        onClick={() => void act('set_rsvp', {
                          team_id: team.team_id,
                          confirmed: !rsvp?.confirmed_at,
                        })}
                      >
                        {rsvp?.confirmed_at ? <><Check size={11} /> Confirmed</> : 'Mark RSVP'}
                      </Btn>
                    ) : (
                      <span className="n-panel-sub">—</span>
                    )}
                    {rsvp?.confirmed_at && (
                      <div className="n-panel-sub" style={{ fontSize: 10 }}>{ist(rsvp.confirmed_at)}</div>
                    )}
                  </td>
                  <td>
                    {data.committed ? (
                      <Pill tone={team.result === 'shortlisted' ? 'ok' : 'idle'}>{team.result}</Pill>
                    ) : (
                      <Pill tone={inCut ? 'live' : 'idle'}>{inCut ? 'would take' : 'would cut'}</Pill>
                    )}
                  </td>
                  {/*
                    Reset before the cut, promote after it. They are the same
                    column because they are the same thing at two different
                    moments: the manual override on one team's result.
                  */}
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
                    {data.committed && team.result !== 'shortlisted' && (
                      <Btn
                        small
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(
                            `Promote ${team.team_code} onto the shortlist?

They have already been sent the rejection mail. This cannot be undone from here, and they will need the shortlisted mail sent to them afterwards.`,
                          )) {
                            void act('promote_teams', { team_ids: [team.team_id] });
                          }
                        }}
                      >
                        <ArrowUp size={11} /> Promote
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
        title="Attempts"
        subtitle="What every team actually typed, including the teams still sitting it. This is the record to open when a team disputes a result."
        actions={
          <Btn small onClick={exportAnswers} disabled={data.attempts.length === 0}>
            <Download size={11} /> Answers CSV
          </Btn>
        }
      >
        <Table head={['Team', 'Progress', 'Score', 'Tries', 'Took', 'State', '']}>
          {data.attempts.length === 0 ? (
            <Empty colSpan={7}>Nobody has started the Gauntlet yet.</Empty>
          ) : (
            data.attempts.map((attempt) => {
              const open = openAttempt === attempt.team_id;
              return (
                <Fragment key={attempt.team_id}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 600 }}>{attempt.team_code}</div>
                      <div className="n-panel-sub">{attempt.team_name}</div>
                    </td>
                    <td>
                      {/* Three pips rather than "2/3": which puzzle stalled them
                          is the question an organiser is actually asking. */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {attempt.puzzles.map((puzzle) => (
                          <span
                            key={puzzle.id}
                            title={`${puzzle.title} — ${puzzle.solved ? 'solved' : 'not solved'}, ${puzzle.tries} ${puzzle.tries === 1 ? 'try' : 'tries'}`}
                            style={{
                              width: 18, height: 18, display: 'grid', placeItems: 'center',
                              fontSize: 10, fontVariantNumeric: 'tabular-nums',
                              border: '1px solid var(--n-line, #333)',
                              background: puzzle.solved ? 'var(--ok, #4ade80)' : 'transparent',
                              color: puzzle.solved ? '#08160c' : 'inherit',
                              opacity: puzzle.solved || puzzle.tries > 0 ? 1 : 0.45,
                            }}
                          >
                            {puzzle.id}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{attempt.total_score}</strong>
                      <span className="n-panel-sub"> / {data.config.max_score}</span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {attempt.tries}
                      {/* Far more answers than puzzles means guessing, which is
                          worth a second look before a team is shortlisted. */}
                      {attempt.tries >= 15 && (
                        <div style={{ fontSize: 10, color: 'var(--warn, #f2c14e)' }}>heavy guessing</div>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{mmss(attempt.elapsed_seconds)}</td>
                    <td>
                      <Pill tone={attempt.status === 'in_progress' ? 'live' : attempt.status === 'submitted' ? 'ok' : 'idle'}>
                        {attempt.status === 'in_progress' ? 'sitting it' : attempt.status}
                      </Pill>
                    </td>
                    <td>
                      <Btn small onClick={() => setOpenAttempt(open ? null : attempt.team_id)}>
                        {open ? 'Hide' : 'Answers'}
                      </Btn>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} style={{ background: 'rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px 10px' }}>
                          <div className="n-panel-sub" style={{ fontSize: 11 }}>
                            Started {ist(attempt.started_at)} ·{' '}
                            {attempt.submitted_at ? `handed in ${ist(attempt.submitted_at)}` : 'not handed in'}
                            {attempt.auto_submitted && ' (ran out of time)'}
                            {attempt.word_assigned && ` · word ${attempt.word_assigned}`}
                            {attempt.image_assigned && ` · image ${attempt.image_assigned}`}
                            {attempt.year !== null && ` · year ${attempt.year} paper`}
                          </div>
                          {attempt.puzzles.map((puzzle) => (
                            <div key={puzzle.id} style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                              <Pill tone={puzzle.solved ? 'ok' : puzzle.tries > 0 ? 'warn' : 'idle'}>
                                {puzzle.solved ? 'solved' : puzzle.tries > 0 ? 'tried' : 'untouched'}
                              </Pill>{' '}
                              <strong>{puzzle.title}</strong>
                              <div className="n-panel-sub">
                                {puzzle.tries} {puzzle.tries === 1 ? 'answer' : 'answers'} submitted
                                {puzzle.solved_at ? ` · solved ${ist(puzzle.solved_at)}` : ''}
                              </div>
                              {puzzle.answer !== null && (
                                <div style={{ fontFamily: 'var(--n-mono, monospace)', fontSize: 11.5, wordBreak: 'break-all' }}>
                                  {puzzle.answer}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </Table>
      </Panel>

      <Panel
        title="Email"
        subtitle="Goes to the team lead only, over SMTP, one mail every 5 seconds. Every send skips teams that already received that mail, so a second click is safe — and is how you resume a run that ran out of time."
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

      {/*
        The send history, which nothing used to show.
        Reads `email_logs`, which every send has always written — the gap was
        that a run reported itself in a toast and then the evidence was gone.
      */}
      <Panel
        title="Mail log"
        subtitle="The last 60 sends, newest first. Every attempt lands here, including the fallback from Resend to SMTP."
        actions={
          <Btn small onClick={() => void load()}>
            <RefreshCw size={12} /> Refresh
          </Btn>
        }
      >
        {mailFailures > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--danger, #f87171)', borderLeft: '3px solid var(--danger, #f87171)', fontSize: 11.5, lineHeight: 1.55 }}>
            <strong>{mailFailures} of the last {data.mail_log.length} sends failed.</strong>{' '}
            A failed <code>resend</code> row followed by an <code>smtp</code> row to the same address
            is the fallback working. Two failures in a row is a team that got nothing.
          </div>
        )}

        <Table head={['When', 'Team', 'Type', 'To', 'Via', 'Result']}>
          {data.mail_log.length === 0 ? (
            <Empty colSpan={6}>Nothing sent yet.</Empty>
          ) : (
            data.mail_log.map((entry) => (
              <tr key={entry.id}>
                <td className="n-panel-sub" style={{ whiteSpace: 'nowrap' }}>{ist(entry.at)}</td>
                <td>
                  {entry.team_code ? (
                    <>
                      <div style={{ fontWeight: 600 }}>{entry.team_code}</div>
                      <div className="n-panel-sub">{entry.team_name}</div>
                    </>
                  ) : (
                    <span className="n-panel-sub">—</span>
                  )}
                </td>
                <td className="n-panel-sub">{entry.email_type}</td>
                <td className="n-panel-sub" style={{ wordBreak: 'break-all' }}>{entry.recipient}</td>
                <td className="n-panel-sub">{entry.provider}</td>
                <td>
                  <Pill tone={entry.status === 'sent' ? 'ok' : 'danger'}>{entry.status}</Pill>
                  {/* The error is the whole point of looking at this table. */}
                  {entry.error && (
                    <div style={{ fontSize: 10, color: 'var(--danger, #f87171)', marginTop: 4, maxWidth: 320 }}>
                      {entry.error}
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
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
              {confirm === 'commit' && `Freeze ${cut1 + cut2} teams — ${cut1} first year, ${cut2} second?`}
              {confirm === 'clear' && 'Clear the committed shortlist?'}
              {confirm === 'announce' && `Email ${data.mail.announcement_pending} teams?`}
              {confirm === 'results' && `Email ${data.mail.shortlisted_pending + data.mail.rejected_pending} teams their result?`}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              {confirm === 'commit' && (
                <>
                  {cut1 + cut2} teams go through and {Math.max(0, data.ranked.length - cut1 - cut2)} do
                  not. Round 1 stays shut to everyone for now — it opens team by team as you mark each
                  RSVP, so nobody can start until they have confirmed. Each qualifier
                  is granted{' '}
                  {Object.entries(data.config.grant).map(([key, value]) => `${value} ${key}`).join(', ') || 'nothing'}.
                  {' '}Both years are even, so PvP pairs {cut1 / 2} first-year and {cut2 / 2} second-year
                  matches. Attendance is not touched — that is still marked on the day from the
                  attendance console.
                  {contested.length > 1 && ` ${contested.length} teams are tied at a cut line.`}
                </>
              )}
              {confirm === 'clear' && 'The list unfreezes and result mails are blocked again. Resources already granted are not taken back — re-committing will not double-pay.'}
              {confirm === 'announce' && 'Goes to the team lead of every payment-verified team that has not had it yet, and to nobody else on the roster. Paced at one mail every 5 seconds, so leave the tab open. This cannot be unsent.'}
              {confirm === 'results' && 'Congratulations to those in, and the sorry note to those out — team leads only. Paced at one mail every 5 seconds, so this takes minutes, not moments. If it does not finish, press it again to carry on. This cannot be unsent.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setConfirm(null)} disabled={busy}>Cancel</Btn>
              <Btn
                variant={confirm === 'clear' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() => {
                  if (confirm === 'commit') void act('commit_shortlist', { cut1, cut2 });
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

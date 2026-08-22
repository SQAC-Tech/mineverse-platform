'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, FileText, Lock, RefreshCw, Search, Users } from 'lucide-react';
import {
  Panel, Btn, Table, Empty, Loading, PageTitle, Grid, StatTile, Pill, statusTone, Field, apiCall,
} from '@/components/admin/nether-ui';

/**
 * What every team wrote, per round.
 *
 * The grading screen next door only ever showed the manual-review queue — the
 * few answers the grader could not decide — so an organiser facing "we answered
 * question 7, why is it blank" had nowhere to look but the database. This is
 * that screen: the whole paper for every team, answered or not.
 */

interface Answer {
  question_id: string;
  order_index: number;
  title: string;
  type: string;
  variant_number: number;
  on_paper: boolean;
  answer_text: string | null;
  code: string | null;
  language: string | null;
  status: string | null;
  revision: number | null;
  final_score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  locked_at: string | null;
}

interface Guardian {
  guardian_name: string;
  status: string;
  correct_count: number | null;
  total_questions: number | null;
  attempt_number: number;
  completed_at: string | null;
  answers: Array<{ question_id: string; order_index: number; answer_text: string | null; correct: boolean }>;
}

interface TeamRow {
  team_id: string;
  team_code: string;
  team_name: string;
  answered: number;
  locked: number;
  graded: number;
  score: number;
  off_paper: number;
  last_activity: string | null;
  answers: Answer[];
  guardians: Guardian[];
}

interface Data {
  round: { id: number; name: string; status: string; starts_at: string | null; ends_at: string | null };
  question_count: number;
  teams: TeamRow[];
  totals: { teams: number; started: number; answered: number; locked: number; graded: number; expected: number };
}

type RoundOption = { id: number; name: string; status: string };

function ist(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function AdminSubmissionsPage() {
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [roundId, setRoundId] = useState<number | ''>('');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiCall<RoundOption[]>('/api/admin/rounds');
      if (!res.ok) { toast.error(res.message); return; }
      // Round 4 has no question bank of its own — the Day 2 finale is run from
      // its own console — so it is left out rather than shown permanently empty.
      // Sorted by id, not by the `sequence` the API orders on: sequence restarts
      // per day, so it lists the rounds as 1, 2, 5, 3.
      const playable = (res.data ?? [])
        .filter((round) => round.id !== 0 && round.id !== 4)
        .sort((a, b) => a.id - b.id);
      setRounds(playable);
      setRoundId((current) => (current === '' ? playable[0]?.id ?? '' : current));
    })();
  }, []);

  const load = useCallback(async () => {
    if (roundId === '') return;
    setLoading(true);
    const res = await apiCall<Data>(`/api/admin/submissions?round_id=${roundId}`);
    setLoading(false);
    if (res.ok) setData(res.data);
    else { setData(null); toast.error(res.message); }
  }, [roundId]);

  // Fetch on mount and whenever the chosen round changes. The same shape every
  // other admin screen uses; the rule objects to the setState inside `load`,
  // which is the whole point of a screen that reads from the server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const teams = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.teams.filter((team) => {
      if (onlyGaps && team.answered >= data.question_count) return false;
      if (!needle) return true;
      return (
        team.team_code.toLowerCase().includes(needle) ||
        team.team_name.toLowerCase().includes(needle)
      );
    });
  }, [data, query, onlyGaps]);

  /** Every answer, one row each. The blanks are rows too — that is the point. */
  const exportCsv = () => {
    if (!data) return;
    const cell = (value: unknown) =>
      value === null || value === undefined ? '""' : `"${String(value).replace(/"/g, '""')}"`;

    const lines = [
      'round,team_code,team_name,question_no,title,type,variant,on_paper,status,revision,score,language,answer,submitted_at,locked_at,feedback',
    ];
    for (const team of data.teams) {
      for (const answer of team.answers) {
        lines.push([
          data.round.id, cell(team.team_code), cell(team.team_name), answer.order_index,
          cell(answer.title), answer.type, answer.variant_number, answer.on_paper,
          answer.status ?? 'unanswered',
          answer.revision ?? '', answer.final_score ?? '', answer.language ?? '',
          cell(answer.code ?? answer.answer_text), answer.submitted_at ?? '', answer.locked_at ?? '',
          cell(answer.feedback),
        ].join(','));
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `round-${data.round.id}-answers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle
        title="Submissions"
        subtitle={
          data
            ? `${data.round.name} · ${data.question_count} questions per team · window ${ist(data.round.starts_at)} → ${ist(data.round.ends_at)} IST`
            : 'Every answer every team saved, round by round.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="Round">
              <select
                className="n-input"
                value={roundId}
                onChange={(event) => setRoundId(Number(event.target.value))}
              >
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>Round {round.id} — {round.name}</option>
                ))}
              </select>
            </Field>
            <Btn onClick={() => void load()} disabled={loading}><RefreshCw size={12} /> Refresh</Btn>
            <Btn onClick={exportCsv} disabled={!data || data.teams.length === 0}><Download size={12} /> CSV</Btn>
          </div>
        }
      />

      {loading && !data ? (
        <Loading label="Loading submissions" />
      ) : !data ? (
        <Panel><Empty>Pick a round.</Empty></Panel>
      ) : (
        <>
          <Grid min={170}>
            <StatTile label="Teams in this round" value={data.totals.teams} icon={<Users size={14} />} />
            <StatTile
              label="Started"
              value={data.totals.started}
              hint={`${data.totals.teams - data.totals.started} have not saved anything`}
              icon={<FileText size={14} />}
            />
            <StatTile
              label="Answers saved"
              value={data.totals.answered}
              hint={`of ${data.totals.expected} possible`}
              icon={<CheckCircle2 size={14} />}
            />
            <StatTile label="Locked" value={data.totals.locked} hint="Submitted as final" icon={<Lock size={14} />} />
            <StatTile label="Graded" value={data.totals.graded} icon={<CheckCircle2 size={14} />} />
          </Grid>

          {data.round.status !== 'active' && (
            <div
              style={{
                padding: '10px 12px', border: '1px solid var(--warn, #f2c14e)',
                borderLeft: '3px solid var(--warn, #f2c14e)', fontSize: 11.5, lineHeight: 1.55,
              }}
            >
              <strong>This round is {data.round.status}.</strong> Teams cannot save answers to it — the
              submission endpoints refuse anything outside an <code>active</code> round with a future
              <code> ends_at</code>. Open it on the Rounds screen before the teams sit down.
            </div>
          )}

          <Panel
            title="Teams"
            subtitle="One row per team. Open a row for the paper it was served and everything it wrote against it."
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
                  <Search size={12} />
                  <input
                    className="n-input"
                    placeholder="Team code or name"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    style={{ width: 180 }}
                  />
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
                  <input type="checkbox" checked={onlyGaps} onChange={(event) => setOnlyGaps(event.target.checked)} />
                  Incomplete only
                </label>
              </div>
            }
          >
            <Table head={['Team', 'Answered', 'Locked', 'Score', 'Last saved', '']}>
              {teams.length === 0 ? (
                <Empty colSpan={6}>
                  {data.teams.length === 0
                    ? 'No team has access to this round yet.'
                    : 'No team matches that filter.'}
                </Empty>
              ) : (
                teams.map((team) => {
                  const expanded = open === team.team_id;
                  const complete = team.answered >= data.question_count;
                  return (
                    <Fragment key={team.team_id}>
                      <tr
                        style={{
                          boxShadow: team.answered > 0
                            ? `inset 3px 0 0 ${complete ? 'var(--ok, #4ade80)' : 'var(--warn, #f2c14e)'}`
                            : 'inset 3px 0 0 transparent',
                          opacity: team.answered > 0 ? 1 : 0.7,
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 600 }}>{team.team_code}</div>
                          <div className="n-panel-sub">{team.team_name}</div>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {team.answered} / {data.question_count}
                          {team.answered === 0 && team.off_paper === 0 && (
                            <div style={{ fontSize: 10, color: 'var(--warn, #f2c14e)' }}>nothing saved</div>
                          )}
                          {team.off_paper > 0 && (
                            <div className="n-panel-sub" style={{ fontSize: 10 }}>
                              +{team.off_paper} from an older paper
                            </div>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{team.locked}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {team.graded > 0 ? team.score : '—'}
                          {team.graded > 0 && team.graded < team.answered && (
                            <div className="n-panel-sub" style={{ fontSize: 10 }}>
                              {team.graded} of {team.answered} graded
                            </div>
                          )}
                        </td>
                        <td><span className="n-panel-sub">{ist(team.last_activity)}</span></td>
                        <td>
                          <Btn small onClick={() => setOpen(expanded ? null : team.team_id)}>
                            {expanded ? 'Hide' : 'Answers'}
                          </Btn>
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td colSpan={6} style={{ background: 'rgba(0,0,0,0.25)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 2px 12px' }}>
                              {team.guardians.length > 0 && (
                                <div style={{ fontSize: 11.5 }}>
                                  <strong>Guardian battles</strong>
                                  {team.guardians.map((battle, index) => (
                                    <div key={`${battle.guardian_name}-${index}`} style={{ marginTop: 4 }}>
                                      <div className="n-panel-sub">
                                        {battle.guardian_name} — {battle.status}, {battle.correct_count ?? 0} of{' '}
                                        {battle.total_questions ?? '?'} correct on attempt {battle.attempt_number}
                                        {battle.completed_at ? ` · ${ist(battle.completed_at)}` : ''}
                                      </div>
                                      {battle.answers.map((entry) => (
                                        <div
                                          key={entry.question_id}
                                          className="n-panel-sub"
                                          style={{ paddingLeft: 12, fontFamily: 'var(--n-mono, monospace)' }}
                                        >
                                          Q{entry.order_index} {entry.correct ? '✓' : '✗'}{' '}
                                          {entry.answer_text ?? '(blank)'}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {team.answers.map((answer) => {
                                const body = answer.code ?? answer.answer_text;
                                return (
                                  <div
                                    key={answer.question_id}
                                    style={{
                                      fontSize: 11.5, lineHeight: 1.6, paddingLeft: 10,
                                      borderLeft: `2px solid ${answer.status ? 'var(--n-line, #333)' : 'var(--warn, #f2c14e)'}`,
                                      opacity: answer.on_paper ? 1 : 0.75,
                                    }}
                                  >
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <strong>Q{answer.order_index}. {answer.title}</strong>
                                      <Pill tone={answer.status ? statusTone(answer.status) : 'warn'}>
                                        {answer.status ?? 'unanswered'}
                                      </Pill>
                                      <span className="n-panel-sub">
                                        {answer.type} · version {answer.variant_number}
                                        {answer.language ? ` · ${answer.language}` : ''}
                                        {answer.revision !== null ? ` · rev ${answer.revision}` : ''}
                                        {answer.final_score !== null ? ` · scored ${answer.final_score}` : ''}
                                      </span>
                                      {!answer.on_paper && (
                                        <Pill tone="warn">not on their current paper</Pill>
                                      )}
                                    </div>
                                    {body ? (
                                      <pre
                                        style={{
                                          margin: '4px 0 0', padding: 8, maxHeight: 320, overflow: 'auto',
                                          background: 'rgba(0,0,0,0.35)', fontSize: 11,
                                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                        }}
                                      >
                                        {body}
                                      </pre>
                                    ) : (
                                      <div className="n-panel-sub" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                        <AlertTriangle size={11} /> nothing saved for this question
                                      </div>
                                    )}
                                    {answer.feedback && (
                                      <div className="n-panel-sub">Grader: {answer.feedback}</div>
                                    )}
                                    {answer.submitted_at && (
                                      <div className="n-panel-sub" style={{ fontSize: 10 }}>
                                        saved {ist(answer.submitted_at)}
                                        {answer.locked_at ? ` · locked ${ist(answer.locked_at)}` : ''}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
        </>
      )}
    </div>
  );
}

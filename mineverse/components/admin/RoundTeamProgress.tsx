'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Panel, Btn, Pill, Table, Empty, Loading, apiCall, statusTone } from '@/components/admin/nether-ui';

/**
 * Who is in each round and what the grader did with their answers.
 *
 * Grading and payout now happen when a team hands a section in, which removes
 * the admin batch run — and with it the screen that used to be the only proof
 * anything had been marked. This is that proof: per round, per team, how much
 * of the paper is answered, how much is marked, and exactly which resources
 * were paid for it.
 *
 * Split by day because the two halves are shortlisted separately. Day 2 stays
 * empty until teams are carried forward from Day 1, and an empty Day 2 is the
 * correct reading of the event rather than a missing fetch.
 */

interface RoundMeta {
  id: number;
  name: string;
  day: number;
  sequence: number;
}

interface TeamRow {
  team_id: string;
  team_code: string;
  team_name: string;
  answered: number;
  slots: number;
  submitted: number;
  graded: number;
  manual_review: number;
  pending: number;
  correct: number;
  partial: number;
  awarded: Record<string, number>;
  paid_answers: number;
}

interface AnswerRow {
  submission_id: string;
  question_id: string;
  type: string;
  prompt: string;
  expected_answer: unknown;
  reward: Record<string, number>;
  answer_text: string | null;
  code: string | null;
  language: string | null;
  evaluation: { total_passed?: number; total_cases?: number; status?: string } | null;
  status: string;
  final_score: number | null;
  feedback: string | null;
  graded_by: string | null;
  awarded: Record<string, number> | null;
}

interface TeamDetail {
  team: { team_code: string; team_name: string; team_size: number | null } | null;
  slots: number;
  awarded_total: Record<string, number>;
  answers: AnswerRow[];
}

function deltaText(delta: Record<string, number> | null | undefined): string {
  const parts = Object.entries(delta ?? {})
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([resource, amount]) => `${Number(amount) > 0 ? '+' : ''}${amount} ${resource}`);
  return parts.length > 0 ? parts.join(', ') : '—';
}

/** One short phrase for what the platform has settled about a team's paper. */
function progressTone(row: TeamRow) {
  if (row.answered === 0) return { tone: 'idle' as const, label: 'nothing yet' };
  if (row.manual_review > 0) return { tone: 'warn' as const, label: `${row.manual_review} to review` };
  if (row.pending > 0) return { tone: 'warn' as const, label: `${row.pending} ungraded` };
  return { tone: 'ok' as const, label: 'all graded' };
}

function scoreLabel(answer: AnswerRow): string {
  if (answer.final_score === null) return '—';
  if (answer.final_score >= 1) return 'correct';
  if (answer.final_score <= 0) return 'wrong';
  return `${Math.round(answer.final_score * 100)}%`;
}

function answerText(answer: AnswerRow): string {
  if (answer.answer_text?.trim()) return answer.answer_text;
  if (answer.code?.trim()) return answer.code;
  return '(no answer)';
}

function TeamPaper({ roundId, teamId, onBack }: { roundId: number; teamId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiCall<TeamDetail>(`/api/admin/rounds/teams?round_id=${roundId}&team_id=${teamId}`);
      if (cancelled) return;
      if (res.ok) setDetail(res.data ?? null);
      else toast.error(res.message);
    })();
    return () => { cancelled = true; };
  }, [roundId, teamId]);

  if (!detail) return <Panel><Loading label="Loading answers" /></Panel>;

  return (
    <Panel
      title={detail.team ? `${detail.team.team_code} — ${detail.team.team_name}` : 'Team'}
      subtitle={`${detail.answers.length} of ${detail.slots} answered · earned ${deltaText(detail.awarded_total)}`}
      actions={<Btn onClick={onBack}><ChevronLeft size={12} /> Back to teams</Btn>}
    >
      {detail.answers.length === 0 ? (
        <Empty>This team has not answered anything in this round.</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {detail.answers.map((answer) => (
            <div
              key={answer.submission_id}
              style={{
                padding: 12,
                background: 'var(--bg-void)',
                border: '1px solid rgb(from var(--accent-muted) r g b / 25%)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <Pill tone={statusTone(answer.status)}>{answer.status.replace(/_/g, ' ')}</Pill>
                <span className="n-panel-sub">{answer.type.replace(/_/g, ' ')}</span>
                <span className="n-panel-sub">·</span>
                <span className="n-panel-sub">{scoreLabel(answer)}</span>
                {answer.evaluation?.total_cases ? (
                  <>
                    <span className="n-panel-sub">·</span>
                    <span className="n-panel-sub">
                      {answer.evaluation.total_passed ?? 0}/{answer.evaluation.total_cases} tests
                    </span>
                  </>
                ) : null}
                <span style={{ marginLeft: 'auto' }} className="n-mono">{deltaText(answer.awarded)}</span>
              </div>

              <div className="n-panel-sub" style={{ whiteSpace: 'pre-wrap', marginBottom: 8, maxHeight: 120, overflow: 'auto' }}>
                {answer.prompt}
              </div>

              <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <div>
                  <div className="n-label">Their answer</div>
                  <pre
                    className="n-mono"
                    style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}
                  >
                    {answerText(answer)}
                  </pre>
                </div>
                <div>
                  <div className="n-label">Accepted</div>
                  <pre
                    className="n-mono"
                    style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}
                  >
                    {answer.expected_answer ? JSON.stringify(answer.expected_answer) : '(graded by rubric)'}
                  </pre>
                </div>
              </div>

              {answer.feedback && (
                <div className="n-panel-sub" style={{ marginTop: 8 }}>
                  <strong>Grader:</strong> {answer.feedback}
                  {answer.graded_by ? ` (${answer.graded_by})` : ''}
                </div>
              )}

              <div className="n-panel-sub" style={{ marginTop: 6 }}>
                Pays {deltaText(answer.reward)} when correct
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function RoundTeamProgress({ rounds }: { rounds: RoundMeta[] }) {
  const [day, setDay] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  /** Tagged with the round it describes, so a stale reply cannot be shown. */
  const [loaded, setLoaded] = useState<{ roundId: number; rows: TeamRow[] } | null>(null);

  const dayRounds = rounds.filter((round) => round.day === day).sort((a, b) => a.sequence - b.sequence);

  /**
   * The round actually being shown.
   *
   * Derived rather than stored, so switching day cannot leave the table pointing
   * at a round from the day just left. Keeping them in sync with an effect meant
   * a setState during render — which React 19 rejects, and which showed the
   * wrong round for one frame in every version before it.
   */
  const roundId = picked !== null && dayRounds.some((round) => round.id === picked)
    ? picked
    : dayRounds[0]?.id ?? null;

  /**
   * Bumped by Refresh to re-run the fetch below for the same round.
   *
   * The fetch lives entirely inside the effect rather than in a callback the
   * effect calls: React 19 rejects reaching setState from an effect body even
   * through an awaited helper, and the cancellation flag it lets us keep is
   * what stops a slow reply for Round 1 landing after the user has moved to
   * Round 3.
   */
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (roundId === null) return;
    let cancelled = false;

    void (async () => {
      const res = await apiCall<{ teams: TeamRow[] }>(`/api/admin/rounds/teams?round_id=${roundId}`);
      if (cancelled) return;
      if (res.ok) setLoaded({ roundId, rows: res.data?.teams ?? [] });
      else { setLoaded({ roundId, rows: [] }); toast.error(res.message); }
    })();

    return () => { cancelled = true; };
  }, [roundId, reloads]);

  // Anything we hold for another round is still loading as far as this view is
  // concerned, which is what replaces the "set to null then fetch" effect.
  const teams = loaded && loaded.roundId === roundId ? loaded.rows : null;

  if (openTeam && roundId !== null) {
    return <TeamPaper roundId={roundId} teamId={openTeam} onBack={() => setOpenTeam(null)} />;
  }

  return (
    <Panel
      title="Team progress"
      subtitle="Answers are marked and paid the moment a team submits a section — this is what has actually been settled"
      actions={<Btn onClick={() => setReloads((n) => n + 1)}><RefreshCw size={12} /> Refresh</Btn>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[1, 2].map((value) => (
          <Btn key={value} variant={day === value ? 'primary' : 'ghost'} onClick={() => { setDay(value); setPicked(null); setOpenTeam(null); }}>
            Day {value}
          </Btn>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {dayRounds.length === 0 ? (
          <span className="n-panel-sub">No rounds configured for this day.</span>
        ) : dayRounds.map((round) => (
          <Btn
            key={round.id}
            small
            variant={roundId === round.id ? 'primary' : 'ghost'}
            onClick={() => { setPicked(round.id); setOpenTeam(null); }}
          >
            {round.name}
          </Btn>
        ))}
      </div>

      {teams === null ? (
        <Loading label="Loading teams" />
      ) : (
        <Table head={['Team', 'Answered', 'Submitted', 'Graded', 'Correct', 'Partial', 'Resources granted', 'State', '']}>
          {teams.length === 0 ? (
            <Empty colSpan={9}>
              {day === 2
                ? 'No team has played a Day 2 round yet — these fill in once Day 1 teams are shortlisted.'
                : 'No team has answered anything in this round yet.'}
            </Empty>
          ) : teams.map((row) => {
            const state = progressTone(row);
            return (
              <tr key={row.team_id}>
                <td>
                  <div className="n-mono">{row.team_code}</div>
                  <div className="n-panel-sub">{row.team_name}</div>
                </td>
                <td className="n-mono">{row.answered}/{row.slots}</td>
                <td className="n-mono">{row.submitted}</td>
                <td className="n-mono">{row.graded}</td>
                <td className="n-mono">{row.correct}</td>
                <td className="n-mono">{row.partial}</td>
                <td className="n-mono">{deltaText(row.awarded)}</td>
                <td><Pill tone={state.tone}>{state.label}</Pill></td>
                <td>
                  <Btn small onClick={() => setOpenTeam(row.team_id)}>Open</Btn>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Panel>
  );
}

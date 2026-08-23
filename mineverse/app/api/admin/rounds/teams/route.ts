import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { pickVariants } from '@/lib/gameplay/questions/variants';

export const dynamic = 'force-dynamic';

const db = supabaseServer as any;

/**
 * Who is in a round, and what the platform has done about their answers.
 *
 * Two shapes from one endpoint:
 *
 *   ?round_id=1              the roster — one row per team, with counts
 *   ?round_id=1&team_id=...  one team's paper, question by question
 *
 * A team appears in a round's roster once it has answered something in that
 * round. Access rows are provisioned for every team up front, so listing by
 * access would show all ninety-odd teams under Round 5 before Day 2 has been
 * shortlisted — which is exactly the thing an organiser is trying to read off
 * this screen. Engagement is the honest signal.
 */

type Delta = Record<string, number>;

function sumDeltas(rows: Array<{ delta: unknown }>): Delta {
  const total: Delta = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries((row.delta ?? {}) as Delta)) {
      const amount = Number(value ?? 0);
      if (!amount) continue;
      total[key] = (total[key] ?? 0) + amount;
    }
  }
  return total;
}

/**
 * How many questions this round asks a single team.
 *
 * Not the row count: each slot holds several interchangeable variants and a team
 * is served one of them. Counting rows would report a Round 1 paper of 39
 * questions when a team actually sees 13, and every progress figure built on it
 * would look like nobody had finished anything.
 */
async function slotCount(roundId: number): Promise<number> {
  const { data, error } = await db
    .from('questions')
    .select('id, order_index, variant_group, guardian_name, type')
    .eq('round_id', roundId);
  if (error) throw error;

  const playable = (data ?? []).filter((row: any) => !row.guardian_name && row.type !== 'pvp');
  // Any team code gives the same slot count; the pick only decides which
  // variant fills each slot.
  return pickVariants(playable, null, roundId).length;
}

export async function GET(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const roundId = Number(url.searchParams.get('round_id'));
  const teamId = url.searchParams.get('team_id');

  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: 'round_id is required' }, { status: 400 });
  }

  try {
    return teamId ? await teamDetail(roundId, teamId) : await roster(roundId);
  } catch (error) {
    console.error('Admin round teams error:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}

async function roster(roundId: number) {
  const { data: submissions, error } = await db
    .from('submissions')
    .select('id, team_id, status, final_score, final_award_ledger_id')
    .eq('round_id', roundId);
  if (error) throw error;

  const rows = submissions ?? [];
  const teamIds = [...new Set(rows.map((row: any) => row.team_id))] as string[];

  if (teamIds.length === 0) {
    return NextResponse.json({ success: true, data: { teams: [], slots: await slotCount(roundId) } });
  }

  const [{ data: teams }, { data: ledger }, { data: access }] = await Promise.all([
    db.from('teams').select('id, team_code, team_name').in('id', teamIds),
    db
      .from('resource_ledger')
      .select('team_id, delta, source_id')
      .in('team_id', teamIds)
      .eq('source_type', 'question_grade'),
    db.from('team_round_access').select('team_id, started_at, completed_at').eq('round_id', roundId).in('team_id', teamIds),
  ]);

  const teamById = new Map((teams ?? []).map((row: any) => [row.id, row]));
  const accessById = new Map((access ?? []).map((row: any) => [row.team_id, row]));

  // Ledger rows are keyed by submission id, which is the only way to tell a
  // Round 1 award from a Round 3 one — the ledger itself has no round column.
  const submissionIds = new Set(rows.map((row: any) => row.id));
  const ledgerByTeam = new Map<string, Array<{ delta: unknown }>>();
  for (const entry of ledger ?? []) {
    if (!submissionIds.has(entry.source_id)) continue;
    const bucket = ledgerByTeam.get(entry.team_id) ?? [];
    bucket.push(entry);
    ledgerByTeam.set(entry.team_id, bucket);
  }

  const slots = await slotCount(roundId);

  const teamRows = teamIds.map((id) => {
    const mine = rows.filter((row: any) => row.team_id === id);
    const graded = mine.filter((row: any) => row.status === 'graded');
    const awarded = sumDeltas(ledgerByTeam.get(id) ?? []);
    const team = teamById.get(id) as any;
    const accessRow = accessById.get(id) as any;

    return {
      team_id: id,
      team_code: team?.team_code ?? '—',
      team_name: team?.team_name ?? 'Unknown team',
      answered: mine.length,
      slots,
      submitted: mine.filter((row: any) => row.status === 'locked' || row.status === 'graded' || row.status === 'manual_review').length,
      graded: graded.length,
      manual_review: mine.filter((row: any) => row.status === 'manual_review').length,
      pending: mine.filter((row: any) => row.status === 'draft' || row.status === 'submitted' || row.status === 'locked').length,
      // A score of 1 is a full mark; anything between 0 and 1 came from the
      // partial-credit path and is worth showing separately.
      correct: graded.filter((row: any) => Number(row.final_score ?? 0) >= 1).length,
      partial: graded.filter((row: any) => {
        const score = Number(row.final_score ?? 0);
        return score > 0 && score < 1;
      }).length,
      awarded,
      paid_answers: mine.filter((row: any) => row.final_award_ledger_id).length,
      started_at: accessRow?.started_at ?? null,
      completed_at: accessRow?.completed_at ?? null,
    };
  });

  teamRows.sort((a, b) => a.team_code.localeCompare(b.team_code));

  return NextResponse.json({ success: true, data: { teams: teamRows, slots } });
}

async function teamDetail(roundId: number, teamId: string) {
  const [{ data: team }, { data: submissions, error }] = await Promise.all([
    db.from('teams').select('id, team_code, team_name, team_size').eq('id', teamId).maybeSingle(),
    db
      .from('submissions')
      .select('id, question_id, answer_text, code, language, response, status, final_score, feedback, graded_by, revision, submitted_at, locked_at, final_award_ledger_id')
      .eq('round_id', roundId)
      .eq('team_id', teamId),
  ]);
  if (error) throw error;

  const rows = submissions ?? [];

  const { data: questions } = await db
    .from('questions')
    .select('id, type, prompt, reward, expected_answer, order_index, guardian_name')
    .in('id', rows.length > 0 ? rows.map((row: any) => row.question_id) : ['00000000-0000-0000-0000-000000000000']);

  const questionById = new Map((questions ?? []).map((row: any) => [row.id, row]));

  const ledgerIds = rows.map((row: any) => row.final_award_ledger_id).filter(Boolean);
  const { data: ledger } = ledgerIds.length > 0
    ? await db.from('resource_ledger').select('id, delta, reason, created_at').in('id', ledgerIds)
    : { data: [] };
  const ledgerById = new Map((ledger ?? []).map((row: any) => [row.id, row]));

  const answers = rows
    .map((row: any) => {
      const question = questionById.get(row.question_id) as any;
      const award = row.final_award_ledger_id ? (ledgerById.get(row.final_award_ledger_id) as any) : null;
      const evaluation = (row.response as any)?.kind === 'coding_evaluation' ? row.response : null;

      return {
        submission_id: row.id,
        question_id: row.question_id,
        order_index: question?.order_index ?? 0,
        type: question?.type ?? 'unknown',
        prompt: question?.prompt ?? '',
        // Safe here and nowhere else: this endpoint is behind the admin scope,
        // and marking a disputed answer by hand is impossible without it.
        expected_answer: question?.expected_answer ?? null,
        reward: question?.reward ?? {},
        guardian: question?.guardian_name ?? null,
        answer_text: row.answer_text,
        code: row.code,
        language: row.language,
        evaluation,
        status: row.status,
        final_score: row.final_score === null || row.final_score === undefined ? null : Number(row.final_score),
        feedback: row.feedback,
        graded_by: row.graded_by,
        awarded: award?.delta ?? null,
        awarded_at: award?.created_at ?? null,
        submitted_at: row.submitted_at,
        locked_at: row.locked_at,
      };
    })
    .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index);

  const awardedTotal = sumDeltas(
    (answers as Array<{ awarded: unknown }>)
      .filter((answer) => answer.awarded)
      .map((answer) => ({ delta: answer.awarded })),
  );

  return NextResponse.json({
    success: true,
    data: {
      team: team ?? null,
      round_id: roundId,
      slots: await slotCount(roundId),
      awarded_total: awardedTotal,
      answers,
    },
  });
}

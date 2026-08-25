import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';
import { BOSS_PASS_MARK } from '@/lib/gameplay/boss/config';

interface SubmittedAnswer {
  question_id: string;
  /** Index into the question's `options`, as the arena renders them. */
  selected_index?: number | null;
}

/**
 * Hands in the Ender Dragon fight. Once, and then it is over.
 *
 * ## Marked on a count, not on perfection
 *
 * The fight used to demand all twenty-five and called anything less a loss with
 * a three-minute cooldown. Round 5 is now ranked on total correct answers —
 * the dragon and the seven questions in one pile, no weighting — so what
 * matters is how many a team got, and `score_evidence.correct` is what the
 * standings read. `won` and `lost` are only the label the team and the console
 * see.
 *
 * ## Marked here, never in the browser
 *
 * `correct_index` never leaves the server: the attempt payload carries prompts
 * and options only, and the answers arrive as an index into those options.
 */
export async function POST(request: Request) {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) return guardResult;
  const session = guardResult as Day2Session;

  let body: { answers?: SubmittedAnswer[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'MALFORMED_REQUEST' }, { status: 400 });
  }
  const answers = Array.isArray(body.answers) ? body.answers : [];

  const { data: attempt } = await supabaseServer
    .from('day2_final_boss_attempts')
    .select('id, question_payload')
    .eq('team_id', session.team_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ success: false, error: 'NO_ACTIVE_ATTEMPT' }, { status: 400 });
  }

  const payload = (attempt.question_payload ?? {}) as { questions?: { id: string }[] };
  const questionIds = (payload.questions ?? []).map((q) => q.id);

  const { data: questions, error: keyError } = await supabaseServer
    .from('screening_questions')
    .select('id, correct_index')
    .in('id', questionIds);

  if (keyError) {
    console.error('Final boss: answer key unavailable', keyError.message);
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  const keyById = new Map((questions ?? []).map((q) => [q.id, q.correct_index]));
  const submittedById = new Map(answers.map((a) => [a.question_id, a.selected_index]));

  const results = questionIds.map((id) => {
    const selected = submittedById.get(id);
    const correctIndex = keyById.get(id);
    // A question left blank is wrong, not unscorable — the pack is fixed and
    // every one of the twenty-five counts against the same total.
    const correct =
      typeof selected === 'number' && typeof correctIndex === 'number' && selected === correctIndex;
    return { question_id: id, selected_index: selected ?? null, correct };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const won = correctCount >= BOSS_PASS_MARK;
  const completedAt = new Date().toISOString();

  const { error: closeError } = await supabaseServer
    .from('day2_final_boss_attempts')
    .update({
      status: won ? 'won' : 'lost',
      completed_at: completedAt,
      // No cooldown either way. There is no second attempt to cool down for.
      cooldown_until: null,
      score_evidence: {
        correct: correctCount,
        total: questionIds.length,
        pass_mark: BOSS_PASS_MARK,
        results,
      },
    })
    .eq('id', attempt.id)
    // Only close an attempt that is still open, so two submits cannot both land.
    .eq('status', 'active');

  if (closeError) {
    console.error('Final boss: could not record the attempt', closeError.message);
    return NextResponse.json({ success: false, error: 'SUBMIT_FAILED' }, { status: 500 });
  }

  /**
   * A provisional claim is filed for a team that cleared the bar, and the
   * organisers still certify the champion by hand. It is deliberately not the
   * winner: Round 5 is decided on the combined count, which is not known until
   * the ninety minutes are up and everyone's seven questions are in.
   */
  if (won) {
    const { error: claimError } = await supabaseServer
      .from('day2_provisional_winners')
      .insert({ team_id: session.team_id, claimed_at: completedAt, status: 'pending' });

    // A duplicate claim is not a failed submission; the fight is still recorded.
    if (claimError && claimError.code !== '23505') {
      console.error('Final boss: provisional claim failed', claimError.message);
    }
  }

  return NextResponse.json({
    success: true,
    result: won ? 'won' : 'lost',
    correct: correctCount,
    total: questionIds.length,
  });
}

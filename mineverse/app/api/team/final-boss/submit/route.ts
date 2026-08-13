import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';
import { checkDeterministicAnswer } from '@/lib/gameplay/grading/deterministic';

export async function POST(request: Request) {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }
  const session = guardResult as Day2Session;

  const body = await request.json();
  const answers = body.answers as { question_id: string; answer_text?: string; code?: string }[];

  // Get active attempt
  const { data: attempt } = await supabaseServer
    .from('day2_final_boss_attempts')
    .select('*')
    .eq('team_id', session.team_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ success: false, error: 'NO_ACTIVE_ATTEMPT' }, { status: 400 });
  }

  // Fetch the questions for this attempt to get the expected_answer
  // The attempt has question_payload which has the list of questions
  const questionIds = attempt.question_payload.questions.map((q: any) => q.id);

  const { data: questions } = await supabaseServer
    .from('questions')
    .select('id, expected_answer')
    .in('id', questionIds);

  let allCorrect = true;
  const scoreEvidence: any[] = [];

  for (const q of questions || []) {
    const submitted = answers.find(a => a.question_id === q.id);
    const text = submitted?.answer_text ?? submitted?.code ?? null;
    const isCorrect = checkDeterministicAnswer(text, q.expected_answer);
    
    scoreEvidence.push({
      question_id: q.id,
      submitted: text,
      correct: isCorrect,
    });

    if (!isCorrect) {
      allCorrect = false;
    }
  }

  if (allCorrect) {
    // WON
    const completedAt = new Date().toISOString();
    
    // Begin "transaction" equivalent
    await supabaseServer
      .from('day2_final_boss_attempts')
      .update({
        status: 'won',
        completed_at: completedAt,
        score_evidence: { results: scoreEvidence },
      })
      .eq('id', attempt.id);

    // Create provisional winner claim. Check for tie-break.
    // Actually, we just insert the provisional winner claim.
    const { error: winnerError } = await supabaseServer
      .from('day2_provisional_winners')
      .insert({
        team_id: session.team_id,
        claimed_at: completedAt,
        status: 'pending', // A cron or admin route checks for ties
      });

    // Check if there's exactly the same timestamp in another claim
    const { data: ties } = await supabaseServer
      .from('day2_provisional_winners')
      .select('team_id')
      .eq('claimed_at', completedAt)
      .neq('team_id', session.team_id);
    
    if (ties && ties.length > 0) {
      // Mark both as pending_tiebreak
      const tiedTeams = [session.team_id, ...ties.map(t => t.team_id)];
      await supabaseServer
        .from('day2_provisional_winners')
        .update({ status: 'pending_tiebreak' })
        .in('team_id', tiedTeams);
    }
    
    return NextResponse.json({ success: true, result: 'won' });

  } else {
    // LOST - 3 min cooldown
    const cooldownUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    
    await supabaseServer
      .from('day2_final_boss_attempts')
      .update({
        status: 'lost',
        completed_at: new Date().toISOString(),
        cooldown_until: cooldownUntil,
        score_evidence: { results: scoreEvidence },
      })
      .eq('id', attempt.id);
      
    return NextResponse.json({ success: true, result: 'lost', cooldown_until: cooldownUntil });
  }
}

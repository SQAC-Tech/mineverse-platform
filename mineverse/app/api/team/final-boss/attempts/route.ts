import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST() {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }
  const session = guardResult as Day2Session;

  // 1. Check prerequisites: Repaired Portal, Diamond Pickaxe, Active Round 5
  const { data: repair } = await supabaseServer
    .from('day2_portal_repair')
    .select('*')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (!repair) {
    return NextResponse.json({ success: false, error: 'PORTAL_NOT_REPAIRED' }, { status: 400 });
  }

  const { data: craftLog } = await supabaseServer
    .from('crafting_log')
    .select('*')
    .eq('team_id', session.team_id)
    .eq('item', 'diamond_pickaxe') // Needs to have diamond_pickaxe
    .maybeSingle();

  // Note: if the team doesn't have diamond_pickaxe, Dev 4 handles its crafting. We just check.
  if (!craftLog) {
    return NextResponse.json({ success: false, error: 'MISSING_DIAMOND_PICKAXE' }, { status: 400 });
  }

  const { data: access } = await supabaseServer
    .from('team_round_access')
    .select('*')
    .eq('team_id', session.team_id)
    .eq('round_id', 5) // Round 5
    .maybeSingle();

  // Assume Round 5 active check
  if (!access || access.is_locked) {
    return NextResponse.json({ success: false, error: 'ROUND_5_NOT_ACTIVE' }, { status: 400 });
  }

  // 2. Check cooldown & existing attempt
  const { data: lastAttempt } = await supabaseServer
    .from('day2_final_boss_attempts')
    .select('*')
    .eq('team_id', session.team_id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAttempt) {
    if (lastAttempt.status === 'active') {
       return NextResponse.json({ success: true, payload: lastAttempt.question_payload });
    }
    if (lastAttempt.status === 'won') {
       return NextResponse.json({ success: false, error: 'ALREADY_WON' }, { status: 400 });
    }
    if (lastAttempt.cooldown_until && new Date(lastAttempt.cooldown_until) > new Date()) {
       return NextResponse.json({ success: false, error: 'ON_COOLDOWN', cooldown_until: lastAttempt.cooldown_until }, { status: 400 });
    }
  }

  // 3. Fetch organizer-seeded questions (Dev 5 or Organizer adds these to questions table for round 5 with a specific type? Or a separate table for boss? The prompt said "server-held question packs/test cases only... seeded database rows").
  // Wait, if it's seeded, let's fetch from `questions` with type='boss' or something. Or maybe a specific table `day2_boss_questions`. Let's just assume `questions` with `round_id=5` and `type='boss'`.
  // Wait, the prompt says "The Final Boss question data will be seeded into the database separately by the organizers/development team."
  // I will check `questions` table for round 5 where `type='boss'`. But the `type` constraint in migration 01 is:
  // check (type in ('crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp'))
  // So they can't insert 'boss' without altering the table. Maybe `type='coding'` and some marker in content? Let's just query `questions` for round 5 ordered by `order_index`. Wait, no, maybe they use a new table.
  // Actually, Dev 3 doesn't need to create the questions table, I can just query `questions` table for round_id=5. I'll just get all `type='coding'` questions in round_id=5, or just any question for the final boss. Let's create a temporary table for `day2_boss_questions` or just fetch from `questions` table and check if any exist. Since Dev 3 didn't define a new table, I should probably check `questions` where round_id=5 and maybe it's marked as boss, or there's a convention. Let's just assume there's a `day2_boss_questions` table, or use `questions`. I will create a `day2_boss_questions` table in my migration! Oh wait, I can't modify the migration now that it's run, or can I? No, I can alter the table. Let me just use the `questions` table.

  const { data: questions } = await supabaseServer
    .from('questions')
    .select('id, prompt, content')
    .eq('round_id', 5)
    .order('order_index');

  if (!questions || questions.length === 0) {
     return NextResponse.json({ success: false, error: 'NOT_AVAILABLE' }, { status: 503 }); // 503 Service Unavailable
  }

  // Generate payload
  const questionPayload = {
    questions: questions.map(q => ({
      id: q.id,
      prompt: q.prompt,
      content: q.content,
    })),
  };

  // 4. Create attempt
  const { data: attempt, error: attemptError } = await supabaseServer
    .from('day2_final_boss_attempts')
    .insert({
      team_id: session.team_id,
      status: 'active',
      question_payload: questionPayload,
    })
    .select()
    .single();

  if (attemptError) {
    return NextResponse.json({ success: false, error: 'START_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ success: true, payload: attempt.question_payload });
}

import { supabaseServer } from '@/lib/supabase/server';

/**
 * The generated types do not describe the embedded `teams(...)` select or the
 * shape stored in `score_evidence`, so the three reads are typed here against
 * what this function actually needs.
 */
interface QualifiedRow {
  team_id: string;
  teams: { team_code: string; team_name: string } | null;
}

interface AttemptRow {
  team_id: string;
  status: string;
  completed_at: string | null;
  score_evidence: { correct?: number; total?: number } | null;
}

interface SubmissionRow {
  team_id: string;
  final_score: number | null;
}

export interface Round5Standing {
  rank: number;
  team_id: string;
  team_code: string;
  team_name: string;
  /** Correct answers in the dragon fight, out of the pack it was given. */
  boss_correct: number;
  boss_total: number;
  boss_status: 'won' | 'lost' | 'active' | 'not_attempted';
  /** Correct answers among the seven Round 5 questions. */
  questions_correct: number;
  questions_answered: number;
  /** The two piled together. This is what the ranking is on. */
  total_correct: number;
  /** When the fight was handed in — the tie-break, and null if it never was. */
  boss_completed_at: string | null;
}

/**
 * Round 5, ranked.
 *
 * One pile, no weighting: a correct answer is a correct answer whether it came
 * from the dragon's twenty-five or the round's seven. That is the whole rule,
 * and it is deliberately not a formula — a weighted score would need explaining
 * to a room of teams at the moment the result is announced.
 *
 * Level on the count, the team that finished the dragon first is ahead. It is
 * the only timestamp both halves share: the seven questions are answered in any
 * order across the ninety minutes, so there is no honest "finished" moment for
 * them, while the fight has exactly one.
 *
 * A team that never opened the fight still ranks — on its questions alone. The
 * attempt is mandatory, so that is a fact the organisers need to see rather
 * than a row to hide.
 */
export async function getRound5Leaderboard(): Promise<Round5Standing[]> {
  const [qualifiedResult, attemptsResult, submissionsResult] = await Promise.all([
    supabaseServer
      .from('team_game_state')
      .select('team_id, teams(team_code, team_name)')
      .eq('qualified_for_day2', true),
    supabaseServer
      .from('day2_final_boss_attempts')
      .select('team_id, status, completed_at, score_evidence'),
    supabaseServer.from('submissions').select('team_id, final_score').eq('round_id', 5),
  ]);

  const qualified = (qualifiedResult.data ?? []) as unknown as QualifiedRow[];
  const attempts = (attemptsResult.data ?? []) as unknown as AttemptRow[];
  const submissions = (submissionsResult.data ?? []) as unknown as SubmissionRow[];

  const bossByTeam = new Map<string, AttemptRow>();
  for (const row of attempts) {
    // A team has one attempt now, but older rows may exist from the earlier
    // retryable design — keep the one that was actually handed in.
    const held = bossByTeam.get(row.team_id);
    if (!held || (row.completed_at && !held.completed_at)) bossByTeam.set(row.team_id, row);
  }

  const questionsByTeam = new Map<string, { correct: number; answered: number }>();
  for (const row of submissions) {
    const tally = questionsByTeam.get(row.team_id) ?? { correct: 0, answered: 0 };
    tally.answered += 1;
    if (Number(row.final_score ?? 0) >= 1) tally.correct += 1;
    questionsByTeam.set(row.team_id, tally);
  }

  const rows: Omit<Round5Standing, 'rank'>[] = qualified.map((entry) => {
    const boss = bossByTeam.get(entry.team_id);
    const evidence = (boss?.score_evidence ?? {}) as { correct?: number; total?: number };
    const tally = questionsByTeam.get(entry.team_id) ?? { correct: 0, answered: 0 };

    const bossCorrect = Number(evidence.correct ?? 0);

    return {
      team_id: entry.team_id,
      team_code: entry.teams?.team_code ?? '—',
      team_name: entry.teams?.team_name ?? '—',
      boss_correct: bossCorrect,
      boss_total: Number(evidence.total ?? 0),
      boss_status: (boss?.status ?? 'not_attempted') as Round5Standing['boss_status'],
      questions_correct: tally.correct,
      questions_answered: tally.answered,
      total_correct: bossCorrect + tally.correct,
      boss_completed_at: boss?.completed_at ?? null,
    };
  });

  rows.sort((a, b) => {
    if (b.total_correct !== a.total_correct) return b.total_correct - a.total_correct;
    // A team that never finished the fight cannot win a tie-break on speed.
    if (a.boss_completed_at && b.boss_completed_at) {
      return a.boss_completed_at.localeCompare(b.boss_completed_at);
    }
    if (a.boss_completed_at) return -1;
    if (b.boss_completed_at) return 1;
    return a.team_code.localeCompare(b.team_code);
  });

  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

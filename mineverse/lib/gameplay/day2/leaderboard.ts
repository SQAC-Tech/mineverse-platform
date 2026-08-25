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

interface ResourceRow {
  team_id: string;
  wood: number; stone: number; iron: number;
  gold: number; diamond: number; emerald: number; obsidian: number;
}

export type TeamResources = Omit<ResourceRow, 'team_id'>;

const NO_RESOURCES: TeamResources = {
  wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, emerald: 0, obsidian: 0,
};

/**
 * What one unit of each resource is worth in the standings.
 *
 * An organiser ruling, and a ratio rather than a scale: the six weights sum to
 * ten. Obsidian is not in the ruling and no team holds any, so it scores
 * nothing rather than being given a number nobody decided.
 */
export const RESOURCE_WEIGHTS: TeamResources = {
  wood: 0.5,
  stone: 1,
  iron: 1.5,
  gold: 2,
  emerald: 2,
  diamond: 3,
  obsidian: 0,
};

export function resourcePoints(balance: TeamResources): number {
  let total = 0;
  for (const key of Object.keys(RESOURCE_WEIGHTS) as (keyof TeamResources)[]) {
    total += (balance[key] ?? 0) * RESOURCE_WEIGHTS[key];
  }
  // One decimal: wood is worth a half, so whole numbers would round it away.
  return Math.round(total * 10) / 10;
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
  /**
   * What the team is holding. Shown, never ranked on: the standings are the
   * count of correct answers, and a team that spent its gold on the Diamond
   * Pickaxe must not fall behind one that hoarded.
   */
  resources: TeamResources;
  /** The weighted value of what they hold. */
  resource_points: number;
  /** Answers plus resource points. This is what the ranking is on. */
  grand_total: number;
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
  const [qualifiedResult, attemptsResult, submissionsResult, resourcesResult] = await Promise.all([
    supabaseServer
      .from('team_game_state')
      .select('team_id, teams(team_code, team_name)')
      .eq('qualified_for_day2', true),
    supabaseServer
      .from('day2_final_boss_attempts')
      .select('team_id, status, completed_at, score_evidence'),
    supabaseServer.from('submissions').select('team_id, final_score').eq('round_id', 5),
    supabaseServer
      .from('resources')
      .select('team_id, wood, stone, iron, gold, diamond, emerald, obsidian'),
  ]);

  const qualified = (qualifiedResult.data ?? []) as unknown as QualifiedRow[];
  const attempts = (attemptsResult.data ?? []) as unknown as AttemptRow[];
  const submissions = (submissionsResult.data ?? []) as unknown as SubmissionRow[];
  const resources = (resourcesResult.data ?? []) as unknown as ResourceRow[];

  const resourcesByTeam = new Map<string, TeamResources>();
  for (const { team_id, ...balance } of resources) resourcesByTeam.set(team_id, balance);

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
    const balance = resourcesByTeam.get(entry.team_id) ?? NO_RESOURCES;
    const points = resourcePoints(balance);

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
      resources: balance,
      resource_points: points,
      grand_total: Math.round((bossCorrect + tally.correct + points) * 10) / 10,
    };
  });

  rows.sort((a, b) => {
    if (b.grand_total !== a.grand_total) return b.grand_total - a.grand_total;
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

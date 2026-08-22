import { supabaseServer } from '@/lib/supabase/server';
import { GAUNTLET_PUZZLES, MAX_GAUNTLET_SCORE, scoreGauntlet } from './config';
import { solvedPuzzleIds, totalTries, type GauntletState } from './service';

/**
 * One team's Gauntlet, in full, for the organiser console.
 *
 * Separate from `rankTeams` on purpose. That one answers "who is in the top
 * twenty", so it only looks at attempts carrying a score and its shape is what
 * the shortlist commit and the result mails read. This one answers "what did
 * this team actually do", which includes the teams still sitting it — the ones
 * `rankTeams` cannot show, because an unfinished attempt has no score to rank.
 *
 * Both are needed. During the window an organiser is asked "team 42 says the
 * site ate their answer" and needs the answer; after it, the same screen is the
 * only record of what was typed.
 */
export interface AttemptDetail {
  team_id: string;
  team_code: string;
  team_name: string;
  status: 'in_progress' | 'submitted' | 'expired';
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  auto_submitted: boolean;
  total_score: number;
  raw_score: number;
  bonus_points: number;
  /** Puzzles solved out of `GAUNTLET_PUZZLES.length`. */
  correct_count: number;
  /** How long they took, in seconds — submit time minus start, or so far. */
  elapsed_seconds: number;
  /** Every answer submitted across the attempt, right or wrong. */
  tries: number;
  year: number | null;
  word_assigned: string | null;
  image_assigned: string | null;
  puzzles: Array<{
    id: number;
    title: string;
    solved: boolean;
    solved_at: string | null;
    tries: number;
    answer: string | null;
  }>;
}

export const GAUNTLET_MAX_SCORE = MAX_GAUNTLET_SCORE;

export async function listAttemptDetails(): Promise<AttemptDetail[]> {
  const { data, error } = await supabaseServer
    .from('screening_attempts')
    .select(
      'team_id, option_order, started_at, deadline_at, submitted_at, auto_submitted, raw_score, bonus_points, total_score, correct_count, status, teams(team_code, team_name)',
    )
    .order('started_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row): AttemptDetail => {
    // `option_order` is a `Json` column reused as the Gauntlet's state blob —
    // see `GauntletState`, which is the only description of what is in it.
    const state = (row.option_order ?? {}) as GauntletState;
    const solved = new Set(solvedPuzzleIds(state));

    // Recomputed rather than read from the row: an attempt still in progress has
    // no stored score at all, and this is the number an organiser is comparing
    // against the team standing in front of them.
    const live = scoreGauntlet(solved);
    const stored = row.total_score === null || row.total_score === undefined;

    const end = row.submitted_at ? new Date(row.submitted_at).getTime() : Date.now();

    return {
      team_id: row.team_id,
      team_code: row.teams?.team_code ?? '',
      team_name: row.teams?.team_name ?? '',
      status: row.status as AttemptDetail['status'],
      started_at: row.started_at,
      deadline_at: row.deadline_at,
      submitted_at: row.submitted_at,
      auto_submitted: Boolean(row.auto_submitted),
      total_score: stored ? live.raw_score : Number(row.total_score),
      raw_score: stored ? live.raw_score : Number(row.raw_score ?? 0),
      bonus_points: Number(row.bonus_points ?? 0),
      correct_count: solved.size,
      elapsed_seconds: Math.max(0, Math.floor((end - new Date(row.started_at).getTime()) / 1000)),
      tries: totalTries(state),
      year: typeof state.year === 'number' ? state.year : null,
      word_assigned: state.word_assigned ?? null,
      image_assigned: state.image_assigned ?? null,
      puzzles: GAUNTLET_PUZZLES.map((puzzle) => {
        const key = String(puzzle.id);
        return {
          id: puzzle.id,
          title: puzzle.title,
          solved: solved.has(puzzle.id),
          solved_at: state.progress?.[key]?.solved_at ?? null,
          tries: state.progress?.[key]?.tries ?? 0,
          answer: state.answers?.[key] ?? null,
        };
      }),
    };
  });
}

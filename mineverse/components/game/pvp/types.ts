/**
 * The shapes `/api/team/pvp/current` returns.
 *
 * Their own file because two components need them and neither owns the other:
 * `PvpArenaScreen` fetches a match, `PvpArena` renders one. They used to live
 * in `PvpPanel`, the rail tile that started a duel from inside a round screen —
 * so the arena imported its types from a component it has nothing to do with,
 * and deleting that tile when the search moved to the dashboard would have
 * taken the type definitions with it.
 */

export interface PvpQuestion {
  id: string;
  display_order: number;
  type: string;
  prompt: string;
  content: unknown;
}

export interface PvpSubmission {
  match_question_id: string;
  revision: number;
  status: string;
  submitted_at: string;
  /** This team's own saved answer, so a refresh mid-duel restores the boxes. */
  answer_text?: string;
}

export interface PvpMatch {
  id: string;
  status: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  own_outcome: string | null;
  result: { won: boolean; summary: string | null } | null;
  questions: PvpQuestion[];
  submissions: PvpSubmission[];
}

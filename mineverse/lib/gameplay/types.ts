export interface Dev3GuardianBattle {
  id: string;
  team_id: string;
  round_id: number;
  guardian_name: string;
  attempt_number: number;
  status: 'started' | 'won' | 'lost';
  question_set_version: string;
  started_at: string;
  deadline_at: string | null;
  completed_at: string | null;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  retry_after: string | null;
  reward_ledger_id: string | null;
  penalty_ledger_id: string | null;
  consumed_items: string[] | null;
}

export interface Dev3Transaction {
  id: string;
  team_id: string;
  item_type: string;
  cost_emerald: number;
  ledger_id: string | null;
  created_at: string;
}

export interface Dev3ItemUse {
  id: string;
  team_id: string;
  transaction_id: string;
  item_type: string;
  used_at: string;
  consumed_at: string | null;
  guardian_battle_id: string | null;
  question_id: string | null;
}

export interface Dev3ChoiceDecision {
  team_id: string;
  choice_key: string;
  option_selected: string;
  ledger_id: string;
  created_at: string;
}

export interface Dev3TeamGameState {
  team_id: string;
  nether_core_count: number;
  armor_crafted: boolean;
  qualified_for_day2: boolean;
  qualification_frozen_by: string | null;
  qualification_frozen_at: string | null;
  qualification_freeze_id: string | null;
  qualification_cutoff_percent: number | null;
  qualification_reason: string | null;
  elimination_reason: string | null;
  updated_at: string;
}

export interface Dev4Submission {
  id: string;
  team_id: string;
  round_id: number;
  question_id: string;
  status: 'pending' | 'graded' | 'manual_review';
  score: number;
  submitted_at: string;
}

export interface Dev4Question {
  id: string;
  round_id: number;
  type: string; // assumed e.g. 'guardian'
  metadata: Record<string, any>;
}

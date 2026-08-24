// GENERATED from the PostgREST openapi.json in the Supabase backup.
// Regenerate with scripts/mongo/gen-relations.mjs — do not hand-edit.

export interface Relation { column: string; table: string; ref: string }

export const RELATIONS: Record<string, Relation[]> = {
  "crafting_log": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "unlock_round_id",
      "table": "rounds",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "screening_answers": [
    {
      "column": "attempt_id",
      "table": "screening_attempts",
      "ref": "id"
    },
    {
      "column": "question_id",
      "table": "screening_questions",
      "ref": "id"
    }
  ],
  "attendance_checkpoints": [
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "proctor_sessions": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "questions": [
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "item_uses": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "transaction_id",
      "table": "transactions",
      "ref": "id"
    },
    {
      "column": "guardian_battle_id",
      "table": "guardian_battles",
      "ref": "id"
    }
  ],
  "day2_champion_certifications": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "email_logs": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "member_id",
      "table": "members",
      "ref": "id"
    }
  ],
  "relay_screening_attempts": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "team_game_state": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "grading_runs": [
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "proctor_events": [
    {
      "column": "session_id",
      "table": "proctor_sessions",
      "ref": "id"
    },
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "pvp_match_questions": [
    {
      "column": "match_id",
      "table": "pvp_matches",
      "ref": "id"
    },
    {
      "column": "source_question_id",
      "table": "questions",
      "ref": "id"
    }
  ],
  "day2_portal_fragments": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "resource_ledger": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "day2_reconciliations": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "latest_ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "pvp_matches": [
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    },
    {
      "column": "winner_team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "replay_of_match_id",
      "table": "pvp_matches",
      "ref": "id"
    }
  ],
  "pvp_results": [
    {
      "column": "match_id",
      "table": "pvp_matches",
      "ref": "id"
    },
    {
      "column": "winner_team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "loser_team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "award_ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "guardian_battles": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "members": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "resources": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "manual_adjustments": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "payments": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "pvp_match_submissions": [
    {
      "column": "match_id",
      "table": "pvp_matches",
      "ref": "id"
    },
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "match_question_id",
      "table": "pvp_match_questions",
      "ref": "id"
    }
  ],
  "day2_event_effects": [
    {
      "column": "event_id",
      "table": "day2_event_instances",
      "ref": "id"
    },
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "screening_attempts": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "pvp_match_teams": [
    {
      "column": "match_id",
      "table": "pvp_matches",
      "ref": "id"
    },
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "otp_challenges": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "team_round_access": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "transactions": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "team_event_effects": [
    {
      "column": "world_event_id",
      "table": "world_events",
      "ref": "id"
    },
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "submissions": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    },
    {
      "column": "question_id",
      "table": "questions",
      "ref": "id"
    }
  ],
  "day2_provisional_winners": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "day2_final_boss_attempts": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "attendance_member_records": [
    {
      "column": "attendance_record_id",
      "table": "attendance_records",
      "ref": "id"
    },
    {
      "column": "member_id",
      "table": "members",
      "ref": "id"
    }
  ],
  "attendance_records": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "checkpoint_id",
      "table": "attendance_checkpoints",
      "ref": "id"
    }
  ],
  "screening_shortlist": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "choice_decisions": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "day2_portal_repair": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    }
  ],
  "grading_items": [
    {
      "column": "run_id",
      "table": "grading_runs",
      "ref": "id"
    },
    {
      "column": "submission_id",
      "table": "submissions",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ],
  "world_events": [
    {
      "column": "round_id",
      "table": "rounds",
      "ref": "id"
    }
  ],
  "day2_manual_adjustments": [
    {
      "column": "team_id",
      "table": "teams",
      "ref": "id"
    },
    {
      "column": "ledger_id",
      "table": "resource_ledger",
      "ref": "id"
    }
  ]
};

/** Single-column primary key per table, used to fill `_id` on insert. */
export const PRIMARY_KEY: Record<string, string> = {
  "crafting_log": "id",
  "screening_answers": "question_id",
  "attendance_checkpoints": "id",
  "teams": "id",
  "proctor_sessions": "id",
  "questions": "id",
  "item_uses": "id",
  "day2_champion_certifications": "team_id",
  "email_logs": "id",
  "relay_screening_attempts": "id",
  "team_game_state": "team_id",
  "grading_runs": "id",
  "day2_event_instances": "id",
  "proctor_events": "id",
  "pvp_match_questions": "id",
  "day2_portal_fragments": "team_id",
  "resource_ledger": "id",
  "day2_reconciliations": "id",
  "pvp_matches": "id",
  "pvp_results": "id",
  "guardian_battles": "id",
  "members": "id",
  "resources": "team_id",
  "manual_adjustments": "id",
  "payments": "id",
  "pvp_match_submissions": "id",
  "day2_event_effects": "id",
  "screening_attempts": "id",
  "pvp_match_teams": "id",
  "otp_challenges": "id",
  "team_round_access": "id",
  "transactions": "id",
  "team_event_effects": "id",
  "submissions": "id",
  "day2_provisional_winners": "team_id",
  "day2_final_boss_attempts": "id",
  "attendance_member_records": "id",
  "staff_attendance": "id",
  "attendance_records": "id",
  "screening_shortlist": "team_id",
  "choice_decisions": "id",
  "platform_settings": "key",
  "screening_questions": "id",
  "day2_portal_repair": "team_id",
  "grading_items": "id",
  "world_events": "id",
  "rounds": "id",
  "day2_manual_adjustments": "id"
};

/** Columns that must round-trip as Date, not ISO string. */
export const DATE_COLUMNS: Record<string, string[]> = {
  "crafting_log": [
    "crafted_at"
  ],
  "screening_answers": [
    "answered_at"
  ],
  "attendance_checkpoints": [
    "created_at"
  ],
  "teams": [
    "created_at",
    "updated_at",
    "active_login_at",
    "active_login_seen_at"
  ],
  "proctor_sessions": [
    "started_at",
    "last_seen_at",
    "ended_at"
  ],
  "questions": [
    "created_at"
  ],
  "item_uses": [
    "used_at",
    "consumed_at"
  ],
  "day2_champion_certifications": [
    "certified_at"
  ],
  "email_logs": [
    "sent_at",
    "created_at"
  ],
  "relay_screening_attempts": [
    "started_at",
    "submitted_at",
    "created_at"
  ],
  "team_game_state": [
    "qualification_frozen_at",
    "updated_at"
  ],
  "grading_runs": [
    "created_at",
    "started_at",
    "completed_at"
  ],
  "day2_event_instances": [
    "starts_at",
    "ends_at",
    "triggered_at"
  ],
  "proctor_events": [
    "occurred_at"
  ],
  "pvp_match_questions": [
    "created_at"
  ],
  "day2_portal_fragments": [
    "awarded_at"
  ],
  "resource_ledger": [
    "created_at"
  ],
  "day2_reconciliations": [
    "reconciled_at"
  ],
  "pvp_matches": [
    "started_at",
    "deadline_at",
    "resolved_at",
    "created_at"
  ],
  "pvp_results": [
    "resolved_at"
  ],
  "guardian_battles": [
    "started_at",
    "completed_at",
    "retry_after",
    "deadline_at"
  ],
  "members": [
    "created_at",
    "updated_at"
  ],
  "resources": [
    "updated_at"
  ],
  "manual_adjustments": [
    "created_at"
  ],
  "payments": [
    "verified_at",
    "created_at",
    "updated_at"
  ],
  "pvp_match_submissions": [
    "validated_at",
    "submitted_at"
  ],
  "day2_event_effects": [
    "applied_at"
  ],
  "screening_attempts": [
    "started_at",
    "deadline_at",
    "submitted_at",
    "created_at"
  ],
  "pvp_match_teams": [
    "completion_at",
    "created_at"
  ],
  "otp_challenges": [
    "expires_at",
    "created_at"
  ],
  "team_round_access": [
    "started_at",
    "completed_at",
    "created_at"
  ],
  "transactions": [
    "created_at"
  ],
  "team_event_effects": [
    "applied_at",
    "expires_at"
  ],
  "submissions": [
    "submitted_at",
    "locked_at",
    "created_at",
    "updated_at"
  ],
  "day2_provisional_winners": [
    "claimed_at"
  ],
  "day2_final_boss_attempts": [
    "started_at",
    "completed_at",
    "cooldown_until"
  ],
  "attendance_member_records": [
    "created_at"
  ],
  "staff_attendance": [
    "reported_at",
    "created_at"
  ],
  "attendance_records": [
    "marked_at",
    "updated_at"
  ],
  "screening_shortlist": [
    "submitted_at",
    "decided_at",
    "result_mailed_at",
    "rsvp_confirmed_at"
  ],
  "choice_decisions": [
    "created_at"
  ],
  "platform_settings": [
    "updated_at"
  ],
  "screening_questions": [
    "created_at"
  ],
  "day2_portal_repair": [
    "repaired_at"
  ],
  "grading_items": [
    "created_at",
    "updated_at"
  ],
  "world_events": [
    "starts_at",
    "ends_at",
    "created_at"
  ],
  "rounds": [
    "starts_at",
    "ends_at",
    "created_at"
  ],
  "day2_manual_adjustments": [
    "requested_at"
  ]
};

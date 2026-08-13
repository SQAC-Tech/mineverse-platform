export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_checkpoints: {
        Row: {
          code: string
          created_at: string
          day: number
          id: number
          label: string
          round_id: number | null
          sequence: number
        }
        Insert: {
          code: string
          created_at?: string
          day: number
          id?: number
          label: string
          round_id?: number | null
          sequence: number
        }
        Update: {
          code?: string
          created_at?: string
          day?: number
          id?: number
          label?: string
          round_id?: number | null
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_checkpoints_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_member_records: {
        Row: {
          attendance_record_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_records_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          checkpoint_id: number
          id: string
          marked_at: string
          members_present: number
          method: string
          notes: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          checkpoint_id: number
          id?: string
          marked_at?: string
          members_present: number
          method: string
          notes?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          checkpoint_id?: number
          id?: string
          marked_at?: string
          members_present?: number
          method?: string
          notes?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "attendance_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      choice_decisions: {
        Row: {
          choice_key: string
          created_at: string
          id: string
          ledger_id: string | null
          option_selected: string
          team_id: string
        }
        Insert: {
          choice_key: string
          created_at?: string
          id?: string
          ledger_id?: string | null
          option_selected: string
          team_id: string
        }
        Update: {
          choice_key?: string
          created_at?: string
          id?: string
          ledger_id?: string | null
          option_selected?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choice_decisions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crafting_log: {
        Row: {
          actual_cost: Json
          base_cost: Json
          crafted_at: string
          discount_percent: number
          discount_source: string | null
          id: string
          idempotency_key: string
          item: string
          ledger_id: string
          team_id: string
          unlock_round_id: number | null
        }
        Insert: {
          actual_cost: Json
          base_cost: Json
          crafted_at?: string
          discount_percent?: number
          discount_source?: string | null
          id?: string
          idempotency_key: string
          item: string
          ledger_id: string
          team_id: string
          unlock_round_id?: number | null
        }
        Update: {
          actual_cost?: Json
          base_cost?: Json
          crafted_at?: string
          discount_percent?: number
          discount_source?: string | null
          id?: string
          idempotency_key?: string
          item?: string
          ledger_id?: string
          team_id?: string
          unlock_round_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crafting_log_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crafting_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crafting_log_unlock_round_id_fkey"
            columns: ["unlock_round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          error: string | null
          id: string
          member_id: string | null
          provider: string
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          error?: string | null
          id?: string
          member_id?: string | null
          provider: string
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          error?: string | null
          id?: string
          member_id?: string | null
          provider?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_items: {
        Row: {
          created_at: string
          error: string | null
          final_score: number | null
          id: string
          ledger_id: string | null
          path: string
          provider_metadata: Json | null
          revision: number
          run_id: string | null
          state: string
          submission_id: string
          updated_at: string
          validated_result: Json | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          final_score?: number | null
          id?: string
          ledger_id?: string | null
          path: string
          provider_metadata?: Json | null
          revision: number
          run_id?: string | null
          state?: string
          submission_id: string
          updated_at?: string
          validated_result?: Json | null
        }
        Update: {
          created_at?: string
          error?: string | null
          final_score?: number | null
          id?: string
          ledger_id?: string | null
          path?: string
          provider_metadata?: Json | null
          revision?: number
          run_id?: string | null
          state?: string
          submission_id?: string
          updated_at?: string
          validated_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_items_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "grading_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_runs: {
        Row: {
          batch_size: number
          completed_at: string | null
          created_at: string
          cursor: string | null
          error: string | null
          id: string
          initiated_by: string
          manual_review_count: number
          model: string | null
          processed_count: number
          provider: string | null
          round_id: number
          started_at: string | null
          state: string
          total_count: number
        }
        Insert: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          cursor?: string | null
          error?: string | null
          id?: string
          initiated_by: string
          manual_review_count?: number
          model?: string | null
          processed_count?: number
          provider?: string | null
          round_id: number
          started_at?: string | null
          state?: string
          total_count?: number
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          cursor?: string | null
          error?: string | null
          id?: string
          initiated_by?: string
          manual_review_count?: number
          model?: string | null
          processed_count?: number
          provider?: string | null
          round_id?: number
          started_at?: string | null
          state?: string
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "grading_runs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_battles: {
        Row: {
          attempt_number: number
          completed_at: string | null
          consumed_items: string[] | null
          correct_count: number | null
          deadline_at: string | null
          guardian_name: string
          id: string
          penalty_ledger_id: string | null
          question_set_version: string
          retry_after: string | null
          reward_ledger_id: string | null
          round_id: number
          score: number | null
          started_at: string
          status: string
          team_id: string
          total_questions: number | null
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          consumed_items?: string[] | null
          correct_count?: number | null
          deadline_at?: string | null
          guardian_name: string
          id?: string
          penalty_ledger_id?: string | null
          question_set_version: string
          retry_after?: string | null
          reward_ledger_id?: string | null
          round_id: number
          score?: number | null
          started_at?: string
          status: string
          team_id: string
          total_questions?: number | null
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          consumed_items?: string[] | null
          correct_count?: number | null
          deadline_at?: string | null
          guardian_name?: string
          id?: string
          penalty_ledger_id?: string | null
          question_set_version?: string
          retry_after?: string | null
          reward_ledger_id?: string | null
          round_id?: number
          score?: number | null
          started_at?: string
          status?: string
          team_id?: string
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_battles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      item_uses: {
        Row: {
          consumed_at: string | null
          guardian_battle_id: string | null
          id: string
          item_type: string
          question_id: string | null
          team_id: string
          transaction_id: string | null
          used_at: string
        }
        Insert: {
          consumed_at?: string | null
          guardian_battle_id?: string | null
          id?: string
          item_type: string
          question_id?: string | null
          team_id: string
          transaction_id?: string | null
          used_at?: string
        }
        Update: {
          consumed_at?: string | null
          guardian_battle_id?: string | null
          id?: string
          item_type?: string
          question_id?: string | null
          team_id?: string
          transaction_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_uses_guardian_battle_id_fkey"
            columns: ["guardian_battle_id"]
            isOneToOne: false
            referencedRelation: "guardian_battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_uses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_uses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_adjustments: {
        Row: {
          admin_id: string
          balance_after: Json | null
          balance_before: Json | null
          created_at: string
          delta: Json
          id: string
          idempotency_key: string
          ledger_id: string | null
          reason: string
          team_id: string
        }
        Insert: {
          admin_id: string
          balance_after?: Json | null
          balance_before?: Json | null
          created_at?: string
          delta: Json
          id?: string
          idempotency_key: string
          ledger_id?: string | null
          reason: string
          team_id: string
        }
        Update: {
          admin_id?: string
          balance_after?: Json | null
          balance_before?: Json | null
          created_at?: string
          delta?: Json
          id?: string
          idempotency_key?: string
          ledger_id?: string | null
          reason?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_adjustments_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_adjustments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          college_email: string
          created_at: string
          department: string
          email: string
          email_verified: boolean
          id: string
          is_team_lead: boolean
          name: string
          phone: string
          registration_no: string | null
          section: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          college_email: string
          created_at?: string
          department: string
          email: string
          email_verified?: boolean
          id?: string
          is_team_lead?: boolean
          name: string
          phone: string
          registration_no?: string | null
          section?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          college_email?: string
          created_at?: string
          department?: string
          email?: string
          email_verified?: boolean
          id?: string
          is_team_lead?: boolean
          name?: string
          phone?: string
          registration_no?: string | null
          section?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_results: {
        Row: {
          activity: string
          award: Json
          created_at: string
          id: string
          idempotency_key: string
          ledger_id: string | null
          notes: string | null
          recorded_by: string
          round_id: number
          team_id: string
          volunteer_name: string | null
        }
        Insert: {
          activity: string
          award?: Json
          created_at?: string
          id?: string
          idempotency_key: string
          ledger_id?: string | null
          notes?: string | null
          recorded_by: string
          round_id: number
          team_id: string
          volunteer_name?: string | null
        }
        Update: {
          activity?: string
          award?: Json
          created_at?: string
          id?: string
          idempotency_key?: string
          ledger_id?: string | null
          notes?: string | null
          recorded_by?: string
          round_id?: number
          team_id?: string
          volunteer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_results_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_challenges: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          purpose: string
          team_id: string | null
          verification_token: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          purpose: string
          team_id?: string | null
          verification_token?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          purpose?: string
          team_id?: string | null
          verification_token?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "otp_challenges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          sender_name: string
          sender_upi_id: string | null
          status: string
          team_id: string
          team_size: number
          transaction_id: string
          updated_at: string
          upi_string: string | null
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          sender_name: string
          sender_upi_id?: string | null
          status?: string
          team_id: string
          team_size: number
          transaction_id: string
          updated_at?: string
          upi_string?: string | null
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          sender_name?: string
          sender_upi_id?: string | null
          status?: string
          team_id?: string
          team_size?: number
          transaction_id?: string
          updated_at?: string
          upi_string?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_match_questions: {
        Row: {
          content: Json
          created_at: string
          display_order: number
          expected_answer: Json | null
          id: string
          language_options: string[]
          match_id: string
          prompt: string
          source_question_id: string | null
          time_limit_seconds: number | null
          type: string
        }
        Insert: {
          content?: Json
          created_at?: string
          display_order: number
          expected_answer?: Json | null
          id?: string
          language_options?: string[]
          match_id: string
          prompt: string
          source_question_id?: string | null
          time_limit_seconds?: number | null
          type: string
        }
        Update: {
          content?: Json
          created_at?: string
          display_order?: number
          expected_answer?: Json | null
          id?: string
          language_options?: string[]
          match_id?: string
          prompt?: string
          source_question_id?: string | null
          time_limit_seconds?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvp_match_questions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pvp_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_match_questions_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_match_submissions: {
        Row: {
          answer_text: string
          id: string
          idempotency_key: string
          is_correct: boolean | null
          match_id: string
          match_question_id: string
          revision: number
          status: string
          submitted_at: string
          team_id: string
          validated_at: string | null
        }
        Insert: {
          answer_text: string
          id?: string
          idempotency_key: string
          is_correct?: boolean | null
          match_id: string
          match_question_id: string
          revision?: number
          status?: string
          submitted_at?: string
          team_id: string
          validated_at?: string | null
        }
        Update: {
          answer_text?: string
          id?: string
          idempotency_key?: string
          is_correct?: boolean | null
          match_id?: string
          match_question_id?: string
          revision?: number
          status?: string
          submitted_at?: string
          team_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pvp_match_submissions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pvp_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_match_submissions_match_question_id_fkey"
            columns: ["match_question_id"]
            isOneToOne: false
            referencedRelation: "pvp_match_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_match_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_match_teams: {
        Row: {
          completion_at: string | null
          created_at: string
          elapsed_ms: number | null
          eligibility_snapshot: Json
          id: string
          match_id: string
          outcome: string | null
          status: string
          team_id: string
        }
        Insert: {
          completion_at?: string | null
          created_at?: string
          elapsed_ms?: number | null
          eligibility_snapshot?: Json
          id?: string
          match_id: string
          outcome?: string | null
          status?: string
          team_id: string
        }
        Update: {
          completion_at?: string | null
          created_at?: string
          elapsed_ms?: number | null
          eligibility_snapshot?: Json
          id?: string
          match_id?: string
          outcome?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvp_match_teams_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pvp_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_match_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_matches: {
        Row: {
          audit_correlation_id: string
          created_at: string
          created_by: string
          deadline_at: string | null
          duration_seconds: number
          id: string
          pack_id: string
          pack_version: string
          replay_of_match_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          result_summary: Json | null
          round_id: number
          started_at: string | null
          started_by: string | null
          status: string
          void_reason: string | null
          voided_by: string | null
          winner_team_id: string | null
        }
        Insert: {
          audit_correlation_id?: string
          created_at?: string
          created_by: string
          deadline_at?: string | null
          duration_seconds?: number
          id?: string
          pack_id: string
          pack_version?: string
          replay_of_match_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          result_summary?: Json | null
          round_id: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          void_reason?: string | null
          voided_by?: string | null
          winner_team_id?: string | null
        }
        Update: {
          audit_correlation_id?: string
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          duration_seconds?: number
          id?: string
          pack_id?: string
          pack_version?: string
          replay_of_match_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          result_summary?: Json | null
          round_id?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          void_reason?: string | null
          voided_by?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pvp_matches_replay_of_match_id_fkey"
            columns: ["replay_of_match_id"]
            isOneToOne: false
            referencedRelation: "pvp_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_results: {
        Row: {
          award_ledger_id: string | null
          id: string
          loser_team_id: string
          match_id: string
          resolved_at: string
          source: string
          winner_elapsed_ms: number | null
          winner_team_id: string
        }
        Insert: {
          award_ledger_id?: string | null
          id?: string
          loser_team_id: string
          match_id: string
          resolved_at?: string
          source?: string
          winner_elapsed_ms?: number | null
          winner_team_id: string
        }
        Update: {
          award_ledger_id?: string | null
          id?: string
          loser_team_id?: string
          match_id?: string
          resolved_at?: string
          source?: string
          winner_elapsed_ms?: number | null
          winner_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvp_results_award_ledger_id_fkey"
            columns: ["award_ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_results_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "pvp_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_results_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          auto_grade_strategy: string | null
          content: Json
          created_at: string
          expected_answer: Json | null
          guardian_name: string | null
          hidden_test_cases: Json | null
          id: string
          language_options: string[]
          order_index: number
          prompt: string
          reward: Json
          round_id: number
          rubric: Json | null
          time_limit_seconds: number | null
          type: string
        }
        Insert: {
          auto_grade_strategy?: string | null
          content?: Json
          created_at?: string
          expected_answer?: Json | null
          guardian_name?: string | null
          hidden_test_cases?: Json | null
          id?: string
          language_options?: string[]
          order_index: number
          prompt: string
          reward?: Json
          round_id: number
          rubric?: Json | null
          time_limit_seconds?: number | null
          type: string
        }
        Update: {
          auto_grade_strategy?: string | null
          content?: Json
          created_at?: string
          expected_answer?: Json | null
          guardian_name?: string | null
          hidden_test_cases?: Json | null
          id?: string
          language_options?: string[]
          order_index?: number
          prompt?: string
          reward?: Json
          round_id?: number
          rubric?: Json | null
          time_limit_seconds?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_ledger: {
        Row: {
          actor_id: string | null
          actor_type: string
          balance_after: Json
          created_at: string
          delta: Json
          id: string
          idempotency_key: string
          reason: string | null
          source_id: string | null
          source_type: string
          team_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          balance_after: Json
          created_at?: string
          delta: Json
          id?: string
          idempotency_key: string
          reason?: string | null
          source_id?: string | null
          source_type: string
          team_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          balance_after?: Json
          created_at?: string
          delta?: Json
          id?: string
          idempotency_key?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_ledger_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          diamond: number
          emerald: number
          gold: number
          iron: number
          obsidian: number
          stone: number
          team_id: string
          updated_at: string
          version: number
          wood: number
        }
        Insert: {
          diamond?: number
          emerald?: number
          gold?: number
          iron?: number
          obsidian?: number
          stone?: number
          team_id: string
          updated_at?: string
          version?: number
          wood?: number
        }
        Update: {
          diamond?: number
          emerald?: number
          gold?: number
          iron?: number
          obsidian?: number
          stone?: number
          team_id?: string
          updated_at?: string
          version?: number
          wood?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          day: number
          description: string | null
          ends_at: string | null
          id: number
          name: string
          sequence: number
          starts_at: string | null
          status: string
          time_allotted: number
        }
        Insert: {
          created_at?: string
          day: number
          description?: string | null
          ends_at?: string | null
          id?: number
          name: string
          sequence: number
          starts_at?: string | null
          status?: string
          time_allotted: number
        }
        Update: {
          created_at?: string
          day?: number
          description?: string | null
          ends_at?: string | null
          id?: number
          name?: string
          sequence?: number
          starts_at?: string | null
          status?: string
          time_allotted?: number
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          created_at: string
          desk: string
          hours: number
          id: string
          notes: string | null
          person_name: string
          reported_at: string
        }
        Insert: {
          created_at?: string
          desk: string
          hours: number
          id?: string
          notes?: string | null
          person_name: string
          reported_at?: string
        }
        Update: {
          created_at?: string
          desk?: string
          hours?: number
          id?: string
          notes?: string | null
          person_name?: string
          reported_at?: string
        }
        Relationships: []
      }
      structure_repairs: {
        Row: {
          cost_ledger_id: string
          id: string
          repaired_at: string
          structure_id: string
          team_id: string
        }
        Insert: {
          cost_ledger_id: string
          id?: string
          repaired_at?: string
          structure_id: string
          team_id: string
        }
        Update: {
          cost_ledger_id?: string
          id?: string
          repaired_at?: string
          structure_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_repairs_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_repairs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          built_at: string
          id: string
          round_id: number
          state: string
          team_id: string
          type: string
          updated_at: string
          upgrade_lineage: string[] | null
        }
        Insert: {
          built_at?: string
          id?: string
          round_id: number
          state: string
          team_id: string
          type: string
          updated_at?: string
          upgrade_lineage?: string[] | null
        }
        Update: {
          built_at?: string
          id?: string
          round_id?: number
          state?: string
          team_id?: string
          type?: string
          updated_at?: string
          upgrade_lineage?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "structures_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answer_text: string | null
          code: string | null
          created_at: string
          feedback: string | null
          final_award_ledger_id: string | null
          final_score: number | null
          graded_by: string | null
          graded_revision: number | null
          id: string
          language: string | null
          locked_at: string | null
          question_id: string
          response: Json
          revision: number
          round_id: number
          status: string
          submitted_at: string
          team_id: string
          updated_at: string
        }
        Insert: {
          answer_text?: string | null
          code?: string | null
          created_at?: string
          feedback?: string | null
          final_award_ledger_id?: string | null
          final_score?: number | null
          graded_by?: string | null
          graded_revision?: number | null
          id?: string
          language?: string | null
          locked_at?: string | null
          question_id: string
          response?: Json
          revision?: number
          round_id: number
          status?: string
          submitted_at?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          answer_text?: string | null
          code?: string | null
          created_at?: string
          feedback?: string | null
          final_award_ledger_id?: string | null
          final_score?: number | null
          graded_by?: string | null
          graded_revision?: number | null
          id?: string
          language?: string | null
          locked_at?: string | null
          question_id?: string
          response?: Json
          revision?: number
          round_id?: number
          status?: string
          submitted_at?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_event_effects: {
        Row: {
          applied_at: string
          expires_at: string | null
          id: string
          ledger_id: string | null
          modifier: Json
          protection: string | null
          resolution: string | null
          team_id: string
          world_event_id: string
        }
        Insert: {
          applied_at?: string
          expires_at?: string | null
          id?: string
          ledger_id?: string | null
          modifier?: Json
          protection?: string | null
          resolution?: string | null
          team_id: string
          world_event_id: string
        }
        Update: {
          applied_at?: string
          expires_at?: string | null
          id?: string
          ledger_id?: string | null
          modifier?: Json
          protection?: string | null
          resolution?: string | null
          team_id?: string
          world_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_event_effects_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_event_effects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_event_effects_world_event_id_fkey"
            columns: ["world_event_id"]
            isOneToOne: false
            referencedRelation: "world_events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_game_state: {
        Row: {
          armor_crafted: boolean
          elimination_reason: string | null
          nether_core_count: number
          qualification_cutoff_percent: number | null
          qualification_freeze_id: string | null
          qualification_frozen_at: string | null
          qualification_frozen_by: string | null
          qualification_reason: string | null
          qualified_for_day2: boolean
          team_id: string
          updated_at: string
        }
        Insert: {
          armor_crafted?: boolean
          elimination_reason?: string | null
          nether_core_count?: number
          qualification_cutoff_percent?: number | null
          qualification_freeze_id?: string | null
          qualification_frozen_at?: string | null
          qualification_frozen_by?: string | null
          qualification_reason?: string | null
          qualified_for_day2?: boolean
          team_id: string
          updated_at?: string
        }
        Update: {
          armor_crafted?: boolean
          elimination_reason?: string | null
          nether_core_count?: number
          qualification_cutoff_percent?: number | null
          qualification_freeze_id?: string | null
          qualification_frozen_at?: string | null
          qualification_frozen_by?: string | null
          qualification_reason?: string | null
          qualified_for_day2?: boolean
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_game_state_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_round_access: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_locked: boolean
          round_id: number
          score: number
          started_at: string | null
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          round_id: number
          score?: number
          started_at?: string | null
          team_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          round_id?: number
          score?: number
          started_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_round_access_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_round_access_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          completion_time: number
          created_at: string
          id: string
          is_payment_verified: boolean
          qr_token: string | null
          status: string
          team_code: string
          team_name: string
          team_size: number
          total_score: number
          updated_at: string
        }
        Insert: {
          completion_time?: number
          created_at?: string
          id?: string
          is_payment_verified?: boolean
          qr_token?: string | null
          status?: string
          team_code: string
          team_name: string
          team_size: number
          total_score?: number
          updated_at?: string
        }
        Update: {
          completion_time?: number
          created_at?: string
          id?: string
          is_payment_verified?: boolean
          qr_token?: string | null
          status?: string
          team_code?: string
          team_name?: string
          team_size?: number
          total_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          cost_emerald: number
          created_at: string
          id: string
          item_type: string
          ledger_id: string | null
          team_id: string
        }
        Insert: {
          cost_emerald: number
          created_at?: string
          id?: string
          item_type: string
          ledger_id?: string | null
          team_id: string
        }
        Update: {
          cost_emerald?: number
          created_at?: string
          id?: string
          item_type?: string
          ledger_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      world_events: {
        Row: {
          created_at: string
          effect: Json
          ends_at: string | null
          event_key: string
          id: string
          round_id: number
          scope: string
          starts_at: string
          status: string
          target_team_ids: string[]
          triggered_by: string
        }
        Insert: {
          created_at?: string
          effect?: Json
          ends_at?: string | null
          event_key: string
          id?: string
          round_id: number
          scope?: string
          starts_at?: string
          status?: string
          target_team_ids?: string[]
          triggered_by: string
        }
        Update: {
          created_at?: string
          effect?: Json
          ends_at?: string | null
          event_key?: string
          id?: string
          round_id?: number
          scope?: string
          starts_at?: string
          status?: string
          target_team_ids?: string[]
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_manual_adjustment: {
        Args: {
          p_admin_id: string
          p_delta: Json
          p_idempotency_key: string
          p_reason: string
          p_team_id: string
        }
        Returns: Json
      }
      craft_team_item: {
        Args: { p_idempotency_key: string; p_item: string; p_team_id: string }
        Returns: Json
      }
      dev3_buy_marketplace_item: {
        Args: {
          p_cost_emerald: number
          p_delta: Json
          p_idempotency_key: string
          p_item_type: string
          p_reason: string
          p_team_id: string
        }
        Returns: Json
      }
      dev3_make_choice_decision: {
        Args: {
          p_choice_key: string
          p_delta: Json
          p_idempotency_key: string
          p_option_selected: string
          p_reason: string
          p_team_id: string
        }
        Returns: Json
      }
      dev4_resource_snapshot: {
        Args: {
          p_diamond: number
          p_emerald: number
          p_gold: number
          p_iron: number
          p_obsidian: number
          p_stone: number
          p_wood: number
        }
        Returns: Json
      }
      generate_team_code: { Args: never; Returns: string }
      mutate_team_resources: {
        Args: {
          p_actor_id?: string
          p_actor_type?: string
          p_delta: Json
          p_idempotency_key?: string
          p_reason?: string
          p_source_id?: string
          p_source_type: string
          p_team_id: string
        }
        Returns: Json
      }
      record_offline_result: {
        Args: {
          p_activity: string
          p_admin_id: string
          p_award: Json
          p_idempotency_key: string
          p_notes?: string
          p_round_id: number
          p_team_id: string
          p_volunteer_name: string
        }
        Returns: Json
      }
      resolve_pvp_match: {
        Args: { p_admin_id: string; p_match_id: string }
        Returns: Json
      }
      start_pvp_match: {
        Args: { p_admin_id: string; p_match_id: string }
        Returns: Json
      }
      void_pvp_match: {
        Args: { p_admin_id: string; p_match_id: string; p_reason: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

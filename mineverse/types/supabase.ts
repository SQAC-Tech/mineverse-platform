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
      day2_champion_certifications: {
        Row: {
          certified_at: string
          certified_by: string
          evidence: Json
          reason: string
          team_id: string
        }
        Insert: {
          certified_at?: string
          certified_by: string
          evidence?: Json
          reason: string
          team_id: string
        }
        Update: {
          certified_at?: string
          certified_by?: string
          evidence?: Json
          reason?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_champion_certifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_event_effects: {
        Row: {
          applied_at: string
          applied_by: string
          delta: Json
          event_id: string
          id: string
          idempotency_key: string
          ledger_id: string
          notes: string | null
          protection: string | null
          reason: string
          resolution: string
          team_id: string
        }
        Insert: {
          applied_at?: string
          applied_by: string
          delta?: Json
          event_id: string
          id?: string
          idempotency_key: string
          ledger_id: string
          notes?: string | null
          protection?: string | null
          reason: string
          resolution: string
          team_id: string
        }
        Update: {
          applied_at?: string
          applied_by?: string
          delta?: Json
          event_id?: string
          id?: string
          idempotency_key?: string
          ledger_id?: string
          notes?: string | null
          protection?: string | null
          reason?: string
          resolution?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_event_effects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "day2_event_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day2_event_effects_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day2_event_effects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_event_instances: {
        Row: {
          effect: Json
          ends_at: string | null
          event_key: string
          id: string
          idempotency_key: string
          notes: string | null
          reason: string
          round_id: number
          scope: string
          starts_at: string
          status: string
          target_team_ids: string[]
          triggered_at: string
          triggered_by: string
        }
        Insert: {
          effect?: Json
          ends_at?: string | null
          event_key: string
          id?: string
          idempotency_key: string
          notes?: string | null
          reason: string
          round_id?: number
          scope?: string
          starts_at?: string
          status?: string
          target_team_ids?: string[]
          triggered_at?: string
          triggered_by: string
        }
        Update: {
          effect?: Json
          ends_at?: string | null
          event_key?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          reason?: string
          round_id?: number
          scope?: string
          starts_at?: string
          status?: string
          target_team_ids?: string[]
          triggered_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
      day2_final_boss_attempts: {
        Row: {
          completed_at: string | null
          cooldown_until: string | null
          id: string
          question_payload: Json
          score_evidence: Json | null
          started_at: string
          status: string
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          cooldown_until?: string | null
          id?: string
          question_payload?: Json
          score_evidence?: Json | null
          started_at?: string
          status: string
          team_id: string
        }
        Update: {
          completed_at?: string | null
          cooldown_until?: string | null
          id?: string
          question_payload?: Json
          score_evidence?: Json | null
          started_at?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_final_boss_attempts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_manual_adjustments: {
        Row: {
          admin_id: string
          balance_after: Json
          balance_before: Json
          expected_balance_after: Json
          expected_balance_before: Json
          id: string
          idempotency_key: string
          ledger_id: string
          notes: string | null
          reason: string
          requested_at: string
          requested_delta: Json
          status: string
          team_id: string
        }
        Insert: {
          admin_id: string
          balance_after: Json
          balance_before: Json
          expected_balance_after: Json
          expected_balance_before: Json
          id?: string
          idempotency_key: string
          ledger_id: string
          notes?: string | null
          reason: string
          requested_at?: string
          requested_delta: Json
          status?: string
          team_id: string
        }
        Update: {
          admin_id?: string
          balance_after?: Json
          balance_before?: Json
          expected_balance_after?: Json
          expected_balance_before?: Json
          id?: string
          idempotency_key?: string
          ledger_id?: string
          notes?: string | null
          reason?: string
          requested_at?: string
          requested_delta?: Json
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_manual_adjustments_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day2_manual_adjustments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_portal_fragments: {
        Row: {
          awarded_at: string
          source: string
          team_id: string
        }
        Insert: {
          awarded_at?: string
          source: string
          team_id: string
        }
        Update: {
          awarded_at?: string
          source?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_portal_fragments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_portal_repair: {
        Row: {
          repaired_at: string
          team_id: string
        }
        Insert: {
          repaired_at?: string
          team_id: string
        }
        Update: {
          repaired_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_portal_repair_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_provisional_winners: {
        Row: {
          claimed_at: string
          status: string
          team_id: string
        }
        Insert: {
          claimed_at?: string
          status?: string
          team_id: string
        }
        Update: {
          claimed_at?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day2_provisional_winners_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day2_reconciliations: {
        Row: {
          diamond_pickaxe_crafted: boolean
          discrepancies: Json
          final_boss_outcome: Json
          id: string
          idempotency_key: string
          latest_ledger_id: string | null
          operator_notes: string
          portal_repaired: boolean
          qualification_snapshot: Json
          reconciled_at: string
          reconciled_by: string
          resource_balance: Json
          resource_version: number
          state: string
          team_id: string
          unresolved_adjustments: Json
        }
        Insert: {
          diamond_pickaxe_crafted: boolean
          discrepancies?: Json
          final_boss_outcome: Json
          id?: string
          idempotency_key: string
          latest_ledger_id?: string | null
          operator_notes: string
          portal_repaired: boolean
          qualification_snapshot: Json
          reconciled_at?: string
          reconciled_by: string
          resource_balance: Json
          resource_version: number
          state: string
          team_id: string
          unresolved_adjustments?: Json
        }
        Update: {
          diamond_pickaxe_crafted?: boolean
          discrepancies?: Json
          final_boss_outcome?: Json
          id?: string
          idempotency_key?: string
          latest_ledger_id?: string | null
          operator_notes?: string
          portal_repaired?: boolean
          qualification_snapshot?: Json
          reconciled_at?: string
          reconciled_by?: string
          resource_balance?: Json
          resource_version?: number
          state?: string
          team_id?: string
          unresolved_adjustments?: Json
        }
        Relationships: [
          {
            foreignKeyName: "day2_reconciliations_latest_ledger_id_fkey"
            columns: ["latest_ledger_id"]
            isOneToOne: false
            referencedRelation: "resource_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day2_reconciliations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      proctor_events: {
        Row: {
          detail: Json
          id: number
          kind: string
          occurred_at: string
          round_id: number
          session_id: string
          severity: string
          team_id: string
        }
        Insert: {
          detail?: Json
          id?: number
          kind: string
          occurred_at?: string
          round_id: number
          session_id: string
          severity: string
          team_id: string
        }
        Update: {
          detail?: Json
          id?: number
          kind?: string
          occurred_at?: string
          round_id?: number
          session_id?: string
          severity?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctor_events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctor_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctor_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      proctor_sessions: {
        Row: {
          capabilities: Json
          device_id: string
          ended_at: string | null
          id: string
          key_violation_count: number
          last_seen_at: string
          round_id: number
          started_at: string
          status: string
          team_id: string
          user_agent: string | null
          warning_count: number
        }
        Insert: {
          capabilities?: Json
          device_id: string
          ended_at?: string | null
          id?: string
          key_violation_count?: number
          last_seen_at?: string
          round_id: number
          started_at?: string
          status?: string
          team_id: string
          user_agent?: string | null
          warning_count?: number
        }
        Update: {
          capabilities?: Json
          device_id?: string
          ended_at?: string | null
          id?: string
          key_violation_count?: number
          last_seen_at?: string
          round_id?: number
          started_at?: string
          status?: string
          team_id?: string
          user_agent?: string | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "proctor_sessions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctor_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
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
          logic_puzzle_variant: string | null
          order_index: number
          pack_version: string | null
          prompt: string
          reward: Json
          round_id: number
          rubric: Json | null
          runtime_meta: Json | null
          sample_test_cases: Json
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
          logic_puzzle_variant?: string | null
          order_index: number
          pack_version?: string | null
          prompt: string
          reward?: Json
          round_id: number
          rubric?: Json | null
          runtime_meta?: Json | null
          sample_test_cases?: Json
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
          logic_puzzle_variant?: string | null
          order_index?: number
          pack_version?: string | null
          prompt?: string
          reward?: Json
          round_id?: number
          rubric?: Json | null
          runtime_meta?: Json | null
          sample_test_cases?: Json
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
      screening_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          question_id: string
          selected_index: number
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          question_id: string
          selected_index: number
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          question_id?: string
          selected_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "screening_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "screening_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_attempts: {
        Row: {
          auto_submitted: boolean
          bonus_points: number
          correct_count: number | null
          created_at: string
          deadline_at: string
          id: string
          option_order: Json
          question_ids: string[]
          raw_score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          team_id: string
          total_score: number | null
        }
        Insert: {
          auto_submitted?: boolean
          bonus_points?: number
          correct_count?: number | null
          created_at?: string
          deadline_at: string
          id?: string
          option_order?: Json
          question_ids: string[]
          raw_score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          team_id: string
          total_score?: number | null
        }
        Update: {
          auto_submitted?: boolean
          bonus_points?: number
          correct_count?: number | null
          created_at?: string
          deadline_at?: string
          id?: string
          option_order?: Json
          question_ids?: string[]
          raw_score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          team_id?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_attempts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          options: Json
          order_index: number
          prompt: string
          topic: string | null
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty: string
          explanation?: string | null
          id?: string
          options: Json
          order_index: number
          prompt: string
          topic?: string | null
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          prompt?: string
          topic?: string | null
        }
        Relationships: []
      }
      screening_shortlist: {
        Row: {
          decided_at: string
          decided_by: string | null
          grant_ledger_id: string | null
          rank: number
          result: string
          result_mailed_at: string | null
          submitted_at: string | null
          team_id: string
          total_score: number
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          grant_ledger_id?: string | null
          rank: number
          result: string
          result_mailed_at?: string | null
          submitted_at?: string | null
          team_id: string
          total_score: number
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          grant_ledger_id?: string | null
          rank?: number
          result?: string
          result_mailed_at?: string | null
          submitted_at?: string | null
          team_id?: string
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_shortlist_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      dev5_apply_day2_manual_adjustment: {
        Args: {
          p_admin_id: string
          p_delta: Json
          p_expected_balance_after: Json
          p_expected_balance_before: Json
          p_idempotency_key: string
          p_notes?: string
          p_reason: string
          p_team_id: string
        }
        Returns: Json
      }
      dev5_jsonb_has_nonzero_number: {
        Args: { p_delta: Json }
        Returns: boolean
      }
      dev5_trigger_day2_event: {
        Args: {
          p_admin_id: string
          p_event_key: string
          p_idempotency_key: string
          p_notes?: string
          p_reason: string
          p_target_team_ids: string[]
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

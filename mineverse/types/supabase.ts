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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_team_code: { Args: never; Returns: string }
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

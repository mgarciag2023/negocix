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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          email: string
          id: string
          is_blocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email: string
          id?: string
          is_blocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string
          id?: string
          is_blocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_leads: {
        Row: {
          address: string
          category: string
          company_size: string | null
          contact_status: Database["public"]["Enums"]["contact_status"]
          created_at: string
          email: string | null
          employee_count: string | null
          first_contact_date: string | null
          has_whatsapp: boolean | null
          id: string
          instagram: string | null
          interest_status: Database["public"]["Enums"]["interest_status"]
          last_contact_date: string | null
          lead_id: string
          lead_stage: Database["public"]["Enums"]["lead_stage"]
          match_score: number
          name: string
          next_follow_up_date: string | null
          notes: string | null
          opened_date: string | null
          phone: string
          reasons: string[] | null
          responsible: string | null
          revenue: string | null
          saved_at: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address: string
          category: string
          company_size?: string | null
          contact_status?: Database["public"]["Enums"]["contact_status"]
          created_at?: string
          email?: string | null
          employee_count?: string | null
          first_contact_date?: string | null
          has_whatsapp?: boolean | null
          id?: string
          instagram?: string | null
          interest_status?: Database["public"]["Enums"]["interest_status"]
          last_contact_date?: string | null
          lead_id: string
          lead_stage?: Database["public"]["Enums"]["lead_stage"]
          match_score?: number
          name: string
          next_follow_up_date?: string | null
          notes?: string | null
          opened_date?: string | null
          phone: string
          reasons?: string[] | null
          responsible?: string | null
          revenue?: string | null
          saved_at?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string
          category?: string
          company_size?: string | null
          contact_status?: Database["public"]["Enums"]["contact_status"]
          created_at?: string
          email?: string | null
          employee_count?: string | null
          first_contact_date?: string | null
          has_whatsapp?: boolean | null
          id?: string
          instagram?: string | null
          interest_status?: Database["public"]["Enums"]["interest_status"]
          last_contact_date?: string | null
          lead_id?: string
          lead_stage?: Database["public"]["Enums"]["lead_stage"]
          match_score?: number
          name?: string
          next_follow_up_date?: string | null
          notes?: string | null
          opened_date?: string | null
          phone?: string
          reasons?: string[] | null
          responsible?: string | null
          revenue?: string | null
          saved_at?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          results_count: number | null
          search_config: Json
          search_type: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          results_count?: number | null
          search_config?: Json
          search_type?: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          results_count?: number | null
          search_config?: Json
          search_type?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_lead_limits: {
        Row: {
          created_at: string
          id: string
          leads_per_search: number
          representatives_per_search: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leads_per_search?: number
          representatives_per_search?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leads_per_search?: number
          representatives_per_search?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_seen_leads: {
        Row: {
          id: string
          place_id: string
          search_type: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          place_id: string
          search_type?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          place_id?: string
          search_type?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_blocked_fields: {
        Args: { _user_id: string }
        Returns: {
          blocked_at: string
          blocked_reason: string
          is_blocked: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      contact_status: "not_contacted" | "message_sent" | "conversation_started"
      interest_status: "pending" | "interested" | "not_interested"
      lead_stage:
        | "interested"
        | "in_conversation"
        | "follow_up_pending"
        | "in_negotiation"
        | "closed_won"
        | "closed_lost"
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
    Enums: {
      app_role: ["admin", "user"],
      contact_status: ["not_contacted", "message_sent", "conversation_started"],
      interest_status: ["pending", "interested", "not_interested"],
      lead_stage: [
        "interested",
        "in_conversation",
        "follow_up_pending",
        "in_negotiation",
        "closed_won",
        "closed_lost",
      ],
    },
  },
} as const

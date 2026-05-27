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
      cached_search_results: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          results: Json
          results_count: number
          search_config: Json
          search_type: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          results?: Json
          results_count?: number
          search_config?: Json
          search_type?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          results?: Json
          results_count?: number
          search_config?: Json
          search_type?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cidade: string | null
          cnae_principal: string | null
          cnae_secundaria: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          data_abertura: string | null
          data_situacao_cadastral: string | null
          descricao_cnae: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          faixa_etaria_socio: string | null
          id: string
          matriz_filial: string | null
          mei: string | null
          motivo_situacao: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          nome_socio: string | null
          porte: string | null
          qualificacao_socio: string | null
          razao_social: string | null
          search_vector: unknown
          simples: string | null
          situacao_cadastral: string | null
          telefone_1: string | null
          telefone_2: string | null
        }
        Insert: {
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnae_secundaria?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          data_situacao_cadastral?: string | null
          descricao_cnae?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          faixa_etaria_socio?: string | null
          id?: string
          matriz_filial?: string | null
          mei?: string | null
          motivo_situacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          nome_socio?: string | null
          porte?: string | null
          qualificacao_socio?: string | null
          razao_social?: string | null
          search_vector?: unknown
          simples?: string | null
          situacao_cadastral?: string | null
          telefone_1?: string | null
          telefone_2?: string | null
        }
        Update: {
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnae_secundaria?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          data_abertura?: string | null
          data_situacao_cadastral?: string | null
          descricao_cnae?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          faixa_etaria_socio?: string | null
          id?: string
          matriz_filial?: string | null
          mei?: string | null
          motivo_situacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          nome_socio?: string | null
          porte?: string | null
          qualificacao_socio?: string | null
          razao_social?: string | null
          search_vector?: unknown
          simples?: string | null
          situacao_cadastral?: string | null
          telefone_1?: string | null
          telefone_2?: string | null
        }
        Relationships: []
      }
      failed_signup_attempts: {
        Row: {
          created_at: string
          email: string
          error_code: string | null
          error_message: string
          full_name: string | null
          id: string
          phone: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_code?: string | null
          error_message: string
          full_name?: string | null
          id?: string
          phone?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_code?: string | null
          error_message?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
          trial_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registered_representatives: {
        Row: {
          cities: string[]
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string
          segments: string[]
          state: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          cities?: string[]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone: string
          segments?: string[]
          state: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          cities?: string[]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string
          segments?: string[]
          state?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      registered_suppliers: {
        Row: {
          cities: string[]
          company_name: string
          created_at: string
          delivers_nationwide: boolean
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string
          products: string[]
          responsible_name: string | null
          state: string
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          cities?: string[]
          company_name: string
          created_at?: string
          delivers_nationwide?: boolean
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone: string
          products?: string[]
          responsible_name?: string | null
          state: string
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          cities?: string[]
          company_name?: string
          created_at?: string
          delivers_nationwide?: boolean
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string
          products?: string[]
          responsible_name?: string | null
          state?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
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
          results: Json | null
          results_count: number | null
          search_config: Json
          search_type: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          results?: Json | null
          results_count?: number | null
          search_config?: Json
          search_type?: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          results?: Json | null
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
      trial_analytics: {
        Row: {
          created_at: string
          device_id: string | null
          event_type: string
          id: string
          results_count: number | null
          search_config: Json | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          results_count?: number | null
          search_config?: Json | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          results_count?: number | null
          search_config?: Json | null
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
      representatives_directory: {
        Row: {
          cities: string[] | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          phone: string | null
          segments: string[] | null
          state: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          cities?: string[] | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          segments?: string[] | null
          state?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          cities?: string[] | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          phone?: string | null
          segments?: string[] | null
          state?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_distinct_cities: {
        Args: { p_prefix: string; p_state: string }
        Returns: {
          cidade: string
        }[]
      }
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
      populate_all_search_vectors: {
        Args: { p_batch_size?: number }
        Returns: {
          estado_done: string
          rows_updated: number
        }[]
      }
      populate_search_vector_batch: {
        Args: { p_batch_size?: number; p_estado: string }
        Returns: number
      }
      search_companies: {
        Args: {
          p_biz_type?: string
          p_city?: string
          p_limit_val?: number
          p_offset_val?: number
          p_search_terms?: string[]
          p_state?: string
        }
        Returns: {
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cidade: string | null
          cnae_principal: string | null
          cnae_secundaria: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          data_abertura: string | null
          data_situacao_cadastral: string | null
          descricao_cnae: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          faixa_etaria_socio: string | null
          id: string
          matriz_filial: string | null
          mei: string | null
          motivo_situacao: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          nome_socio: string | null
          porte: string | null
          qualificacao_socio: string | null
          razao_social: string | null
          search_vector: unknown
          simples: string | null
          situacao_cadastral: string | null
          telefone_1: string | null
          telefone_2: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_companies_ilike: {
        Args: {
          p_biz_type?: string
          p_city?: string
          p_limit_val?: number
          p_offset_val?: number
          p_search_terms?: string[]
          p_state?: string
        }
        Returns: {
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cidade: string | null
          cnae_principal: string | null
          cnae_secundaria: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          data_abertura: string | null
          data_situacao_cadastral: string | null
          descricao_cnae: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          faixa_etaria_socio: string | null
          id: string
          matriz_filial: string | null
          mei: string | null
          motivo_situacao: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          nome_socio: string | null
          porte: string | null
          qualificacao_socio: string | null
          razao_social: string | null
          search_vector: unknown
          simples: string | null
          situacao_cadastral: string | null
          telefone_1: string | null
          telefone_2: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
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

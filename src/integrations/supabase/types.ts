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
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      api_usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string | null
          success: boolean
          tokens_estimated: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id?: string | null
          success?: boolean
          tokens_estimated?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string | null
          success?: boolean
          tokens_estimated?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      criativos: {
        Row: {
          angulo: string
          angulo_json: Json | null
          audio_paths: Json | null
          background_media_path: string | null
          created_at: string
          estilo: string
          estilo_producao: Database["public"]["Enums"]["estilo_producao"] | null
          export_paths: Json | null
          export_status: Database["public"]["Enums"]["export_status"] | null
          formato: string
          formato_saida: Database["public"]["Enums"]["formato_saida"] | null
          geracao_id: string | null
          id: string
          observacoes: string | null
          organization_id: string | null
          produto: string
          project_id: string | null
          roteiro: Json | null
          score_json: Json | null
          status: Database["public"]["Enums"]["criativo_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
          utm_content: string | null
          voice_id: string | null
        }
        Insert: {
          angulo: string
          angulo_json?: Json | null
          audio_paths?: Json | null
          background_media_path?: string | null
          created_at?: string
          estilo?: string
          estilo_producao?: Database["public"]["Enums"]["estilo_producao"] | null
          export_paths?: Json | null
          export_status?: Database["public"]["Enums"]["export_status"] | null
          formato?: string
          formato_saida?: Database["public"]["Enums"]["formato_saida"] | null
          geracao_id?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          produto: string
          project_id?: string | null
          roteiro?: Json | null
          score_json?: Json | null
          status?: Database["public"]["Enums"]["criativo_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
          utm_content?: string | null
          voice_id?: string | null
        }
        Update: {
          angulo?: string
          angulo_json?: Json | null
          audio_paths?: Json | null
          background_media_path?: string | null
          created_at?: string
          estilo?: string
          estilo_producao?: Database["public"]["Enums"]["estilo_producao"] | null
          export_paths?: Json | null
          export_status?: Database["public"]["Enums"]["export_status"] | null
          formato?: string
          formato_saida?: Database["public"]["Enums"]["formato_saida"] | null
          geracao_id?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          produto?: string
          project_id?: string | null
          roteiro?: Json | null
          score_json?: Json | null
          status?: Database["public"]["Enums"]["criativo_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          utm_content?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      video_render_jobs: {
        Row: {
          created_at: string
          criativo_id: string
          error: string | null
          external_job_id: string | null
          id: string
          progress: Json | null
          provider: string
          result_paths: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criativo_id: string
          error?: string | null
          external_job_id?: string | null
          id?: string
          progress?: Json | null
          provider: string
          result_paths?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criativo_id?: string
          error?: string | null
          external_job_id?: string | null
          id?: string
          progress?: Json | null
          provider?: string
          result_paths?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      geracoes: {
        Row: {
          angulos: Json
          context: string | null
          created_at: string
          diagnostico: Json
          goal: string
          id: string
          organization_id: string | null
          product_type: string
          project_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          angulos?: Json
          context?: string | null
          created_at?: string
          diagnostico?: Json
          goal?: string
          id?: string
          organization_id?: string | null
          product_type?: string
          project_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          angulos?: Json
          context?: string | null
          created_at?: string
          diagnostico?: Json
          goal?: string
          id?: string
          organization_id?: string | null
          product_type?: string
          project_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          token?: string
        }
        Relationships: []
      }
      organizations: {
        Row: { created_at: string; id: string; name: string; slug: string }
        Insert: { created_at?: string; id?: string; name: string; slug: string }
        Update: { created_at?: string; id?: string; name?: string; slug?: string }
        Relationships: []
      }
      profiles: {
        Row: { created_at: string; display_name: string | null; id: string; is_platform_admin: boolean; nicho: string | null }
        Insert: { created_at?: string; display_name?: string | null; id: string; is_platform_admin?: boolean; nicho?: string | null }
        Update: { created_at?: string; display_name?: string | null; id?: string; is_platform_admin?: boolean; nicho?: string | null }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          nicho: string | null
          organization_id: string
          url_default: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nicho?: string | null
          organization_id: string
          url_default?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nicho?: string | null
          organization_id?: string
          url_default?: string | null
        }
        Relationships: []
      }
      resultados_reportados: {
        Row: {
          created_at: string
          criativo_id: string
          id: string
          metrica: string | null
          observacao: string | null
          tipo: Database["public"]["Enums"]["resultado_tipo"]
          user_id: string
          valor: string | null
        }
        Insert: {
          created_at?: string
          criativo_id: string
          id?: string
          metrica?: string | null
          observacao?: string | null
          tipo: Database["public"]["Enums"]["resultado_tipo"]
          user_id: string
          valor?: string | null
        }
        Update: {
          created_at?: string
          criativo_id?: string
          id?: string
          metrica?: string | null
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["resultado_tipo"]
          user_id?: string
          valor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: { Args: { org_id: string }; Returns: boolean }
    }
    Enums: {
      criativo_status: "Gerado" | "Subiu" | "Rodando" | "Performando" | "Pausado"
      estilo_producao: "texto_animado" | "clipes_texto" | "ugc_avatar"
      export_status: "rascunho" | "renderizando" | "pronto" | "erro"
      formato_saida: "criativo_curto" | "vsl_curta"
      org_member_role: "owner" | "editor" | "viewer"
      resultado_tipo: "venda" | "lead" | "clique"
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
      criativo_status: ["Gerado", "Subiu", "Rodando", "Performando", "Pausado"],
      estilo_producao: ["texto_animado", "clipes_texto", "ugc_avatar"],
      export_status: ["rascunho", "renderizando", "pronto", "erro"],
      formato_saida: ["criativo_curto", "vsl_curta"],
      org_member_role: ["owner", "editor", "viewer"],
      resultado_tipo: ["venda", "lead", "clique"],
    },
  },
} as const

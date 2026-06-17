import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ApiUsageEventType =
  | "pergunta_cirurgica"
  | "gerar_angulos"
  | "refinar_bloco"
  | "gerar_variacoes"
  | "gerar_audio"
  | "export"
  | "gerar_vsl"
  | "analisar_campeao";

const TOKEN_ESTIMATES: Record<ApiUsageEventType, number> = {
  pergunta_cirurgica: 800,
  gerar_angulos: 12000,
  refinar_bloco: 1500,
  gerar_variacoes: 3000,
  gerar_audio: 500,
  export: 200,
  gerar_vsl: 10000,
  analisar_campeao: 8000,
};

/** Fire-and-forget — não bloqueia a resposta ao usuário. */
export function trackApiUsage(params: {
  userId?: string;
  organizationId?: string | null;
  eventType: ApiUsageEventType;
  tokensEstimated?: number;
  success?: boolean;
}) {
  const row = {
    user_id: params.userId ?? null,
    organization_id: params.organizationId ?? null,
    event_type: params.eventType,
    tokens_estimated: params.tokensEstimated ?? TOKEN_ESTIMATES[params.eventType],
    success: params.success ?? true,
  };

  void supabaseAdmin
    .from("api_usage_events")
    .insert(row)
    .then(({ error }) => {
      if (error) console.error("[api-usage]", error.message);
    });
}

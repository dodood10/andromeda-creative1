import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ApiUsageEventType =
  | "pergunta_cirurgica"
  | "gerar_angulos"
  | "refinar_bloco"
  | "gerar_variacoes"
  | "gerar_audio"
  | "export"
  | "gerar_vsl"
  | "analisar_campeao"
  | "import_campeao";

const TOKEN_ESTIMATES: Record<ApiUsageEventType, number> = {
  pergunta_cirurgica: 800,
  gerar_angulos: 12000,
  refinar_bloco: 1500,
  gerar_variacoes: 3000,
  gerar_audio: 500,
  export: 200,
  gerar_vsl: 10000,
  analisar_campeao: 8000,
  import_campeao: 6000,
};

const ApiUsageInputSchema = z.object({
  userId: z.string().nullish(),
  organizationId: z.string().nullish(),
  eventType: z.enum([
    "pergunta_cirurgica",
    "gerar_angulos",
    "refinar_bloco",
    "gerar_variacoes",
    "gerar_audio",
    "export",
    "gerar_vsl",
    "analisar_campeao",
    "import_campeao",
  ]),
  tokensEstimated: z.number().nullish(),
  success: z.boolean().nullish(),
});

export const trackApiUsageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ApiUsageInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_usage_events")
      .insert({
        user_id: data.userId ?? null,
        organization_id: data.organizationId ?? null,
        event_type: data.eventType,
        tokens_estimated:
          data.tokensEstimated ?? TOKEN_ESTIMATES[data.eventType as ApiUsageEventType],
        success: data.success ?? true,
      });
    if (error) console.error("[api-usage]", error.message);
    return { ok: !error };
  });

/** Fire-and-forget — safe to call from client or server. */
export function trackApiUsage(params: {
  userId?: string;
  organizationId?: string | null;
  eventType: ApiUsageEventType;
  tokensEstimated?: number;
  success?: boolean;
}) {
  void trackApiUsageFn({
    data: {
      userId: params.userId ?? null,
      organizationId: params.organizationId ?? null,
      eventType: params.eventType,
      tokensEstimated: params.tokensEstimated ?? TOKEN_ESTIMATES[params.eventType],
      success: params.success ?? true,
    },
  }).catch((e) => console.error("[api-usage]", e));
}

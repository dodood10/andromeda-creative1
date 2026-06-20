import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { trackApiUsage, type ApiUsageEventType } from "./api-usage";

export type FunnelEventType =
  | "angulos_gerados"
  | "angulos_validacao_falhou"
  | "wizard_step"
  | "draft_created"
  | "editor_opened"
  | "export_pronto"
  | "marcou_subiu"
  | "render_started"
  | "render_done"
  | "render_failed"
  | "test_plan_viewed";

const FUNNEL_AS_API: Record<FunnelEventType, ApiUsageEventType> = {
  angulos_gerados: "gerar_angulos",
  angulos_validacao_falhou: "gerar_angulos",
  wizard_step: "gerar_angulos",
  draft_created: "gerar_angulos",
  editor_opened: "export",
  export_pronto: "export",
  marcou_subiu: "export",
  render_started: "export",
  render_done: "export",
  render_failed: "export",
  test_plan_viewed: "export",
};

const FunnelInputSchema = z.object({
  userId: z.string().nullish(),
  organizationId: z.string().nullish(),
  event: z.enum([
    "angulos_gerados",
    "angulos_validacao_falhou",
    "wizard_step",
    "draft_created",
    "editor_opened",
    "export_pronto",
    "marcou_subiu",
    "render_started",
    "render_done",
    "render_failed",
    "test_plan_viewed",
  ]),
  success: z.boolean().nullish(),
  durationMs: z.number().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const trackFunnelEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FunnelInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("funnel_events")
      .insert({
        user_id: data.userId ?? null,
        organization_id: data.organizationId ?? null,
        event_type: data.event,
        success: data.success ?? true,
        duration_ms: data.durationMs ?? null,
        metadata: ((data.metadata ?? {}) as unknown) as Json,
      });
    if (error) console.error("[funnel-events]", error.message);
    return { ok: !error };
  });

/** Fire-and-forget — safe from client or server. */
export function trackFunnelEvent(params: {
  userId?: string;
  organizationId?: string | null;
  event: FunnelEventType;
  success?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  trackApiUsage({
    userId: params.userId,
    organizationId: params.organizationId,
    eventType: FUNNEL_AS_API[params.event],
    tokensEstimated: 50,
    success: params.success ?? true,
  });

  void trackFunnelEventFn({
    data: {
      userId: params.userId ?? null,
      organizationId: params.organizationId ?? null,
      event: params.event,
      success: params.success ?? true,
      durationMs: params.durationMs ?? null,
      metadata: params.metadata ?? null,
    },
  }).catch((e) => console.error("[funnel-events]", e));
}

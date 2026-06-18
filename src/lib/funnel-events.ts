import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { trackApiUsage, type ApiUsageEventType } from "./api-usage";

export type FunnelEventType =
  | "angulos_gerados"
  | "wizard_step"
  | "draft_created"
  | "editor_opened"
  | "export_pronto"
  | "render_started"
  | "render_done"
  | "render_failed"
  | "test_plan_viewed";

const FUNNEL_AS_API: Record<FunnelEventType, ApiUsageEventType> = {
  angulos_gerados: "gerar_angulos",
  wizard_step: "gerar_angulos",
  draft_created: "gerar_angulos",
  editor_opened: "export",
  export_pronto: "export",
  render_started: "export",
  render_done: "export",
  render_failed: "export",
  test_plan_viewed: "export",
};

/** Rastreio de funil em funnel_events + api_usage_events (legado). */
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

  const row = {
    user_id: params.userId ?? null,
    organization_id: params.organizationId ?? null,
    event_type: params.event,
    success: params.success ?? true,
    duration_ms: params.durationMs ?? null,
    metadata: params.metadata ?? {},
  };

  void supabaseAdmin
    .from("funnel_events")
    .insert(row)
    .then(({ error }) => {
      if (error) console.error("[funnel-events]", error.message);
    });
}

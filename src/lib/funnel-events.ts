import { trackApiUsage, type ApiUsageEventType } from "./api-usage";

export type FunnelEventType =
  | "angulos_gerados"
  | "wizard_step"
  | "draft_created"
  | "editor_opened"
  | "export_pronto";

const FUNNEL_AS_API: Record<FunnelEventType, ApiUsageEventType> = {
  angulos_gerados: "gerar_angulos",
  wizard_step: "gerar_angulos",
  draft_created: "gerar_angulos",
  editor_opened: "export",
  export_pronto: "export",
};

/** Rastreio leve de funil via api_usage_events (sem migration). */
export function trackFunnelEvent(params: {
  userId?: string;
  organizationId?: string | null;
  event: FunnelEventType;
  success?: boolean;
}) {
  trackApiUsage({
    userId: params.userId,
    organizationId: params.organizationId,
    eventType: FUNNEL_AS_API[params.event],
    tokensEstimated: 50,
    success: params.success ?? true,
  });
}

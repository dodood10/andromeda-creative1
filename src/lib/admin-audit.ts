import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function logAdminAction(params: {
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: (params.metadata ?? {}) as import("@/integrations/supabase/types").Json,
  });
  if (error) console.error("[admin-audit]", error.message);
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, type PlanTier } from "./plan-quota";

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const getPlanUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = monthStartIso();

    const tier: PlanTier = "free";

    const geracoesQuery = supabase
      .from("geracoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);

    if (data.organizationId) {
      geracoesQuery.eq("organization_id", data.organizationId);
    }

    const { count: geracoesMes } = await geracoesQuery;

    let exportsQuery = supabase
      .from("criativos")
      .select("id", { count: "exact", head: true })
      .eq("export_status", "pronto")
      .gte("updated_at", since);

    if (data.organizationId) {
      exportsQuery = exportsQuery.eq("organization_id", data.organizationId);
    } else {
      exportsQuery = exportsQuery.eq("user_id", userId);
    }

    const { count: exportsMes } = await exportsQuery;

    const limits = PLAN_LIMITS[tier];

    return {
      tier,
      geracoesMes: geracoesMes ?? 0,
      exportsMes: exportsMes ?? 0,
      limits: {
        geracoesMes: limits.geracoesMes,
        exportsMes: limits.exportsMes,
      },
      canGerar: (geracoesMes ?? 0) < limits.geracoesMes,
      canExport: (exportsMes ?? 0) < limits.exportsMes,
    };
  });

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_LIMITS, type PlanTier } from "./plan-quota";

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getOrgPlanTier(
  supabase: SupabaseClient<Database>,
  organizationId: string | null | undefined,
): Promise<PlanTier> {
  if (!organizationId) return "free";

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("tier, status")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data || data.status !== "active") return "free";
    return data.tier as PlanTier;
  } catch {
    return "free";
  }
}

export async function assertCanGerar(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string | null | undefined,
) {
  const tier = await getOrgPlanTier(supabase, organizationId);
  const limits = PLAN_LIMITS[tier];
  if (limits.geracoesMes === Infinity) return;

  const since = monthStartIso();
  let query = supabase
    .from("geracoes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { count } = await query;
  if ((count ?? 0) >= limits.geracoesMes) {
    throw new Error(
      `Limite de ${limits.geracoesMes} gerações/mês do plano ${tier}. Faça upgrade em Plano e uso.`,
    );
  }
}

export async function assertCanExport(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string | null | undefined,
) {
  const tier = await getOrgPlanTier(supabase, organizationId);
  const limits = PLAN_LIMITS[tier];
  if (limits.exportsMes === Infinity) return;

  const since = monthStartIso();
  let query = supabase
    .from("criativos")
    .select("id", { count: "exact", head: true })
    .eq("export_status", "pronto")
    .gte("updated_at", since);

  if (organizationId) query = query.eq("organization_id", organizationId);
  else query = query.eq("user_id", userId);

  const { count } = await query;
  if ((count ?? 0) >= limits.exportsMes) {
    throw new Error(
      `Limite de ${limits.exportsMes} export(s)/mês do plano ${tier}. Faça upgrade em Plano e uso.`,
    );
  }
}

export async function assertCanCreateProject(
  supabase: SupabaseClient<Database>,
  organizationId: string,
) {
  const tier = await getOrgPlanTier(supabase, organizationId);
  const limits = PLAN_LIMITS[tier];
  if (limits.projetos === Infinity) return;

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if ((count ?? 0) >= limits.projetos) {
    throw new Error(
      `Limite de ${limits.projetos} projeto(s) do plano ${tier}. Faça upgrade em Plano e uso.`,
    );
  }
}

export async function assertCanImportCampeoes(
  supabase: SupabaseClient<Database>,
  organizationId: string | null | undefined,
  additionalImports = 1,
) {
  const tier = await getOrgPlanTier(supabase, organizationId);
  const limits = PLAN_LIMITS[tier];
  if (limits.importsMes === Infinity) return;

  const since = monthStartIso();
  let query = supabase
    .from("criativos")
    .select("id", { count: "exact", head: true })
    .eq("source", "importado")
    .gte("imported_at", since);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { count } = await query;
  if ((count ?? 0) + additionalImports > limits.importsMes) {
    throw new Error(
      `Limite de ${limits.importsMes} import(s) de campeões/mês do plano ${tier}. Faça upgrade em Plano e uso.`,
    );
  }
}

export async function assertCanEscala(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  additionalVariacoes = 1,
) {
  const tier = await getOrgPlanTier(supabase, organizationId);
  const limits = PLAN_LIMITS[tier];
  if (limits.escalaMes === Infinity) return;
  if (limits.escalaMes === 0) {
    throw new Error("Escala com IA disponível no plano Pro. Veja Plano e uso.");
  }

  const since = monthStartIso();
  const { count } = await supabase
    .from("criativos")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .like("angulo", "% · var %");

  if ((count ?? 0) + additionalVariacoes > limits.escalaMes) {
    throw new Error(
      `Limite de variações de escala do plano ${tier} atingido este mês.`,
    );
  }
}

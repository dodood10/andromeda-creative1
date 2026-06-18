import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, PLAN_LABELS, type PlanTier } from "./plan-quota";
import { getOrgPlanTier } from "./plan-enforcement";

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

    const tier: PlanTier = await getOrgPlanTier(supabase, data.organizationId);

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

    let escalaQuery = supabase
      .from("criativos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .like("angulo", "% · var %");

    if (data.organizationId) {
      escalaQuery = escalaQuery.eq("organization_id", data.organizationId);
    } else {
      escalaQuery = escalaQuery.eq("user_id", userId);
    }

    const { count: escalaMes } = await escalaQuery;

    const limits = PLAN_LIMITS[tier];

    return {
      tier,
      geracoesMes: geracoesMes ?? 0,
      exportsMes: exportsMes ?? 0,
      escalaMes: escalaMes ?? 0,
      limits: {
        geracoesMes: limits.geracoesMes,
        exportsMes: limits.exportsMes,
        escalaMes: limits.escalaMes,
      },
      canGerar: (geracoesMes ?? 0) < limits.geracoesMes,
      canExport: (exportsMes ?? 0) < limits.exportsMes,
      canEscala: limits.escalaMes === Infinity || (escalaMes ?? 0) < limits.escalaMes,
      label: PLAN_LABELS[tier],
    };
  });

/** Stripe checkout — ativa quando STRIPE_SECRET_KEY estiver configurado */
export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      tier: z.enum(["pro", "agency"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const pricePro = process.env.STRIPE_PRICE_PRO_ID;

    if (!stripeKey || !pricePro) {
      throw new Error(
        "Checkout em configuração. Entre em contato ou aguarde a ativação do Stripe.",
      );
    }

    const { supabase, userId } = context;

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (member?.role !== "owner") {
      throw new Error("Apenas o owner pode gerenciar o plano");
    }

    if (data.tier === "agency") {
      throw new Error("Plano Agency — fale com vendas em suporte@andromeda.app");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": pricePro,
        "line_items[0][quantity]": "1",
        success_url: `${process.env.APP_URL ?? "http://localhost:5173"}/app/plano?checkout=success`,
        cancel_url: `${process.env.APP_URL ?? "http://localhost:5173"}/app/plano?checkout=cancel`,
        client_reference_id: data.organizationId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe: ${err.slice(0, 200)}`);
    }

    const session = (await res.json()) as { url?: string };
    if (!session.url) throw new Error("Stripe não retornou URL de checkout");
    return { checkoutUrl: session.url };
  });

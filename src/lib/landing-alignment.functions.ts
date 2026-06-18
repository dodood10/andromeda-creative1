import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { HttpUrlSchema } from "./security-url";
import { fetchPageText } from "./page-fetch";
import { buildOfferSnapshot } from "./offer-snapshot";
import { checkOfferCongruence, type CongruenceResult } from "./congruence-check";

export type LandingAlignmentResult = CongruenceResult;

export const avaliarAlinhamentoLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid().optional(),
      url: HttpUrlSchema,
      hook: z.string().max(2000),
      cta: z.string().max(1000),
      roteiroResumo: z.string().max(8000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const snapshot = await buildOfferSnapshot(data.url, apiKey);
    return checkOfferCongruence({
      offerSnapshot: snapshot,
      hook: data.hook,
      cta: data.cta,
      roteiroResumo: data.roteiroResumo,
      apiKey,
    });
  });

export const avaliarCongruenciaOferta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      url: HttpUrlSchema,
      hook: z.string().max(2000),
      cta: z.string().max(1000),
      roteiroResumo: z.string().max(8000).optional(),
      projectId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const snapshot = await buildOfferSnapshot(data.url, apiKey);
    return checkOfferCongruence({
      offerSnapshot: snapshot,
      hook: data.hook,
      cta: data.cta,
      roteiroResumo: data.roteiroResumo,
      apiKey,
    });
  });

export async function resolveLandingUrlForCriativo(
  supabase: SupabaseClient<Database>,
  criativo: { geracao_id?: string | null; project_id?: string | null },
): Promise<string | null> {
  if (criativo.geracao_id) {
    const { data: geracao } = await supabase
      .from("geracoes")
      .select("url")
      .eq("id", criativo.geracao_id)
      .maybeSingle();
    if (geracao?.url) return geracao.url;
  }
  if (criativo.project_id) {
    const { data: geracao } = await supabase
      .from("geracoes")
      .select("url")
      .eq("project_id", criativo.project_id)
      .not("url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return geracao?.url ?? null;
  }
  return null;
}

export const getCriativoLandingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: criativo, error } = await supabase
      .from("criativos")
      .select("geracao_id, project_id, angulo_json, roteiro")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const url = await resolveLandingUrlForCriativo(supabase, criativo);
    const aj = criativo.angulo_json as { hook?: string; cta?: string } | null;
    const roteiro = (criativo.roteiro as Array<{ conteudo?: string }>) ?? [];
    const hook = aj?.hook ?? roteiro[0]?.conteudo ?? "";
    const cta = aj?.cta ?? roteiro[roteiro.length - 1]?.conteudo ?? "";
    const roteiroResumo = roteiro.map((b) => b.conteudo).join(" ").slice(0, 2000);

    return { url, hook, cta, roteiroResumo };
  });

/** @internal for tests */
export { fetchPageText };

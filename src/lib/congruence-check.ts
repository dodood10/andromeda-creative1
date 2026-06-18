import { z } from "zod";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";
import { CONGRUENCE_CHECK_SYSTEM } from "./prompts/congruence-check.system";
import type { OfferSnapshot } from "./offer-snapshot";

export type CongruenceResult = {
  alinhado: boolean;
  score: number;
  divergencias: string[];
  sugestoes: string[];
};

export const CongruenceResultSchema = z.object({
  alinhado: z.boolean(),
  score: z.number().min(0).max(100),
  divergencias: z.array(z.string()),
  sugestoes: z.array(z.string()),
});

export function heuristicCongruenceCheck(params: {
  offerSnapshot: OfferSnapshot;
  hook: string;
  cta: string;
  pageText?: string;
}): CongruenceResult {
  const page = (params.pageText ?? params.offerSnapshot.page_excerpt ?? "").toLowerCase();
  const offerText = [
    params.offerSnapshot.promessa,
    params.offerSnapshot.mecanismo,
    params.offerSnapshot.cta,
  ]
    .join(" ")
    .toLowerCase();

  const corpus = `${page} ${offerText}`;

  const hookWords = params.hook
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4)
    .slice(0, 12);
  const hookHits = hookWords.filter((w) => corpus.includes(w)).length;
  const hookRatio = hookWords.length ? hookHits / hookWords.length : 0;

  const ctaWords = params.cta
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);
  const ctaHits = ctaWords.filter((w) => corpus.includes(w)).length;

  let score = Math.round(hookRatio * 55 + (ctaHits > 0 ? 25 : 0) + (corpus.length > 100 ? 20 : 5));
  score = Math.max(0, Math.min(100, score));

  const divergencias: string[] = [];
  const sugestoes: string[] = [];

  if (hookRatio < 0.2) {
    divergencias.push("Hook não ecoa a promessa/mecanismo da oferta.");
    sugestoes.push(`Alinhe o hook com: "${params.offerSnapshot.promessa.slice(0, 80)}…"`);
  }
  if (ctaHits === 0 && params.cta.trim()) {
    divergencias.push("CTA do criativo não corresponde à ação da oferta.");
    sugestoes.push(`Use verbo/ação similar a: "${params.offerSnapshot.cta}"`);
  }

  return {
    alinhado: score >= 70,
    score,
    divergencias,
    sugestoes,
  };
}

export async function checkOfferCongruence(params: {
  offerSnapshot: OfferSnapshot;
  hook: string;
  cta: string;
  roteiroResumo?: string;
  apiKey?: string;
}): Promise<CongruenceResult> {
  if (!params.apiKey) {
    return heuristicCongruenceCheck({
      offerSnapshot: params.offerSnapshot,
      hook: params.hook,
      cta: params.cta,
      pageText: params.offerSnapshot.page_excerpt,
    });
  }

  try {
    const userMessage = [
      `OFERTA CANÔNICA:`,
      `Promessa: ${params.offerSnapshot.promessa}`,
      `Mecanismo: ${params.offerSnapshot.mecanismo}`,
      `CTA: ${params.offerSnapshot.cta}`,
      `Nicho: ${params.offerSnapshot.nicho_inferido}`,
      "",
      `HOOK do criativo: ${params.hook}`,
      `CTA do criativo: ${params.cta}`,
      params.roteiroResumo ? `Roteiro resumido: ${params.roteiroResumo.slice(0, 1500)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await callAnthropicJson({
      apiKey: params.apiKey,
      system: CONGRUENCE_CHECK_SYSTEM,
      userMessage,
      maxTokens: 1024,
    });
    const parsed = CongruenceResultSchema.safeParse(extractJsonFromAnthropicText(raw));
    if (parsed.success) return parsed.data;
  } catch {
    /* fallback */
  }

  return heuristicCongruenceCheck({
    offerSnapshot: params.offerSnapshot,
    hook: params.hook,
    cta: params.cta,
    pageText: params.offerSnapshot.page_excerpt,
  });
}

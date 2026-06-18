import { z } from "zod";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";
import { fetchPageText } from "./page-fetch";
import { OFFER_SNAPSHOT_SYSTEM } from "./prompts/offer-snapshot.system";

export type OfferSnapshot = {
  promessa: string;
  mecanismo: string;
  cta: string;
  formato_produto: string;
  nicho_inferido: string;
  page_excerpt?: string;
};

const OfferSnapshotSchema = z.object({
  promessa: z.string().default(""),
  mecanismo: z.string().default(""),
  cta: z.string().default(""),
  formato_produto: z.string().default(""),
  nicho_inferido: z.string().default(""),
});

const requestCache = new Map<string, Promise<OfferSnapshot>>();

export function heuristicOfferSnapshot(pageText: string): OfferSnapshot {
  const sentences = pageText
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const promessa = sentences[0]?.slice(0, 300) ?? pageText.slice(0, 200);
  const mecanismo = sentences.slice(1, 4).join(". ").slice(0, 400) || promessa;
  const ctaMatch = pageText.match(
    /\b(compre|garanta|acesse|inscreva|comece|baixe|experimente)[^.!?]{0,80}/i,
  );
  return {
    promessa,
    mecanismo,
    cta: ctaMatch?.[0]?.trim() ?? "Saiba mais / acesse a página",
    formato_produto: "não identificado",
    nicho_inferido: "geral",
    page_excerpt: pageText.slice(0, 600),
  };
}

export function formatOfferSnapshotBlock(snapshot: OfferSnapshot): string {
  return [
    "OFERTA CANÔNICA (fonte única de claims — promessa, mecanismo e CTA do criativo DEVEM vir daqui):",
    `Promessa: ${snapshot.promessa}`,
    `Mecanismo: ${snapshot.mecanismo}`,
    `CTA da página: ${snapshot.cta}`,
    `Formato: ${snapshot.formato_produto}`,
    `Nicho: ${snapshot.nicho_inferido}`,
    "Nunca copie claims de referências externas que contradigam esta oferta.",
  ].join("\n");
}

export async function buildOfferSnapshot(
  url: string,
  apiKey?: string,
): Promise<OfferSnapshot> {
  const cached = requestCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const pageText = await fetchPageText(url);
    if (!apiKey) {
      return { ...heuristicOfferSnapshot(pageText), page_excerpt: pageText.slice(0, 600) };
    }
    try {
      const raw = await callAnthropicJson({
        apiKey,
        system: OFFER_SNAPSHOT_SYSTEM,
        userMessage: `URL: ${url}\n\nTexto da página:\n${pageText.slice(0, 6000)}`,
        maxTokens: 1024,
      });
      const parsed = OfferSnapshotSchema.safeParse(extractJsonFromAnthropicText(raw));
      if (parsed.success) {
        return { ...parsed.data, page_excerpt: pageText.slice(0, 600) };
      }
    } catch {
      /* fallback */
    }
    return { ...heuristicOfferSnapshot(pageText), page_excerpt: pageText.slice(0, 600) };
  })();

  requestCache.set(url, promise);
  return promise;
}

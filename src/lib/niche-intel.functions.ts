import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";

function nichoKey(nicho: string) {
  return nicho
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

import type { NicheBenchmarks } from "./project-niche-benchmark";

export type IntelInsight = { title: string; desc: string; tag: string };

export type { NicheBenchmarks };

type NicheIntelGenerated = {
  insights: IntelInsight[];
  benchmarks?: NicheBenchmarks;
};

async function generateNicheIntel(nichoLabel: string): Promise<NicheIntelGenerated> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      insights: [
        {
          tag: "Andromeda",
          title: `Tendências em ${nichoLabel}`,
          desc: "Configure ANTHROPIC_API_KEY para insights diários com web search. Enquanto isso, gere criativos e reporte métricas no pipeline.",
        },
      ],
    };
  }

  try {
    const text = await callAnthropicJson({
      apiKey,
      maxTokens: 1024,
      useWebSearch: true,
      webSearchMaxUses: 2,
      system: `Você é analista de Meta Ads. Gere 3 insights curtos sobre o que está escalando HOJE no nicho informado.
Inclua benchmarks típicos do nicho (estimativa conservadora baseada em mercado BR).
Responda APENAS JSON: {
  "insights": [ { "tag": "Hook|Formato|CPM", "title": "...", "desc": "..." } ],
  "benchmarks": { "cpa_medio_brl": number|null, "roas_medio": number|null, "hook_rate_medio_pct": number|null }
}
Português do Brasil. Sem markdown.`,
      userMessage: `Nicho: ${nichoLabel}. O que está funcionando em criativos de vídeo para Meta Ads neste nicho agora?`,
    });
    const parsed = extractJsonFromAnthropicText(text) as NicheIntelGenerated;
    return {
      insights: parsed.insights?.slice(0, 3) ?? [],
      benchmarks: parsed.benchmarks,
    };
  } catch {
    return {
      insights: [
        {
          tag: "Feed",
          title: `Panorama ${nichoLabel}`,
          desc: "Não foi possível gerar insights externos agora. Use seus dados em Inteligência após exportar criativos.",
        },
      ],
    };
  }
}

import { parseNicheIntelPayload } from "./project-niche-benchmark";

export async function loadNicheDailyInsights(
  supabase: SupabaseClient<Database>,
  nicho: string,
): Promise<{ insights: IntelInsight[]; benchmarks?: NicheBenchmarks; cached: boolean }> {
  const key = nichoKey(nicho);
  const today = todayIso();

  const { data: cached } = await supabase
    .from("niche_daily_intel")
    .select("insights, generated_for")
    .eq("nicho_key", key)
    .eq("generated_for", today)
    .maybeSingle();

  if (cached?.insights) {
    const payload = parseNicheIntelPayload(cached.insights);
    return { insights: payload.insights, benchmarks: payload.benchmarks, cached: true };
  }

  const generated = await generateNicheIntel(nicho);
  if (generated.insights.length > 0) {
    await supabase.from("niche_daily_intel").upsert(
      {
        nicho_key: key,
        nicho_label: nicho,
        insights: generated as unknown as Database["public"]["Tables"]["niche_daily_intel"]["Insert"]["insights"],
        generated_for: today,
      },
      { onConflict: "nicho_key,generated_for" },
    );
  }

  return { insights: generated.insights, benchmarks: generated.benchmarks, cached: false };
}

export const getNicheDailyIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ nicho: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { insights, benchmarks, cached } = await loadNicheDailyInsights(context.supabase, data.nicho);
    return { nicho: data.nicho, insights, benchmarks, cached };
  });

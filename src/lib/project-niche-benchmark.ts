import type { IntelInsight } from "./niche-intel.functions";

export type NicheBenchmarks = {
  cpa_medio_brl?: number | null;
  roas_medio?: number | null;
  hook_rate_medio_pct?: number | null;
};

export type NicheIntelPayload = {
  insights: IntelInsight[];
  benchmarks?: NicheBenchmarks;
};

export function parseNicheIntelPayload(raw: unknown): NicheIntelPayload {
  if (Array.isArray(raw)) {
    return { insights: raw as IntelInsight[] };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { insights?: IntelInsight[]; benchmarks?: NicheBenchmarks };
    return {
      insights: obj.insights ?? [],
      benchmarks: obj.benchmarks,
    };
  }
  return { insights: [] };
}

export type NicheComparisonLine = {
  metric: string;
  project: string;
  niche: string;
  verdict: "better" | "worse" | "neutral" | "missing";
  hint: string;
};

export function buildNicheBenchmarkComparison(params: {
  projectCpa?: number | null;
  projectRoas?: number | null;
  projectHookRate?: number | null;
  benchmarks?: NicheBenchmarks | null;
}): { lines: NicheComparisonLine[]; hasComparison: boolean } {
  const b = params.benchmarks;
  if (!b) return { lines: [], hasComparison: false };

  const lines: NicheComparisonLine[] = [];

  if (params.projectCpa != null && b.cpa_medio_brl != null && b.cpa_medio_brl > 0) {
    const diff = ((params.projectCpa - b.cpa_medio_brl) / b.cpa_medio_brl) * 100;
    const better = params.projectCpa < b.cpa_medio_brl;
    lines.push({
      metric: "CPA",
      project: `R$ ${params.projectCpa.toFixed(2)}`,
      niche: `R$ ${b.cpa_medio_brl.toFixed(2)}`,
      verdict: Math.abs(diff) < 8 ? "neutral" : better ? "better" : "worse",
      hint: better
        ? `${Math.abs(Math.round(diff))}% abaixo da média do nicho`
        : `${Math.round(diff)}% acima da média do nicho — teste novos ângulos ou escale o campeão`,
    });
  }

  if (params.projectRoas != null && b.roas_medio != null && b.roas_medio > 0) {
    const diff = ((params.projectRoas - b.roas_medio) / b.roas_medio) * 100;
    const better = params.projectRoas > b.roas_medio;
    lines.push({
      metric: "ROAS",
      project: params.projectRoas.toFixed(2),
      niche: b.roas_medio.toFixed(2),
      verdict: Math.abs(diff) < 8 ? "neutral" : better ? "better" : "worse",
      hint: better
        ? `${Math.round(diff)}% acima do benchmark do nicho`
        : `${Math.abs(Math.round(diff))}% abaixo — revise hook e congruência com a oferta`,
    });
  }

  if (params.projectHookRate != null && b.hook_rate_medio_pct != null) {
    const diff = params.projectHookRate - b.hook_rate_medio_pct;
    const better = diff >= 0;
    lines.push({
      metric: "Hook rate",
      project: `${Math.round(params.projectHookRate)}%`,
      niche: `${Math.round(b.hook_rate_medio_pct)}%`,
      verdict: Math.abs(diff) < 3 ? "neutral" : better ? "better" : "worse",
      hint: better
        ? `Hook ${Math.round(diff)} pp acima da média do nicho`
        : `Hook ${Math.abs(Math.round(diff))} pp abaixo — priorize ângulos com score de campeão alto`,
    });
  }

  return { lines, hasComparison: lines.length > 0 };
}

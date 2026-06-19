import type { ResultadoAngulos } from "./schemas/angulos.schema";
import {
  scoreAnguloVsChampions,
  type ChampionForRanking,
  type ChampionRankingContext,
} from "./champion-angle-ranking";
import {
  buildFormatoPorAngulo,
  type FormatoOverride,
  type FormatoSaida,
  type EstiloProducao,
  type ProjectFormatContext,
} from "./formato-recomendacao";
import type { ProductMode } from "./product-mode";

/** Executa tarefas com concorrência limitada. */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        const value = await tasks[idx]();
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );
  return results;
}

const CONFIANCA_RANK: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

export function formatAnthropicError(raw: string): string {
  if (raw.includes("429") || raw.toLowerCase().includes("rate limit")) {
    return "Limite de requisições atingido — aguarde ~30s e tente novamente.";
  }
  if (raw.toLowerCase().includes("timeout") || raw.toLowerCase().includes("timed out")) {
    return "A IA demorou demais — tente novamente com um contexto mais curto.";
  }
  if (raw.includes("401") || raw.toLowerCase().includes("unauthorized")) {
    return "Sessão expirada — faça login novamente.";
  }
  if (raw.includes("529") || raw.toLowerCase().includes("overloaded")) {
    return "Servidor da IA sobrecarregado — tente em alguns minutos.";
  }
  return raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
}

/** Top N ângulos por proximidade com campeões validados, depois confiança da IA. */
export function pickRecommendedAngulos(
  resultado: ResultadoAngulos,
  count = 2,
  championContext?: ChampionRankingContext | null,
): number[] {
  const champions = championContext?.champions ?? [];
  const ranked = resultado.angulos
    .map((a, i) => ({
      i,
      champScore: champions.length ? scoreAnguloVsChampions(a, champions).score : 0,
      rank: CONFIANCA_RANK[a.recomendacao_formato?.confianca ?? "baixa"] ?? 1,
      saturated: a.saturacao_hook?.status === "saturado",
    }))
    .filter((x) => !x.saturated)
    .sort((a, b) => {
      if (b.champScore !== a.champScore) return b.champScore - a.champScore;
      return b.rank - a.rank;
    });

  const picks = ranked.slice(0, count).map((x) => x.i);
  if (picks.length < count) {
    for (let i = 0; i < resultado.angulos.length && picks.length < count; i++) {
      if (!picks.includes(i)) picks.push(i);
    }
  }
  return picks;
}

/** 3 ângulos com micropersonas distintas para pacote A/B, priorizando campeões. */
export function pickAbTestPackage(
  resultado: ResultadoAngulos,
  championContext?: ChampionRankingContext | null,
): number[] {
  const champions = championContext?.champions ?? [];
  const picked: number[] = [];
  const personas = new Set<string>();

  const ranked = resultado.angulos
    .map((a, i) => ({
      i,
      persona: a.micropersona?.nome ?? a.nome,
      champScore: champions.length ? scoreAnguloVsChampions(a, champions).score : 0,
      rank: CONFIANCA_RANK[a.recomendacao_formato?.confianca ?? "baixa"] ?? 1,
      saturated: a.saturacao_hook?.status === "saturado",
    }))
    .filter((x) => !x.saturated)
    .sort((a, b) => {
      if (b.champScore !== a.champScore) return b.champScore - a.champScore;
      return b.rank - a.rank;
    });

  for (const item of ranked) {
    if (picked.length >= 3) break;
    if (personas.has(item.persona) && picked.length >= 1) continue;
    personas.add(item.persona);
    picked.push(item.i);
  }

  for (let i = 0; i < resultado.angulos.length && picked.length < 3; i++) {
    if (!picked.includes(i)) picked.push(i);
  }
  return picked.slice(0, 3);
}

export function angleIntelBadge(
  anguloNome: string,
  topPerformers: Array<{ angulo: string }>,
  championBadges?: string[],
): string | null {
  if (championBadges?.length) return championBadges[0] ?? null;
  const match = topPerformers.find(
    (p) => p.angulo === anguloNome || anguloNome.startsWith(p.angulo) || p.angulo.startsWith(anguloNome),
  );
  if (match) {
    const nome = match.angulo.length > 36 ? `${match.angulo.slice(0, 33)}…` : match.angulo;
    return `Similar ao campeão: ${nome}`;
  }
  if (topPerformers.length > 0) return "Ângulo novo — diversifica leilão";
  return null;
}

export { pickFunnelSchwartzPackage } from "./schwartz-angulo";
export { explainAnguloRank, scoreAnguloVsChampions } from "./champion-angle-ranking";
export type { ChampionRankingContext } from "./champion-angle-ranking";

/** Monta formatos diversificados para pacote A/B com base no histórico do projeto. */
export function buildAbTestFormatoMap(
  angulos: ResultadoAngulos["angulos"],
  indices: number[],
  ctx: ProjectFormatContext | null,
  productMode: ProductMode = "criativo",
): Record<number, FormatoOverride> {
  const map = buildFormatoPorAngulo(angulos, indices);
  if (!ctx || indices.length === 0) return map;

  const formatoQueue: FormatoSaida[] = [];
  if (productMode === "vsl") {
    formatoQueue.push("vsl_curta");
  } else {
    formatoQueue.push("criativo_curto");
    if (!ctx.formatosTestados.includes("criativo_curto")) formatoQueue.push("criativo_curto");
  }

  const estiloQueue: EstiloProducao[] = [];
  if (!ctx.estilosTestados.includes("ugc_avatar")) estiloQueue.push("ugc_avatar");
  if (!ctx.estilosTestados.includes("clipes_texto")) estiloQueue.push("clipes_texto");
  if (!ctx.estilosTestados.includes("texto_animado")) estiloQueue.push("texto_animado");
  estiloQueue.push("texto_animado", "clipes_texto", "ugc_avatar");

  indices.forEach((idx, i) => {
    const base = map[idx];
    if (!base) return;
    map[idx] = {
      ...base,
      formatoSaida: formatoQueue[i % formatoQueue.length],
      estiloProducao: estiloQueue[i % estiloQueue.length],
      source: "manual",
    };
  });

  return map;
}

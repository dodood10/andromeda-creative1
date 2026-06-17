import type { ResultadoAngulos } from "./anthropic.functions";

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

/** Top N ângulos por confiança da recomendação, excluindo saturação alta no hook. */
export function pickRecommendedAngulos(resultado: ResultadoAngulos, count = 2): number[] {
  const ranked = resultado.angulos
    .map((a, i) => ({
      i,
      rank: CONFIANCA_RANK[a.recomendacao_formato?.confianca ?? "baixa"] ?? 1,
      saturated: a.saturacao_hook?.status === "saturado",
    }))
    .filter((x) => !x.saturated)
    .sort((a, b) => b.rank - a.rank);

  const picks = ranked.slice(0, count).map((x) => x.i);
  if (picks.length < count) {
    for (let i = 0; i < resultado.angulos.length && picks.length < count; i++) {
      if (!picks.includes(i)) picks.push(i);
    }
  }
  return picks;
}

/** 3 ângulos com micropersonas distintas para pacote A/B. */
export function pickAbTestPackage(resultado: ResultadoAngulos): number[] {
  const picked: number[] = [];
  const personas = new Set<string>();

  const ranked = resultado.angulos
    .map((a, i) => ({
      i,
      persona: a.micropersona?.nome ?? a.nome,
      rank: CONFIANCA_RANK[a.recomendacao_formato?.confianca ?? "baixa"] ?? 1,
      saturated: a.saturacao_hook?.status === "saturado",
    }))
    .filter((x) => !x.saturated)
    .sort((a, b) => b.rank - a.rank);

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
): string | null {
  const match = topPerformers.find(
    (p) => p.angulo === anguloNome || anguloNome.startsWith(p.angulo),
  );
  if (match) return "Similar a campeão performando";
  if (topPerformers.length > 0) return "Ângulo novo — diversifica leilão";
  return null;
}

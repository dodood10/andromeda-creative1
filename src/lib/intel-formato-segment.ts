import { normalizeAnguloBase } from "./project-performance-context";

export type FormatoSaida = "criativo_curto" | "vsl_curta";

type CriativoIntelRow = {
  id: string;
  angulo: string;
  status: string | null;
  formato_saida: string | null;
  export_status?: string | null;
  angulo_json: unknown;
  performando_intel_status: string | null;
};

type SinaisLike = {
  hook_rate_estimado?: string;
  hold_rate_30s?: string;
  taxa_conclusao_estimada?: string;
  feedback_negativo_esperado?: string;
};

function parsePercentRange(value?: string): number | null {
  if (!value) return null;
  const nums = value.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
}

function extractSinais(
  c: CriativoIntelRow,
): SinaisLike | null {
  const aj = c.angulo_json as {
    sinais_andromeda?: SinaisLike;
    vsl_sinais?: SinaisLike;
  } | null;
  if (c.formato_saida === "vsl_curta" && aj?.vsl_sinais) {
    return aj.vsl_sinais;
  }
  return aj?.sinais_andromeda ?? null;
}

export type FormatoIntelSegment = {
  formato: FormatoSaida;
  total: number;
  performando: number;
  performandoValidados: number;
  exportados: number;
  hookRateMedioEstimado: number | null;
  holdRateMedioEstimado: number | null;
  taxaConclusaoMedia: number | null;
  feedbackDistribuicao: { baixo: number; medio: number; alto: number };
  topAngulos: Array<{ angulo: string; performando: number; total: number }>;
};

export function buildFormatoIntelSegment(
  criativos: CriativoIntelRow[],
  formato: FormatoSaida,
): FormatoIntelSegment {
  const rows = criativos.filter((c) => c.formato_saida === formato);
  const hookRates: number[] = [];
  const holdRates: number[] = [];
  const conclusaoRates: number[] = [];
  const feedbackCounts = { baixo: 0, medio: 0, alto: 0 };
  const anguloPerformance: Record<string, { performando: number; total: number }> = {};

  for (const c of rows) {
    const sinais = extractSinais(c);
    const hook = parsePercentRange(sinais?.hook_rate_estimado);
    if (hook != null) hookRates.push(hook);
    const hold = parsePercentRange(sinais?.hold_rate_30s);
    if (hold != null) holdRates.push(hold);
    const conclusao = parsePercentRange(sinais?.taxa_conclusao_estimada);
    if (conclusao != null) conclusaoRates.push(conclusao);

    const fb = sinais?.feedback_negativo_esperado?.toLowerCase();
    if (fb === "baixo" || fb === "medio" || fb === "médio" || fb === "alto") {
      const key = fb === "médio" ? "medio" : fb;
      feedbackCounts[key as keyof typeof feedbackCounts]++;
    }

    const base = normalizeAnguloBase(c.angulo);
    if (!anguloPerformance[base]) anguloPerformance[base] = { performando: 0, total: 0 };
    anguloPerformance[base].total++;
    if (c.status === "Performando" && c.performando_intel_status === "approved") {
      anguloPerformance[base].performando++;
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const performando = rows.filter((c) => c.status === "Performando");
  const performandoValidados = performando.filter(
    (c) => c.performando_intel_status === "approved",
  );

  return {
    formato,
    total: rows.length,
    performando: performando.length,
    performandoValidados: performandoValidados.length,
    exportados: rows.filter((c) => c.export_status === "pronto").length,
    hookRateMedioEstimado: avg(hookRates),
    holdRateMedioEstimado: avg(holdRates),
    taxaConclusaoMedia: avg(conclusaoRates),
    feedbackDistribuicao: feedbackCounts,
    topAngulos: Object.entries(anguloPerformance)
      .filter(([, v]) => v.performando > 0)
      .sort((a, b) => b[1].performando - a[1].performando)
      .slice(0, 5)
      .map(([angulo, v]) => ({ angulo, performando: v.performando, total: v.total })),
  };
}

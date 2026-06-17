export type SinaisAndromeda = {
  hook_rate_estimado?: string;
  feedback_negativo_esperado?: string;
  fatia_leilao?: string;
};

function clamp(n: number, min = 30, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/** Extrai score numérico de strings como "35-45%", "40% hook rate", "alto (40+)". */
export function parseHookRateScore(estimado?: string): number {
  if (!estimado?.trim()) return 55;
  const nums = estimado.match(/\d+/g)?.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)) ?? [];
  if (nums.length >= 2) return clamp(Math.round((nums[0] + nums[1]) / 2));
  if (nums.length === 1) return clamp(nums[0]);
  if (/alto|forte|elevado/i.test(estimado)) return 78;
  if (/médio|medio|moderado/i.test(estimado)) return 65;
  if (/baixo|fraco/i.test(estimado)) return 48;
  return 55;
}

export function scoreFromFeedbackNegativo(feedback?: string): number {
  switch (feedback?.toLowerCase()) {
    case "baixo":
      return 12;
    case "medio":
    case "médio":
      return 0;
    case "alto":
      return -15;
    default:
      return 0;
  }
}

export function scoreFromFatiaLeilao(fatia?: string): number {
  if (!fatia?.trim()) return 70;
  const t = fatia.toLowerCase();
  if (/ampla|grande|wide|broad/.test(t)) return 88;
  if (/média|media|moderada/.test(t)) return 72;
  if (/nicho|estreita|narrow|específica|especifica/.test(t)) return 58;
  return 70;
}

export function computeHookDimensionScore(sinais?: SinaisAndromeda): {
  score: number;
  dica?: string;
} {
  const base = parseHookRateScore(sinais?.hook_rate_estimado);
  const adj = scoreFromFeedbackNegativo(sinais?.feedback_negativo_esperado);
  const score = clamp(base + adj);
  let dica: string | undefined;
  if (score < 70) {
    dica = sinais?.hook_rate_estimado
      ? `Hook rate estimado: ${sinais.hook_rate_estimado} — teste novo gancho nos primeiros 3s.`
      : "Reforce o hook com promessa específica e padrão de interrupção visual.";
  }
  return { score, dica };
}

export function computeLeilaoScore(sinais?: SinaisAndromeda): number {
  return scoreFromFatiaLeilao(sinais?.fatia_leilao);
}

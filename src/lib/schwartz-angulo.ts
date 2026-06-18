import type { AnguloCopyTipo, NivelConscienciaAlvo } from "./types/enums";
import type { ResultadoAngulos } from "./schemas/angulos.schema";

export const ANGULO_COPY_LABELS: Record<AnguloCopyTipo, string> = {
  direto: "Direto",
  historia: "História",
  problema_solucao: "Problema/Solução",
  contrario: "Contrário",
  curiosidade: "Curiosidade",
  novo_mecanismo: "Novo mecanismo",
  autoridade_prova: "Autoridade/Prova",
};

export const NIVEL_CONSCIENCIA_LABELS: Record<NivelConscienciaAlvo, string> = {
  1: "1 — Inconsciente",
  2: "2 — Consciente do problema",
  3: "3 — Consciente da solução",
  4: "4 — Consciente do produto",
  5: "5 — Mais consciente",
};

const ALL_COPY_TIPOS: AnguloCopyTipo[] = [
  "direto",
  "historia",
  "problema_solucao",
  "contrario",
  "curiosidade",
  "novo_mecanismo",
  "autoridade_prova",
];

export function goalToSchwartzRange(goal: string): { min: number; max: number; hint: string } {
  switch (goal) {
    case "traf":
      return {
        min: 1,
        max: 2,
        hint: "Objetivo tráfego/topo: priorize níveis 1–2 (educar problema, curiosidade). Evite CTA de compra imediata no hook.",
      };
    case "leads":
      return {
        min: 2,
        max: 3,
        hint: "Objetivo leads: priorize níveis 2–3 (problema + caminho de solução). CTA de cadastro, não compra direta.",
      };
    default:
      return {
        min: 3,
        max: 5,
        hint: "Objetivo conversão: priorize níveis 3–5 (mecanismo, prova, oferta). CTA com benefício claro.",
      };
  }
}

export function inferAnguloCopyFromText(text: string): AnguloCopyTipo {
  const t = text.toLowerCase();
  if (/\b(contr[aá]ri|mito|mentira|engana|falso)\b/.test(t)) return "contrario";
  if (/\b(hist[oó]ria|jornada|quando eu|meu nome é)\b/.test(t)) return "historia";
  if (/\b(curios|segredo|ningu[eé]m te contou|descobri)\b/.test(t)) return "curiosidade";
  if (/\b(mecanismo|m[eé]todo|protocolo|t[eé]cnica)\b/.test(t)) return "novo_mecanismo";
  if (/\b(depoimento|clientes|estudo|pesquisa|\d+%)\b/.test(t)) return "autoridade_prova";
  if (/\b(problema|dor|sofri|n[aã]o aguento)\b/.test(t)) return "problema_solucao";
  return "direto";
}

export function parseNivelConscienciaAlvo(raw: unknown, fallback = 3): NivelConscienciaAlvo {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "").match(/\d/)?.[0] ?? "", 10);
  if (n >= 1 && n <= 5) return n as NivelConscienciaAlvo;
  return fallback as NivelConscienciaAlvo;
}

type AnguloLike = {
  angulo_copy?: AnguloCopyTipo;
  nivel_consciencia_alvo?: NivelConscienciaAlvo;
  hook?: string;
  variavel_explorada?: string;
  nivel_schwartz?: string;
  [key: string]: unknown;
};

export function normalizeSchwartzAnguloFields<T extends AnguloLike>(angulo: T): T & {
  angulo_copy: AnguloCopyTipo;
  nivel_consciencia_alvo: NivelConscienciaAlvo;
} {
  const copy =
    angulo.angulo_copy ??
    inferAnguloCopyFromText(`${angulo.variavel_explorada ?? ""} ${angulo.hook ?? ""}`);
  const nivel =
    angulo.nivel_consciencia_alvo ?? parseNivelConscienciaAlvo(angulo.nivel_schwartz, 3);
  return { ...angulo, angulo_copy: copy, nivel_consciencia_alvo: nivel };
}

/** Seleciona 1 ângulo por nível Schwartz (1–5) para pacote funil. */
export function pickFunnelSchwartzPackage(resultado: ResultadoAngulos): number[] {
  const levels: NivelConscienciaAlvo[] = [1, 2, 3, 4, 5];
  const picked: number[] = [];
  const usedLevels = new Set<number>();

  for (const level of levels) {
    const idx = resultado.angulos.findIndex(
      (a, i) =>
        !picked.includes(i) &&
        (a.nivel_consciencia_alvo === level ||
          parseNivelConscienciaAlvo(a.nivel_schwartz) === level),
    );
    if (idx >= 0) {
      picked.push(idx);
      usedLevels.add(level);
    }
  }

  for (const level of levels) {
    if (usedLevels.has(level)) continue;
    const idx = resultado.angulos.findIndex((a, i) => !picked.includes(i));
    if (idx >= 0) {
      picked.push(idx);
      usedLevels.add(level);
    }
  }

  return picked.slice(0, 5);
}

export function ensureAnguloCopyDiversityHint(): string {
  return `Os 5 ângulos DEVEM usar pelo menos 4 tipos distintos de angulo_copy entre: ${ALL_COPY_TIPOS.join(", ")}.`;
}

export type NivelConscienciaPreferencia = {
  modo: import("./types/enums").NivelConscienciaModo;
  nivel?: NivelConscienciaAlvo;
  min?: NivelConscienciaAlvo;
  max?: NivelConscienciaAlvo;
};

export function formatSchwartzPreferenciaBlock(
  pref: NivelConscienciaPreferencia,
  goalHint: { min: number; max: number; hint: string },
): string {
  switch (pref.modo) {
    case "nivel":
      return `Preferência do usuário: PRIORIZAR nível ${pref.nivel ?? 3} de consciência Schwartz em todos os 5 ângulos (ajuste hook e CTA ao nível). Ainda use micropersonas distintas.`;
    case "faixa":
      return `Preferência do usuário: níveis de consciência entre ${pref.min ?? goalHint.min} e ${pref.max ?? goalHint.max}. Distribua os 5 ângulos dentro dessa faixa com diversidade.`;
    case "funil":
      return `Preferência do usuário: PACOTE FUNIL — exatamente 1 ângulo por nível Schwartz (1, 2, 3, 4, 5), cada um com micropersona distinta.`;
    default:
      return `Nível de consciência: IA decide com base no objetivo (faixa sugerida ${goalHint.min}–${goalHint.max}). Mantenha diversidade entre os 5 ângulos quando possível.`;
  }
}

export type AngulosValidation = {
  ok: boolean;
  issues: string[];
  distinctCopy: number;
  distinctPersonas: number;
};

export function validateAngulosResult(resultado: ResultadoAngulos): AngulosValidation {
  const issues: string[] = [];
  const copySet = new Set(resultado.angulos.map((a) => a.angulo_copy).filter(Boolean));
  const personaSet = new Set(
    resultado.angulos.map((a) => a.micropersona?.nome ?? a.nome).filter(Boolean),
  );
  if (resultado.angulos.length !== 5) {
    issues.push(`Esperados 5 ângulos, recebidos ${resultado.angulos.length}`);
  }
  if (copySet.size < 4) {
    issues.push(`Apenas ${copySet.size} angulo_copy distintos (mínimo 4)`);
  }
  if (personaSet.size < 4) {
    issues.push(`Apenas ${personaSet.size} micropersonas distintas (mínimo 4)`);
  }
  return {
    ok: issues.length === 0,
    issues,
    distinctCopy: copySet.size,
    distinctPersonas: personaSet.size,
  };
}

const GENERIC_HOOK_PATTERNS =
  /\b(transforme sua vida|resultados incr[ií]veis|voc[eê] precisa ver|n[aã]o perca|oportunidade [uú]nica)\b/i;

export function computeFourUsScore(hook: string, cta?: string, goal = "conv"): {
  score: number;
  dica?: string;
  detalhes: { unico: boolean; util: boolean; urgente: boolean; ultraEspecifico: boolean };
} {
  const text = `${hook} ${cta ?? ""}`.trim();
  const hasNumber = /\d+/.test(text);
  const hasNamedMechanism = /\b(m[eé]todo|protocolo|t[eé]cnica|sistema|ritual)\b/i.test(text);
  const hasProperNoun = /\b[A-ZÁÉÍÓÚ][a-záéíóú]{2,}\b/.test(hook);
  const unico = hasNumber || hasNamedMechanism || hasProperNoun;

  const util = hook.length >= 25 && !GENERIC_HOOK_PATTERNS.test(hook);
  const ultraEspecifico = !GENERIC_HOOK_PATTERNS.test(hook) && (hasNumber || hook.split(/\s+/).length >= 8);
  const urgente =
    goal === "conv" &&
    /\b(agora|hoje|antes que|últim|garanta|comece)\b/i.test(text) &&
    !/\b(100%|garantido|milagre)\b/i.test(text);

  const parts = [unico, util, ultraEspecifico, goal === "conv" ? urgente || util : util];
  const score = Math.round((parts.filter(Boolean).length / 4) * 100);

  let dica: string | undefined;
  if (!ultraEspecifico) dica = "Evite frases genéricas — use número, mecanismo nomeado ou promessa mensurável.";
  else if (!unico) dica = "Torne o hook mais único com dado específico ou nome do método.";
  else if (goal === "conv" && !urgente) dica = "Para conversão, considere urgência real (prazo, custo da espera).";

  return {
    score,
    dica,
    detalhes: { unico, util, urgente, ultraEspecifico },
  };
}

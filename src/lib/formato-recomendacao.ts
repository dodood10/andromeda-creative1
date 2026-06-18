import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  RecomendacaoFormatoSchema,
  type RecomendacaoFormato,
} from "./schemas/angulos.schema";
import type { EstiloProducao, FormatoSaida } from "./types/enums";

export type { EstiloProducao, FormatoSaida } from "./types/enums";

export type FormatoOverride = {
  formatoSaida: FormatoSaida;
  estiloProducao: EstiloProducao;
  aspectRatioPrioritario: "9:16" | "4:5" | "1:1";
  source: "ia" | "manual";
};

export const DEFAULT_RECOMENDACAO: RecomendacaoFormato = {
  formato_saida: "criativo_curto",
  estilo_producao: "texto_animado",
  aspect_ratio_prioritario: "9:16",
  duracao_alvo_seg: 45,
  justificativa: "Formato padrão — recomendação da IA indisponível para esta geração.",
  formatos_saturados_nicho: [],
  confianca: "baixa",
  requer_midia_usuario: false,
};

type AnguloLike = {
  recomendacao_formato?: unknown;
  [key: string]: unknown;
};

export function normalizeRecomendacaoFormato(raw: unknown): RecomendacaoFormato {
  const parsed = RecomendacaoFormatoSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return { ...DEFAULT_RECOMENDACAO };
}

export function normalizeAngulo<T extends AnguloLike>(angulo: T): T & { recomendacao_formato: RecomendacaoFormato } {
  return {
    ...angulo,
    recomendacao_formato: normalizeRecomendacaoFormato(angulo.recomendacao_formato),
  };
}

export function overrideFromRecomendacao(rec: RecomendacaoFormato, source: "ia" | "manual" = "ia"): FormatoOverride {
  return {
    formatoSaida: rec.formato_saida,
    estiloProducao: rec.estilo_producao,
    aspectRatioPrioritario: rec.aspect_ratio_prioritario,
    source,
  };
}

export function buildFormatoPorAngulo(
  angulos: AnguloLike[],
  selectedIndices: Iterable<number>,
  globalOverride?: Partial<FormatoOverride>,
): Record<number, FormatoOverride> {
  const map: Record<number, FormatoOverride> = {};
  for (const idx of selectedIndices) {
    const angulo = angulos[idx];
    if (!angulo) continue;
    const rec = normalizeAngulo(angulo).recomendacao_formato;
    const base = overrideFromRecomendacao(rec, "ia");
    map[idx] = globalOverride
      ? {
          ...base,
          ...globalOverride,
          source: globalOverride.source ?? "manual",
        }
      : base;
  }
  return map;
}

export function formatoSaidaLabel(v: FormatoSaida): string {
  return v === "vsl_curta" ? "VSL curta (até 2min)" : "Criativo curto (30–60s)";
}

export function estiloProducaoLabel(v: EstiloProducao): string {
  if (v === "clipes_texto") return "Clipes + texto";
  if (v === "ugc_avatar") return "UGC depoimento (IA)";
  return "Texto animado + voz";
}

export function estiloProducaoBadge(v: EstiloProducao): string {
  if (v === "clipes_texto") return "Clipes IA";
  if (v === "ugc_avatar") return "UGC recomendado";
  return "Texto animado";
}

export function formatoBadgeLabel(override: FormatoOverride, duracao?: number): string {
  const dur = duracao ?? (override.formatoSaida === "vsl_curta" ? 90 : 45);
  return `${override.formatoSaida === "vsl_curta" ? "VSL" : "Criativo"} ${dur}s · ${estiloProducaoLabel(override.estiloProducao)}`;
}

export type ProjectFormatContext = {
  totalCriativos: number;
  formatosTestados: FormatoSaida[];
  estilosTestados: EstiloProducao[];
  performando: number;
  rodando: number;
  topPerformers: Array<{ angulo: string; formato: string; estilo: string }>;
  summaryText: string;
};

export async function getProjectFormatContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectFormatContext | null> {
  const { data: criativos, error } = await supabase
    .from("criativos")
    .select("angulo, status, formato_saida, estilo_producao")
    .eq("project_id", projectId);

  if (error || !criativos?.length) return null;

  const formatosSet = new Set<FormatoSaida>();
  const estilosSet = new Set<EstiloProducao>();
  let performando = 0;
  let rodando = 0;
  const topPerformers: ProjectFormatContext["topPerformers"] = [];

  for (const c of criativos) {
    if (c.formato_saida) formatosSet.add(c.formato_saida as FormatoSaida);
    if (c.estilo_producao) estilosSet.add(c.estilo_producao as EstiloProducao);
    if (c.status === "Performando") {
      performando++;
      topPerformers.push({
        angulo: c.angulo,
        formato: c.formato_saida ?? "—",
        estilo: c.estilo_producao ?? "—",
      });
    }
    if (c.status === "Rodando") rodando++;
  }

  const formatosTestados = [...formatosSet];
  const estilosTestados = [...estilosSet];
  const counts = {
    criativo_curto: criativos.filter((c) => c.formato_saida === "criativo_curto").length,
    vsl_curta: criativos.filter((c) => c.formato_saida === "vsl_curta").length,
    texto_animado: criativos.filter((c) => c.estilo_producao === "texto_animado").length,
    clipes_texto: criativos.filter((c) => c.estilo_producao === "clipes_texto").length,
    ugc_avatar: criativos.filter((c) => c.estilo_producao === "ugc_avatar").length,
  };

  const parts = [
    `${criativos.length} criativo(s) no projeto`,
    `${counts.criativo_curto}x criativo_curto, ${counts.vsl_curta}x vsl_curta`,
    `${counts.texto_animado}x texto_animado, ${counts.clipes_texto}x clipes_texto, ${counts.ugc_avatar}x ugc_avatar`,
    `${performando} performando, ${rodando} rodando`,
  ];

  const diversidade: string[] = [];
  if (!formatosSet.has("vsl_curta") && criativos.length >= 2) {
    diversidade.push("ainda não testou vsl_curta");
  }
  if (!formatosSet.has("criativo_curto") && criativos.length >= 2) {
    diversidade.push("ainda não testou criativo_curto");
  }
  if (!estilosSet.has("clipes_texto") && criativos.length >= 2) {
    diversidade.push("ainda não testou clipes_texto");
  }
  if (!estilosSet.has("ugc_avatar") && criativos.length >= 2) {
    diversidade.push("ainda não testou ugc_avatar");
  }

  const summaryText = [
    parts.join("; "),
    diversidade.length ? `Oportunidades de diversidade: ${diversidade.join(", ")}` : "",
    topPerformers.length
      ? `Performando agora: ${topPerformers.slice(0, 3).map((p) => `"${p.angulo}" (${p.formato}/${p.estilo})`).join(", ")}`
      : "",
    "Priorize formatos NÃO testados quando coerente com cada ângulo, para diversificar o leilão Meta.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    totalCriativos: criativos.length,
    formatosTestados,
    estilosTestados,
    performando,
    rodando,
    topPerformers: topPerformers.slice(0, 5),
    summaryText,
  };
}

export function needsMediaUpload(
  angulos: AnguloLike[],
  selectedIndices: Iterable<number>,
  formatoPorAngulo: Record<number, FormatoOverride>,
): number[] {
  const needs: number[] = [];
  for (const idx of selectedIndices) {
    const rec = normalizeAngulo(angulos[idx] ?? {}).recomendacao_formato;
    const applied = formatoPorAngulo[idx];
    const estilo = applied?.estiloProducao ?? rec.estilo_producao;
    if (estilo === "clipes_texto" || estilo === "ugc_avatar" || rec.requer_midia_usuario) {
      needs.push(idx);
    }
  }
  return needs;
}

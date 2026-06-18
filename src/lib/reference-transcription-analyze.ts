import type { ImportCampeaoAnalysis } from "./schemas/import-campeao.schema";
import { analisarCriativoImportado } from "./import-creative.functions";
import { detectNicheSignals } from "./reference-niche-guard";

export type ReferenceTranscriptionAnalysis = {
  hook: string;
  angulo: string;
  tipo_angulo: string;
  estrutura_resumo: string;
  formato_inferido: string;
  nivel_conspiracao: string;
  nicho_inferido?: string;
};

export function mapImportAnalysisToReference(
  analysis: ImportCampeaoAnalysis,
  sourceText?: string,
): ReferenceTranscriptionAnalysis {
  const estruturaResumo = analysis.estrutura
    .map((e) => `${e.tempo}: ${e.conteudo}`)
    .join(" | ");

  const formato = analysis.recomendacao_formato;
  const formatoInferido = [
    formato.formato_saida,
    formato.estilo_producao,
    formato.justificativa ? `— ${formato.justificativa.slice(0, 120)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const niches = sourceText ? detectNicheSignals(sourceText) : [];

  return {
    hook: analysis.hook,
    angulo: analysis.nome,
    tipo_angulo: `${analysis.tipo} · ${analysis.variavel_explorada}`,
    estrutura_resumo: estruturaResumo.slice(0, 800),
    formato_inferido: formatoInferido.slice(0, 300),
    nivel_conspiracao: analysis.nivel_conspiracao,
    nicho_inferido: niches[0] ?? undefined,
  };
}

export function buildFallbackReferenceAnalysis(
  text: string,
  label?: string,
): ReferenceTranscriptionAnalysis {
  const firstSentence = text.split(/[.!?\n]/).find((s) => s.trim().length > 20)?.trim() ?? text.slice(0, 120);
  const niches = detectNicheSignals(text);
  return {
    hook: firstSentence.slice(0, 200),
    angulo: label ?? "Referência colada",
    tipo_angulo: "Escala · referência manual",
    estrutura_resumo: "Análise automática indisponível — use o texto completo como padrão.",
    formato_inferido: "não inferido",
    nivel_conspiracao: "sem",
    nicho_inferido: niches[0] ?? undefined,
  };
}

export async function analyzeReferenceTranscription(params: {
  apiKey: string | undefined;
  userId: string;
  text: string;
  label?: string;
}): Promise<ReferenceTranscriptionAnalysis> {
  const nome = params.label ?? (params.text.slice(0, 48).trim() || "Referência colada");
  try {
    const full = await analisarCriativoImportado({
      apiKey: params.apiKey,
      userId: params.userId,
      nomeAngulo: nome,
      transcription: params.text,
      transcriptionLabel: "COPY COLADA PELO USUÁRIO — anúncio de referência",
      notas: "Análise para inteligência geral (não cria criativo).",
    });
    return mapImportAnalysisToReference(full, params.text);
  } catch {
    return buildFallbackReferenceAnalysis(params.text, params.label);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";
import { IMPORT_CAMPEAO_SYSTEM } from "./prompts/import-campeao.system";
import {
  ImportCampeaoAnalysisSchema,
  type ImportCampeaoAnalysis,
} from "./schemas/import-campeao.schema";
import type { RoteiroBloco } from "./schemas/angulos.schema";
import { callFfmpegTranscribe } from "./render/render-ffmpeg";
import {
  buildWhisperTranscriptionSnapshot,
  type WhisperSegment,
} from "./transcribe-export";
import type { ExportTranscricaoSnapshot } from "./export-transcription";
import { trackApiUsage } from "./api-usage";
import type { EstiloProducao, FormatoSaida } from "./types/enums";

export type ImportMetricInput = {
  metrica: string;
  valor: string;
};

export type ImportCriativoCampeaoParams = {
  supabase: SupabaseClient<Database>;
  userId: string;
  projectId: string;
  organizationId: string;
  storagePath: string;
  nomeAngulo: string;
  metrics?: ImportMetricInput[];
  formatoSaida?: FormatoSaida;
  estiloProducao?: EstiloProducao;
  aspectRatio?: "9:16" | "4:5" | "1:1";
  notas?: string;
  fileName?: string;
  produto?: string;
};

function estimateDurationFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(15, Math.min(180, Math.round(words / 2.5)));
}

function buildImportTranscriptionSnapshot(
  roteiro: RoteiroBloco[],
  transcription: string,
  source: "whisper" | "paste",
  duracaoSeg?: number,
): ExportTranscricaoSnapshot {
  return {
    blocos: roteiro.map((b) => ({
      tempo: b.tempo,
      conteudo: b.conteudo,
      tipo: b.tipo,
    })),
    exported_at: new Date().toISOString(),
    source,
    total_blocos: roteiro.length,
    duracao_estimada_seg: duracaoSeg ?? estimateDurationFromText(transcription),
  };
}

async function persistImportMetrics(
  supabase: SupabaseClient<Database>,
  userId: string,
  criativoId: string,
  metrics: ImportMetricInput[],
  observacao: string,
) {
  for (const m of metrics) {
    if (!m.metrica?.trim() || !m.valor?.trim()) continue;
    await supabase.from("resultados_reportados").insert({
      criativo_id: criativoId,
      user_id: userId,
      tipo: "clique",
      metrica: m.metrica.trim(),
      valor: m.valor.trim(),
      observacao,
      intel_review_status: "pending",
    });
  }
}

async function finalizeImportCriativo(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  criativoId: string;
  analysis: ImportCampeaoAnalysis;
  transcription: string;
  snapshot: ExportTranscricaoSnapshot | null;
  formatoTag: string;
  aspect: string;
  metrics: ImportMetricInput[];
  metricsObservacao: string;
}): Promise<{ criativoId: string; analyzed: boolean }> {
  const roteiro = params.analysis.roteiro;
  const anguloJson = {
    numero: 0,
    ...params.analysis,
    importado: true,
    importado_em: new Date().toISOString(),
    recomendacao_formato_aplicada: {
      formato_saida: params.analysis.recomendacao_formato.formato_saida,
      estilo_producao: params.analysis.recomendacao_formato.estilo_producao,
      aspect_ratio_prioritario: params.analysis.recomendacao_formato.aspect_ratio_prioritario,
      source: "import",
    },
    export_transcricao:
      params.snapshot ??
      (params.transcription.trim()
        ? buildImportTranscriptionSnapshot(roteiro, params.transcription, "paste")
        : undefined),
  };

  const { error: updateErr } = await params.supabase
    .from("criativos")
    .update({
      angulo: `${params.analysis.nome} · ${params.formatoTag} · ${params.aspect}`,
      roteiro,
      angulo_json: anguloJson,
    })
    .eq("id", params.criativoId);

  if (updateErr) throw new Error(updateErr.message);

  await persistImportMetrics(
    params.supabase,
    params.userId,
    params.criativoId,
    params.metrics,
    params.metricsObservacao,
  );

  return { criativoId: params.criativoId, analyzed: !!params.transcription.trim() };
}

function estiloLabel(estilo: EstiloProducao): string {
  if (estilo === "texto_animado") return "Texto";
  if (estilo === "ugc_avatar") return "UGC";
  return "Clipes";
}

function buildFallbackAnalysis(params: {
  nomeAngulo: string;
  transcription: string;
  duracaoSeg?: number;
  formatoSaida?: FormatoSaida;
  estiloProducao?: EstiloProducao;
  aspectRatio?: "9:16" | "4:5" | "1:1";
}): ImportCampeaoAnalysis {
  const dur = params.duracaoSeg ?? 45;
  const texto = params.transcription.trim() || params.nomeAngulo;
  const hook = texto.split(/[.!?]/)[0]?.trim() || params.nomeAngulo;
  const formato = params.formatoSaida ?? "criativo_curto";
  const estilo = params.estiloProducao ?? "clipes_texto";
  const aspect = params.aspectRatio ?? "9:16";

  return ImportCampeaoAnalysisSchema.parse({
    nome: params.nomeAngulo,
    tipo: "Escala",
    micropersona: { nome: "Importado", papel_temido: "Perder resultados" },
    variavel_explorada: "importado",
    nivel_schwartz: "3-4",
    nivel_conspiracao: "sem",
    hook,
    estrutura: [{ tempo: `0-${dur}s`, conteudo: texto }],
    hook_visual: "Cena de abertura do anúncio importado",
    cta: texto.slice(-120) || "CTA do anúncio",
    justificativa_probabilistica: "Campeão importado — análise automática indisponível",
    sinais_andromeda: {
      hook_rate_estimado: "35% (estimativa padrão import)",
      feedback_negativo_esperado: "medio",
      fatia_leilao: "Testado na conta do anunciante",
    },
    recomendacao_formato: {
      formato_saida: formato,
      estilo_producao: estilo,
      aspect_ratio_prioritario: aspect,
      duracao_alvo_seg: dur,
      justificativa: "Inferido do import",
      confianca: "baixa",
      requer_midia_usuario: estilo !== "texto_animado",
      render_pipeline: estilo === "ugc_avatar" ? "ugc_provider" : "legado_ffmpeg",
    },
    roteiro: [
      { tempo: `0-${Math.min(3, dur)}s`, conteudo: hook, tipo: "hook" },
      { tempo: `3-${dur}s`, conteudo: texto, tipo: "cta" },
    ],
  });
}

export async function analisarCriativoImportado(params: {
  apiKey: string | undefined;
  userId: string;
  nomeAngulo: string;
  transcription: string;
  duracaoSeg?: number;
  formatoSaida?: FormatoSaida;
  estiloProducao?: EstiloProducao;
  aspectRatio?: "9:16" | "4:5" | "1:1";
  notas?: string;
  transcriptionLabel?: string;
}): Promise<ImportCampeaoAnalysis> {
  const fallback = () =>
    buildFallbackAnalysis({
      nomeAngulo: params.nomeAngulo,
      transcription: params.transcription,
      duracaoSeg: params.duracaoSeg,
      formatoSaida: params.formatoSaida,
      estiloProducao: params.estiloProducao,
      aspectRatio: params.aspectRatio,
    });

  if (!params.apiKey || !params.transcription.trim()) {
    return fallback();
  }

  const userMsg = `NOME DO ANÚNCIO (usuário): ${params.nomeAngulo}
DURAÇÃO ESTIMADA: ${params.duracaoSeg ?? "desconhecida"} segundos
FORMATO INFORMADO: ${params.formatoSaida ?? "não informado"}
ESTILO INFORMADO: ${params.estiloProducao ?? "não informado"}
ASPECT RATIO: ${params.aspectRatio ?? "9:16"}
NOTAS: ${params.notas ?? "(nenhuma)"}

TRANSCRIÇÃO (${params.transcriptionLabel ?? "WHISPER — áudio real do anúncio"}):
${params.transcription}

Decomponha este campeão em JSON conforme especificação.`;

  try {
    const text = await callAnthropicJson({
      apiKey: params.apiKey,
      system: IMPORT_CAMPEAO_SYSTEM,
      userMessage: userMsg,
      maxTokens: 4096,
    });
    const raw = extractJsonFromAnthropicText(text);
    const parsed = ImportCampeaoAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[import-campeao] schema fail:", parsed.error.flatten());
      return fallback();
    }
    await trackApiUsage({
      userId: params.userId,
      eventType: "import_campeao",
      success: true,
    });
    return parsed.data;
  } catch (e) {
    console.warn("[import-campeao] Anthropic falhou:", e);
    return fallback();
  }
}

async function transcribeImportVideo(
  criativoId: string,
  storagePath: string,
  placeholderRoteiro: RoteiroBloco[],
): Promise<{ transcription: string; snapshot: ReturnType<typeof buildWhisperTranscriptionSnapshot> | null }> {
  const whisper = await callFfmpegTranscribe({ criativoId, storagePath });
  if (!whisper?.segments?.length) {
    return { transcription: "", snapshot: null };
  }

  const segments: WhisperSegment[] = whisper.segments;
  const snapshot = buildWhisperTranscriptionSnapshot({
    segments,
    roteiro: placeholderRoteiro,
    durationSec: whisper.duration,
    language: whisper.language,
  });
  const transcription =
    whisper.text?.trim() ||
    segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" ");

  return { transcription, snapshot };
}

export async function executeImportCriativoCampeao(
  params: ImportCriativoCampeaoParams,
): Promise<{ criativoId: string; analyzed: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const {
    supabase,
    userId,
    projectId,
    organizationId,
    storagePath,
    nomeAngulo,
    metrics = [],
    formatoSaida,
    estiloProducao,
    aspectRatio,
    notas,
    fileName,
    produto,
  } = params;

  const formato = formatoSaida ?? "criativo_curto";
  const estilo = estiloProducao ?? "clipes_texto";
  const aspect = aspectRatio ?? "9:16";
  const formatoTag = formato === "vsl_curta" ? "VSL" : "Curto";
  const anguloDisplay = `${nomeAngulo} · ${formatoTag} · ${aspect}`;

  const placeholderRoteiro: RoteiroBloco[] = [{ tempo: "0-60s", conteudo: "", tipo: "hook" }];

  const { data: criativo, error: insertErr } = await supabase
    .from("criativos")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      project_id: projectId,
      geracao_id: null,
      produto: produto ?? "Importado",
      angulo: anguloDisplay,
      formato: aspect,
      estilo: estiloLabel(estilo),
      formato_saida: formato,
      estilo_producao: estilo,
      status: "Performando",
      export_status: "pronto",
      export_paths: [storagePath],
      roteiro: placeholderRoteiro,
      utm_content: crypto.randomUUID(),
      source: "importado",
      imported_at: new Date().toISOString(),
      import_metadata: {
        fileName: fileName ?? null,
        notas: notas ?? null,
        nomeAngulo,
      },
      performando_intel_status: "pending",
      performando_intel_submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !criativo) throw new Error(insertErr?.message ?? "Falha ao criar criativo importado");

  const { transcription, snapshot } = await transcribeImportVideo(
    criativo.id,
    storagePath,
    placeholderRoteiro,
  );

  const analysis = await analisarCriativoImportado({
    apiKey,
    userId,
    nomeAngulo,
    transcription,
    duracaoSeg: snapshot?.duracao_estimada_seg,
    formatoSaida: formato,
    estiloProducao: estilo,
    aspectRatio: aspect,
    notas,
  });

  const whisperSnapshot =
    snapshot ??
    (transcription.trim()
      ? buildImportTranscriptionSnapshot(analysis.roteiro, transcription, "whisper", undefined)
      : null);

  return finalizeImportCriativo({
    supabase,
    userId,
    criativoId: criativo.id,
    analysis,
    transcription,
    snapshot: whisperSnapshot,
    formatoTag,
    aspect,
    metrics,
    metricsObservacao: "Import biblioteca campeões",
  });
}

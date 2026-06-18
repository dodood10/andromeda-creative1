import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EstiloProducao } from "@/lib/formato-recomendacao";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import type { AudioPaths, ScoreJson } from "@/lib/types/criativo-json";
import { parseAudioPaths, parseScoreJson } from "@/lib/types/criativo-json";
import { trackApiUsage } from "@/lib/api-usage";
import { trackFunnelEvent } from "@/lib/funnel-events";
import { ensureCriativoAudio } from "@/lib/render/audio-prep";
import {
  buildExportScorePatch,
  executeCriativoRender,
} from "@/lib/render/render-orchestrator";
import { createRenderJob } from "@/lib/render/render-jobs";
import { ensureExportTranscription } from "@/lib/transcribe-export";
import type { ExportTranscricaoSnapshot } from "@/lib/export-transcription";

export type CriativoRenderRow = {
  id: string;
  roteiro: RoteiroBloco[] | null;
  audio_paths: AudioPaths | null;
  background_media_path: string | null;
  utm_content: string | null;
  estilo_producao: EstiloProducao | null;
  angulo_json: unknown;
  produto: string;
  score_json: ScoreJson | null;
  organization_id: string | null;
  voice_id: string | null;
};

export async function processCriativoRenderJob(params: {
  supabase: SupabaseClient<Database>;
  criativo: CriativoRenderRow;
  userId?: string;
  jobId?: string;
  renderStart?: number;
}) {
  const { supabase, criativo, userId } = params;
  const renderStart = params.renderStart ?? Date.now();
  const estilo = (criativo.estilo_producao ?? "texto_animado") as EstiloProducao;
  const roteiro = (criativo.roteiro as RoteiroBloco[]) ?? [];

  const { audioPaths } = await ensureCriativoAudio({
    supabase,
    criativoId: criativo.id,
    roteiro,
    voiceId: criativo.voice_id,
    userId,
    organizationId: criativo.organization_id,
  });

  const criativoWithAudio = { ...criativo, audio_paths: audioPaths };

  const { paths, devMode, resolved, message } = await executeCriativoRender({
    supabase,
    criativo: criativoWithAudio,
    existingJobId: params.jobId,
  });

  const existingScore = criativo.score_json;
  const scorePatch = buildExportScorePatch(existingScore, resolved);
  const aj = (criativo.angulo_json as Record<string, unknown>) ?? {};
  const existingSnapshot = (aj.export_transcricao as ExportTranscricaoSnapshot | undefined) ?? null;
  const exportTranscricao = await ensureExportTranscription({
    criativoId: criativo.id,
    roteiro,
    exportPaths: paths,
    existing: existingSnapshot,
  });

  await supabase
    .from("criativos")
    .update({
      export_status: "pronto",
      export_paths: paths,
      storage_path: paths[0] ?? null,
      audio_paths: audioPaths,
      angulo_json: { ...aj, export_transcricao: exportTranscricao },
      score_json: devMode
        ? {
            ...scorePatch,
            exportDevMode: true,
            exportDevMessage:
              message ??
              "FFMPEG_SERVICE_URL não configurado — arquivos MP4 são placeholders, não use no Meta.",
          }
        : scorePatch,
    })
    .eq("id", criativo.id);

  trackApiUsage({
    userId,
    organizationId: criativo.organization_id,
    eventType: "export",
    success: true,
  });

  trackFunnelEvent({
    userId,
    organizationId: criativo.organization_id,
    event: "render_done",
    durationMs: Date.now() - renderStart,
    metadata: {
      pipeline: resolved.pipeline,
      estilo,
      ugc_recommended: resolved.ugcRecommended,
      devMode,
    },
  });

  trackFunnelEvent({
    userId,
    organizationId: criativo.organization_id,
    event: "export_pronto",
    durationMs: Date.now() - renderStart,
  });
}

export async function failCriativoRenderJob(params: {
  supabase: SupabaseClient<Database>;
  criativoId: string;
  userId?: string;
  organizationId?: string | null;
  estilo: EstiloProducao;
  error: unknown;
}) {
  trackApiUsage({
    userId: params.userId,
    organizationId: params.organizationId,
    eventType: "export",
    success: false,
  });

  trackFunnelEvent({
    userId: params.userId,
    organizationId: params.organizationId,
    event: "render_failed",
    success: false,
    metadata: {
      estilo: params.estilo,
      error: params.error instanceof Error ? params.error.message : String(params.error),
    },
  });

  await params.supabase
    .from("criativos")
    .update({ export_status: "erro" })
    .eq("id", params.criativoId);
}

/** Processamento em background via waitUntil (admin ou retry). */
export async function runBackgroundRenderForCriativoId(criativoId: string, userId?: string) {
  const { data: criativo, error } = await supabaseAdmin
    .from("criativos")
    .select("*")
    .eq("id", criativoId)
    .single();

  if (error || !criativo) throw new Error("Criativo não encontrado");

  const renderStart = Date.now();
  const estilo = (criativo.estilo_producao ?? "texto_animado") as EstiloProducao;

  try {
    await processCriativoRenderJob({
      supabase: supabaseAdmin,
      criativo: {
        id: criativo.id,
        roteiro: criativo.roteiro as RoteiroBloco[] | null,
        audio_paths: parseAudioPaths(criativo.audio_paths),
        background_media_path: criativo.background_media_path,
        utm_content: criativo.utm_content,
        estilo_producao: criativo.estilo_producao as EstiloProducao | null,
        angulo_json: criativo.angulo_json,
        produto: criativo.produto,
        score_json: parseScoreJson(criativo.score_json),
        organization_id: criativo.organization_id,
        voice_id: criativo.voice_id,
      },
      userId,
      renderStart,
    });
  } catch (e) {
    await failCriativoRenderJob({
      supabase: supabaseAdmin,
      criativoId,
      userId,
      organizationId: criativo.organization_id,
      estilo,
      error: e,
    });
    throw e;
  }
}

export async function createPendingRenderJob(criativoId: string, provider = "orchestrator") {
  return createRenderJob({ criativoId, provider });
}

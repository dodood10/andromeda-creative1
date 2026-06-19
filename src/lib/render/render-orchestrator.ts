import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EstiloProducao } from "@/lib/formato-recomendacao";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import type { AudioPaths, ScoreJson } from "@/lib/types/criativo-json";
import {
  extractRecomendacaoFromAnguloJson,
  resolveRenderPipeline,
  type ResolvedRender,
} from "@/lib/render/render-router";
import { callFfmpegRender } from "@/lib/render/render-ffmpeg";
import { executeBrollRender } from "@/lib/render/render-broll";
import { createRenderJob, updateRenderJob } from "@/lib/render/render-jobs";
import { estimateRenderCost } from "@/lib/render/render-cost";
import {
  actorFromRecomendacao,
  buildUgcScript,
  downloadAndStoreUgcVideo,
  generateUgcVideo,
} from "@/lib/video-providers/agent-media";

export type RenderOrchestratorResult = {
  paths: string[];
  devMode: boolean;
  resolved: ResolvedRender;
  message?: string;
};

const MINIMAL_MP4 = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAABBtZGF0AAAC",
  "base64",
);

async function uploadDevPlaceholder(
  supabase: SupabaseClient<Database>,
  criativoId: string,
) {
  const paths = [
    `exports/${criativoId}/${criativoId}-9x16.mp4`,
    `exports/${criativoId}/${criativoId}-4x5.mp4`,
  ];

  for (const p of paths) {
    await supabase.storage.from("criativos-media").upload(p, MINIMAL_MP4, {
      contentType: "video/mp4",
      upsert: true,
    });
  }
  return paths;
}

export async function executeCriativoRender(params: {
  supabase: SupabaseClient<Database>;
  criativo: {
    id: string;
    roteiro: RoteiroBloco[] | null;
    audio_paths: AudioPaths | null;
    background_media_path: string | null;
    utm_content: string | null;
    estilo_producao: EstiloProducao | null;
    angulo_json: unknown;
    produto: string;
    score_json: ScoreJson | null;
  };
  existingJobId?: string;
}): Promise<RenderOrchestratorResult> {
  const { supabase, criativo } = params;
  const roteiro = (criativo.roteiro as RoteiroBloco[]) ?? [];
  const utm = criativo.utm_content ?? criativo.id;
  const estilo = (criativo.estilo_producao ?? "texto_animado") as EstiloProducao;
  const rec = extractRecomendacaoFromAnguloJson(criativo.angulo_json);
  const angulo = criativo.angulo_json as { hook_visual?: string } | null;

  const resolved = resolveRenderPipeline(estilo, {
    requerMidiaUsuario: rec?.requer_midia_usuario,
    hookVisual: angulo?.hook_visual ?? rec?.justificativa,
  });

  const ffmpegConfigured = Boolean(
    process.env.FFMPEG_SERVICE_URL && process.env.FFMPEG_SERVICE_SECRET,
  );

  if (!ffmpegConfigured && process.env.NODE_ENV === "production" && resolved.pipeline !== "ugc_provider") {
    throw new Error(
      "FFMPEG_SERVICE_URL não configurado em produção — configure o microserviço antes de exportar.",
    );
  }

  if (!ffmpegConfigured && resolved.pipeline === "legado_ffmpeg") {
    const paths = await uploadDevPlaceholder(supabase, criativo.id);
    return {
      paths,
      devMode: true,
      resolved,
      message: "FFMPEG_SERVICE_URL não configurado — placeholders enviados ao storage",
    };
  }

  const provider =
    resolved.pipeline === "ugc_provider"
      ? "agent_media"
      : resolved.pipeline === "broll_ia"
        ? process.env.NANOBANANA_API_KEY
          ? "nanobanana"
          : "pexels_fallback"
        : "ffmpeg";

  const jobId =
    params.existingJobId ?? (await createRenderJob({ criativoId: criativo.id, provider }));

  const startedAt = Date.now();

  try {
    await updateRenderJob(jobId, {
      status: "running",
      progress: { step: "start", message: "Iniciando render…" },
    });

    let paths: string[];

    if (resolved.pipeline === "ugc_provider") {
      await updateRenderJob(jobId, {
        status: "running",
        progress: { step: "ugc", message: "Gerando vídeo UGC com avatar IA…" },
      });
      const script = buildUgcScript(roteiro);
      const { videoUrl } = await generateUgcVideo({
        script,
        actorSlug: actorFromRecomendacao(rec),
        aspectRatio: rec?.aspect_ratio_prioritario,
      });
      paths = await downloadAndStoreUgcVideo({
        videoUrl,
        supabase,
        criativoId: criativo.id,
      });
    } else if (resolved.pipeline === "broll_ia") {
      const result = await executeBrollRender({
        supabase,
        criativoId: criativo.id,
        roteiro,
        audioPaths: criativo.audio_paths,
        utm,
        hookVisual: angulo?.hook_visual,
        produto: criativo.produto,
        aspectRatio: rec?.aspect_ratio_prioritario,
        backgroundMediaPath: criativo.background_media_path,
        jobId,
        onProgress: (p) => void updateRenderJob(jobId, { status: "running", progress: p }),
      });
      paths = result.paths;
    } else {
      const result = await callFfmpegRender({
        criativoId: criativo.id,
        roteiro,
        audioPaths: criativo.audio_paths,
        backgroundMediaPath: criativo.background_media_path,
        utmContent: utm,
      });
      if (!result) {
        const devPaths = await uploadDevPlaceholder(supabase, criativo.id);
        await updateRenderJob(jobId, { status: "done", result_paths: devPaths });
        return {
          paths: devPaths,
          devMode: true,
          resolved,
          message: "FFMPEG indisponível",
        };
      }
      paths = result.paths;
    }

    await updateRenderJob(jobId, {
      status: "done",
      result_paths: paths,
      progress: { step: "done", message: "Export concluído" },
    });

    return { paths, devMode: false, resolved };
  } catch (e) {
    await updateRenderJob(jobId, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export function buildExportScorePatch(
  existingScore: ScoreJson | null,
  resolved: ResolvedRender,
): ScoreJson {
  const base: ScoreJson = { ...(existingScore ?? {}) };

  if (resolved.usedUgcProvider) {
    const next = { ...base };
    delete next.ugc_recommended;
    delete next.ugc_message;
    delete next.render_fallback;
    next.ugc_provider = "agent_media";
    return next;
  }

  if (!resolved.ugcRecommended) return base;

  return {
    ...base,
    ugc_recommended: true,
    render_fallback: resolved.renderFallbackEstilo ?? "texto_animado",
    ugc_message:
      "IA recomendou UGC depoimento. Render com clipes/texto — configure AGENT_MEDIA_API_KEY para avatar IA.",
  };
}

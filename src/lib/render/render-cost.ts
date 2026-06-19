import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import type { RenderPipeline } from "@/lib/render/render-router";

/**
 * Estimativa de custo (USD) de um render de vídeo.
 * Valores aproximados em referência a planos públicos de cada fornecedor.
 * Atualize aqui quando renegociar contratos/planos.
 */
export const RENDER_COST_TABLE = {
  ttsPerChar: 0.00018, // ElevenLabs Starter: ~$5/30k chars
  ffmpegPerRender: 0.003, // CPU ~10-30s em Cloud Run
  nanobananaPerClip: 0.1,
  pexelsPerClip: 0,
  agentMediaPerVideo: 0.8,
  storagePerVideo: 0.001,
} as const;

export type RenderCostBreakdown = {
  tts_usd: number;
  video_usd: number;
  ffmpeg_usd: number;
  storage_usd: number;
  total_usd: number;
  details: {
    pipeline: RenderPipeline;
    provider: string;
    blocos: number;
    chars: number;
    clips_generated?: number;
  };
};

export function estimateRenderCost(params: {
  pipeline: RenderPipeline;
  provider: string;
  roteiro: RoteiroBloco[];
  clipsGenerated?: number;
}): RenderCostBreakdown {
  const blocos = params.roteiro.length;
  const chars = params.roteiro.reduce((s, b) => s + (b.conteudo?.length ?? 0), 0);

  let tts = chars * RENDER_COST_TABLE.ttsPerChar;
  let video = 0;
  let ffmpeg = 0;

  if (params.pipeline === "ugc_provider") {
    // UGC já inclui voz no provedor
    tts = 0;
    video = RENDER_COST_TABLE.agentMediaPerVideo;
  } else if (params.pipeline === "broll_ia") {
    const clips = params.clipsGenerated ?? blocos;
    if (params.provider === "nanobanana") {
      video = clips * RENDER_COST_TABLE.nanobananaPerClip;
    } else {
      video = clips * RENDER_COST_TABLE.pexelsPerClip;
    }
    ffmpeg = RENDER_COST_TABLE.ffmpegPerRender;
  } else {
    ffmpeg = RENDER_COST_TABLE.ffmpegPerRender;
  }

  const storage = RENDER_COST_TABLE.storagePerVideo;
  const total = tts + video + ffmpeg + storage;

  return {
    tts_usd: round(tts),
    video_usd: round(video),
    ffmpeg_usd: round(ffmpeg),
    storage_usd: round(storage),
    total_usd: round(total),
    details: {
      pipeline: params.pipeline,
      provider: params.provider,
      blocos,
      chars,
      clips_generated: params.clipsGenerated,
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import { runWithConcurrency } from "@/lib/gerador-helpers";
import { buildBrollPrompts } from "@/lib/render/broll-prompts";
import { BUCKET, callFfmpegRender } from "@/lib/render/render-ffmpeg";
import { updateRenderJob, type RenderJobProgress } from "@/lib/render/render-jobs";
import {
  createNanoBananaImageToVideo,
  createNanoBananaTextToVideo,
  downloadVideoToBuffer,
  isNanoBananaConfigured,
  pollNanoBananaVideo,
} from "@/lib/video-providers/nanobanana";

async function fetchPexelsClipUrl(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as {
    videos?: Array<{
      video_files: Array<{ link: string; quality: string; width: number; height: number }>;
    }>;
  };

  const video = json.videos?.[0];
  if (!video) return null;
  const file =
    video.video_files.find((f) => f.quality === "hd" && f.height >= f.width) ??
    video.video_files[0];
  return file?.link ?? null;
}

async function uploadClip(
  supabase: SupabaseClient<Database>,
  criativoId: string,
  blocoIndex: number,
  buffer: ArrayBuffer,
) {
  const path = `clips/${criativoId}/bloco-${blocoIndex}.mp4`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

async function generateClipForBlock(params: {
  prompt: string;
  queryPexels: string;
  blocoIndex: number;
  aspectRatio?: string;
  productImageSignedUrl?: string | null;
}): Promise<ArrayBuffer> {
  if (isNanoBananaConfigured()) {
    try {
      const job = params.productImageSignedUrl
        ? await createNanoBananaImageToVideo({
            imageUrl: params.productImageSignedUrl,
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
          })
        : await createNanoBananaTextToVideo({
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
          });

      const url = job.videoUrl ?? (await pollNanoBananaVideo(job.videoId));
      return downloadVideoToBuffer(url);
    } catch {
      /* fallback pexels */
    }
  }

  const pexelsUrl = await fetchPexelsClipUrl(params.queryPexels);
  if (pexelsUrl) return downloadVideoToBuffer(pexelsUrl);

  throw new Error(`Não foi possível gerar clipe do bloco ${params.blocoIndex + 1}`);
}

export async function executeBrollRender(params: {
  supabase: SupabaseClient<Database>;
  criativoId: string;
  roteiro: RoteiroBloco[];
  audioPaths: unknown;
  utm: string;
  hookVisual?: string;
  produto?: string;
  aspectRatio?: string;
  backgroundMediaPath?: string | null;
  jobId: string;
  onProgress?: (p: RenderJobProgress) => void;
}): Promise<{ paths: string[] }> {
  const prompts = buildBrollPrompts({
    roteiro: params.roteiro,
    hookVisual: params.hookVisual,
    produto: params.produto,
    aspectRatio: params.aspectRatio,
  });

  let productImageSignedUrl: string | null = null;
  if (params.backgroundMediaPath) {
    const { data } = await params.supabase.storage
      .from(BUCKET)
      .createSignedUrl(params.backgroundMediaPath, 3600);
    productImageSignedUrl = data?.signedUrl ?? null;
  }

  const total = prompts.length;
  const clipPaths: string[] = new Array(total);

  const tasks = prompts.map((p) => async () => {
    const buffer = await generateClipForBlock({
      prompt: p.prompt,
      queryPexels: p.queryPexels,
      blocoIndex: p.blocoIndex,
      aspectRatio: params.aspectRatio,
      productImageSignedUrl,
    });
    const path = await uploadClip(params.supabase, params.criativoId, p.blocoIndex, buffer);
    clipPaths[p.blocoIndex] = path;

    const progress: RenderJobProgress = {
      step: "broll",
      current: clipPaths.filter(Boolean).length,
      total,
      message: `Gerando cena ${clipPaths.filter(Boolean).length}/${total}…`,
    };
    params.onProgress?.(progress);
    await updateRenderJob(params.jobId, { status: "running", progress });
  });

  await runWithConcurrency(tasks, 2);

  const orderedClips = clipPaths.filter(Boolean);
  if (orderedClips.length === 0) {
    throw new Error("Nenhum clipe gerado");
  }

  const result = await callFfmpegRender({
    criativoId: params.criativoId,
    roteiro: params.roteiro,
    audioPaths: params.audioPaths,
    clipPaths: orderedClips,
    utmContent: params.utm,
    endpoint: "render-clipes",
  });

  if (!result) {
    throw new Error("FFMPEG_SERVICE_URL não configurado");
  }

  return result;
}

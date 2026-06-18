import type { RecomendacaoFormato } from "@/lib/schemas/angulos.schema";
import { roteiroTextForUgc } from "@/lib/render/broll-prompts";

const API_BASE = "https://api.agent-media.ai/v1";

const AVATAR_MAP: Record<string, string> = {
  mulher_30: "sofia",
  mulher_35: "sofia",
  mulher_40: "sofia",
  homem_30: "marcus",
  homem_35: "marcus",
  empatica: "sofia",
  autoritativa: "marcus",
  casual: "sofia",
  default: "sofia",
};

export function isUgcProviderConfigured(): boolean {
  return Boolean(process.env.AGENT_MEDIA_API_KEY);
}

export function mapPerfilToActor(perfil?: string | null): string {
  if (!perfil) return AVATAR_MAP.default;
  const key = perfil.toLowerCase();
  for (const [pattern, actor] of Object.entries(AVATAR_MAP)) {
    if (key.includes(pattern)) return actor;
  }
  return AVATAR_MAP.default;
}

async function pollUgcJob(jobId: string, maxAttempts = 120): Promise<string> {
  const apiKey = process.env.AGENT_MEDIA_API_KEY!;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json()) as {
      status?: string;
      video_url?: string;
      url?: string;
      error?: string;
    };

    const url = data.video_url ?? data.url;
    if (url) return url;
    if (data.status === "failed" || data.status === "error") {
      throw new Error(data.error ?? "UGC provider falhou");
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("UGC provider timeout");
}

export async function generateUgcVideo(params: {
  script: string;
  actorSlug?: string;
  aspectRatio?: string;
}): Promise<{ videoUrl: string; jobId: string }> {
  const apiKey = process.env.AGENT_MEDIA_API_KEY;
  if (!apiKey) throw new Error("AGENT_MEDIA_API_KEY ausente");

  const res = await fetch(`${API_BASE}/generate/ugc_video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actor_slug: params.actorSlug ?? "sofia",
      script: params.script.slice(0, 4000),
      target_duration: Math.min(60, Math.max(10, Math.ceil(params.script.length / 20))),
      subtitle_style: "hormozi",
      aspect_ratio: params.aspectRatio === "4:5" ? "4:5" : "9:16",
    }),
  });

  const data = (await res.json()) as {
    job_id?: string;
    id?: string;
    video_url?: string;
    error?: string;
  };

  if (!res.ok) throw new Error(data.error ?? `UGC API ${res.status}`);

  if (data.video_url) {
    return { videoUrl: data.video_url, jobId: data.job_id ?? data.id ?? "sync" };
  }

  const jobId = data.job_id ?? data.id;
  if (!jobId) throw new Error("UGC API não retornou job_id");

  const videoUrl = await pollUgcJob(jobId);
  return { videoUrl, jobId };
}

export async function downloadAndStoreUgcVideo(params: {
  videoUrl: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
  criativoId: string;
}): Promise<string[]> {
  const res = await fetch(params.videoUrl);
  if (!res.ok) throw new Error(`Download UGC: ${res.status}`);
  const buffer = await res.arrayBuffer();

  const path9 = `exports/${params.criativoId}/${params.criativoId}-9x16.mp4`;
  const { error } = await params.supabase.storage
    .from("criativos-media")
    .upload(path9, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(error.message);

  return [path9];
}

export function buildUgcScript(
  roteiro: import("@/lib/schemas/angulos.schema").RoteiroBloco[],
): string {
  return roteiroTextForUgc(roteiro);
}

export function actorFromRecomendacao(rec: Partial<RecomendacaoFormato> | null): string {
  return mapPerfilToActor(rec?.perfil_avatar);
}

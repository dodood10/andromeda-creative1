const API_BASE = "https://nanobananavideo.com/api/v1";

export type NanoBananaAspect = "9:16" | "16:9" | "1:1" | "4:5";

function mapAspect(ratio?: string): NanoBananaAspect {
  if (ratio === "4:5") return "4:5";
  if (ratio === "1:1") return "1:1";
  if (ratio === "16:9") return "16:9";
  return "9:16";
}

export function isNanoBananaConfigured(): boolean {
  return Boolean(process.env.NANOBANANA_API_KEY);
}

export async function createNanoBananaTextToVideo(params: {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
}): Promise<{ videoId: string; videoUrl?: string }> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error("NANOBANANA_API_KEY ausente");

  const res = await fetch(`${API_BASE}/text-to-video.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: params.prompt,
      resolution: "1080p",
      duration: params.duration ?? 5,
      aspect_ratio: mapAspect(params.aspectRatio),
      video_model: "seedance2",
    }),
  });

  const data = (await res.json()) as {
    success?: boolean;
    video_id?: string;
    video_url?: string;
    error?: string;
  };

  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `NanoBanana ${res.status}`);
  }

  return { videoId: data.video_id!, videoUrl: data.video_url };
}

export async function createNanoBananaImageToVideo(params: {
  imageUrl: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
}): Promise<{ videoId: string; videoUrl?: string }> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error("NANOBANANA_API_KEY ausente");

  const res = await fetch(`${API_BASE}/image-to-video.php`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: params.imageUrl,
      prompt: params.prompt,
      resolution: "1080p",
      duration: params.duration ?? 5,
      aspect_ratio: mapAspect(params.aspectRatio),
      video_model: "seedance2",
    }),
  });

  const data = (await res.json()) as {
    success?: boolean;
    video_id?: string;
    video_url?: string;
    error?: string;
  };

  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `NanoBanana ${res.status}`);
  }

  return { videoId: data.video_id!, videoUrl: data.video_url };
}

export async function pollNanoBananaVideo(videoId: string, maxAttempts = 60): Promise<string> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error("NANOBANANA_API_KEY ausente");

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${API_BASE}/video-status.php?video_id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const data = (await res.json()) as {
      success?: boolean;
      status?: string;
      video_url?: string;
      error?: string;
    };

    if (data.video_url) return data.video_url;
    if (data.status === "failed") throw new Error(data.error ?? "NanoBanana falhou");

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("NanoBanana timeout aguardando vídeo");
}

export async function downloadVideoToBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download vídeo: ${res.status}`);
  return res.arrayBuffer();
}

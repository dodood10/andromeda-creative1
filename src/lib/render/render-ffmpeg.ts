import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";

const BUCKET = "criativos-media";

export async function callFfmpegRender(payload: {
  criativoId: string;
  roteiro: RoteiroBloco[];
  audioPaths: unknown;
  backgroundMediaPath?: string | null;
  clipPaths?: string[];
  utmContent: string;
  endpoint?: "render" | "render-clipes";
}) {
  const ffmpegUrl = process.env.FFMPEG_SERVICE_URL;
  const ffmpegSecret = process.env.FFMPEG_SERVICE_SECRET;
  if (!ffmpegUrl || !ffmpegSecret) {
    return null;
  }

  const path = payload.endpoint === "render-clipes" ? "/render-clipes" : "/render";
  const res = await fetch(`${ffmpegUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ffmpegSecret}`,
    },
    body: JSON.stringify({
      criativoId: payload.criativoId,
      roteiro: payload.roteiro,
      audioPaths: payload.audioPaths,
      backgroundMediaPath: payload.backgroundMediaPath,
      clipPaths: payload.clipPaths,
      utmContent: payload.utmContent,
    }),
  });

  if (!res.ok) {
    throw new Error(`FFmpeg service: ${res.status}`);
  }

  return (await res.json()) as { paths: string[] };
}

export { BUCKET };

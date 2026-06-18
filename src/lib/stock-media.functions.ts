import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SearchSchema = z.object({
  query: z.string().min(2).max(80),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  perPage: z.number().int().min(1).max(12).default(6),
});

type PexelsPhoto = {
  id: number;
  photographer: string;
  src: { medium: string; large2x: string; original: string };
  alt: string;
};

type PexelsVideo = {
  id: number;
  user: { name: string };
  video_files: Array<{ link: string; quality: string; width: number; height: number }>;
  image: string;
};

export const searchPexelsMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return { configured: false as const, photos: [], videos: [] };
    }

    const headers = { Authorization: apiKey };
    const q = encodeURIComponent(data.query);
    const orient = data.orientation;

    const [photoRes, videoRes] = await Promise.all([
      fetch(
        `https://api.pexels.com/v1/search?query=${q}&orientation=${orient}&per_page=${data.perPage}`,
        { headers },
      ),
      fetch(
        `https://api.pexels.com/videos/search?query=${q}&orientation=${orient}&per_page=${Math.min(data.perPage, 6)}`,
        { headers },
      ),
    ]);

    const photosJson = photoRes.ok ? ((await photoRes.json()) as { photos?: PexelsPhoto[] }) : {};
    const videosJson = videoRes.ok ? ((await videoRes.json()) as { videos?: PexelsVideo[] }) : {};

    return {
      configured: true as const,
      photos: (photosJson.photos ?? []).map((p) => ({
        id: String(p.id),
        type: "image" as const,
        previewUrl: p.src.medium,
        downloadUrl: p.src.large2x || p.src.original,
        attribution: p.photographer,
        alt: p.alt || data.query,
      })),
      videos: (videosJson.videos ?? []).map((v) => {
        const file =
          v.video_files.find((f) => f.quality === "hd" && f.height >= f.width) ??
          v.video_files[0];
        return {
          id: String(v.id),
          type: "video" as const,
          previewUrl: v.image,
          downloadUrl: file?.link ?? "",
          attribution: v.user.name,
          alt: data.query,
        };
      }),
    };
  });

export const downloadPexelsToStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      downloadUrl: z.string().url(),
      projectId: z.string().uuid(),
      filename: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const res = await fetch(data.downloadUrl);
    if (!res.ok) throw new Error("Falha ao baixar mídia do Pexels");

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();
    const path = `${userId}/${data.projectId}/pexels-${Date.now()}-${data.filename}`;

    const { error } = await supabaseAdmin.storage
      .from("criativos-media")
      .upload(path, buffer, { contentType, upsert: false });

    if (error) throw new Error(error.message);
    return { path };
  });

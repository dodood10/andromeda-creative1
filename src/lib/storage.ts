import { supabase } from "@/integrations/supabase/client";

const BUCKET = "criativos-media";
const MAX_FILE_BYTES = 104_857_600;

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateUploadFile(file: File): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo excede o limite de 100MB");
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Tipo de arquivo não permitido: ${mime || "desconhecido"}`);
  }
}

export function buildMediaPath(userId: string, projectId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${projectId}/${Date.now()}-${safe}`;
}

export async function uploadCriativoMedia(
  userId: string,
  file: File,
  projectId?: string,
): Promise<{ path: string; publicUrl: string | null }> {
  validateUploadFile(file);

  const path = projectId
    ? buildMediaPath(userId, projectId, file.name)
    : `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function getSignedMediaUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

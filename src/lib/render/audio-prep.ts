import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";

const BUCKET = "criativos-media";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

async function uploadAudioBlock(
  supabase: SupabaseClient<Database>,
  criativoId: string,
  blocoIndex: number,
  buffer: ArrayBuffer,
) {
  const path = `audio/${criativoId}/bloco-${blocoIndex}.mp3`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

function hasAudioPaths(audioPaths: unknown): boolean {
  if (!audioPaths || typeof audioPaths !== "object") return false;
  return Object.keys(audioPaths as Record<string, string>).length > 0;
}

/** Gera narração ElevenLabs para todos os blocos se ainda não existir áudio. */
export async function ensureCriativoAudio(params: {
  supabase: SupabaseClient<Database>;
  criativoId: string;
  roteiro: RoteiroBloco[];
  voiceId?: string | null;
  userId?: string;
  organizationId?: string | null;
}): Promise<{ audioPaths: Record<string, string>; generated: boolean }> {
  const { supabase, criativoId, roteiro } = params;

  const { data: row } = await supabase
    .from("criativos")
    .select("audio_paths, voice_id")
    .eq("id", criativoId)
    .single();

  const existing = (row?.audio_paths as Record<string, string>) ?? {};
  if (hasAudioPaths(existing)) {
    return { audioPaths: existing, generated: false };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { audioPaths: existing, generated: false };
  }

  const voiceId = params.voiceId ?? row?.voice_id ?? DEFAULT_VOICE_ID;
  const audioPaths: Record<string, string> = {};
  let gerados = 0;

  for (let i = 0; i < roteiro.length; i++) {
    const texto = roteiro[i]?.conteudo?.trim();
    if (!texto) continue;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" }),
    });

    if (!res.ok) continue;

    const buffer = await res.arrayBuffer();
    const path = await uploadAudioBlock(supabase, criativoId, i, buffer);
    audioPaths[String(i)] = path;
    gerados++;
  }

  if (gerados > 0) {
    await supabase
      .from("criativos")
      .update({ audio_paths: audioPaths, voice_id: voiceId })
      .eq("id", criativoId);
  }

  return { audioPaths, generated: gerados > 0 };
}

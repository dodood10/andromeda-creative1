import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import type { AudioPaths } from "@/lib/types/criativo-json";
import { parseAudioPaths } from "@/lib/types/criativo-json";
import { suggestVoiceForTom, DEFAULT_VOICE_ID } from "@/lib/voice-suggestion";
import type { TomCalibracao } from "@/lib/types/enums";

const BUCKET = "criativos-media";

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

function hasAudioPaths(audioPaths: AudioPaths | null | undefined): boolean {
  return Boolean(audioPaths && Object.keys(audioPaths).length > 0);
}

/** Gera narração ElevenLabs para todos os blocos se ainda não existir áudio. */
export async function ensureCriativoAudio(params: {
  supabase: SupabaseClient<Database>;
  criativoId: string;
  roteiro: RoteiroBloco[];
  voiceId?: string | null;
  userId?: string;
  organizationId?: string | null;
}): Promise<{ audioPaths: AudioPaths; generated: boolean }> {
  const { supabase, criativoId, roteiro } = params;

  const { data: row } = await supabase
    .from("criativos")
    .select("audio_paths, voice_id")
    .eq("id", criativoId)
    .single();

  const existing = parseAudioPaths(row?.audio_paths);
  if (hasAudioPaths(existing)) {
    return { audioPaths: existing, generated: false };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { audioPaths: existing, generated: false };
  }

  const voiceId = params.voiceId ?? row?.voice_id ?? DEFAULT_VOICE_ID;
  const audioPaths: AudioPaths = {};
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

/** Define voz sugerida e gera áudio do hook (bloco 0) ao criar rascunho. */
export async function bootstrapDraftHookAudio(params: {
  supabase: SupabaseClient<Database>;
  criativoId: string;
  roteiro: RoteiroBloco[];
  tomCalibracao?: TomCalibracao | string;
}): Promise<{ voiceId: string; hookGenerated: boolean }> {
  const voiceId = suggestVoiceForTom(params.tomCalibracao);
  await params.supabase
    .from("criativos")
    .update({ voice_id: voiceId })
    .eq("id", params.criativoId);

  const hookText = params.roteiro[0]?.conteudo?.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !hookText) {
    return { voiceId, hookGenerated: false };
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: hookText, model_id: "eleven_multilingual_v2" }),
  });

  if (!res.ok) return { voiceId, hookGenerated: false };

  const buffer = await res.arrayBuffer();
  const path = await uploadAudioBlock(params.supabase, params.criativoId, 0, buffer);
  await params.supabase
    .from("criativos")
    .update({ audio_paths: { "0": path }, voice_id: voiceId })
    .eq("id", params.criativoId);

  return { voiceId, hookGenerated: true };
}

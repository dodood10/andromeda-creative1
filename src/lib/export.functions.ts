import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RoteiroBloco } from "./schemas/angulos.schema";
import {
  computeHookDimensionScore,
  computeLeilaoScore,
  type SinaisAndromeda,
} from "./score-sinais";

const BUCKET = "criativos-media";

const VOZES_PTBR = [
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (masculina)" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella (feminina)" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold (autoritativa)" },
  { id: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy (empática)" },
];

export const listVozes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": apiKey },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            voices: Array<{ voice_id: string; name: string; labels?: { language?: string } }>;
          };
          const pt = data.voices.filter(
            (v) =>
              v.labels?.language?.toLowerCase().includes("pt") ||
              VOZES_PTBR.some((f) => f.id === v.voice_id),
          );
          if (pt.length > 0) {
            return pt.map((v) => ({ id: v.voice_id, label: v.name }));
          }
        }
      } catch {
        /* fallback */
      }
    }
    return VOZES_PTBR;
  });

async function uploadAudioBlock(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
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

export const gerarAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      texto: z.string().min(1),
      voiceId: z.string().min(1),
      blocoIndex: z.number().int().min(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const { supabase } = context;

    if (!apiKey) {
      return { audioUrl: null, devMode: true, message: "ELEVENLABS_API_KEY ausente — prévia em modo texto" };
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: data.texto,
          model_id: "eleven_multilingual_v2",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${err}`);
    }

    const buffer = await res.arrayBuffer();
    const path = await uploadAudioBlock(supabase, data.criativoId, data.blocoIndex, buffer);

    const { data: criativo } = await supabase
      .from("criativos")
      .select("audio_paths")
      .eq("id", data.criativoId)
      .single();

    const audioPaths = (criativo?.audio_paths as Record<string, string>) ?? {};
    audioPaths[String(data.blocoIndex)] = path;

    await supabase
      .from("criativos")
      .update({ audio_paths: audioPaths, voice_id: data.voiceId })
      .eq("id", data.criativoId);

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    return { audioUrl: signed?.signedUrl ?? null, path, devMode: false };
  });

export const gerarAudioRoteiroCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      voiceId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const { supabase } = context;

    if (!apiKey) {
      return { gerados: 0, devMode: true, message: "ELEVENLABS_API_KEY ausente" };
    }

    const { data: criativo, error } = await supabase
      .from("criativos")
      .select("roteiro")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const roteiro = (criativo.roteiro as RoteiroBloco[]) ?? [];
    const audioPaths: Record<string, string> = {};
    let gerados = 0;

    for (let i = 0; i < roteiro.length; i++) {
      const texto = roteiro[i]?.conteudo?.trim();
      if (!texto) continue;

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" }),
        },
      );

      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      const path = await uploadAudioBlock(supabase, data.criativoId, i, buffer);
      audioPaths[String(i)] = path;
      gerados++;
    }

    await supabase
      .from("criativos")
      .update({ audio_paths: audioPaths, voice_id: data.voiceId })
      .eq("id", data.criativoId);

    return { gerados, devMode: false };
  });

const CLAIMS_PROIBIDOS = [
  /cura\s+(garantida|definitiva)/i,
  /100%\s*(garantido|eficaz)/i,
  /sem\s+efeitos?\s+colaterais/i,
  /aprovado\s+pela\s+anvisa/i,
  /ganhe\s+dinheiro\s+enquanto\s+dorme/i,
];

export type ScoreDimensao = {
  id: string;
  label: string;
  score: number;
  minimo: number;
  ok: boolean;
  dica?: string;
};

function computeSafeZonesScore(roteiro: RoteiroBloco[]) {
  if (roteiro.length === 0) return 40;
  let score = 70;
  const hook = roteiro[0];
  if (!hook?.conteudo?.trim()) score -= 25;
  else if (hook.conteudo.length > 120) score -= 15;
  const longBlocks = roteiro.filter((b) => (b.conteudo?.length ?? 0) > 180).length;
  score -= longBlocks * 10;
  const cta = roteiro[roteiro.length - 1];
  if (cta && (cta.conteudo?.length ?? 0) > 100) score -= 10;
  return Math.max(30, Math.min(100, score));
}

export const avaliarCriativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativo, error } = await supabase
      .from("criativos")
      .select("*, angulo_json")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const roteiro = (criativo.roteiro as RoteiroBloco[]) ?? [];
    const textoCompleto = roteiro.map((b) => b.conteudo).join(" ");
    const angulo = criativo.angulo_json as {
      sinais_andromeda?: SinaisAndromeda;
      hook?: string;
    } | null;

    const sinais = angulo?.sinais_andromeda;
    const { score: hookScore, dica: hookDica } = computeHookDimensionScore(sinais);
    const leilaoScore = computeLeilaoScore(sinais);

    const complianceIssues = CLAIMS_PROIBIDOS.filter((r) => r.test(textoCompleto));
    const complianceScore =
      complianceIssues.length === 0 ? 95 : Math.max(20, 95 - complianceIssues.length * 25);

    const temCta = /compre|garanta|acesse|clique|link|saiba mais/i.test(textoCompleto);
    const temProva = /\d+[\d.,]*|pessoas|clientes|resultado/i.test(textoCompleto);
    const temMecanismo = roteiro.length >= 3;
    const elementosScore = [temCta, temProva, temMecanismo].filter(Boolean).length * 33;

    const safeZonesScore = computeSafeZonesScore(roteiro);

    const { data: similares } = await supabase
      .from("criativos")
      .select("angulo")
      .eq("project_id", criativo.project_id!)
      .neq("id", criativo.id);

    const mesmoAngulo = (similares ?? []).filter((s) => s.angulo === criativo.angulo).length;
    const diversidadeFromAngulo = Math.max(40, 100 - mesmoAngulo * 15);
    const diversidadeScore = Math.round((diversidadeFromAngulo + leilaoScore) / 2);

    const dimensoes: ScoreDimensao[] = [
      { id: "hook", label: "Hook rate esperado", score: hookScore, minimo: 70, ok: hookScore >= 70, dica: hookDica },
      {
        id: "compliance",
        label: "Compliance Meta",
        score: complianceScore,
        minimo: 80,
        ok: complianceScore >= 80,
        dica: complianceIssues.length ? "Remova claims proibidas do roteiro" : undefined,
      },
      {
        id: "elementos",
        label: "Elementos obrigatórios",
        score: elementosScore,
        minimo: 80,
        ok: elementosScore >= 80,
        dica: !temCta ? "Adicione CTA claro" : undefined,
      },
      {
        id: "safezones",
        label: "Safe zones",
        score: safeZonesScore,
        minimo: 70,
        ok: safeZonesScore >= 70,
        dica: safeZonesScore < 70 ? "Encurte textos longos no hook ou CTA" : undefined,
      },
      {
        id: "diversidade",
        label: "Diversidade criativa",
        score: diversidadeScore,
        minimo: 60,
        ok: diversidadeScore >= 60,
        dica:
          diversidadeScore < 60
            ? sinais?.fatia_leilao
              ? `Fatia de leilão: ${sinais.fatia_leilao} — diversifique ângulos.`
              : "Muitos criativos com o mesmo ângulo neste projeto."
            : undefined,
      },
    ];

    const podeExportar = dimensoes.every((d) => d.ok);
    const scoreJson = { dimensoes, podeExportar, avaliadoEm: new Date().toISOString() };

    await supabase.from("criativos").update({ score_json: scoreJson }).eq("id", data.criativoId);

    return scoreJson;
  });

export const getExportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("criativos")
      .select("export_status, export_paths, utm_content, score_json")
      .eq("id", data.criativoId)
      .single();

    if (error || !row) throw new Error("Criativo não encontrado");
    const score = row.score_json as { exportDevMode?: boolean } | null;
    return {
      status: row.export_status ?? "rascunho",
      paths: (row.export_paths as string[]) ?? [],
      utm: row.utm_content,
      devMode: score?.exportDevMode === true,
    };
  });

export const getMediaCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ffmpegConfigured: Boolean(process.env.FFMPEG_SERVICE_URL && process.env.FFMPEG_SERVICE_SECRET),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
  }));

export const getSignedExportUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ paths: z.array(z.string().min(1)) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const urls: Record<string, string> = {};

    for (const p of data.paths) {
      const { data: signed, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(p, 3600);
      if (!error && signed?.signedUrl) urls[p] = signed.signedUrl;
    }

    return { urls };
  });

export const getSignedAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ path: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

/** Minimal valid MP4 (ftyp+moov) for dev placeholder exports */
const MINIMAL_MP4 = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAABBtZGF0AAAC",
  "base64",
);

async function uploadDevPlaceholder(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  criativoId: string,
) {
  const paths = [
    `exports/${criativoId}/${criativoId}-9x16.mp4`,
    `exports/${criativoId}/${criativoId}-4x5.mp4`,
  ];

  for (const p of paths) {
    await supabase.storage.from(BUCKET).upload(p, MINIMAL_MP4, {
      contentType: "video/mp4",
      upsert: true,
    });
  }
  return paths;
}

export const solicitarExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativo, error } = await supabase
      .from("criativos")
      .select("*")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const score = criativo.score_json as { podeExportar?: boolean } | null;
    if (score && score.podeExportar === false) {
      throw new Error("Score abaixo do mínimo — corrija os alertas antes de exportar");
    }

    await supabase
      .from("criativos")
      .update({ export_status: "renderizando" })
      .eq("id", data.criativoId);

    const roteiro = criativo.roteiro as RoteiroBloco[];
    const utm = criativo.utm_content ?? criativo.id;
    const ffmpegUrl = process.env.FFMPEG_SERVICE_URL;
    const ffmpegSecret = process.env.FFMPEG_SERVICE_SECRET;

    try {
      if (ffmpegUrl && ffmpegSecret) {
        const res = await fetch(`${ffmpegUrl}/render`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ffmpegSecret}`,
          },
          body: JSON.stringify({
            criativoId: criativo.id,
            roteiro,
            audioPaths: criativo.audio_paths,
            backgroundMediaPath: criativo.background_media_path,
            utmContent: utm,
          }),
        });

        if (!res.ok) {
          throw new Error(`FFmpeg service: ${res.status}`);
        }

        const result = (await res.json()) as { paths: string[] };
        await supabase
          .from("criativos")
          .update({
            export_status: "pronto",
            export_paths: result.paths,
            storage_path: result.paths[0] ?? null,
          })
          .eq("id", data.criativoId);

        return { status: "pronto", paths: result.paths, utm, devMode: false };
      }

      const devPaths = await uploadDevPlaceholder(supabase, criativo.id);
      const existingScore = (criativo.score_json as Record<string, unknown>) ?? {};

      await supabase
        .from("criativos")
        .update({
          export_status: "pronto",
          export_paths: devPaths,
          storage_path: devPaths[0],
          score_json: {
            ...existingScore,
            exportDevMode: true,
            exportDevMessage:
              "FFMPEG_SERVICE_URL não configurado — arquivos MP4 são placeholders, não use no Meta.",
          },
        })
        .eq("id", data.criativoId);

      return {
        status: "pronto",
        paths: devPaths,
        utm,
        devMode: true,
        message: "FFMPEG_SERVICE_URL não configurado — placeholders enviados ao storage",
      };
    } catch (e) {
      await supabase
        .from("criativos")
        .update({ export_status: "erro" })
        .eq("id", data.criativoId);
      throw e;
    }
  });

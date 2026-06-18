import type { RoteiroBloco } from "./schemas/angulos.schema";
import type { ExportTranscricaoBloco, ExportTranscricaoSnapshot } from "./export-transcription";
import { buildExportTranscriptionSnapshot } from "./export-transcription";
import { callFfmpegTranscribe } from "./render/render-ffmpeg";
import { buildVslBlockTimings } from "./vsl-duration";
import { isVslRoteiro } from "./vsl-roteiro";

export type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

function parseBlockTimeRange(tempo: string, index: number, total: number): { start: number; end: number } {
  const nums = tempo.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) return { start: nums[0], end: nums[1] };
  if (nums.length === 1) return { start: 0, end: nums[0] };
  return { start: index * 10, end: (index + 1) * 10 };
}

function resolveBlockRanges(roteiro: RoteiroBloco[]): Array<{ start: number; end: number }> {
  if (isVslRoteiro(roteiro)) {
    const lastEnd = roteiro.reduce((max, b, i) => {
      const r = parseBlockTimeRange(b.tempo, i, roteiro.length);
      return Math.max(max, r.end);
    }, 120);
    const timings = buildVslBlockTimings(lastEnd);
    return timings.map((t) => ({ start: t.startSec, end: t.endSec }));
  }
  return roteiro.map((b, i) => parseBlockTimeRange(b.tempo, i, roteiro.length));
}

export function mapWhisperSegmentsToBlocos(
  segments: WhisperSegment[],
  roteiro: RoteiroBloco[],
): ExportTranscricaoBloco[] {
  if (!segments.length) return [];

  const ranges = resolveBlockRanges(roteiro);
  const totalDuration = Math.max(
    segments[segments.length - 1]?.end ?? 0,
    ranges[ranges.length - 1]?.end ?? 0,
  );

  const blocos: ExportTranscricaoBloco[] = [];

  for (let i = 0; i < Math.max(roteiro.length, ranges.length); i++) {
    const roteiroBlock = roteiro[i];
    const range = ranges[i] ?? {
      start: (totalDuration / roteiro.length) * i,
      end: (totalDuration / roteiro.length) * (i + 1),
    };
    const texts = segments
      .filter((s) => s.start < range.end && s.end > range.start)
      .map((s) => s.text.trim())
      .filter(Boolean);
    const conteudo = texts.join(" ").trim() || roteiroBlock?.conteudo || "";
    blocos.push({
      tempo: roteiroBlock?.tempo ?? `${range.start}-${range.end}s`,
      conteudo,
      tipo: roteiroBlock?.tipo,
      hook_visual: roteiroBlock?.hook_visual,
    });
  }

  return blocos;
}

export function buildWhisperTranscriptionSnapshot(params: {
  segments: WhisperSegment[];
  roteiro: RoteiroBloco[];
  durationSec?: number;
  language?: string;
}): ExportTranscricaoSnapshot {
  const blocos = mapWhisperSegmentsToBlocos(params.segments, params.roteiro);
  const duration =
    params.durationSec ??
    (params.segments.length ? params.segments[params.segments.length - 1].end : undefined);

  return {
    blocos,
    exported_at: new Date().toISOString(),
    source: "whisper",
    total_blocos: blocos.length,
    duracao_estimada_seg: duration ? Math.round(duration) : undefined,
    whisper_language: params.language,
  };
}

/** Transcreve MP4 exportado via FFmpeg + Whisper; retorna null se serviço indisponível. */
export async function transcribeExportFromStorage(params: {
  criativoId: string;
  storagePath: string;
  roteiro: RoteiroBloco[];
}): Promise<ExportTranscricaoSnapshot | null> {
  const whisper = await callFfmpegTranscribe({
    criativoId: params.criativoId,
    storagePath: params.storagePath,
  });
  if (!whisper?.segments?.length) return null;

  return buildWhisperTranscriptionSnapshot({
    segments: whisper.segments,
    roteiro: params.roteiro,
    durationSec: whisper.duration,
    language: whisper.language,
  });
}

/** Garante transcrição do export: Whisper > snapshot do roteiro. */
export async function ensureExportTranscription(params: {
  criativoId: string;
  roteiro: RoteiroBloco[];
  exportPaths: string[];
  existing?: ExportTranscricaoSnapshot | null;
  forceWhisper?: boolean;
}): Promise<ExportTranscricaoSnapshot> {
  const { criativoId, roteiro, exportPaths, existing, forceWhisper } = params;
  const primaryPath = exportPaths[0];

  if (
    primaryPath &&
    (forceWhisper || !existing?.blocos?.length || existing.source !== "whisper")
  ) {
    try {
      const whisperSnap = await transcribeExportFromStorage({
        criativoId,
        storagePath: primaryPath,
        roteiro,
      });
      if (whisperSnap?.blocos.length) return whisperSnap;
    } catch (e) {
      console.warn("[transcribe-export] Whisper falhou, usando snapshot:", e);
    }
  }

  if (existing?.blocos?.length) return existing;
  return buildExportTranscriptionSnapshot(roteiro);
}

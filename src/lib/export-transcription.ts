import type { RoteiroBloco } from "./schemas/angulos.schema";

export type ExportTranscricaoBloco = {
  tempo: string;
  conteudo: string;
  tipo?: string;
  hook_visual?: string;
};

export type ExportTranscricaoSnapshot = {
  blocos: ExportTranscricaoBloco[];
  exported_at: string;
  source: "export_snapshot" | "whisper";
  total_blocos: number;
  duracao_estimada_seg?: number;
  whisper_language?: string;
};

export function roteiroToTranscricaoBlocos(roteiro: RoteiroBloco[]): ExportTranscricaoBloco[] {
  return roteiro.map((b) => ({
    tempo: b.tempo,
    conteudo: b.conteudo,
    tipo: b.tipo,
    hook_visual: b.hook_visual,
  }));
}

export function buildExportTranscriptionSnapshot(roteiro: RoteiroBloco[]): ExportTranscricaoSnapshot {
  const blocos = roteiroToTranscricaoBlocos(roteiro);
  return {
    blocos,
    exported_at: new Date().toISOString(),
    source: "export_snapshot",
    total_blocos: blocos.length,
    duracao_estimada_seg: estimateDurationFromRoteiro(roteiro),
  };
}

function estimateDurationFromRoteiro(roteiro: RoteiroBloco[]): number | undefined {
  const last = roteiro[roteiro.length - 1]?.tempo ?? "";
  const nums = last.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) return Math.max(nums[0], nums[1]);
  if (nums.length === 1) return nums[0];
  return undefined;
}

type CriativoLike = {
  roteiro?: RoteiroBloco[] | null;
  angulo_json?: unknown;
  export_status?: string | null;
  export_paths?: unknown;
};

export function getExportTranscriptionForAnalysis(criativo: CriativoLike): {
  blocos: ExportTranscricaoBloco[];
  sourceLabel: string;
  exportedAt?: string;
} {
  const aj = (criativo.angulo_json as { export_transcricao?: ExportTranscricaoSnapshot } | null) ?? {};
  const snapshot = aj.export_transcricao;
  const hasExport = criativo.export_status === "pronto" && Array.isArray(criativo.export_paths) && criativo.export_paths.length > 0;

  if (snapshot?.blocos?.length) {
    const whisperNote =
      snapshot.source === "whisper"
        ? "TRANSCRIÇÃO WHISPER DO ÁUDIO REAL DO MP4 EXPORTADO (fonte primária — o que realmente foi falado)"
        : hasExport
          ? "TRANSCRIÇÃO DO EXPORT (snapshot gravado no MP4 exportado — fonte primária)"
          : "TRANSCRIÇÃO DO ROTEIRO NO MOMENTO DO EXPORT (fonte primária)";
    return {
      blocos: snapshot.blocos,
      sourceLabel: whisperNote,
      exportedAt: snapshot.exported_at,
    };
  }

  const roteiro = (criativo.roteiro as RoteiroBloco[]) ?? [];
  return {
    blocos: roteiroToTranscricaoBlocos(roteiro),
    sourceLabel: hasExport
      ? "ROTEIRO ATUAL (export existe — transcrição snapshot ausente; use como aproximação do que rodou)"
      : "ROTEIRO DO RASCUNHO (sem export — ainda não reflete o que rodou no Meta)",
  };
}

export function formatTranscriptionForPrompt(criativo: CriativoLike): string {
  const { blocos, sourceLabel, exportedAt } = getExportTranscriptionForAnalysis(criativo);
  const lines = [
    sourceLabel,
    exportedAt ? `Exportado em: ${exportedAt}` : "",
    JSON.stringify(blocos, null, 2),
    "Priorize esta transcrição sobre o roteiro JSON bruto se houver divergência de copy editada pós-export.",
  ].filter(Boolean);
  return lines.join("\n");
}

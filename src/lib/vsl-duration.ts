/** Proporções padrão dos 6 blocos VSL (base 120s). */
const VSL_BLOCK_RATIOS = [15, 15, 30, 30, 20, 10] as const;
const VSL_BLOCK_TYPES = ["hook_duplo", "dor", "mecanismo", "prova", "objecoes", "cta"] as const;
const VSL_BLOCK_LABELS = [
  "Hook duplo",
  "Agitação da dor",
  "Mecanismo único",
  "Prova",
  "Quebra de objeções",
  "CTA com valor",
] as const;

export type VslBlockTiming = {
  tempo: string;
  tipo: (typeof VSL_BLOCK_TYPES)[number];
  label: string;
  startSec: number;
  endSec: number;
  durationSec: number;
};

export function resolveVslTargetDurationSec(angulo: {
  recomendacao_formato?: { duracao_alvo_seg?: number };
}): number {
  const raw = angulo.recomendacao_formato?.duracao_alvo_seg;
  if (typeof raw === "number" && raw >= 60 && raw <= 120) return raw;
  return 120;
}

/** Gera timings proporcionais para VSL (60–120s). */
export function buildVslBlockTimings(totalSec: number): VslBlockTiming[] {
  const clamped = Math.max(60, Math.min(120, Math.round(totalSec)));
  const rawDurations = VSL_BLOCK_RATIOS.map((ratio) =>
    Math.max(6, Math.round((ratio / 120) * clamped)),
  );
  const sum = rawDurations.reduce((a, b) => a + b, 0);
  const diff = clamped - sum;
  if (diff !== 0) rawDurations[rawDurations.length - 1] += diff;

  let cursor = 0;
  return VSL_BLOCK_TYPES.map((tipo, i) => {
    const durationSec = rawDurations[i] ?? 10;
    const startSec = cursor;
    const endSec = startSec + durationSec;
    cursor = endSec;
    return {
      tempo: `${startSec}-${endSec}s`,
      tipo,
      label: VSL_BLOCK_LABELS[i] ?? tipo,
      startSec,
      endSec,
      durationSec,
    };
  });
}

export function getVslBlocksPreview(totalSec = 120): Array<{ tempo: string; label: string }> {
  return buildVslBlockTimings(totalSec).map((b) => ({
    tempo: formatTempoLabel(b.startSec, b.endSec),
    label: b.label,
  }));
}

function formatTempoLabel(start: number, end: number): string {
  const fmt = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}min${r}s` : `${m}min`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

export function formatVslDurationPrompt(totalSec: number): string {
  const blocks = buildVslBlockTimings(totalSec);
  return blocks
    .map((b) => `- ${b.label}: ${b.tempo} (${b.durationSec}s)`)
    .join("\n");
}

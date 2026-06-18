import type { ExportTranscricaoSnapshot } from "./export-transcription";

const CONVERSION_METRICS = new Set(["hook_rate", "roas", "cpa", "conversoes", "gasto"]);

export function hasWhisperTranscriptionFromAnguloJson(anguloJson: unknown): boolean {
  if (!anguloJson || typeof anguloJson !== "object") return false;
  const raw = (anguloJson as { export_transcricao?: unknown }).export_transcricao;
  if (typeof raw === "string") return Boolean(raw.trim());
  if (!raw || typeof raw !== "object") return false;
  const snap = raw as ExportTranscricaoSnapshot;
  if (snap.source === "whisper" || snap.source === "paste") return true;
  return Array.isArray(snap.blocos) && snap.blocos.length > 0;
}

export type QueuePriorityInput = {
  kind: "performando" | "resultado";
  observacao?: string | null;
  metrica?: string | null;
  source?: string | null;
  hasWhisperTranscription?: boolean;
};

export function computeQueuePriorityScore(input: QueuePriorityInput): number {
  let score = 0;
  const obs = input.observacao ?? "";

  if (obs.includes("Import CSV") && obs.toLowerCase().includes("utm")) {
    score += 10;
  } else if (obs.includes("Import CSV")) {
    score += 6;
  }

  if (input.metrica && CONVERSION_METRICS.has(input.metrica)) {
    score += 8;
  }

  if (input.kind === "resultado" && obs.includes("Import biblioteca")) {
    score += 4;
  }

  if (input.source === "importado" && input.hasWhisperTranscription) {
    score += 5;
  }

  return score;
}

export function priorityLabelFromScore(score: number): "Alta (CSV/UTM)" | "Média" | "Baixa" {
  if (score >= 10) return "Alta (CSV/UTM)";
  if (score >= 5) return "Média";
  return "Baixa";
}

export function priorityHintForUser(score: number): string {
  if (score >= 10) {
    return "Prioridade alta na fila — evidência CSV/UTM anexada.";
  }
  if (score >= 5) {
    return "Prioridade média — importe CSV do Meta com utm_content para acelerar.";
  }
  return "Prioridade baixa — reporte métricas e importe CSV do Ads Manager para validação mais rápida.";
}

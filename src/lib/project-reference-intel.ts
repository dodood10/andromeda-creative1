import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectIntelSettings } from "./sinais-calibration";
import type { ReferenceTranscriptionAnalysis } from "./reference-transcription-analyze";

export type ReferenceTranscription = {
  id: string;
  text: string;
  added_at: string;
  label?: string;
  analysis?: ReferenceTranscriptionAnalysis;
};

export type ReferenceCombo = {
  structure_id?: string;
  formato_id?: string;
  angulo_id?: string;
  updated_at?: string;
};

const MAX_ENTRIES = 20;
const MAX_TEXT_CHARS = 12_000;
const MIN_TEXT_CHARS = 40;

export function capReferenceTranscriptions(list: ReferenceTranscription[]): ReferenceTranscription[] {
  return list.slice(-MAX_ENTRIES);
}

export function mergeReferenceTranscription(
  settings: ProjectIntelSettings | null | undefined,
  entry: ReferenceTranscription,
): ProjectIntelSettings {
  const existing = settings ?? {};
  const list = capReferenceTranscriptions([...(existing.reference_transcriptions ?? []), entry]);
  return { ...existing, reference_transcriptions: list };
}

function formatEntryExcerpt(r: ReferenceTranscription, maxChars: number): string {
  if (r.analysis) {
    const parts = [
      r.label ? `[${r.label}]` : null,
      `Hook: ${r.analysis.hook}`,
      `Ângulo: ${r.analysis.angulo}`,
      `Formato: ${r.analysis.formato_inferido}`,
      `Estrutura: ${r.analysis.estrutura_resumo}`,
    ].filter(Boolean);
    const block = parts.join(" · ");
    return block.length > maxChars ? `${block.slice(0, maxChars)}…` : block;
  }
  return r.text.length > maxChars ? `${r.text.slice(0, maxChars)}…` : r.text;
}

const STRUCTURAL_ONLY_PREFIX =
  "PADRÃO ESTRUTURAL APENAS — adapte toda promessa, números e mecanismo ao produto da URL do projeto. Não copie claims literais de outro nicho.";

export function formatReferenceComboBlock(
  refs: ReferenceTranscription[] | undefined,
  combo: ReferenceCombo | undefined,
): string | null {
  if (!combo || !refs?.length) return null;
  const byId = new Map(refs.map((r) => [r.id, r]));
  const structure = combo.structure_id ? byId.get(combo.structure_id) : undefined;
  const formato = combo.formato_id ? byId.get(combo.formato_id) : undefined;
  const angulo = combo.angulo_id ? byId.get(combo.angulo_id) : undefined;

  if (!structure && !formato && !angulo) return null;

  const lines = [
    STRUCTURAL_ONLY_PREFIX,
    "COMBO DE REFERÊNCIAS ATIVO (misture estes padrões — estrutura de um, formato de outro, hook de um terceiro):",
  ];

  if (structure) {
    const summary =
      structure.analysis?.estrutura_resumo ?? structure.text.slice(0, 400);
    lines.push(`• Estrutura (${structure.label ?? "ref"}): ${summary}`);
  }
  if (formato) {
    const fmt =
      formato.analysis?.formato_inferido ??
      formato.analysis?.estrutura_resumo ??
      formato.text.slice(0, 300);
    lines.push(`• Formato (${formato.label ?? "ref"}): ${fmt}`);
  }
  if (angulo) {
    const hook = angulo.analysis?.hook ?? angulo.text.slice(0, 200);
    const tipo = angulo.analysis?.tipo_angulo ?? angulo.analysis?.angulo;
    lines.push(`• Ângulo/hook (${angulo.label ?? "ref"}): ${hook}${tipo ? ` · ${tipo}` : ""}`);
  }

  lines.push("Gere variação inédita combinando os elementos acima; não copie literalmente.");
  return lines.join("\n");
}

export function formatReferenceTranscriptionsBlock(
  refs: ReferenceTranscription[] | undefined,
  maxEntries = 5,
  maxCharsPerEntry = 600,
  combo?: ReferenceCombo,
): string | null {
  const comboBlock = formatReferenceComboBlock(refs, combo);
  if (!refs?.length && !comboBlock) return null;

  const recent = (refs ?? []).slice(-maxEntries);
  const refLines =
    recent.length > 0
      ? [
          STRUCTURAL_ONLY_PREFIX,
          "REFERÊNCIAS DE COPY QUE JÁ VENDEU (transcrições do projeto — use como padrão de hook, ritmo e CTA):",
          ...recent.map((r, i) => `[${i + 1}] ${formatEntryExcerpt(r, maxCharsPerEntry)}`),
          "Inspire-se no tom e na estrutura, sem copiar literalmente; gere variações inéditas.",
        ]
      : [];

  const parts = [comboBlock, refLines.length ? refLines.join("\n") : null].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

export async function getProjectGeneralIntelText(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<string | null> {
  const settings = await loadProjectIntelSettingsRaw(supabase, projectId);
  return formatReferenceTranscriptionsBlock(
    settings?.reference_transcriptions,
    5,
    600,
    settings?.reference_combo,
  );
}

export async function loadProjectIntelSettingsRaw(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectIntelSettings | null> {
  const { data } = await supabase
    .from("projects")
    .select("intel_settings")
    .eq("id", projectId)
    .maybeSingle();
  const raw = data?.intel_settings as ProjectIntelSettings | null;
  return raw ?? null;
}

function validateTranscriptionText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_CHARS) {
    throw new Error(`Cole a transcrição completa (mínimo ${MIN_TEXT_CHARS} caracteres).`);
  }
  if (trimmed.length > MAX_TEXT_CHARS) {
    throw new Error(`Transcrição muito longa (máximo ${MAX_TEXT_CHARS} caracteres).`);
  }
  return trimmed;
}

export async function appendProjectReferenceTranscription(
  supabase: SupabaseClient<Database>,
  projectId: string,
  text: string,
  options?: {
    label?: string;
    analysis?: ReferenceTranscriptionAnalysis;
    skipLessonGuard?: boolean;
  },
): Promise<{ total: number }> {
  const trimmed = validateTranscriptionText(text);

  if (!options?.skipLessonGuard) {
    const { isLikelyLessonTranscript } = await import("./reference-transcription-extract");
    if (isLikelyLessonTranscript(trimmed)) {
      throw new Error(
        "Este texto parece uma aula ou explicação longa, não um anúncio. Use “Extrair copies” para salvar só os trechos de anúncio.",
      );
    }
  }

  const existing = (await loadProjectIntelSettingsRaw(supabase, projectId)) ?? {};
  const next = mergeReferenceTranscription(existing, {
    id: crypto.randomUUID(),
    text: trimmed,
    added_at: new Date().toISOString(),
    label: options?.label,
    analysis: options?.analysis,
  });

  const { error } = await supabase
    .from("projects")
    .update({
      intel_settings: next as Record<string, unknown>,
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  return { total: next.reference_transcriptions?.length ?? 0 };
}

export async function appendProjectReferenceTranscriptionsBatch(
  supabase: SupabaseClient<Database>,
  projectId: string,
  snippets: Array<{
    text: string;
    label?: string;
    analysis?: ReferenceTranscriptionAnalysis;
  }>,
): Promise<{ total: number; added: number }> {
  if (!snippets.length) throw new Error("Nenhum trecho para salvar.");

  let settings = (await loadProjectIntelSettingsRaw(supabase, projectId)) ?? {};
  let added = 0;

  for (const snippet of snippets) {
    const trimmed = validateTranscriptionText(snippet.text);
    settings = mergeReferenceTranscription(settings, {
      id: crypto.randomUUID(),
      text: trimmed,
      added_at: new Date().toISOString(),
      label: snippet.label,
      analysis: snippet.analysis,
    });
    added += 1;
  }

  const { error } = await supabase
    .from("projects")
    .update({
      intel_settings: settings as Record<string, unknown>,
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  return { total: settings.reference_transcriptions?.length ?? 0, added };
}

export async function saveProjectReferenceCombo(
  supabase: SupabaseClient<Database>,
  projectId: string,
  combo: ReferenceCombo | null,
): Promise<void> {
  const existing = (await loadProjectIntelSettingsRaw(supabase, projectId)) ?? {};
  const refs = existing.reference_transcriptions ?? [];

  if (combo) {
    const ids = [combo.structure_id, combo.formato_id, combo.angulo_id].filter(Boolean);
    for (const id of ids) {
      if (!refs.some((r) => r.id === id)) {
        throw new Error("Referência do combo não encontrada no projeto.");
      }
    }
  }

  const next: ProjectIntelSettings = {
    ...existing,
    reference_combo: combo
      ? { ...combo, updated_at: new Date().toISOString() }
      : undefined,
  };

  const { error } = await supabase
    .from("projects")
    .update({ intel_settings: next as Record<string, unknown> })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
}

export async function removeProjectReferenceTranscription(
  supabase: SupabaseClient<Database>,
  projectId: string,
  transcriptionId: string,
): Promise<{ total: number }> {
  const existing = (await loadProjectIntelSettingsRaw(supabase, projectId)) ?? {};
  const before = existing.reference_transcriptions ?? [];
  const list = before.filter((r) => r.id !== transcriptionId);
  if (list.length === before.length) {
    throw new Error("Transcrição não encontrada");
  }

  const combo = existing.reference_combo;
  const comboUsesRemoved =
    combo &&
    (combo.structure_id === transcriptionId ||
      combo.formato_id === transcriptionId ||
      combo.angulo_id === transcriptionId);

  const { error } = await supabase
    .from("projects")
    .update({
      intel_settings: {
        ...existing,
        reference_transcriptions: list,
        reference_combo: comboUsesRemoved ? undefined : combo,
      } as Record<string, unknown>,
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  return { total: list.length };
}

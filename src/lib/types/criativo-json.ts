import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";
import { AnguloSchema } from "@/lib/schemas/angulos.schema";
import type { EscalaAnalise } from "@/lib/schemas/escala.schema";
import type { VslAnguloJsonExtras } from "@/lib/vsl-roteiro";

export const AudioPathsSchema = z.record(z.string(), z.string());
export type AudioPaths = z.infer<typeof AudioPathsSchema>;

export const ScoreDimensaoSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number(),
  minimo: z.number(),
  ok: z.boolean(),
  dica: z.string().optional(),
});

export const ScoreJsonSchema = z
  .object({
    dimensoes: z.array(ScoreDimensaoSchema).optional(),
    podeExportar: z.boolean().optional(),
    avaliadoEm: z.string().optional(),
    exportDevMode: z.boolean().optional(),
    exportDevMessage: z.string().optional(),
    ugc_recommended: z.boolean().optional(),
    ugc_message: z.string().optional(),
    render_fallback: z.string().optional(),
    ugc_provider: z.string().optional(),
    total: z.number().optional(),
  })
  .passthrough();

export type ScoreDimensao = z.infer<typeof ScoreDimensaoSchema>;
export type ScoreJson = z.infer<typeof ScoreJsonSchema>;
export type CriativoScore = ScoreJson & { dimensoes: ScoreDimensao[]; podeExportar: boolean };

export type AnguloItem = z.infer<typeof AnguloSchema>;
export type AnguloJson = AnguloItem &
  VslAnguloJsonExtras & {
    hook?: string;
    escala_analise?: EscalaAnalise;
    recomendacao_formato_aplicada?: AnguloItem["recomendacao_formato"];
  };

export type CriativoRow = Tables<"criativos">;

export type CriativoDetail = Omit<CriativoRow, "audio_paths" | "score_json" | "angulo_json"> & {
  audio_paths: AudioPaths | null;
  score_json: ScoreJson | null;
  angulo_json: AnguloJson | null;
};

export function parseAudioPaths(raw: Json | null | undefined): AudioPaths {
  const parsed = AudioPathsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function parseScoreJson(raw: Json | null | undefined): ScoreJson | null {
  if (raw == null) return null;
  const parsed = ScoreJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseAnguloJson(raw: Json | null | undefined): AnguloJson | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const parsed = AnguloSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, ...(raw as VslAnguloJsonExtras) };
}

export function mapCriativoRow(row: CriativoRow): CriativoDetail {
  return {
    ...row,
    audio_paths: row.audio_paths ? parseAudioPaths(row.audio_paths) : null,
    score_json: parseScoreJson(row.score_json),
    angulo_json: parseAnguloJson(row.angulo_json),
  };
}

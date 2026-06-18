import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseNumericMetric } from "./meta-csv-parser";
import type { ChampionMetric, SinaisCalibration } from "./project-performance-context";

export type ProjectIntelSettings = {
  hook_rate_bias_pp?: number;
  calibration_samples?: number;
  last_calibrated_at?: string;
  cpa_medio_validado?: number;
  roas_medio_validado?: number;
  conversion_bias_notes?: string;
  calibration_samples_conversion?: number;
  reference_transcriptions?: Array<{
    id: string;
    text: string;
    added_at: string;
    label?: string;
    analysis?: {
      hook: string;
      angulo: string;
      tipo_angulo: string;
      estrutura_resumo: string;
      formato_inferido: string;
      nivel_conspiracao: string;
    };
  }>;
  reference_combo?: {
    structure_id?: string;
    formato_id?: string;
    angulo_id?: string;
    updated_at?: string;
  };
};

export function computeHookRateBias(sinaisCalibration: SinaisCalibration[]): number | null {
  const deltas: number[] = [];
  for (const s of sinaisCalibration) {
    const estNums = s.hookRateEstimado?.match(/\d+/g)?.map(Number) ?? [];
    const realNum = s.hookRateReal ? parseNumericMetric(s.hookRateReal) : null;
    if (!estNums.length || realNum == null) continue;
    const est = estNums.length > 1 ? (estNums[0] + estNums[1]) / 2 : estNums[0];
    deltas.push(realNum - est);
  }
  if (!deltas.length) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

export function computeConversionCalibration(
  championMetrics: ChampionMetric[][],
): Pick<
  ProjectIntelSettings,
  "cpa_medio_validado" | "roas_medio_validado" | "conversion_bias_notes" | "calibration_samples_conversion"
> | null {
  const cpas: number[] = [];
  const roasValues: number[] = [];

  for (const metrics of championMetrics) {
    for (const m of metrics) {
      if (m.metrica === "cpa") {
        const n = parseNumericMetric(m.valor);
        if (n != null && n > 0) cpas.push(n);
      }
      if (m.metrica === "roas") {
        const n = parseNumericMetric(m.valor);
        if (n != null && n > 0) roasValues.push(n);
      }
    }
  }

  if (!cpas.length && !roasValues.length) return null;

  const cpa_medio_validado = cpas.length
    ? Math.round((cpas.reduce((a, b) => a + b, 0) / cpas.length) * 100) / 100
    : undefined;
  const roas_medio_validado = roasValues.length
    ? Math.round((roasValues.reduce((a, b) => a + b, 0) / roasValues.length) * 100) / 100
    : undefined;

  const notes: string[] = [];
  if (cpa_medio_validado != null) {
    notes.push(
      cpa_medio_validado >= 80
        ? "CPA histórico alto — priorize blocos de prova social, garantia e CTA explícito pós-clique."
        : "CPA histórico moderado — equilibre hook direto com prova nos blocos 10–25s.",
    );
  }
  if (roas_medio_validado != null) {
    notes.push(
      roas_medio_validado >= 3
        ? "ROAS alto — priorize hook direto e promessa forte nos primeiros 3s; CTA pode ser mais suave."
        : "ROAS moderado — reforce urgência real e CTA claro sem sacrificar retenção.",
    );
  }

  return {
    cpa_medio_validado,
    roas_medio_validado,
    conversion_bias_notes: notes.join(" "),
    calibration_samples_conversion: cpas.length + roasValues.length,
  };
}

export function formatConversionContextBlock(settings: ProjectIntelSettings | null): string {
  if (!settings?.cpa_medio_validado && !settings?.roas_medio_validado) return "";
  const parts: string[] = ["CONVERSÃO VALIDADA (campeões aprovados):"];
  if (settings.cpa_medio_validado != null) {
    parts.push(`CPA médio R$ ${settings.cpa_medio_validado.toFixed(2)}`);
  }
  if (settings.roas_medio_validado != null) {
    parts.push(`ROAS médio ${settings.roas_medio_validado.toFixed(2)}`);
  }
  if (settings.conversion_bias_notes) {
    parts.push(`Instrução: ${settings.conversion_bias_notes}`);
  }
  return parts.join(" — ");
}

export function formatCalibrationBiasInstruction(settings: ProjectIntelSettings | null): string {
  if (!settings) return "";
  const blocks: string[] = [];

  if (settings.hook_rate_bias_pp != null && settings.calibration_samples) {
    const bias = settings.hook_rate_bias_pp;
    const dir =
      bias > 0
        ? `subestimou em ~${bias}pp (reais foram maiores)`
        : bias < 0
          ? `superestimou em ~${Math.abs(bias)}pp (reais foram menores)`
          : "alinhado com o real";
    blocks.push(
      [
        `BIAS DE CALIBRAÇÃO DO PROJETO (${settings.calibration_samples} amostra(s)):`,
        `As estimativas de hook_rate_estimado ${dir}.`,
        bias !== 0
          ? `Ajuste hook_rate_estimado em ${bias > 0 ? "+" : ""}${bias}pp em relação à sua intuição inicial.`
          : "Mantenha estimativas conservadoras.",
      ].join("\n"),
    );
  }

  const conversionBlock = formatConversionContextBlock(settings);
  if (conversionBlock) blocks.push(conversionBlock);

  return blocks.join("\n\n");
}

export async function refreshProjectCalibration(
  supabase: SupabaseClient<Database>,
  projectId: string,
  sinaisCalibration: SinaisCalibration[],
  championMetrics?: ChampionMetric[][],
): Promise<ProjectIntelSettings | null> {
  const existing = await loadProjectIntelSettings(supabase, projectId);
  const bias = computeHookRateBias(sinaisCalibration);
  const conversion = championMetrics?.length
    ? computeConversionCalibration(championMetrics)
    : null;

  if (bias == null && !conversion && !existing) return null;

  const settings: ProjectIntelSettings = {
    ...existing,
    ...(bias != null
      ? {
          hook_rate_bias_pp: bias,
          calibration_samples: sinaisCalibration.filter((s) => s.hookRateReal).length,
        }
      : {}),
    ...(conversion ?? {}),
    last_calibrated_at: new Date().toISOString(),
  };

  await supabase
    .from("projects")
    .update({ intel_settings: settings as Record<string, unknown> })
    .eq("id", projectId);

  return settings;
}

export async function loadProjectIntelSettings(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectIntelSettings | null> {
  const { data } = await supabase
    .from("projects")
    .select("intel_settings")
    .eq("id", projectId)
    .maybeSingle();
  const raw = data?.intel_settings as ProjectIntelSettings | null;
  if (
    !raw?.hook_rate_bias_pp &&
    !raw?.calibration_samples &&
    !raw?.cpa_medio_validado &&
    !raw?.roas_medio_validado &&
    !raw?.conversion_bias_notes &&
    !raw?.calibration_samples_conversion &&
    !(raw?.reference_transcriptions?.length ?? 0)
  ) {
    return null;
  }
  return raw;
}

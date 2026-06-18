import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseNumericMetric } from "./meta-csv-parser";
import type { SinaisCalibration } from "./project-performance-context";

export type ProjectIntelSettings = {
  hook_rate_bias_pp?: number;
  calibration_samples?: number;
  last_calibrated_at?: string;
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

export function formatCalibrationBiasInstruction(settings: ProjectIntelSettings | null): string {
  if (settings?.hook_rate_bias_pp == null || !settings.calibration_samples) return "";
  const bias = settings.hook_rate_bias_pp;
  const dir =
    bias > 0
      ? `subestimou em ~${bias}pp (reais foram maiores)`
      : bias < 0
        ? `superestimou em ~${Math.abs(bias)}pp (reais foram menores)`
        : "alinhado com o real";
  return [
    `BIAS DE CALIBRAÇÃO DO PROJETO (${settings.calibration_samples} amostra(s)):`,
    `As estimativas de hook_rate_estimado ${dir}.`,
    bias !== 0
      ? `Ajuste hook_rate_estimado em ${bias > 0 ? "+" : ""}${bias}pp em relação à sua intuição inicial.`
      : "Mantenha estimativas conservadoras.",
  ].join("\n");
}

export async function refreshProjectCalibration(
  supabase: SupabaseClient<Database>,
  projectId: string,
  sinaisCalibration: SinaisCalibration[],
): Promise<ProjectIntelSettings | null> {
  const bias = computeHookRateBias(sinaisCalibration);
  if (bias == null) return null;

  const settings: ProjectIntelSettings = {
    hook_rate_bias_pp: bias,
    calibration_samples: sinaisCalibration.filter((s) => s.hookRateReal).length,
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
  if (!raw?.hook_rate_bias_pp && !raw?.calibration_samples) return null;
  return raw;
}

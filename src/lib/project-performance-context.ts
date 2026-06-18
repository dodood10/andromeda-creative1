import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EstiloProducao, FormatoSaida } from "./types/enums";
import { parseNumericMetric } from "./meta-csv-parser";
import {
  computeConversionCalibration,
  formatCalibrationBiasInstruction,
  formatConversionContextBlock,
  loadProjectIntelSettings,
  refreshProjectCalibration,
} from "./sinais-calibration";

export type ChampionMetric = {
  metrica: string;
  valor: string;
  tipo: string;
  source: "approved" | "csv_auto";
};

export type SinaisCalibration = {
  angulo: string;
  hookRateEstimado: string | null;
  hookRateReal: string | null;
  delta: string | null;
};

export type ProjectPerformanceContext = {
  champions: Array<{
    criativoId: string;
    angulo: string;
    formato: FormatoSaida | string;
    estilo: EstiloProducao | string;
    metrics: ChampionMetric[];
    source?: "andromeda" | "importado";
  }>;
  failedPatterns: Array<{ estilo: string; count: number; performando: number }>;
  variationFailures: Array<{ variacaoId: string; count: number }>;
  sinaisCalibration: SinaisCalibration[];
  recentAnguloNames: string[];
  summaryText: string;
};

export type ChampionPerformanceContext = {
  criativoId: string;
  angulo: string;
  metrics: ChampionMetric[];
  sinaisCalibration: SinaisCalibration | null;
  summaryText: string;
};

export function normalizeAnguloBase(angulo: string): string {
  return angulo.split(" · ")[0]?.trim() ?? angulo;
}

export type PerformanceContextOptions = {
  /** Quando true (padrão), só campeões e padrões validados pela equipe entram no prompt. */
  approvedOnly?: boolean;
};

function parseMetricValue(valor: string | null): string {
  if (!valor) return "—";
  return valor.trim();
}

function isUsableMetric(r: {
  intel_review_status: string | null;
  observacao: string | null;
}): boolean {
  if (r.intel_review_status === "approved") return true;
  return !!(r.observacao?.includes("Import CSV") && r.intel_review_status === "pending");
}

function metricSource(r: {
  intel_review_status: string | null;
  observacao: string | null;
}): "approved" | "csv_auto" {
  if (r.observacao?.includes("Import CSV") && r.intel_review_status === "pending") return "csv_auto";
  return "approved";
}

async function fetchMetricsBundle(
  supabase: SupabaseClient<Database>,
  projectId: string,
) {
  const { data: criativos } = await supabase
    .from("criativos")
    .select(
      "id, angulo, formato_saida, estilo_producao, status, performando_intel_status, angulo_json, source",
    )
    .eq("project_id", projectId);

  const ids = (criativos ?? []).map((c) => c.id);
  if (ids.length === 0) {
    return { criativos: [], resultados: [], metricsByCriativo: new Map<string, ChampionMetric[]>() };
  }

  const { data: resultados } = await supabase
    .from("resultados_reportados")
    .select("criativo_id, tipo, metrica, valor, intel_review_status, observacao")
    .in("criativo_id", ids)
    .in("intel_review_status", ["approved", "pending"])
    .order("created_at", { ascending: false })
    .limit(500);

  const metricsByCriativo = new Map<string, ChampionMetric[]>();
  for (const r of resultados ?? []) {
    if (!r.criativo_id || !r.metrica || !isUsableMetric(r)) continue;
    const list = metricsByCriativo.get(r.criativo_id) ?? [];
    if (list.some((x) => x.metrica === r.metrica)) continue;
    list.push({
      metrica: r.metrica!,
      valor: parseMetricValue(r.valor),
      tipo: r.tipo ?? "clique",
      source: metricSource(r),
    });
    metricsByCriativo.set(r.criativo_id, list);
  }

  return { criativos: criativos ?? [], resultados: resultados ?? [], metricsByCriativo };
}

function extractHookRateEstimado(anguloJson: unknown): string | null {
  const aj = anguloJson as {
    sinais_andromeda?: { hook_rate_estimado?: string };
  } | null;
  return aj?.sinais_andromeda?.hook_rate_estimado ?? null;
}

function findRealHookRate(metrics: ChampionMetric[]): string | null {
  const hr = metrics.find((m) => m.metrica === "hook_rate");
  return hr?.valor ?? null;
}

function buildSinaisCalibration(
  angulo: string,
  anguloJson: unknown,
  metrics: ChampionMetric[],
): SinaisCalibration | null {
  const hookRateEstimado = extractHookRateEstimado(anguloJson);
  const hookRateReal = findRealHookRate(metrics);
  if (!hookRateEstimado && !hookRateReal) return null;

  let delta: string | null = null;
  const estNums = hookRateEstimado?.match(/\d+/g)?.map(Number) ?? [];
  const realNum = hookRateReal ? parseNumericMetric(hookRateReal) : null;
  if (estNums.length && realNum != null) {
    const est = estNums.length > 1 ? (estNums[0] + estNums[1]) / 2 : estNums[0];
    const diff = Math.round(realNum - est);
    delta = diff >= 0 ? `+${diff}pp vs estimativa` : `${diff}pp vs estimativa`;
  }

  return { angulo: normalizeAnguloBase(angulo), hookRateEstimado, hookRateReal, delta };
}

function getVariationFailures(
  criativos: Array<{ angulo: string; status: string; angulo_json: unknown }>,
): Array<{ variacaoId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of criativos) {
    const aj = c.angulo_json as { escala_variacao_id?: string } | null;
    const varId = aj?.escala_variacao_id;
    if (!varId) continue;
    if (c.status === "Performando") continue;
    if (c.status === "Pausado" || c.status === "Gerado") {
      counts.set(varId, (counts.get(varId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 1)
    .map(([variacaoId, count]) => ({ variacaoId, count }))
    .sort((a, b) => b.count - a.count);
}

function formatMetricsLine(metrics: ChampionMetric[]): string {
  const priority = ["roas", "cpa", "hook_rate", "gasto", "ctr", "conversoes", "cpm"];
  const sorted = [...metrics].sort((a, b) => {
    const ai = priority.indexOf(a.metrica);
    const bi = priority.indexOf(b.metrica);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted
    .slice(0, 6)
    .map((x) => `${x.metrica} ${x.valor}`)
    .join(" · ");
}

/** Escolhe o melhor criativo Performando para CTAs de escala (métricas CSV/real > só aprovado admin). */
export function pickBestPerformandoCriativoId(
  criativos: Array<{
    id: string;
    status: string;
    performando_intel_status: string | null;
    angulo: string;
  }>,
  metricsByCriativo: Map<string, ChampionMetric[]>,
): string | null {
  const performando = criativos.filter(
    (c) => c.status === "Performando" && c.performando_intel_status === "approved",
  );
  if (!performando.length) return null;

  const score = (id: string) => {
    const m = metricsByCriativo.get(id) ?? [];
    let s = 0;
    if (m.some((x) => x.metrica === "roas")) s += 10;
    if (m.some((x) => x.metrica === "cpa")) s += 8;
    if (m.some((x) => x.metrica === "hook_rate")) s += 6;
    if (m.some((x) => x.metrica === "gasto")) s += 2;
    const c = performando.find((p) => p.id === id);
    if (c?.performando_intel_status === "approved") s += 5;
    if (m.some((x) => x.source === "csv_auto")) s += 4;
    return s;
  };

  const ranked = [...performando].sort((a, b) => score(b.id) - score(a.id));
  return ranked[0]?.id ?? null;
}

function isApprovedChampion(c: { status: string; performando_intel_status: string | null }): boolean {
  return c.status === "Performando" && c.performando_intel_status === "approved";
}

export async function getProjectPerformanceContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
  options: PerformanceContextOptions = {},
): Promise<ProjectPerformanceContext | null> {
  const approvedOnly = options.approvedOnly !== false;
  const intelSettings = await loadProjectIntelSettings(supabase, projectId);
  const { criativos, metricsByCriativo } = await fetchMetricsBundle(supabase, projectId);

  if (criativos.length === 0) return null;

  const champions = criativos
    .filter((c) =>
      approvedOnly ? isApprovedChampion(c) : c.status === "Performando",
    )
    .map((c) => ({
      criativoId: c.id,
      angulo: normalizeAnguloBase(c.angulo),
      formato: c.formato_saida ?? "—",
      estilo: c.estilo_producao ?? "—",
      metrics: metricsByCriativo.get(c.id) ?? [],
      source: (c as { source?: "andromeda" | "importado" }).source ?? "andromeda",
    }))
    .slice(0, 5);

  const estiloStats = new Map<string, { count: number; performando: number }>();
  for (const c of criativos) {
    const estilo = c.estilo_producao ?? "desconhecido";
    const stat = estiloStats.get(estilo) ?? { count: 0, performando: 0 };
    stat.count++;
    const countsAsPerformando = approvedOnly
      ? isApprovedChampion(c)
      : c.status === "Performando";
    if (countsAsPerformando) stat.performando++;
    estiloStats.set(estilo, stat);
  }

  const failedPatterns = [...estiloStats.entries()]
    .filter(([, s]) => s.count >= 2 && s.performando === 0)
    .map(([estilo, s]) => ({ estilo, count: s.count, performando: s.performando }));

  const variationFailures = getVariationFailures(criativos);

  const sinaisCalibration: SinaisCalibration[] = [];
  for (const c of criativos) {
    const metrics = metricsByCriativo.get(c.id) ?? [];
    if (!metrics.length) continue;
    const cal = buildSinaisCalibration(c.angulo, c.angulo_json, metrics);
    if (cal?.hookRateReal) sinaisCalibration.push(cal);
  }

  const { data: geracoes } = await supabase
    .from("geracoes")
    .select("angulos")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentAnguloNames: string[] = [];
  for (const g of geracoes ?? []) {
    const angulos = g.angulos as Array<{ nome?: string; micropersona?: { nome?: string } }> | null;
    for (const a of angulos ?? []) {
      const name = a.micropersona?.nome ?? a.nome;
      if (name && !recentAnguloNames.includes(name)) recentAnguloNames.push(name);
    }
  }

  for (const c of criativos) {
    const aj = c.angulo_json as { micropersona?: { nome?: string }; nome?: string } | null;
    const mp = aj?.micropersona?.nome ?? aj?.nome ?? normalizeAnguloBase(c.angulo);
    if (mp && !recentAnguloNames.includes(mp)) recentAnguloNames.push(mp);
  }

  const calibrationBias = formatCalibrationBiasInstruction(intelSettings);

  const lines: string[] = [];

  if (calibrationBias) {
    lines.push(calibrationBias);
  }

  if (champions.length > 0) {
    const champLines = champions.slice(0, 3).map((c) => {
      const m = formatMetricsLine(c.metrics);
      const label = c.source === "importado" ? "Campeão importado" : "Campeão";
      return `- ${label} "${c.angulo}" (${c.formato}/${c.estilo})${m ? `: ${m}` : " (sem métricas reportadas ainda)"}`;
    });
    lines.push("PERFORMANCE REAL DO PROJETO (Meta Ads / CSV / importações / reportes):", ...champLines);

    const conversionComputed = computeConversionCalibration(champions.map((c) => c.metrics));
    const conversionBlock = formatConversionContextBlock({
      ...intelSettings,
      ...(conversionComputed ?? {}),
    });
    if (conversionBlock) lines.push(conversionBlock);
  }

  if (sinaisCalibration.length > 0) {
    lines.push(
      "CALIBRAÇÃO SINAIS ANDROMEDA (estimado vs real):",
      ...sinaisCalibration.slice(0, 4).map(
        (s) =>
          `- "${s.angulo}": estimado ${s.hookRateEstimado ?? "—"} · real ${s.hookRateReal ?? "—"}${s.delta ? ` (${s.delta})` : ""}`,
      ),
      "Ajuste hook_rate_estimado nas novas gerações com base neste delta quando houver dados reais.",
    );
  }

  if (variationFailures.length > 0) {
    lines.push(
      `Variações de escala que NÃO performaram neste projeto: ${variationFailures.map((v) => `${v.variacaoId} (${v.count}x)`).join(", ")} — reduza probabilidade_superar_original para estas.`,
    );
  }

  if (failedPatterns.length > 0) {
    lines.push(
      `Estilos que falharam: ${failedPatterns.map((f) => `${f.estilo} (${f.count} criativos, 0 performando)`).join("; ")}`,
    );
  }

  if (recentAnguloNames.length > 0) {
    lines.push(
      `ANTI-REPETIÇÃO — micropersonas/ângulos já testados neste projeto (NUNCA reutilizar): ${recentAnguloNames.slice(0, 10).join(", ")}`,
      "Gere 5 micropersonas com papéis temidos INÉDITOS para este projeto.",
    );
  }

  if (failedPatterns.length > 0 || variationFailures.length > 0) {
    lines.push("Priorize lateralizações de baixo risco no hook; evite estilos e variações que falharam neste projeto.");
  }

  if (lines.length === 0) return null;

  if (sinaisCalibration.length > 0 || champions.length > 0) {
    await refreshProjectCalibration(
      supabase,
      projectId,
      sinaisCalibration,
      champions.map((c) => c.metrics),
    ).catch(() => {
      /* coluna intel_settings pode não existir em dev sem migration */
    });
  }

  return {
    champions,
    failedPatterns,
    variationFailures,
    sinaisCalibration,
    recentAnguloNames: recentAnguloNames.slice(0, 10),
    summaryText: lines.join("\n"),
  };
}

export async function getChampionPerformanceContext(
  supabase: SupabaseClient<Database>,
  criativoId: string,
): Promise<ChampionPerformanceContext | null> {
  const { data: campeao } = await supabase
    .from("criativos")
    .select("id, angulo, project_id, angulo_json, status")
    .eq("id", criativoId)
    .maybeSingle();

  if (!campeao) return null;

  const { data: resultados } = await supabase
    .from("resultados_reportados")
    .select("tipo, metrica, valor, intel_review_status, observacao")
    .eq("criativo_id", criativoId)
    .in("intel_review_status", ["approved", "pending"])
    .order("created_at", { ascending: false })
    .limit(30);

  const metrics: ChampionMetric[] = [];
  for (const r of resultados ?? []) {
    if (!r.metrica || !isUsableMetric(r)) continue;
    if (metrics.some((x) => x.metrica === r.metrica)) continue;
    metrics.push({
      metrica: r.metrica,
      valor: parseMetricValue(r.valor),
      tipo: r.tipo ?? "clique",
      source: metricSource(r),
    });
  }

  const sinaisCalibration = buildSinaisCalibration(campeao.angulo, campeao.angulo_json, metrics);

  const lines: string[] = [];
  if (metrics.length > 0) {
    lines.push(
      "MÉTRICAS REAIS DO CAMPEÃO (Meta Ads / CSV / reportes):",
      formatMetricsLine(metrics)
        .split(" · ")
        .map((x) => `- ${x}`)
        .join("\n"),
    );
  }
  if (sinaisCalibration?.hookRateReal) {
    lines.push(
      `Hook rate: estimado ${sinaisCalibration.hookRateEstimado ?? "—"} · real ${sinaisCalibration.hookRateReal}${sinaisCalibration.delta ? ` (${sinaisCalibration.delta})` : ""}`,
    );
  }
  if (campeao.project_id) {
    const proj = await getProjectPerformanceContext(supabase, campeao.project_id);
    const varFail = proj?.variationFailures ?? [];
    if (varFail.length) {
      lines.push(
        `Variações que falharam no projeto: ${varFail.map((v) => `${v.variacaoId} (${v.count}x)`).join(", ")}`,
      );
    }
  }
  lines.push("Calibre probabilidade_superar_original e ordem_lancamento com base nestes dados.");

  if (metrics.length === 0 && !sinaisCalibration?.hookRateReal) return null;

  return {
    criativoId,
    angulo: normalizeAnguloBase(campeao.angulo),
    metrics,
    sinaisCalibration,
    summaryText: lines.join("\n"),
  };
}

export async function getVariationFailureContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<string> {
  const { criativos } = await fetchMetricsBundle(supabase, projectId);
  const failures = getVariationFailures(criativos);
  if (!failures.length) return "";
  return `Variações de escala sem performando neste projeto: ${failures.map((f) => `${f.variacaoId} (${f.count} tentativa(s))`).join(", ")}.`;
}

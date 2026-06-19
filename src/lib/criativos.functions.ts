import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { AnguloSchema, ResultadoAngulosSchema, RoteiroBlocoSchema, type RoteiroBloco } from "./schemas/angulos.schema";
import type { ResultadoAngulos } from "./schemas/angulos.schema";
import { normalizeAngulo, getProjectFormatContext } from "./formato-recomendacao";
import {
  getChampionPerformanceContext,
  getProjectPerformanceContext,
  normalizeAnguloBase,
  pickBestPerformandoCriativoId,
  type ChampionMetric,
} from "./project-performance-context";
import { buildEscalaLineage } from "./escala-lineage";
import { buildFormatoIntelSegment } from "./intel-formato-segment";
import { refreshProjectCalibration, loadProjectIntelSettings } from "./sinais-calibration";
import {
  parseMetaAdsCsv,
  csvRowIndicatesStrongPerformance,
  parseNumericMetric,
} from "./meta-csv-parser";
import type { AppLink } from "./app-links";
import { buildVslRoteiroFromAngulo } from "./vsl-roteiro";
import { generateVslFromAngulo } from "./vsl.functions";
import { gerarVariacoesEscala } from "./escala.functions";
import { bootstrapDraftHookAudio } from "./render/audio-prep";
import { trackFunnelEvent } from "./funnel-events";
import { loadNicheDailyInsights } from "./niche-intel.functions";
import { buildNicheBenchmarkComparison } from "./project-niche-benchmark";
import { trackApiUsage } from "./api-usage";
import { HttpUrlSchema } from "./security-url";
import { assertUserOwnedMediaPath } from "./security-storage";
import { assertCanImportCampeoes } from "./plan-enforcement";
import { executeImportCriativoCampeao } from "./import-creative.functions";
import {
  appendOrgReferenceTranscription,
  appendOrgReferenceTranscriptionsBatch,
  getGeneralIntelForProject,
  loadOrgIntelSettings,
  removeOrgReferenceTranscription,
  saveOrgReferenceCombo,
} from "./project-reference-intel";
import { analyzeReferenceTranscription } from "./reference-transcription-analyze";
import { TomCalibracaoSchema } from "./types/enums";
import { championFromCriativoRow, type ChampionForRanking } from "./champion-angle-ranking";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProjectPerformanceContext } from "./project-performance-context";
import {
  computeQueuePriorityScore,
  hasWhisperTranscriptionFromAnguloJson,
  priorityHintForUser,
  priorityLabelFromScore,
} from "./intel-queue-priority";
import {
  CriativoStatusSchema,
  type CriativoStatus,
  type EstiloProducao,
  type FormatoSaida,
} from "./types/enums";
import {
  mapCriativoRow,
  type CriativoRow,
} from "./types/criativo-json";
import type { Enums } from "@/integrations/supabase/types";

type ResultadoTipo = Enums<"resultado_tipo">;

export type { CriativoRow } from "./types/criativo-json";

async function buildChampionsForRanking(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ChampionForRanking[]> {
  const projPerf = await getProjectPerformanceContext(supabase, projectId, { approvedOnly: true });
  if (!projPerf?.champions.length) return [];
  const approvedChampionIds = new Set(projPerf.champions.map((c) => c.criativoId));
  const { data: criativos } = await supabase
    .from("criativos")
    .select("id, angulo, formato_saida, estilo_producao, angulo_json")
    .eq("project_id", projectId)
    .in("id", [...approvedChampionIds]);
  return (criativos ?? [])
    .filter((c) => approvedChampionIds.has(c.id))
    .map((c) => championFromCriativoRow(c));
}

async function syncProjectCalibration(
  supabase: SupabaseClient<Database>,
  projectId: string,
  perf: ProjectPerformanceContext | null,
): Promise<void> {
  if (!perf) return;
  const hasHook = perf.sinaisCalibration.length > 0;
  const hasConversion = perf.champions.some((c) => c.metrics.length > 0);
  if (!hasHook && !hasConversion) return;
  await refreshProjectCalibration(
    supabase,
    projectId,
    perf.sinaisCalibration,
    perf.champions.map((c) => c.metrics),
  );
}

/** Recalcula calibração do projeto (ex.: após aprovação admin). */
export async function refreshCalibrationForProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<void> {
  const perf = await getProjectPerformanceContext(supabase, projectId);
  await syncProjectCalibration(supabase, projectId, perf);
}

const ProjectScopeSchema = z.object({
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const listCriativos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        formatoSaida: z.enum(["criativo_curto", "vsl_curta"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("criativos")
      .select("*")
      .eq("project_id", data.projectId);
    if (data.formatoSaida) {
      q = q.eq("formato_saida", data.formatoSaida);
    }
    const { data: rows, error } = await q.order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return rows as CriativoRow[];
  });

export const getCriativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("criativos")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return mapCriativoRow(row as CriativoRow);
  });

export const updateCriativoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: CriativoStatusSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    type CriativosUpdate = Database["public"]["Tables"]["criativos"]["Update"];
    const patch: CriativosUpdate = { status: data.status };

    if (data.status === "Performando") {
      patch.performando_intel_status = "pending";
      patch.performando_intel_submitted_at = new Date().toISOString();
      patch.performando_intel_reviewed_at = null;
      patch.performando_intel_reviewed_by = null;
      patch.performando_intel_notes = null;
    } else {
      patch.performando_intel_status = null;
      patch.performando_intel_submitted_at = null;
      patch.performando_intel_reviewed_at = null;
      patch.performando_intel_reviewed_by = null;
      patch.performando_intel_notes = null;
    }

    if (data.status === "Rodando") {
      patch.status_rodando_at = new Date().toISOString();
    } else {
      patch.status_rodando_at = null;
    }

    const { data: row, error } = await supabase
      .from("criativos")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (data.status === "Subiu") {
      const rowOrg = row as CriativoRow & { organization_id?: string };
      trackFunnelEvent({
        userId: context.userId,
        organizationId: rowOrg.organization_id,
        event: "marcou_subiu",
        metadata: { criativoId: data.id },
      });
    }

    return row as CriativoRow;
  });

export const updateCriativoRoteiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      roteiro: z.array(RoteiroBlocoSchema),
      voiceId: z.string().optional(),
      backgroundMediaPath: z.string().optional(),
      musicVolume: z.number().int().min(0).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { roteiro: data.roteiro };
    if (data.voiceId !== undefined) patch.voice_id = data.voiceId;
    if (data.backgroundMediaPath !== undefined) {
      assertUserOwnedMediaPath(userId, data.backgroundMediaPath);
      patch.background_media_path = data.backgroundMediaPath;
    }
    if (data.musicVolume !== undefined) patch.music_volume = data.musicVolume;

    const { data: row, error } = await supabase
      .from("criativos")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row as CriativoRow;
  });

const SaveGeracaoSchema = z.object({
  url: HttpUrlSchema,
  productType: z.string(),
  goal: z.string(),
  context: z.string().optional().default(""),
  resultado: ResultadoAngulosSchema,
  criarCriativos: z.boolean().optional().default(false),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  geracaoId: z.string().uuid().optional(),
});

export const saveGeracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveGeracaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resultado, criarCriativos, projectId, organizationId, geracaoId, ...meta } = data;

    const payload = {
      url: meta.url,
      product_type: meta.productType,
      goal: meta.goal,
      context: meta.context,
      diagnostico: resultado.diagnostico,
      angulos: resultado.angulos,
    };

    let geracao: { id: string };

    if (geracaoId) {
      const { data: updated, error } = await supabase
        .from("geracoes")
        .update(payload)
        .eq("id", geracaoId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      geracao = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from("geracoes")
        .insert({
          user_id: userId,
          organization_id: organizationId,
          project_id: projectId,
          ...payload,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      geracao = inserted;
    }

    if (criarCriativos && resultado.angulos.length > 0) {
      let produto = meta.url;
      try {
        produto = new URL(meta.url).hostname.replace(/^www\./, "");
      } catch {
        /* keep url */
      }
      const inserts = resultado.angulos.map((a) => ({
        user_id: userId,
        organization_id: organizationId,
        project_id: projectId,
        geracao_id: geracao.id,
        produto,
        angulo: a.nome,
        formato: "9:16",
        estilo: "Texto",
        status: "Gerado" as const,
      }));

      const { error: criativosError } = await supabase.from("criativos").insert(inserts);
      if (criativosError) throw new Error(criativosError.message);
    }

    return { geracaoId: geracao.id };
  });

export const getGeracaoResultado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ geracaoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: geracao, error } = await supabase
      .from("geracoes")
      .select("diagnostico, angulos, url, product_type, goal, context")
      .eq("id", data.geracaoId)
      .single();

    if (error || !geracao) throw new Error("Geração não encontrada");

    const angulosRaw = (geracao.angulos ?? []) as ResultadoAngulos["angulos"];
    const resultado: ResultadoAngulos = {
      diagnostico: geracao.diagnostico as ResultadoAngulos["diagnostico"],
      angulos: angulosRaw.map((a) => normalizeAngulo(a)),
    };

    return {
      resultado,
      url: geracao.url,
      productType: geracao.product_type ?? "info",
      goal: geracao.goal ?? "conv",
      context: geracao.context ?? "",
    };
  });

const CreateDraftSchema = z.object({
  geracaoId: z.string().uuid(),
  anguloIndex: z.number().int().min(0).max(4),
  formatoSaida: z.enum(["criativo_curto", "vsl_curta"]),
  estiloProducao: z.enum(["texto_animado", "clipes_texto", "ugc_avatar"]),
  formatoSource: z.enum(["ia", "manual"]).optional().default("ia"),
  aspectRatioPrioritario: z.enum(["9:16", "4:5", "1:1"]).optional(),
  backgroundMediaPath: z.string().optional(),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  tomCalibracao: TomCalibracaoSchema.optional().default("direto"),
});

export const createCriativoDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateDraftSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: geracao, error: gErr } = await supabase
      .from("geracoes")
      .select("*")
      .eq("id", data.geracaoId)
      .single();

    if (gErr || !geracao) throw new Error("Geração não encontrada");

    const angulos = geracao.angulos as ResultadoAngulos["angulos"];
    const angulo = angulos[data.anguloIndex];
    if (!angulo) throw new Error("Ângulo inválido");

    const parsed = AnguloSchema.safeParse(angulo);
    const anguloData = parsed.success ? parsed.data : angulo;
    const anguloNormalized = normalizeAngulo(anguloData);

    let roteiro =
      data.formatoSaida === "vsl_curta"
        ? buildVslRoteiroFromAngulo({
            hook: anguloNormalized.hook,
            cta: anguloNormalized.cta,
            estrutura: anguloNormalized.estrutura,
            recomendacao_formato: anguloNormalized.recomendacao_formato,
          })
        : anguloNormalized.estrutura.map((b, i) => ({
            tempo: b.tempo,
            conteudo: b.conteudo,
            tipo: ["hook", "dor", "mecanismo", "prova", "cta"][i] ?? "bloco",
          }));

    let vslExtras: Record<string, unknown> = {};

    if (data.formatoSaida === "vsl_curta") {
      const vslResult = await generateVslFromAngulo({
        apiKey: process.env.ANTHROPIC_API_KEY,
        userId,
        organizationId: data.organizationId,
        angulo: anguloNormalized,
        url: geracao.url,
        productType: geracao.product_type ?? "info",
        goal: geracao.goal ?? "conv",
        context: geracao.context ?? "",
        tomCalibracao: data.tomCalibracao ?? "direto",
        supabase,
        projectId: data.projectId,
      });
      roteiro = vslResult.roteiro;
      vslExtras = vslResult.anguloJsonExtras;
    }

    let produto = geracao.url;
    try {
      produto = new URL(geracao.url).hostname.replace(/^www\./, "");
    } catch {
      /* keep */
    }

    const aspectRatio =
      data.aspectRatioPrioritario ??
      anguloNormalized.recomendacao_formato.aspect_ratio_prioritario;

    const formatoTag = data.formatoSaida === "vsl_curta" ? "VSL" : "Curto";
    const anguloDisplay = `${anguloNormalized.nome} · ${formatoTag} · ${aspectRatio}`;

    const anguloJson = {
      ...anguloNormalized,
      ...vslExtras,
      tom_calibracao_aplicado: data.tomCalibracao ?? "direto",
      recomendacao_formato_original: anguloNormalized.recomendacao_formato,
      recomendacao_formato_aplicada: {
        formato_saida: data.formatoSaida,
        estilo_producao: data.estiloProducao,
        aspect_ratio_prioritario: aspectRatio,
        source: data.formatoSource,
      },
    };

    const { data: criativo, error } = await supabase
      .from("criativos")
      .insert({
        user_id: userId,
        organization_id: data.organizationId,
        project_id: data.projectId,
        geracao_id: data.geracaoId,
        produto,
        angulo: anguloDisplay,
        formato: aspectRatio,
        estilo:
          data.estiloProducao === "texto_animado"
            ? "Texto"
            : data.estiloProducao === "ugc_avatar"
              ? "UGC"
              : "Clipes",
        formato_saida: data.formatoSaida as FormatoSaida,
        estilo_producao: data.estiloProducao as EstiloProducao,
        angulo_json: anguloJson,
        roteiro,
        background_media_path: data.backgroundMediaPath ?? null,
        utm_content: crypto.randomUUID(),
        export_status: "rascunho",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const bootstrap = await bootstrapDraftHookAudio({
      supabase,
      criativoId: criativo.id,
      roteiro: roteiro as RoteiroBloco[],
      tomCalibracao: data.tomCalibracao,
    }).catch(() => ({ voiceId: "", hookGenerated: false }));

    return {
      criativoId: criativo.id,
      vslDevMode: data.formatoSaida === "vsl_curta" && !!vslExtras.vsl_dev_mode,
      hookAudioGenerated: bootstrap?.hookGenerated ?? false,
      voiceId: bootstrap?.voiceId,
    };
  });

export const getDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: allCriativos, error } = await supabase
      .from("criativos")
      .select(
        "status, angulo, formato_saida, export_status, id, performando_intel_status, updated_at, status_rodando_at, angulo_json",
      )
      .eq("project_id", data.projectId);

    if (error) throw new Error(error.message);

    const criativos = (allCriativos ?? []).filter(
      (c) => !c.formato_saida || c.formato_saida === "criativo_curto",
    );

    const counts = {
      Gerado: 0,
      Subiu: 0,
      Rodando: 0,
      Performando: 0,
      Pausado: 0,
    };

    for (const c of criativos ?? []) {
      if (c.status in counts) {
        counts[c.status as keyof typeof counts]++;
      }
    }

    const total = criativos?.length ?? 0;
    const exportados = (criativos ?? []).filter((c) => c.export_status === "pronto").length;
    const marcouSubiu = counts.Subiu + counts.Rodando + counts.Performando > 0;

    const { count: geracoesCount } = await supabase
      .from("geracoes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId);

    const ativos = counts.Rodando + counts.Performando + counts.Subiu;
    const angulosTestados = new Set((criativos ?? []).map((c) => c.angulo));
    const formatosTestados = new Set(
      (criativos ?? []).map((c) => c.formato_saida).filter(Boolean),
    );

    const anguloCounts: Record<string, number> = {};
    for (const c of criativos ?? []) {
      if (c.status === "Rodando" || c.status === "Performando") {
        anguloCounts[c.angulo] = (anguloCounts[c.angulo] ?? 0) + 1;
      }
    }
    const topAngulo = Object.entries(anguloCounts).sort((a, b) => b[1] - a[1])[0];
    const saturacaoPct =
      ativos > 0 && topAngulo ? Math.round((topAngulo[1] / ativos) * 100) : 0;

    const semExportList = (criativos ?? []).filter(
      (c) => c.export_status !== "pronto" && c.status !== "Pausado",
    );
    const semExport = semExportList.length;
    const firstExportPendingId = semExportList[0]?.id ?? null;
    const firstCriativoId = (criativos ?? [])[0]?.id ?? null;

    const { data: resultadosProjeto } = await supabase
      .from("resultados_reportados")
      .select("criativo_id, metrica, valor, intel_review_status, observacao, tipo")
      .in(
        "criativo_id",
        (criativos ?? []).map((c) => c.id),
      )
      .in("intel_review_status", ["approved", "pending"])
      .limit(300);

    const metricsByCriativo = new Map<string, ChampionMetric[]>();
    for (const r of resultadosProjeto ?? []) {
      if (!r.criativo_id || !r.metrica) continue;
      const csvAuto = r.observacao?.includes("Import CSV") && r.intel_review_status === "pending";
      if (r.intel_review_status !== "approved" && !csvAuto) continue;
      const list = metricsByCriativo.get(r.criativo_id) ?? [];
      if (!list.some((x) => x.metrica === r.metrica)) {
        list.push({
          metrica: r.metrica,
          valor: r.valor ?? "—",
          tipo: r.tipo ?? "clique",
          source: csvAuto ? "csv_auto" : "approved",
        });
        metricsByCriativo.set(r.criativo_id, list);
      }
    }

    const firstPerformandoId =
      pickBestPerformandoCriativoId(criativos ?? [], metricsByCriativo) ??
      (criativos ?? []).find((c) => c.status === "Performando")?.id ??
      null;
    const performandoPendentes = (criativos ?? []).filter(
      (c) => c.status === "Performando" && c.performando_intel_status === "pending",
    ).length;

    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const exportSubiuReminder = (criativos ?? []).find(
      (c) => c.export_status === "pronto" && c.status === "Gerado",
    );

    const staleExportReminder = (criativos ?? []).find(
      (c) =>
        c.export_status === "pronto" &&
        c.status === "Gerado" &&
        c.updated_at &&
        new Date(c.updated_at).getTime() < fortyEightHoursAgo,
    );

    const rodandoSince = (c: { status_rodando_at?: string | null; updated_at?: string | null }) => {
      const at = c.status_rodando_at ?? c.updated_at;
      return at ? new Date(at).getTime() : null;
    };

    const rodandoMetricsReminder = (criativos ?? []).find((c) => {
      if (c.status !== "Rodando") return false;
      const since = rodandoSince(c);
      if (since == null || since > sevenDaysAgo) return false;
      return !metricsByCriativo.has(c.id);
    });
    const rodandoMetricsReminderCount = (criativos ?? []).filter((c) => {
      if (c.status !== "Rodando") return false;
      const since = rodandoSince(c);
      if (since == null || since > sevenDaysAgo) return false;
      return !metricsByCriativo.has(c.id);
    }).length;

    const temCsvImport = (resultadosProjeto ?? []).some((r) =>
      r.observacao?.includes("Import CSV"),
    );
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const showCsvReminder =
      !temCsvImport &&
      exportados > 0 &&
      (criativos ?? []).some(
        (c) =>
          c.export_status === "pronto" &&
          c.updated_at &&
          new Date(c.updated_at).getTime() < threeDaysAgo,
      );

    const feed: Array<{ tag: string; title: string; desc: string; action: AppLink }> = [];
    if (counts.Performando > 0) {
      feed.push({
        tag: performandoPendentes > 0 ? "Validação" : "Escalando",
        title:
          performandoPendentes > 0
            ? `${performandoPendentes} performando aguardando validação`
            : `${counts.Performando} criativo(s) performando`,
        desc:
          performandoPendentes > 0
            ? "A equipe Andromeda valida antes de usar estes dados na inteligência do projeto."
            : "Analise o campeão e gere variações completas com IA na fase de escala.",
        action: firstPerformandoId
          ? { to: "/app/escala", search: { criativoId: firstPerformandoId } }
          : { to: "/app/historico", search: { status: "Performando" } },
      });
    }
    if (semExport > 0 && total > 0) {
      feed.push({
        tag: "Ação",
        title: `${semExport} criativo(s) sem export`,
        desc: "Finalize o export no editor antes de subir no Meta.",
        action: firstExportPendingId
          ? { to: "/app/editor", search: { criativoId: firstExportPendingId } }
          : { to: "/app/historico", search: { export: "pendente" } },
      });
    }
    if (angulosTestados.size < 3 && total > 0) {
      feed.push({
        tag: "Diversidade",
        title: `Apenas ${angulosTestados.size} ângulo(s) testados`,
        desc: "Gere novos ângulos para encontrar o campeão mais rápido.",
        action: { to: "/app/gerador" },
      });
    }
    if (exportSubiuReminder) {
      feed.push({
        tag: "Pipeline",
        title: "MP4 pronto — marque como Subiu",
        desc: "Após subir no Meta, atualize o status para acompanhar o pipeline e métricas.",
        action: { to: "/app/historico", search: { criativoId: exportSubiuReminder.id } },
      });
    }
    if (rodandoMetricsReminderCount > 0) {
      feed.push({
        tag: "Métricas",
        title: `${rodandoMetricsReminderCount} criativo(s) rodando há 7+ dias`,
        desc: "Reporte CPA, ROAS ou hook rate para calibrar a próxima geração.",
        action: { to: "/app/historico", search: { status: "Rodando" } },
      });
    }
    if (showCsvReminder) {
      feed.push({
        tag: "Métricas",
        title: "Importe o CSV do Meta",
        desc: "Com 3+ dias no ar, o CSV com utm_content calibra hook rate e CPA automaticamente.",
        action: { to: "/app/historico", search: { export: "pronto" } },
      });
    }
    if (feed.length === 0) {
      feed.push({
        tag: "Andromeda",
        title: "Mantenha volume de testes",
        desc: "Meta recomendada: 12 criativos ativos para validação.",
        action: { to: "/app/gerador" },
      });
    }

    const escalaLineage = buildEscalaLineage(
      (criativos ?? []).map((c) => ({
        id: c.id,
        angulo: c.angulo,
        status: c.status,
        export_status: c.export_status,
        angulo_json: c.angulo_json,
      })),
    );

    const nextAction: AppLink & { label: string } = (() => {
      if (total === 0) return { label: "Gerar seus primeiros 5 ângulos", to: "/app/gerador" };
      if (semExport > 0) {
        return {
          label: `Exportar ${semExport} criativo(s) pendente(s)`,
          to: firstExportPendingId ? "/app/editor" : "/app/historico",
          search: firstExportPendingId
            ? { criativoId: firstExportPendingId }
            : { export: "pendente" },
        };
      }
      if (counts.Performando > 0) {
        return {
          label: `Escalar ${counts.Performando} campeão(ões)`,
          to: firstPerformandoId ? "/app/escala" : "/app/historico",
          search: firstPerformandoId
            ? { criativoId: firstPerformandoId }
            : { status: "Performando" },
        };
      }
      if (counts.Rodando > 0) {
        return {
          label: `Acompanhar ${counts.Rodando} criativo(s) rodando`,
          to: "/app/historico",
          search: { status: "Rodando" },
        };
      }
      return { label: "Gerar novos ângulos para diversificar", to: "/app/gerador" };
    })();

    const intelSettings = await loadProjectIntelSettings(supabase, data.projectId);
    const calibrationNotice =
      intelSettings?.last_calibrated_at &&
      ((intelSettings.calibration_samples ?? 0) > 0 ||
        (intelSettings.calibration_samples_conversion ?? 0) > 0)
        ? {
            calibratedAt: intelSettings.last_calibrated_at,
            hookBiasPp: intelSettings.hook_rate_bias_pp ?? null,
            samples: intelSettings.calibration_samples ?? 0,
            conversionSamples: intelSettings.calibration_samples_conversion ?? 0,
            conversionNotes: intelSettings.conversion_bias_notes ?? null,
            cpaMedio: intelSettings.cpa_medio_validado ?? null,
            roasMedio: intelSettings.roas_medio_validado ?? null,
          }
        : null;

    const { data: projectRow } = await supabase
      .from("projects")
      .select("nicho")
      .eq("id", data.projectId)
      .maybeSingle();

    let nicheComparison: {
      nicho: string;
      lines: ReturnType<typeof buildNicheBenchmarkComparison>["lines"];
    } | null = null;

    if (projectRow?.nicho?.trim()) {
      const nicheData = await loadNicheDailyInsights(supabase, projectRow.nicho.trim());
      const hookRatesProj: number[] = [];
      for (const r of resultadosProjeto ?? []) {
        if (r.metrica !== "hook_rate" || !r.valor) continue;
        if (r.intel_review_status !== "approved" && !r.observacao?.includes("Import CSV")) continue;
        const n = parseNumericMetric(r.valor);
        if (n != null) hookRatesProj.push(n);
      }
      const comp = buildNicheBenchmarkComparison({
        projectCpa: intelSettings?.cpa_medio_validado,
        projectRoas: intelSettings?.roas_medio_validado,
        projectHookRate: hookRatesProj.length
          ? hookRatesProj.reduce((a, b) => a + b, 0) / hookRatesProj.length
          : null,
        benchmarks: nicheData.benchmarks,
      });
      if (comp.hasComparison) {
        nicheComparison = { nicho: projectRow.nicho.trim(), lines: comp.lines };
      }
    }

    return {
      counts,
      total,
      exportados,
      rascunhos: semExport,
      performando: counts.Performando,
      geracoesCount: geracoesCount ?? 0,
      marcouSubiu,
      ativos,
      semExport,
      angulosTestados: [...angulosTestados],
      formatosTestados: [...formatosTestados],
      saturacaoAngulo: topAngulo?.[0] ?? null,
      saturacaoPct,
      feed,
      nextAction,
      firstExportPendingId,
      firstCriativoId,
      firstPerformandoId,
      performandoPendentes,
      staleExportReminderId: staleExportReminder?.id ?? null,
      exportSubiuReminderId: exportSubiuReminder?.id ?? null,
      rodandoMetricsReminderId: rodandoMetricsReminder?.id ?? null,
      rodandoMetricsReminderCount,
      nicheComparison,
      volumeTarget: 12,
      escalaLineage,
      sugestao:
        total === 0
          ? "Comece gerando seus primeiros 5 ângulos Andromeda."
          : angulosTestados.size < 3
            ? `Você testou ${angulosTestados.size} ângulos — diversifique para encontrar o campeão.`
            : "Continue escalando os criativos que estão performando.",
      temCsvImport,
      showCsvReminder,
      calibrationNotice,
    };
  });

export const getVslDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativos, error } = await supabase
      .from("criativos")
      .select("status, export_status, id, updated_at, angulo, angulo_json")
      .eq("project_id", data.projectId)
      .eq("formato_saida", "vsl_curta");

    if (error) throw new Error(error.message);

    const { data: resultadosProjeto } = await supabase
      .from("resultados_reportados")
      .select("observacao, criativo_id")
      .in(
        "criativo_id",
        (criativos ?? []).map((c) => c.id),
      );

    const temCsvImport = (resultadosProjeto ?? []).some((r) =>
      r.observacao?.includes("Import CSV"),
    );
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

    const rows = criativos ?? [];
    const total = rows.length;
    const exportados = rows.filter((c) => c.export_status === "pronto").length;
    const semExportList = rows.filter(
      (c) => c.export_status !== "pronto" && c.status !== "Pausado",
    );
    const semExport = semExportList.length;
    const firstExportPendingId = semExportList[0]?.id ?? null;
    const performandoRows = rows.filter((c) => c.status === "Performando");
    const performando = performandoRows.length;
    const firstPerformandoId = performandoRows[0]?.id ?? null;
    const exportSubiuReminder = rows.find(
      (c) => c.export_status === "pronto" && c.status === "Gerado",
    );

    const showCsvReminder =
      !temCsvImport &&
      exportados > 0 &&
      rows.some(
        (c) =>
          c.export_status === "pronto" &&
          c.updated_at &&
          new Date(c.updated_at).getTime() < threeDaysAgo,
      );

    const nextAction: AppLink & { label: string } =
      total === 0
        ? { label: "Gerar sua primeira VSL", to: "/app/vsl/gerador" }
        : semExport > 0
          ? {
              label: `Exportar ${semExport} VSL(s) pendente(s)`,
              to: "/app/vsl/editor",
              search: firstExportPendingId ? { criativoId: firstExportPendingId } : undefined,
            }
          : performando > 0 && firstPerformandoId
            ? {
                label: `Escalar ${performando} VSL(s) performando`,
                to: "/app/escala",
                search: { criativoId: firstPerformandoId },
              }
            : performando > 0
              ? { label: "Ver VSLs performando", to: "/app/historico", search: { status: "Performando", formato: "vsl_curta" } }
              : { label: "Gerar nova VSL", to: "/app/vsl/gerador" };

    const feed: Array<{ tag: string; title: string; desc: string; action: AppLink }> = [];
    if (total === 0) {
      feed.push({
        tag: "Começar",
        title: "Crie sua primeira VSL curta",
        desc: "Roteiro de 2 min em 6 blocos — hook visual, objeções e CTA com valor.",
        action: { to: "/app/vsl/gerador" },
      });
    }
    if (exportSubiuReminder) {
      feed.push({
        tag: "Pipeline",
        title: "VSL pronta — marque como Subiu",
        desc: "Após subir no Meta, atualize o status no pipeline VSL.",
        action: { to: "/app/historico", search: { criativoId: exportSubiuReminder.id, formato: "vsl_curta" } },
      });
    }
    if (performando > 0 && firstPerformandoId) {
      feed.push({
        tag: "Escala",
        title: `${performando} VSL(s) performando`,
        desc: "Gere variações do campeão para escalar o que já validou.",
        action: { to: "/app/escala", search: { criativoId: firstPerformandoId } },
      });
    }
    if (showCsvReminder) {
      feed.push({
        tag: "Métricas",
        title: "Importe o CSV do Meta (VSL)",
        desc: "Com 3+ dias no ar, o CSV com utm_content calibra hook rate e retenção das VSLs.",
        action: { to: "/app/historico", search: { formato: "vsl_curta", export: "pronto" } },
      });
    }

    const escalaLineage = buildEscalaLineage(
      (criativos ?? []).map((c) => ({
        id: c.id,
        angulo: c.angulo ?? "VSL",
        status: c.status,
        export_status: c.export_status,
        angulo_json: c.angulo_json,
      })),
    ).filter((l) => l.variacoes.length > 0);

    return {
      total,
      rascunhos: semExport,
      exportados,
      semExport,
      performando,
      firstPerformandoId,
      firstExportPendingId,
      exportSubiuReminderId: exportSubiuReminder?.id ?? null,
      showCsvReminder,
      nextAction,
      feed,
      escalaLineage,
    };
  });

export const getLatestCriativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        currentCriativoId: z.string().uuid().optional(),
        formatoSaida: z.enum(["criativo_curto", "vsl_curta"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (data.currentCriativoId) {
      let currentQ = supabase
        .from("criativos")
        .select("id, export_status")
        .eq("id", data.currentCriativoId)
        .eq("project_id", data.projectId);
      if (data.formatoSaida) currentQ = currentQ.eq("formato_saida", data.formatoSaida);
      const { data: current } = await currentQ.maybeSingle();
      if (current && current.export_status !== "pronto") {
        return { criativoId: current.id };
      }
    }

    let pendingQ = supabase
      .from("criativos")
      .select("id")
      .eq("project_id", data.projectId)
      .neq("export_status", "pronto");
    if (data.formatoSaida) pendingQ = pendingQ.eq("formato_saida", data.formatoSaida);
    const { data: pending } = await pendingQ
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pending) return { criativoId: pending.id };

    if (data.currentCriativoId) {
      let curQ = supabase
        .from("criativos")
        .select("id")
        .eq("id", data.currentCriativoId)
        .eq("project_id", data.projectId);
      if (data.formatoSaida) curQ = curQ.eq("formato_saida", data.formatoSaida);
      const { data: current } = await curQ.maybeSingle();
      if (current) return { criativoId: current.id };
    }

    let lastQ = supabase
      .from("criativos")
      .select("id")
      .eq("project_id", data.projectId);
    if (data.formatoSaida) lastQ = lastQ.eq("formato_saida", data.formatoSaida);
    const { data: row, error } = await lastQ
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { criativoId: row?.id ?? null };
  });

export const saveProjectDraftQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        criativoIds: z.array(z.string().uuid()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ draft_queue: data.criativoIds })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadProjectDraftQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .select("draft_queue")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const raw = row?.draft_queue;
    if (!Array.isArray(raw)) return { criativoIds: [] as string[] };
    return {
      criativoIds: raw.filter((id): id is string => typeof id === "string"),
    };
  });

export const advanceProjectDraftQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        currentCriativoId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: loadErr } = await context.supabase
      .from("projects")
      .select("draft_queue")
      .eq("id", data.projectId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    const queue = Array.isArray(row?.draft_queue)
      ? (row!.draft_queue as string[]).filter((id) => typeof id === "string")
      : [];
    const idx = queue.indexOf(data.currentCriativoId);
    const remaining = idx >= 0 ? queue.slice(idx + 1) : queue;
    const { error } = await context.supabase
      .from("projects")
      .update({ draft_queue: remaining })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { nextCriativoId: remaining[0] ?? null, remaining };
  });

export const exportZipCriativos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoIds: z.array(z.string().uuid()).min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const JSZip = (await import("jszip")).default;
    const { supabase } = context;
    const zip = new JSZip();

    const { data: rows, error } = await supabase
      .from("criativos")
      .select("*")
      .in("id", data.criativoIds);

    if (error) throw new Error(error.message);

    const exportaveis = (rows ?? []).filter((c) => c.export_status === "pronto");
    const skipped = (rows ?? []).length - exportaveis.length;

    for (const c of exportaveis) {
      const folder = zip.folder(c.angulo.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40));
      if (!folder) continue;

      folder.file(
        "metadata.json",
        JSON.stringify(
          {
            id: c.id,
            angulo: c.angulo,
            produto: c.produto,
            utm_content: c.utm_content,
            export_status: c.export_status,
            score_json: c.score_json,
          },
          null,
          2,
        ),
      );

      const paths = (c.export_paths as string[]) ?? [];
      for (const p of paths) {
        const { data: file, error: dlErr } = await supabase.storage.from("criativos-media").download(p);
        if (dlErr || !file) continue;
        const buf = await file.arrayBuffer();
        folder.file(pathBasename(p), buf);
      }
    }

    const base64 = await zip.generateAsync({ type: "base64" });
    return {
      zipBase64: base64,
      filename: `andromeda-export-${Date.now()}.zip`,
      included: exportaveis.length,
      skipped,
    };
  });

export const listResultados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("resultados_reportados")
      .select("*, criativos(id, angulo, produto, project_id)")
      .order("created_at", { ascending: false });

    if (data.criativoId) {
      query = query.eq("criativo_id", data.criativoId);
    }

    const { data: rows, error } = await query.limit(50);
    if (error) throw new Error(error.message);

    const filtered = data.projectId
      ? (rows ?? []).filter((r) => {
          const c = r.criativos as { project_id?: string } | null;
          return c?.project_id === data.projectId;
        })
      : rows ?? [];

    return filtered;
  });

export const gerarVariacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      tipos: z.array(z.string()).min(1),
      organizationId: z.string().uuid(),
      projectId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const validIds = new Set(["hook-v", "hook-t", "avatar", "formato", "empilha", "benef", "cta"]);
    const variacoes = data.tipos
      .filter((t) => validIds.has(t))
      .map((variacaoId) => ({ variacaoId: variacaoId as "hook-v" | "hook-t" | "avatar" | "formato" | "empilha" | "benef" | "cta" }));

    if (variacoes.length === 0) {
      return { variacoes: [] };
    }

    return gerarVariacoesEscala({
      data: {
        criativoId: data.criativoId,
        variacoes,
        organizationId: data.organizationId,
        projectId: data.projectId,
      },
    });
  });

export const getInteligenciaNicho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: project } = await supabase
      .from("projects")
      .select("nicho, organization_id")
      .eq("id", data.projectId)
      .maybeSingle();

    const { data: criativos, error: cErr } = await supabase
      .from("criativos")
      .select(
        "id, angulo, status, formato_saida, estilo_producao, angulo_json, export_status, performando_intel_status, source",
      )
      .eq("project_id", data.projectId);

    if (cErr) throw new Error(cErr.message);

    const criativoIds = (criativos ?? []).map((c) => c.id);
    const { data: resultadosRaw, error: rErr } = criativoIds.length
      ? await supabase
          .from("resultados_reportados")
          .select("*, criativos(id, angulo, project_id)")
          .in("criativo_id", criativoIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [], error: null };

    if (rErr) throw new Error(rErr.message);

    const resultadosAprovados = (resultadosRaw ?? []).filter((r) => {
      if (r.intel_review_status === "approved") return true;
      return !!(r.observacao?.includes("Import CSV") && r.intel_review_status === "pending");
    });

    const resultadosPendentes = (resultadosRaw ?? []).filter(
      (r) =>
        r.intel_review_status === "pending" &&
        !r.observacao?.includes("Import CSV"),
    ).length;

    const performando = (criativos ?? []).filter((c) => c.status === "Performando");
    const performandoValidados = performando.filter(
      (c) => c.performando_intel_status === "approved",
    );
    const performandoPendentes = performando.filter(
      (c) => c.performando_intel_status === "pending",
    ).length;
    const rodando = (criativos ?? []).filter((c) => c.status === "Rodando");
    const exportados = (criativos ?? []).filter((c) => c.export_status === "pronto");
    const importados = (criativos ?? []).filter((c) => c.source === "importado");

    const hookRatesEstimados: number[] = [];
    const hookRatesReais: number[] = [];
    const feedbackCounts = { baixo: 0, medio: 0, alto: 0 };
    const anguloPerformance: Record<string, { performando: number; total: number }> = {};
    const estiloApproved: Record<string, number> = {};

    let importComTranscricao = 0;
    let importParcial = 0;

    for (const c of criativos ?? []) {
      const aj = c.angulo_json as {
        sinais_andromeda?: {
          hook_rate_estimado?: string;
          feedback_negativo_esperado?: string;
        };
        vsl_sinais?: {
          hook_rate_estimado?: string;
          hold_rate_30s?: string;
          taxa_conclusao_estimada?: string;
          feedback_negativo_esperado?: string;
        };
        export_transcricao?: { source?: string };
        importado?: boolean;
      } | null;
      const sinais =
        c.formato_saida === "vsl_curta" && aj?.vsl_sinais
          ? aj.vsl_sinais
          : aj?.sinais_andromeda;
      if (sinais?.hook_rate_estimado) {
        const nums = sinais.hook_rate_estimado.match(/\d+/g)?.map(Number) ?? [];
        if (nums.length) {
          hookRatesEstimados.push(nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0]);
        }
      }
      const fb = sinais?.feedback_negativo_esperado?.toLowerCase();
      if (fb === "baixo" || fb === "medio" || fb === "médio" || fb === "alto") {
        const key = fb === "médio" ? "medio" : fb;
        feedbackCounts[key as keyof typeof feedbackCounts]++;
      }

      const base = normalizeAnguloBase(c.angulo);
      if (!anguloPerformance[base]) anguloPerformance[base] = { performando: 0, total: 0 };
      anguloPerformance[base].total++;
      if (c.status === "Performando" && c.performando_intel_status === "approved") {
        anguloPerformance[base].performando++;
      }

      if (
        c.status === "Performando" &&
        c.performando_intel_status === "approved" &&
        c.estilo_producao
      ) {
        estiloApproved[c.estilo_producao] = (estiloApproved[c.estilo_producao] ?? 0) + 1;
      }

      if (c.source === "importado") {
        const txSource = aj?.export_transcricao?.source;
        if (txSource === "whisper" || txSource === "paste") importComTranscricao++;
        else importParcial++;
      }
    }

    for (const r of resultadosAprovados) {
      if (r.metrica === "hook_rate" && r.valor) {
        const n = parseNumericMetric(r.valor);
        if (n != null) hookRatesReais.push(n);
      }
    }

    const projPerf = await getProjectPerformanceContext(supabase, data.projectId, {
      approvedOnly: true,
    });

    const metricsByCriativoIntel = new Map<string, ChampionMetric[]>();
    for (const r of resultadosAprovados) {
      if (!r.criativo_id || !r.metrica) continue;
      const list = metricsByCriativoIntel.get(r.criativo_id) ?? [];
      if (!list.some((x) => x.metrica === r.metrica)) {
        list.push({
          metrica: r.metrica,
          valor: r.valor ?? "—",
          tipo: r.tipo ?? "clique",
          source: r.observacao?.includes("Import CSV") ? "csv_auto" : "approved",
        });
        metricsByCriativoIntel.set(r.criativo_id, list);
      }
    }

    const firstPerformandoCriativoId = pickBestPerformandoCriativoId(
      criativos ?? [],
      metricsByCriativoIntel,
    );

    const championsForRanking = await buildChampionsForRanking(supabase, data.projectId);

    const metricasAgg: Record<string, string[]> = {};
    for (const r of resultadosAprovados) {
      if (r.metrica && r.valor) {
        const list = metricasAgg[r.metrica] ?? [];
        list.push(r.valor);
        metricasAgg[r.metrica] = list;
      }
    }

    const topAngulos = Object.entries(anguloPerformance)
      .filter(([, v]) => v.performando > 0)
      .sort((a, b) => b[1].performando - a[1].performando)
      .slice(0, 5)
      .map(([angulo, v]) => ({ angulo, performando: v.performando, total: v.total }));

    const formatos = [...new Set((criativos ?? []).map((c) => c.formato_saida).filter(Boolean))];
    const intelSettings = await loadProjectIntelSettings(supabase, data.projectId);
    const orgIntelSettings = project?.organization_id
      ? await loadOrgIntelSettings(supabase, project.organization_id)
      : null;

    const rodandoSemMetrica = rodando.filter(
      (c) => !metricsByCriativoIntel.has(c.id),
    ).length;

    const nextAction = (() => {
      if (performandoPendentes > 0) {
        return {
          label: `${performandoPendentes} Performando aguardando validação da equipe`,
          description:
            "Claims não validados não entram no gerador. A equipe Andromeda revisa para proteger a inteligência do projeto.",
          to: "/app/historico" as const,
          search: { status: "Performando" as const },
        };
      }
      if (resultadosPendentes > 0) {
        return {
          label: `${resultadosPendentes} métrica(s) aguardando validação`,
          description: "Somente métricas aprovadas pela equipe alimentam calibração e geração.",
          to: "/app/historico" as const,
        };
      }
      if (rodandoSemMetrica > 0) {
        return {
          label: `Reportar métricas de ${rodandoSemMetrica} criativo(s) rodando`,
          description: "CPA, ROAS e hook rate validados melhoram a calibração do projeto.",
          to: "/app/historico" as const,
          search: { status: "Rodando" as const },
        };
      }
      if (firstPerformandoCriativoId) {
        return {
          label: "Escalar campeão validado",
          description: "Use variações de escala a partir do criativo com melhor performance aprovada.",
          to: "/app/escala" as const,
          search: { criativoId: firstPerformandoCriativoId },
        };
      }
      if ((criativos?.length ?? 0) === 0) {
        return {
          label: "Importar campeões ou gerar ângulos",
          description: "Comece alimentando a inteligência com dados reais do projeto.",
          to: "/app/gerador" as const,
        };
      }
      return {
        label: "Gerar novos ângulos diversificados",
        description: "A IA evita micropersonas já testadas e formatos que falharam no projeto.",
        to: "/app/gerador" as const,
      };
    })();

    let nicheInsights: Awaited<ReturnType<typeof loadNicheDailyInsights>> | null = null;
    if (project?.nicho?.trim()) {
      nicheInsights = await loadNicheDailyInsights(supabase, project.nicho.trim());
    }

    const [generalContextPreview, performanceContextPreview] = await Promise.all([
      project?.organization_id
        ? getGeneralIntelForProject(supabase, data.projectId)
        : Promise.resolve(null),
      getProjectPerformanceContext(supabase, data.projectId, { approvedOnly: true }).then(
        (ctx) => ctx?.summaryText ?? null,
      ),
    ]);

    return {
      resumo: {
        total: criativos?.length ?? 0,
        importados: importados.length,
        geradosNaPlataforma: (criativos?.length ?? 0) - importados.length,
        performando: performando.length,
        performandoValidados: performandoValidados.length,
        rodando: rodando.length,
        exportados: exportados.length,
        resultadosReportados: resultadosAprovados.length,
        resultadosPendentes,
        performandoPendentes,
        referenciasTranscricao: orgIntelSettings?.reference_transcriptions?.length ?? 0,
        hookRateMedioEstimado: hookRatesEstimados.length
          ? Math.round(hookRatesEstimados.reduce((a, b) => a + b, 0) / hookRatesEstimados.length)
          : null,
        hookRateMedioReal: hookRatesReais.length
          ? Math.round(hookRatesReais.reduce((a, b) => a + b, 0) / hookRatesReais.length)
          : null,
      },
      feedbackDistribuicao: feedbackCounts,
      metricasReportadas: Object.entries(metricasAgg).map(([metrica, valores]) => ({
        metrica,
        amostras: valores.length,
        ultimo: valores[0],
        exemplos: valores.slice(0, 3),
      })),
      topAngulos,
      championsForRanking,
      estilosCampeoes: Object.entries(estiloApproved)
        .sort((a, b) => b[1] - a[1])
        .map(([estilo, count]) => ({ estilo, count })),
      firstPerformandoCriativoId,
      sinaisCalibration: projPerf?.sinaisCalibration ?? [],
      intelSettings,
      formatosTestados: formatos,
      contextPreview: generalContextPreview,
      performanceContextPreview,
      referenceTranscriptions: (orgIntelSettings?.reference_transcriptions ?? []).map((r) => ({
        id: r.id,
        preview: r.text.length > 160 ? `${r.text.slice(0, 160)}…` : r.text,
        added_at: r.added_at,
        charCount: r.text.length,
        label: r.label,
        analysis: r.analysis,
      })),
      referenceCombo: orgIntelSettings?.reference_combo ?? null,
      variationFailures: projPerf?.variationFailures ?? [],
      failedPatterns: projPerf?.failedPatterns ?? [],
      micropersonasEvitar: projPerf?.recentAnguloNames ?? [],
      importQuality:
        importados.length > 0
          ? { total: importados.length, comTranscricao: importComTranscricao, parcial: importParcial }
          : null,
      nicheInsights: nicheInsights?.insights ?? [],
      nicheInsightsCached: nicheInsights?.cached ?? false,
      nicheBenchmarks: nicheInsights?.benchmarks ?? null,
      nicheComparison: (() => {
        if (!project?.nicho?.trim()) return null;
        const comp = buildNicheBenchmarkComparison({
          projectCpa: intelSettings?.cpa_medio_validado,
          projectRoas: intelSettings?.roas_medio_validado,
          projectHookRate: hookRatesReais.length
            ? hookRatesReais.reduce((a, b) => a + b, 0) / hookRatesReais.length
            : null,
          benchmarks: nicheInsights?.benchmarks,
        });
        return comp.hasComparison
          ? { nicho: project.nicho.trim(), lines: comp.lines }
          : null;
      })(),
      resultadosRecentes: resultadosAprovados.slice(0, 8).map((r) => ({
        angulo: (r.criativos as { angulo?: string })?.angulo ?? "—",
        tipo: r.tipo,
        metrica: r.metrica,
        valor: r.valor,
        created_at: r.created_at,
        intelReviewStatus: r.intel_review_status,
      })),
      pendentesValidacao: {
        performando: performandoPendentes,
        resultados: resultadosPendentes,
      },
      porFormato: {
        criativo_curto: buildFormatoIntelSegment(criativos ?? [], "criativo_curto"),
        vsl_curta: buildFormatoIntelSegment(criativos ?? [], "vsl_curta"),
      },
      nextAction,
    };
  });

export const getIntelReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativos } = await supabase
      .from("criativos")
      .select(
        "id, angulo, produto, status, performando_intel_status, performando_intel_submitted_at, source, angulo_json",
      )
      .eq("project_id", data.projectId);

    const criativoIds = (criativos ?? []).map((c) => c.id);
    const { data: allResultados } = criativoIds.length
      ? await supabase
          .from("resultados_reportados")
          .select("id, criativo_id, metrica, observacao, created_at, intel_review_status")
          .in("criativo_id", criativoIds)
      : { data: [] };

    const resultadosRaw = (allResultados ?? []).filter((r) => r.intel_review_status === "pending");

    const performandoPending = (criativos ?? []).filter(
      (c) => c.status === "Performando" && c.performando_intel_status === "pending",
    );
    const resultadosPending = (resultadosRaw ?? []).filter(
      (r) => !r.observacao?.includes("Import CSV"),
    );

    const pendingItems: Array<{
      kind: "performando" | "resultado";
      criativoId: string;
      angulo: string;
      produto: string;
      submittedAt: string;
      priorityScore: number;
      priorityLabel: ReturnType<typeof priorityLabelFromScore>;
      priorityHint: string;
    }> = [];

    const linkedByCriativo = new Map<string, { metrica?: string | null; observacao?: string | null }>();
    for (const r of allResultados ?? []) {
      if (!linkedByCriativo.has(r.criativo_id)) {
        linkedByCriativo.set(r.criativo_id, { metrica: r.metrica, observacao: r.observacao });
      }
    }

    for (const c of performandoPending) {
      const linked = linkedByCriativo.get(c.id);
      const score = computeQueuePriorityScore({
        kind: "performando",
        observacao: linked?.observacao,
        metrica: linked?.metrica,
        source: c.source,
        hasWhisperTranscription: hasWhisperTranscriptionFromAnguloJson(c.angulo_json),
      });
      pendingItems.push({
        kind: "performando",
        criativoId: c.id,
        angulo: c.angulo,
        produto: c.produto,
        submittedAt: c.performando_intel_submitted_at ?? "",
        priorityScore: score,
        priorityLabel: priorityLabelFromScore(score),
        priorityHint: priorityHintForUser(score),
      });
    }

    const criativoById = new Map((criativos ?? []).map((c) => [c.id, c]));
    for (const r of resultadosPending) {
      const c = criativoById.get(r.criativo_id);
      const score = computeQueuePriorityScore({
        kind: "resultado",
        observacao: r.observacao,
        metrica: r.metrica,
        source: c?.source,
        hasWhisperTranscription: hasWhisperTranscriptionFromAnguloJson(c?.angulo_json),
      });
      pendingItems.push({
        kind: "resultado",
        criativoId: r.criativo_id,
        angulo: c?.angulo ?? "—",
        produto: c?.produto ?? "—",
        submittedAt: r.created_at,
        priorityScore: score,
        priorityLabel: priorityLabelFromScore(score),
        priorityHint: priorityHintForUser(score),
      });
    }

    pendingItems.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    const totalPending = performandoPending.length + resultadosPending.length;

    const priorityByCriativoId: Record<
      string,
      { priorityScore: number; priorityLabel: ReturnType<typeof priorityLabelFromScore>; priorityHint: string }
    > = {};
    for (const item of pendingItems) {
      priorityByCriativoId[item.criativoId] = {
        priorityScore: item.priorityScore,
        priorityLabel: item.priorityLabel,
        priorityHint: item.priorityHint,
      };
    }

    return {
      totalPending,
      performandoPending: performandoPending.length,
      resultadosPending: resultadosPending.length,
      priorityByCriativoId,
      estimateText:
        totalPending > 0
          ? "Validação geralmente em até 24h úteis. CSV do Meta com utm_content acelera a fila."
          : null,
      oldestPending: pendingItems.slice(0, 5),
      accelerateTips: [
        "Importe CSV do Ads Manager com coluna utm_content",
        "Reporte hook rate, CPA ou ROAS junto com o claim Performando",
        "Importe campeões com vídeo + transcrição automática",
      ],
    };
  });

export const getChampionsForRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const champions = await buildChampionsForRanking(context.supabase, data.projectId);
    return { champions };
  });

export const fetchChampionPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    return getChampionPerformanceContext(context.supabase, data.criativoId);
  });

export const fetchProjectFormatContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    return getProjectFormatContext(context.supabase, data.projectId);
  });

const DEFAULT_ETA = { angulosSec: 60, vslSec: 45, draftSec: 15, exportSec: 45, brollSec: 300 };

export const getProjectFunnelKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      organizationId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: criativos } = await context.supabase
      .from("criativos")
      .select("id, export_status, status, created_at, updated_at, angulo")
      .eq("project_id", data.projectId);

    const rows = criativos ?? [];
    const rascunhos = rows.length;
    const exportados = rows.filter((c) => c.export_status === "pronto").length;
    const subiu = rows.filter((c) => c.status === "Subiu" || c.status === "Rodando" || c.status === "Performando").length;
    const taxaExportRascunho = rascunhos > 0 ? Math.round((exportados / rascunhos) * 100) : null;
    const taxaSubiuExport = exportados > 0 ? Math.round((subiu / exportados) * 100) : null;

    const variacoesEscala = rows.filter((c) => c.angulo.includes(" · var ")).length;
    const campeoes = rows.filter((c) => c.status === "Performando").length;
    const variacoesPorCampeao =
      campeoes > 0 ? Math.round((variacoesEscala / campeoes) * 10) / 10 : null;

    let validacaoFalhou = 0;
    let ttfeMedioSec: number | null = null;
    if (data.organizationId) {
      const { count } = await supabaseAdmin
        .from("funnel_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organizationId)
        .eq("event_type", "angulos_validacao_falhou")
        .gte("created_at", since30d);
      validacaoFalhou = count ?? 0;

      const { data: ttfeEvents } = await supabaseAdmin
        .from("funnel_events")
        .select("duration_ms")
        .eq("organization_id", data.organizationId)
        .eq("event_type", "export_pronto")
        .eq("success", true)
        .gte("created_at", since30d)
        .not("duration_ms", "is", null)
        .limit(50);

      const durations = (ttfeEvents ?? []).map((e) => e.duration_ms!).filter(Boolean);
      if (durations.length) {
        ttfeMedioSec = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000);
      }
    }

    const { count: angulosGerados } = await supabaseAdmin
      .from("funnel_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "angulos_gerados")
      .eq("success", true)
      .gte("created_at", since30d);

    const diversidadeOkPct =
      angulosGerados && validacaoFalhou >= 0
        ? Math.max(0, Math.round(((angulosGerados - validacaoFalhou) / angulosGerados) * 100))
        : null;

    return {
      rascunhos,
      exportados,
      subiu,
      taxaExportRascunho,
      taxaSubiuExport,
      variacoesEscala,
      variacoesPorCampeao,
      validacaoFalhou,
      diversidadeOkPct,
      ttfeMedioSec,
      periodo: "30d",
    };
  });

export const getGeradorEtaEstimates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabaseAdmin
      .from("funnel_events")
      .select("event_type, duration_ms")
      .gte("created_at", since)
      .eq("success", true)
      .not("duration_ms", "is", null);

    const buckets: Record<string, number[]> = {};
    for (const e of events ?? []) {
      if (!e.duration_ms) continue;
      const list = buckets[e.event_type] ?? [];
      list.push(e.duration_ms);
      buckets[e.event_type] = list;
    }

    const avg = (key: string, fallback: number) => {
      const list = buckets[key];
      if (!list?.length) return fallback;
      return Math.round(list.reduce((a, b) => a + b, 0) / list.length / 1000);
    };

    const angulosFromApi = await supabaseAdmin
      .from("api_usage_events")
      .select("created_at")
      .eq("event_type", "gerar_angulos")
      .eq("success", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    let angulosSec = avg("angulos_gerados", DEFAULT_ETA.angulosSec);
    if (!buckets.angulos_gerados?.length && (angulosFromApi.data?.length ?? 0) >= 3) {
      angulosSec = 75;
    }

    return {
      angulosSec,
      vslSec: avg("draft_created", DEFAULT_ETA.vslSec),
      draftSec: avg("draft_created", DEFAULT_ETA.draftSec),
      exportSec: avg("render_done", DEFAULT_ETA.exportSec),
      brollSec: avg("render_done", DEFAULT_ETA.brollSec),
      sampleCount: Object.values(buckets).flat().length,
    };
  });

function pathBasename(p: string) {
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  });

export const reportarResultado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      tipo: z.enum(["venda", "lead", "clique"]),
      metrica: z.string().optional(),
      valor: z.string().optional(),
      observacao: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("resultados_reportados").insert({
      criativo_id: data.criativoId,
      user_id: userId,
      tipo: data.tipo as ResultadoTipo,
      metrica: data.metrica ?? null,
      valor: data.valor ?? null,
      observacao: data.observacao ?? null,
      intel_review_status: "pending",
    });

    if (error) throw new Error(error.message);

    const { data: criativo } = await supabase
      .from("criativos")
      .select("project_id")
      .eq("id", data.criativoId)
      .maybeSingle();
    if (criativo?.project_id && data.metrica) {
      const perf = await getProjectPerformanceContext(supabase, criativo.project_id);
      await syncProjectCalibration(supabase, criativo.project_id, perf);
    }

    return { ok: true };
  });

/** Importa métricas do Ads Manager (CSV) e associa por utm_content ou nome do anúncio */
export const importMetricasCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      csvText: z.string().min(10),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: criativos, error: cErr } = await supabase
      .from("criativos")
      .select("id, utm_content, angulo, produto, status, performando_intel_status")
      .eq("project_id", data.projectId);

    if (cErr) throw new Error(cErr.message);

    const parsedRows = parseMetaAdsCsv(data.csvText);
    if (parsedRows.length === 0) throw new Error("CSV precisa de cabeçalho e ao menos uma linha de dados");

    let imported = 0;
    let autoApproved = 0;
    let performandoAuto = 0;

    for (const row of parsedRows) {
      const match = (criativos ?? []).find(
        (c) =>
          (row.utmContent && c.utm_content === row.utmContent) ||
          (row.adName && (c.angulo?.toLowerCase().includes(row.adName.toLowerCase()) ?? false)),
      );
      if (!match) continue;

      const utmExact = !!(row.utmContent && match.utm_content === row.utmContent);
      const reviewStatus = utmExact ? "approved" : "pending";
      const metricsToInsert =
        row.metrics.length > 0
          ? row.metrics
          : [{ metrica: "import_csv", valor: "1" }];

      for (const m of metricsToInsert) {
        const { error } = await supabase.from("resultados_reportados").insert({
          criativo_id: match.id,
          user_id: userId,
          tipo: "clique",
          metrica: m.metrica,
          valor: m.valor,
          observacao: `Import CSV linha ${row.lineNumber}${utmExact ? " (match UTM — auto-aprovado)" : ""}`,
          intel_review_status: reviewStatus,
        });
        if (!error) imported++;
        if (!error && reviewStatus === "approved") autoApproved++;
      }

      const strong = csvRowIndicatesStrongPerformance(row.metrics);
      if (utmExact && strong) {
        const patch: Record<string, unknown> = {};
        if (match.status === "Rodando" || match.status === "Subiu") {
          patch.status = "Performando";
          performandoAuto++;
        }
        if (match.performando_intel_status !== "approved") {
          patch.performando_intel_status = "approved";
          patch.performando_intel_submitted_at = new Date().toISOString();
          patch.performando_intel_reviewed_at = new Date().toISOString();
          patch.performando_intel_notes = "Auto-aprovado via import CSV Meta (métricas positivas + match UTM)";
        }
        if (Object.keys(patch).length > 0) {
          await supabase.from("criativos").update(patch).eq("id", match.id);
        }
      }
    }

    const perf = await getProjectPerformanceContext(supabase, data.projectId);
    await syncProjectCalibration(supabase, data.projectId, perf);

    return {
      imported,
      total: parsedRows.length,
      autoApproved,
      performandoAuto,
    };
  });

const ImportMetricSchema = z.object({
  metrica: z.string().min(1),
  valor: z.string().min(1),
});

const ImportCampeaoItemSchema = z.object({
  storagePath: z.string().min(1),
  nomeAngulo: z.string().min(1).max(200),
  metrics: z.array(ImportMetricSchema).optional().default([]),
  formatoSaida: z.enum(["criativo_curto", "vsl_curta"]).optional(),
  estiloProducao: z.enum(["texto_animado", "clipes_texto", "ugc_avatar"]).optional(),
  aspectRatio: z.enum(["9:16", "4:5", "1:1"]).optional(),
  notas: z.string().max(1000).optional(),
  fileName: z.string().optional(),
});

export const importCriativoCampeao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    ImportCampeaoItemSchema.extend({
      projectId: z.string().uuid(),
      organizationId: z.string().uuid(),
      produto: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    assertUserOwnedMediaPath(userId, data.storagePath);
    await assertCanImportCampeoes(supabase, data.organizationId, 1);

    const result = await executeImportCriativoCampeao({
      supabase,
      userId,
      projectId: data.projectId,
      organizationId: data.organizationId,
      storagePath: data.storagePath,
      nomeAngulo: data.nomeAngulo,
      metrics: data.metrics,
      formatoSaida: data.formatoSaida,
      estiloProducao: data.estiloProducao,
      aspectRatio: data.aspectRatio,
      notas: data.notas,
      fileName: data.fileName,
      produto: data.produto,
    });

    const perf = await getProjectPerformanceContext(supabase, data.projectId);
    await syncProjectCalibration(supabase, data.projectId, perf);

    return result;
  });

export const importCriativosCampeoesLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      organizationId: z.string().uuid(),
      produto: z.string().optional(),
      items: z.array(ImportCampeaoItemSchema).min(1).max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanImportCampeoes(supabase, data.organizationId, data.items.length);

    const results: Array<{ criativoId: string; nomeAngulo: string; ok: boolean; error?: string }> = [];

    for (const item of data.items) {
      try {
        assertUserOwnedMediaPath(userId, item.storagePath);
        const result = await executeImportCriativoCampeao({
          supabase,
          userId,
          projectId: data.projectId,
          organizationId: data.organizationId,
          storagePath: item.storagePath,
          nomeAngulo: item.nomeAngulo,
          metrics: item.metrics,
          formatoSaida: item.formatoSaida,
          estiloProducao: item.estiloProducao,
          aspectRatio: item.aspectRatio,
          notas: item.notas,
          fileName: item.fileName,
          produto: data.produto,
        });
        results.push({ criativoId: result.criativoId, nomeAngulo: item.nomeAngulo, ok: true });
      } catch (e) {
        results.push({
          criativoId: "",
          nomeAngulo: item.nomeAngulo,
          ok: false,
          error: e instanceof Error ? e.message : "Erro desconhecido",
        });
      }
    }

    const perf = await getProjectPerformanceContext(supabase, data.projectId);
    await syncProjectCalibration(supabase, data.projectId, perf);

    const imported = results.filter((r) => r.ok).length;
    return { imported, total: data.items.length, results };
  });

const ReferenceTranscriptionSchema = z.object({
  transcription: z.string().min(40).max(12000),
  label: z.string().max(120).optional(),
  skipAnalysis: z.boolean().optional(),
});

export const addProjectReferenceTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    ReferenceTranscriptionSchema.extend({
      organizationId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const analysis =
      data.skipAnalysis === true
        ? undefined
        : await analyzeReferenceTranscription({
            apiKey: process.env.ANTHROPIC_API_KEY,
            userId,
            text: data.transcription.trim(),
            label: data.label,
          });
    return appendOrgReferenceTranscription(supabase, data.organizationId, data.transcription, {
      label: data.label,
      analysis,
    });
  });

const ReferenceSnippetSchema = z.object({
  text: z.string().min(40).max(12000),
  label: z.string().max(120).optional(),
});

export const addProjectReferenceTranscriptionsBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      snippets: z.array(ReferenceSnippetSchema).min(1).max(8),
      skipAnalysis: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const withAnalysis = await Promise.all(
      data.snippets.map(async (snippet) => {
        const analysis =
          data.skipAnalysis === true
            ? undefined
            : await analyzeReferenceTranscription({
                apiKey,
                userId: userId,
                text: snippet.text.trim(),
                label: snippet.label,
              });
        return { ...snippet, analysis };
      }),
    );
    return appendOrgReferenceTranscriptionsBatch(supabase, data.organizationId, withAnalysis);
  });

export const setProjectReferenceComboFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      structureId: z.string().uuid().optional(),
      formatoId: z.string().uuid().optional(),
      anguloId: z.string().uuid().optional(),
      clear: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.clear) {
      await saveOrgReferenceCombo(supabase, data.organizationId, null);
      return { ok: true };
    }
    await saveOrgReferenceCombo(supabase, data.organizationId, {
      structure_id: data.structureId,
      formato_id: data.formatoId,
      angulo_id: data.anguloId,
    });
    return { ok: true };
  });

export const removeProjectReferenceTranscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      transcriptionId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    return removeOrgReferenceTranscription(supabase, data.organizationId, data.transcriptionId);
  });

export { ProjectScopeSchema };

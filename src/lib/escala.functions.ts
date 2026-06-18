import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";
import { escalaAnaliseSystemFor, escalaVariacaoSystemFor } from "./prompts/escala.system";
import {
  EscalaAnaliseSchema,
  EscalaVariacaoOutputSchema,
  type EscalaAnalise,
} from "./schemas/escala.schema";
import { trackApiUsage } from "./api-usage";
import type { RoteiroBloco } from "./schemas/angulos.schema";
import { assertCanEscala } from "./plan-enforcement";
import {
  getChampionPerformanceContext,
  getProjectPerformanceContext,
  getVariationFailureContext,
} from "./project-performance-context";
import { formatTranscriptionForPrompt } from "./export-transcription";
import { ensureExportTranscription } from "./transcribe-export";
import type { ExportTranscricaoSnapshot } from "./export-transcription";
import { buildOfferSnapshot, formatOfferSnapshotBlock } from "./offer-snapshot";
import { runWithConcurrency } from "./gerador-helpers";

const VARIACAO_IDS = ["hook-v", "hook-t", "avatar", "formato", "empilha", "benef", "cta"] as const;

async function buildEscalaPerformanceBlock(
  supabase: SupabaseClient,
  criativoId: string,
  projectId: string | null,
): Promise<string> {
  const parts: string[] = [];
  const champCtx = await getChampionPerformanceContext(supabase, criativoId);
  if (champCtx) parts.push(champCtx.summaryText);
  if (projectId) {
    const projCtx = await getProjectPerformanceContext(supabase, projectId);
    if (projCtx) {
      if (projCtx.failedPatterns.length) {
        parts.push(
          `Histórico do projeto — estilos que falharam: ${projCtx.failedPatterns.map((f) => `${f.estilo} (${f.count}x, 0 performando)`).join("; ")}`,
        );
      }
      if (projCtx.variationFailures.length) {
        parts.push(
          `Variações de escala sem sucesso: ${projCtx.variationFailures.map((v) => `${v.variacaoId} (${v.count}x)`).join(", ")}`,
        );
      }
      if (projCtx.sinaisCalibration.length) {
        parts.push(
          "Calibração hook rate (estimado vs real):",
          ...projCtx.sinaisCalibration.slice(0, 3).map(
            (s) => `- ${s.angulo}: est ${s.hookRateEstimado ?? "—"} / real ${s.hookRateReal ?? "—"}${s.delta ? ` (${s.delta})` : ""}`,
          ),
        );
      }
    }
    const varCtx = await getVariationFailureContext(supabase, projectId);
    if (varCtx) parts.push(varCtx);
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

async function executeAnalisarCampeao(params: {
  supabase: SupabaseClient;
  userId: string;
  criativoId: string;
  force: boolean;
}): Promise<{ analise: EscalaAnalise; cached: boolean }> {
  const { supabase, userId, criativoId, force } = params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

  const { data: campeao, error } = await supabase
    .from("criativos")
    .select("*")
    .eq("id", criativoId)
    .single();
  if (error || !campeao) throw new Error("Criativo não encontrado");

  const aj = (campeao.angulo_json as Record<string, unknown>) ?? {};
  if (!force && aj.escala_analise) {
    return { analise: aj.escala_analise as EscalaAnalise, cached: true };
  }

  const roteiro = (campeao.roteiro as RoteiroBloco[]) ?? [];

  const existingSnap = aj.export_transcricao as ExportTranscricaoSnapshot | undefined;
  const exportPaths = Array.isArray(campeao.export_paths) ? (campeao.export_paths as string[]) : [];

  if (campeao.export_status === "pronto" && exportPaths.length > 0) {
    const transcricao = await ensureExportTranscription({
      criativoId,
      roteiro,
      exportPaths,
      existing: existingSnap ?? null,
      forceWhisper: force || existingSnap?.source !== "whisper",
    });
    aj.export_transcricao = transcricao;
    await supabase
      .from("criativos")
      .update({ angulo_json: { ...aj, export_transcricao: transcricao } })
      .eq("id", criativoId);
  } else if (
    campeao.export_status === "pronto" &&
    !(existingSnap?.blocos?.length)
  ) {
    const { buildExportTranscriptionSnapshot } = await import("./export-transcription");
    aj.export_transcricao = buildExportTranscriptionSnapshot(roteiro);
    await supabase
      .from("criativos")
      .update({ angulo_json: { ...aj, export_transcricao: aj.export_transcricao } })
      .eq("id", criativoId);
  }

  const transcricaoExport = formatTranscriptionForPrompt({ ...campeao, angulo_json: aj });
  let geracaoContext = "";
  let offerBlock = "";
  if (campeao.geracao_id) {
    const { data: geracao } = await supabase
      .from("geracoes")
      .select("url, product_type, goal, context, diagnostico")
      .eq("id", campeao.geracao_id)
      .single();
    if (geracao) {
      geracaoContext = `URL: ${geracao.url}\nProduto: ${geracao.product_type}\nObjetivo: ${geracao.goal}\nContexto: ${geracao.context ?? ""}\nDiagnóstico: ${JSON.stringify(geracao.diagnostico)}`;
      if (geracao.url) {
        try {
          offerBlock = formatOfferSnapshotBlock(await buildOfferSnapshot(geracao.url, apiKey));
        } catch {
          /* URL inacessível */
        }
      }
    }
  }

  const userMsg = `CRIATIVO CAMPEÃO:
Ângulo: ${campeao.angulo}
Produto: ${campeao.produto}
Status: ${campeao.status}
Formato: ${campeao.formato_saida} / ${campeao.estilo_producao}
Export: ${campeao.export_status ?? "—"} · ${Array.isArray(campeao.export_paths) ? campeao.export_paths.length : 0} arquivo(s)

${transcricaoExport}

ROTEIRO JSON (referência secundária se divergir da transcrição do export):
${JSON.stringify(roteiro, null, 2)}

ANGULO_JSON:
${JSON.stringify(aj, null, 2)}

${geracaoContext}
${offerBlock}
${await buildEscalaPerformanceBlock(supabase, campeao.id, campeao.project_id)}

Execute as 4 operações e devolva o menu completo das 7 variações.`;

  const text = await callAnthropicJson({
    apiKey,
    system: escalaAnaliseSystemFor(campeao.formato_saida),
    userMessage: userMsg,
    maxTokens: 8192,
  });

  const parsed = EscalaAnaliseSchema.safeParse(extractJsonFromAnthropicText(text));
  if (!parsed.success) {
    trackApiUsage({
      userId,
      organizationId: campeao.organization_id,
      eventType: "analisar_campeao",
      success: false,
    });
    throw new Error("Análise inválida: " + parsed.error.message.slice(0, 200));
  }

  const analise: EscalaAnalise = {
    ...parsed.data,
    gerado_em: new Date().toISOString(),
  };

  await supabase
    .from("criativos")
    .update({ angulo_json: { ...aj, escala_analise: analise } })
    .eq("id", criativoId);

  trackApiUsage({
    userId,
    organizationId: campeao.organization_id,
    eventType: "analisar_campeao",
    success: true,
  });

  return { analise, cached: false };
}

export const analisarCampeao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      force: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return executeAnalisarCampeao({
      supabase,
      userId,
      criativoId: data.criativoId,
      force: data.force,
    });
  });

const VariacaoRequestSchema = z.object({
  variacaoId: z.enum(VARIACAO_IDS),
  hookOptionIndex: z.number().int().min(0).max(4).optional(),
});

export const gerarVariacoesEscala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      criativoId: z.string().uuid(),
      variacoes: z.array(VariacaoRequestSchema).min(1),
      organizationId: z.string().uuid(),
      projectId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEscala(supabase, data.organizationId, data.variacoes.length);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    const { data: campeao, error } = await supabase
      .from("criativos")
      .select("*")
      .eq("id", data.criativoId)
      .single();
    if (error || !campeao) throw new Error("Criativo não encontrado");

    const aj = (campeao.angulo_json as Record<string, unknown>) ?? {};
    let analise = aj.escala_analise as EscalaAnalise | undefined;
    if (!analise) {
      const fresh = await executeAnalisarCampeao({
        supabase,
        userId,
        criativoId: data.criativoId,
        force: true,
      });
      analise = fresh.analise;
    }

    const roteiroOriginal = (campeao.roteiro as RoteiroBloco[]) ?? [];
    const variacoesGeradas: Array<{
      tipo: string;
      hook: string;
      criativoId?: string;
      angulo: string;
      erro?: string;
    }> = [];
    const falhas: Array<{ variacaoId: string; erro: string }> = [];

    let offerBlock = "";
    if (campeao.geracao_id) {
      const { data: geracao } = await supabase
        .from("geracoes")
        .select("url")
        .eq("id", campeao.geracao_id)
        .single();
      if (geracao?.url) {
        try {
          offerBlock = formatOfferSnapshotBlock(await buildOfferSnapshot(geracao.url, apiKey));
        } catch {
          /* URL inacessível */
        }
      }
    }

    const perfBlock = await buildEscalaPerformanceBlock(supabase, data.criativoId, campeao.project_id);
    const variacaoSystem = escalaVariacaoSystemFor(campeao.formato_saida);

    const tasks = data.variacoes.map((req) => async () => {
      const menuItem = analise.menu_variacoes.find((m) => m.id === req.variacaoId);
      if (!menuItem) {
        falhas.push({ variacaoId: req.variacaoId, erro: "Variação não encontrada no menu" });
        return;
      }

      let extraHook = "";
      if (req.variacaoId === "hook-t" && menuItem.opcoes_hook_textual?.length) {
        const idx = req.hookOptionIndex ?? 0;
        extraHook = `\nUse este hook textual: "${menuItem.opcoes_hook_textual[idx] ?? menuItem.opcoes_hook_textual[0]}"`;
      }

      const userMsg = `ANÁLISE DO CAMPEÃO:
${JSON.stringify(analise, null, 2)}

ROTEIRO ORIGINAL:
${JSON.stringify(roteiroOriginal, null, 2)}

VARIAÇÃO A GERAR: ${req.variacaoId} — ${menuItem.nome}
O que muda: ${menuItem.o_que_muda}
O que permanece: ${menuItem.o_que_permanece}
${extraHook}
${offerBlock}
${perfBlock}

Gere roteiro COMPLETO com a variação aplicada. Mantenha corpo idêntico exceto onde a variação exige mudança.`;

      try {
        const text = await callAnthropicJson({
          apiKey,
          system: variacaoSystem,
          userMessage: userMsg,
          maxTokens: 6144,
        });
        const parsed = EscalaVariacaoOutputSchema.safeParse(extractJsonFromAnthropicText(text));
        if (!parsed.success) {
          const msg = parsed.error.message.slice(0, 120);
          falhas.push({ variacaoId: req.variacaoId, erro: msg });
          variacoesGeradas.push({
            tipo: req.variacaoId,
            hook: "",
            angulo: `${campeao.angulo} · var ${req.variacaoId}`,
            erro: msg,
          });
          return;
        }

        const out = parsed.data;
        const estiloAlt =
          out.estilo_producao ??
          (req.variacaoId === "formato" && campeao.estilo_producao === "texto_animado"
            ? "clipes_texto"
            : campeao.estilo_producao);

        const { data: draft } = await supabase
          .from("criativos")
          .insert({
            user_id: userId,
            organization_id: data.organizationId,
            project_id: data.projectId,
            geracao_id: campeao.geracao_id,
            produto: campeao.produto,
            angulo: `${campeao.angulo} · var ${req.variacaoId}`,
            formato: campeao.formato,
            estilo: campeao.estilo,
            formato_saida: campeao.formato_saida,
            estilo_producao: estiloAlt,
            angulo_json: {
              ...aj,
              escala_variacao_de: data.criativoId,
              escala_variacao_id: req.variacaoId,
              escala_variacao_nome: menuItem.nome,
              escala_campeao_angulo: campeao.angulo,
              escala_gerado_em: new Date().toISOString(),
              escala_diff_vs_original: out.diff_vs_original,
              escala_utm_suggestion: out.utm_suggestion,
            },
            roteiro: out.roteiro,
            background_media_path: campeao.background_media_path,
            utm_content: crypto.randomUUID(),
            export_status: "rascunho",
          })
          .select("id")
          .single();

        variacoesGeradas.push({
          tipo: req.variacaoId,
          hook: out.roteiro[0]?.conteudo?.slice(0, 120) ?? "",
          criativoId: draft?.id,
          angulo: `${campeao.angulo} · var ${req.variacaoId}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 120) : "Erro desconhecido";
        falhas.push({ variacaoId: req.variacaoId, erro: msg });
        variacoesGeradas.push({
          tipo: req.variacaoId,
          hook: "",
          angulo: `${campeao.angulo} · var ${req.variacaoId}`,
          erro: msg,
        });
      }
    });

    await runWithConcurrency(tasks, 2);

    trackApiUsage({
      userId,
      organizationId: data.organizationId,
      eventType: "gerar_variacoes",
      tokensEstimated: data.variacoes.length * 4000,
      success: variacoesGeradas.some((v) => !!v.criativoId),
    });

    const sucesso = variacoesGeradas.filter((v) => v.criativoId);
    return { variacoes: sucesso, falhas };
  });

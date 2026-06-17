import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables, Enums } from "@/integrations/supabase/types";
import type { ResultadoAngulos } from "./anthropic.functions";
import { AnguloSchema, RoteiroBlocoSchema } from "./schemas/angulos.schema";
import type { AppLink } from "./app-links";
import { buildVslRoteiroFromAngulo } from "./vsl-roteiro";
import { refineBlockWithAI } from "./anthropic-refine";
import { trackApiUsage } from "./api-usage";

export type CriativoRow = Tables<"criativos">;
type CriativoStatus = Enums<"criativo_status">;
type FormatoSaida = Enums<"formato_saida">;
type EstiloProducao = Enums<"estilo_producao">;
type ResultadoTipo = Enums<"resultado_tipo">;

const CriativoStatusSchema = z.enum([
  "Gerado",
  "Subiu",
  "Rodando",
  "Performando",
  "Pausado",
]);

const ProjectScopeSchema = z.object({
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const listCriativos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("criativos")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });

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
    return row as CriativoRow;
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
    const { data: row, error } = await supabase
      .from("criativos")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
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
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = { roteiro: data.roteiro };
    if (data.voiceId !== undefined) patch.voice_id = data.voiceId;
    if (data.backgroundMediaPath !== undefined) patch.background_media_path = data.backgroundMediaPath;

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
  url: z.string().min(1),
  productType: z.string(),
  goal: z.string(),
  context: z.string().optional().default(""),
  resultado: z.custom<ResultadoAngulos>(),
  criarCriativos: z.boolean().optional().default(false),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const saveGeracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveGeracaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resultado, criarCriativos, projectId, organizationId, ...meta } = data;

    const { data: geracao, error } = await supabase
      .from("geracoes")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        project_id: projectId,
        url: meta.url,
        product_type: meta.productType,
        goal: meta.goal,
        context: meta.context,
        diagnostico: resultado.diagnostico,
        angulos: resultado.angulos,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

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

const CreateDraftSchema = z.object({
  geracaoId: z.string().uuid(),
  anguloIndex: z.number().int().min(0).max(4),
  formatoSaida: z.enum(["criativo_curto", "vsl_curta"]),
  estiloProducao: z.enum(["texto_animado", "clipes_texto"]),
  backgroundMediaPath: z.string().optional(),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
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

    const roteiro =
      data.formatoSaida === "vsl_curta"
        ? buildVslRoteiroFromAngulo({
            hook: anguloData.hook,
            cta: anguloData.cta,
            estrutura: anguloData.estrutura,
          })
        : anguloData.estrutura.map((b, i) => ({
            tempo: b.tempo,
            conteudo: b.conteudo,
            tipo: ["hook", "dor", "mecanismo", "prova", "cta"][i] ?? "bloco",
          }));

    let produto = geracao.url;
    try {
      produto = new URL(geracao.url).hostname.replace(/^www\./, "");
    } catch {
      /* keep */
    }

    const { data: criativo, error } = await supabase
      .from("criativos")
      .insert({
        user_id: userId,
        organization_id: data.organizationId,
        project_id: data.projectId,
        geracao_id: data.geracaoId,
        produto,
        angulo: anguloData.nome,
        formato: data.formatoSaida === "vsl_curta" ? "9:16" : "9:16",
        estilo: data.estiloProducao === "texto_animado" ? "Texto" : "Clipes",
        formato_saida: data.formatoSaida as FormatoSaida,
        estilo_producao: data.estiloProducao as EstiloProducao,
        angulo_json: anguloData,
        roteiro,
        background_media_path: data.backgroundMediaPath ?? null,
        utm_content: crypto.randomUUID(),
        export_status: "rascunho",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { criativoId: criativo.id };
  });

export const getDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativos, error } = await supabase
      .from("criativos")
      .select("status, angulo, formato_saida, export_status, id")
      .eq("project_id", data.projectId);

    if (error) throw new Error(error.message);

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

    const feed: Array<{ tag: string; title: string; desc: string; action: AppLink }> = [];
    if (counts.Performando > 0) {
      feed.push({
        tag: "Escalando",
        title: `${counts.Performando} criativo(s) performando`,
        desc: "Abra o histórico e escale os campeões com variações.",
        action: { to: "/app/historico", search: { status: "Performando" } },
      });
    }
    const semExport = (criativos ?? []).filter(
      (c) => c.export_status !== "pronto" && c.status !== "Pausado",
    ).length;
    if (semExport > 0 && total > 0) {
      feed.push({
        tag: "Ação",
        title: `${semExport} criativo(s) sem export`,
        desc: "Finalize o export no editor antes de subir no Meta.",
        action: { to: "/app/historico", search: { export: "pendente" } },
      });
    }
    if (!formatosTestados.has("vsl_curta") && total > 0) {
      feed.push({
        tag: "Oportunidade",
        title: "Você ainda não testou VSL curta",
        desc: "Teste formato até 2min para diversificar o leilão.",
        action: { to: "/app/gerador", search: { step: "wizard", formato: "vsl_curta" } },
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
    if (feed.length === 0) {
      feed.push({
        tag: "Andromeda",
        title: "Mantenha volume de testes",
        desc: "Meta recomendada: 12 criativos ativos para validação.",
        action: { to: "/app/gerador" },
      });
    }

    const nextAction: AppLink & { label: string } = (() => {
      if (total === 0) return { label: "Gerar seus primeiros 5 ângulos", to: "/app/gerador" };
      if (semExport > 0) {
        return {
          label: `Exportar ${semExport} criativo(s) pendente(s)`,
          to: "/app/historico",
          search: { export: "pendente" },
        };
      }
      if (counts.Performando > 0) {
        return {
          label: `Escalar ${counts.Performando} campeão(ões)`,
          to: "/app/historico",
          search: { status: "Performando" },
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

    return {
      counts,
      total,
      ativos,
      semExport,
      angulosTestados: [...angulosTestados],
      formatosTestados: [...formatosTestados],
      saturacaoAngulo: topAngulo?.[0] ?? null,
      saturacaoPct,
      feed,
      nextAction,
      sugestao:
        total === 0
          ? "Comece gerando seus primeiros 5 ângulos Andromeda."
          : angulosTestados.size < 3
            ? `Você testou ${angulosTestados.size} ângulos — diversifique para encontrar o campeão.`
            : !formatosTestados.has("vsl_curta")
              ? "Você ainda não testou VSL curta neste projeto."
              : "Continue escalando os criativos que estão performando.",
    };
  });

export const getLatestCriativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("criativos")
      .select("id")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { criativoId: row?.id ?? null };
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
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    const { data: campeao, error } = await supabase
      .from("criativos")
      .select("*")
      .eq("id", data.criativoId)
      .single();

    if (error || !campeao) throw new Error("Criativo não encontrado");

    const roteiro = (campeao.roteiro as Array<{ tempo: string; conteudo: string; tipo?: string }>) ?? [];
    const hookAtual = roteiro[0]?.conteudo ?? campeao.angulo;
    const variacoesGeradas: Array<{ tipo: string; hook: string; criativoId?: string; angulo: string }> = [];

    const instrucaoMap: Record<string, { instrucao: string; apply: (texto: string, r: typeof roteiro) => typeof roteiro }> = {
      "hook-t": {
        instrucao: "Crie um novo hook textual mais agressivo para os primeiros 3 segundos, mantendo o mesmo ângulo.",
        apply: (texto, r) => {
          const next = [...r];
          if (next[0]) next[0] = { ...next[0], conteudo: texto };
          return next;
        },
      },
      empilha: {
        instrucao: "Empilhe um gancho mais forte na frente do hook atual, colando duas camadas de curiosidade.",
        apply: (texto, r) => {
          const next = [...r];
          if (next[0]) next[0] = { ...next[0], conteudo: texto };
          return next;
        },
      },
      cta: {
        instrucao: "Gere um CTA mais direto com âncora de valor ou urgência real.",
        apply: (texto, r) => {
          const next = [...r];
          if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], conteudo: texto };
          return next;
        },
      },
      benef: {
        instrucao: "Expanda o bloco de mecanismo/benefícios com 2 benefícios adicionais e consequência emocional.",
        apply: (texto, r) => {
          const next = [...r];
          const mecIdx = next.findIndex((b) => b.tipo === "mecanismo");
          const idx = mecIdx >= 0 ? mecIdx : Math.min(2, Math.max(0, next.length - 1));
          if (next[idx]) next[idx] = { ...next[idx], conteudo: texto };
          return next;
        },
      },
      "hook-v": {
        instrucao: `Descreva em 1 frase o novo padrão visual do hook para: ${campeao.angulo}. Integre ao texto do hook.`,
        apply: (texto, r) => {
          const next = [...r];
          if (next[0]) next[0] = { ...next[0], conteudo: `[Visual: ${texto}]\n\n${next[0].conteudo}` };
          return next;
        },
      },
      avatar: {
        instrucao: "Reescreva o hook com outra persona/narrador (tom e vocabulário diferentes), mantendo a promessa.",
        apply: (texto, r) => {
          const next = [...r];
          if (next[0]) next[0] = { ...next[0], conteudo: texto };
          return next;
        },
      },
      formato: {
        instrucao: "Adapte o hook para formato clipes+texto com frases mais curtas e cortes visuais implícitos.",
        apply: (texto, r) => {
          const next = [...r];
          if (next[0]) next[0] = { ...next[0], conteudo: texto };
          return next;
        },
      },
    };

    for (const tipo of data.tipos) {
      const cfg = instrucaoMap[tipo];
      if (!cfg) continue;

      const blocoIdx = tipo === "cta" ? roteiro.length - 1 : tipo === "benef" ? 2 : 0;
      const bloco = roteiro[blocoIdx] ?? roteiro[0];
      if (!bloco) continue;

      let texto: string;
      try {
        texto = await refineBlockWithAI(
          apiKey,
          bloco.conteudo,
          cfg.instrucao,
          bloco.tempo,
        );
      } catch {
        continue;
      }
      if (!texto) continue;

      const novoRoteiro = cfg.apply(texto, roteiro);
      const estiloAlt =
        tipo === "formato" && campeao.estilo_producao === "texto_animado"
          ? "clipes_texto"
          : campeao.estilo_producao;

      const { data: draft } = await supabase
        .from("criativos")
        .insert({
          user_id: userId,
          organization_id: data.organizationId,
          project_id: data.projectId,
          geracao_id: campeao.geracao_id,
          produto: campeao.produto,
          angulo: `${campeao.angulo} · var ${tipo}`,
          formato: campeao.formato,
          estilo: campeao.estilo,
          formato_saida: campeao.formato_saida,
          estilo_producao: estiloAlt,
          angulo_json: campeao.angulo_json,
          roteiro: novoRoteiro,
          utm_content: crypto.randomUUID(),
          export_status: "rascunho",
        })
        .select("id")
        .single();

      variacoesGeradas.push({
        tipo,
        hook: texto.slice(0, 120),
        criativoId: draft?.id,
        angulo: `${campeao.angulo} · var ${tipo}`,
      });
    }

    trackApiUsage({
      userId,
      organizationId: data.organizationId,
      eventType: "gerar_variacoes",
      tokensEstimated: data.tipos.length * 3000,
      success: variacoesGeradas.length > 0,
    });

    return { variacoes: variacoesGeradas };
  });

export const getInteligenciaNicho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: criativos, error: cErr } = await supabase
      .from("criativos")
      .select("id, angulo, status, formato_saida, angulo_json, export_status")
      .eq("project_id", data.projectId);

    if (cErr) throw new Error(cErr.message);

    const { data: resultadosRaw, error: rErr } = await supabase
      .from("resultados_reportados")
      .select("*, criativos(id, angulo, project_id)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (rErr) throw new Error(rErr.message);

    const resultados = (resultadosRaw ?? []).filter((r) => {
      const c = r.criativos as { project_id?: string } | null;
      return c?.project_id === data.projectId;
    });

    const performando = (criativos ?? []).filter((c) => c.status === "Performando");
    const rodando = (criativos ?? []).filter((c) => c.status === "Rodando");
    const exportados = (criativos ?? []).filter((c) => c.export_status === "pronto");

    const hookRates: number[] = [];
    const feedbackCounts = { baixo: 0, medio: 0, alto: 0 };
    const anguloPerformance: Record<string, { performando: number; total: number }> = {};

    for (const c of criativos ?? []) {
      const aj = c.angulo_json as {
        sinais_andromeda?: {
          hook_rate_estimado?: string;
          feedback_negativo_esperado?: string;
        };
      } | null;
      const sinais = aj?.sinais_andromeda;
      if (sinais?.hook_rate_estimado) {
        const nums = sinais.hook_rate_estimado.match(/\d+/g)?.map(Number) ?? [];
        if (nums.length) hookRates.push(nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0]);
      }
      const fb = sinais?.feedback_negativo_esperado?.toLowerCase();
      if (fb === "baixo" || fb === "medio" || fb === "médio" || fb === "alto") {
        const key = fb === "médio" ? "medio" : fb;
        feedbackCounts[key as keyof typeof feedbackCounts]++;
      }
      if (!anguloPerformance[c.angulo]) anguloPerformance[c.angulo] = { performando: 0, total: 0 };
      anguloPerformance[c.angulo].total++;
      if (c.status === "Performando") anguloPerformance[c.angulo].performando++;
    }

    const metricasAgg: Record<string, string[]> = {};
    for (const r of resultados ?? []) {
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

    return {
      resumo: {
        total: criativos?.length ?? 0,
        performando: performando.length,
        rodando: rodando.length,
        exportados: exportados.length,
        resultadosReportados: resultados?.length ?? 0,
        hookRateMedio: hookRates.length
          ? Math.round(hookRates.reduce((a, b) => a + b, 0) / hookRates.length)
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
      formatosTestados: formatos,
      resultadosRecentes: (resultados ?? []).slice(0, 8).map((r) => ({
        angulo: (r.criativos as { angulo?: string })?.angulo ?? "—",
        tipo: r.tipo,
        metrica: r.metrica,
        valor: r.valor,
        created_at: r.created_at,
      })),
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
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { ProjectScopeSchema };

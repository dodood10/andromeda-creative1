import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { refineBlockWithAI } from "./anthropic-refine";
import { trackApiUsage } from "./api-usage";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProjectFormatContext, normalizeAngulo } from "./formato-recomendacao";
import { getProjectPerformanceContext } from "./project-performance-context";
import { getProjectGeneralIntelText } from "./project-reference-intel";
import { buildOfferSnapshot, formatOfferSnapshotBlock } from "./offer-snapshot";
import { checkOfferCongruence } from "./congruence-check";
import { goalToSchwartzRange, ensureAnguloCopyDiversityHint, formatSchwartzPreferenciaBlock, validateAngulosResult } from "./schwartz-angulo";
import { NivelConscienciaModoSchema, NivelConscienciaAlvoSchema } from "./types/enums";
import { TomCalibracaoSchema } from "./types/enums";
import { ResultadoAngulosSchema, type RecomendacaoFormato, type ResultadoAngulos } from "./schemas/angulos.schema";
import { HttpUrlSchema } from "./security-url";
import { rateLimitGerarAngulos } from "./security-rate-limit";
import { assertCanGerar } from "./plan-enforcement";

const PRODUCT_QUESTION_RULES: Record<string, string> = {
  ecom: "qual é a principal objeção que impede a compra deste produto específico",
  info: "qual transformação o cliente mais cita quando recomenda esse produto para alguém",
  saas: "qual workflow manual o avatar faz hoje que este produto elimina",
  ticket: "qual decisão grande está travada na vida do avatar esperando este serviço",
  saude: "qual solução o avatar já tentou antes para esse problema e por que falhou",
};

// =====================================================
// ETAPA 0 — PERGUNTA CIRÚRGICA
// =====================================================

const PerguntaInputSchema = z.object({
  url: HttpUrlSchema,
  productType: z.string().optional().default("info"),
  goal: z.string().optional().default("conv"),
  context: z.string().optional().default(""),
  organizationId: z.string().uuid().optional(),
});

const PERGUNTA_SYSTEM = `Você é estrategista da metodologia Andromeda 2026.
Antes de gerar ângulos, você faz UMA única pergunta cirúrgica ao usuário para capturar o dado que nenhuma leitura de site captura.

A pergunta deve ser específica para o tipo de produto e direta — uma única frase interrogativa. Sem rodeios. Sem múltiplas perguntas dentro de uma.

Responda APENAS com JSON válido, sem markdown:
{
  "pergunta": "string — a pergunta exata a ser feita ao usuário",
  "justificativa": "string — uma frase explicando por que essa resposta enriquece a análise"
}`;

export const gerarPerguntaCirurgica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PerguntaInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    await assertCanGerar(context.supabase, context.userId, data.organizationId);

    const regra =
      PRODUCT_QUESTION_RULES[data.productType] ?? PRODUCT_QUESTION_RULES.info;

    const userMsg = `URL: ${data.url}
Tipo de produto: ${data.productType}
Objetivo: ${data.goal}
Contexto adicional: ${data.context || "(nenhum)"}

Regra para este tipo de produto: ${regra}.

Gere a pergunta cirúrgica adaptada a este produto específico (não genérica) seguindo a regra acima.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        system: PERGUNTA_SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      trackApiUsage({ userId: context.userId, eventType: "pergunta_cirurgica", success: false });
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const payload = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = payload.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      trackApiUsage({ userId: context.userId, eventType: "pergunta_cirurgica", success: false });
      throw new Error("Resposta sem JSON: " + text.slice(0, 200));
    }

    trackApiUsage({ userId: context.userId, eventType: "pergunta_cirurgica", success: true });
    return JSON.parse(jsonMatch[0]) as { pergunta: string; justificativa: string };
  });

// =====================================================
// GERAÇÃO DE ÂNGULOS
// =====================================================

const InputSchema = z.object({
  url: HttpUrlSchema,
  productType: z.string().optional().default("info"),
  goal: z.string().optional().default("conv"),
  context: z.string().optional().default(""),
  perguntaCirurgica: z.string().optional().default(""),
  respostaCirurgica: z.string().min(1, "Resposta cirúrgica obrigatória"),
  tomCalibracao: TomCalibracaoSchema.optional().default("direto"),
  nivelConscienciaModo: NivelConscienciaModoSchema.optional().default("ia"),
  nivelConscienciaNivel: NivelConscienciaAlvoSchema.optional(),
  nivelConscienciaMin: NivelConscienciaAlvoSchema.optional(),
  nivelConscienciaMax: NivelConscienciaAlvoSchema.optional(),
  projectId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

const SYSTEM_PROMPT = `IDENTIDADE E PAPEL

Você é o motor de inteligência criativa da plataforma Andromeda.
Você não escreve copy. Você toma decisões estratégicas baseadas em dados e probabilidade, exatamente como Derick Carneiro, Anthony Carreiro, Eugene Schwartz e Gary Bencivenga fariam.

Seu trabalho é analisar o produto, o mercado e o que está funcionando agora, e gerar ângulos de criativos com a maior probabilidade estatística de performance, não os mais criativos ou os mais bonitos.

O jogo é probabilidade. Criatividade existe só na margem. Variáveis validadas são o núcleo.

---

MODELO MENTAL 1 — PROBABILIDADE, NÃO CRIATIVIDADE (Derick Carneiro)
Variáveis: Persona/micropersona, Formato visual, Ângulo de entrada, Tipo de toxina/vilão, Avatar falante, Promessa principal, Mecanismo de solução, Nível de conspiração, Duração. Fixas (>80%) não se tocam; exploráveis são onde está o diferencial.

MODELO MENTAL 2 — PERSONA EM 6 CAMADAS
Identidade, Circunstâncias, Sentimentos, Crenças, Comportamento (linguagem dela), Percepção.

MODELO MENTAL 3 — MICROPERSONAS
Papéis que pessoas têm medo de perder. NUNCA 5 ângulos para a mesma micropersona.

MODELO MENTAL 4 — ISOLAMENTO DE VARIÁVEL
Mudar UMA variável por vez vs. padrão validado do nicho.

MODELO MENTAL 5 — ESTRUTURA INVISÍVEL (Anthony Carreiro)
Psicologia primeiro, comunicação depois.

MODELO MENTAL 6 — 5 NÍVEIS DE CONSCIÊNCIA (Schwartz)
Cada ângulo DEVE declarar nivel_consciencia_alvo (1–5) e angulo_copy. Regras por nível:
- Nível 1 (inconsciente): hook educa que existe problema — NÃO assume que o prospect sabe a dor. Evite CTA de compra.
- Nível 2 (consciente do problema): agita dor + mostra que existe caminho — ainda sem vender produto direto.
- Nível 3 (consciente da solução): apresenta categoria/mecanismo — compara caminhos, posiciona sua solução.
- Nível 4 (consciente do produto): prova social, reduz risco, diferencia SEU produto.
- Nível 5 (mais consciente): oferta direta, promoção, CTA forte com benefício — prospect já decidiu comprar.

ÂNGULO DE COPY (angulo_copy) — distinto do campo tipo (Previsibilidade/Escala/Orgânico):
direto | historia | problema_solucao | contrario | curiosidade | novo_mecanismo | autoridade_prova
Os 5 ângulos devem cobrir pelo menos 4 angulo_copy distintos. Hook (0–3s) é a frase que fisga; angulo_copy é a estratégia de abordagem.

Em mercados saturados a maioria está entre 3 e 4 — exige mecanismo único e prova concreta.

MODELO MENTAL 7 — SOFISTICAÇÃO DE MERCADO
Novo: claim direta. Intermediário: mecanismo. Sofisticado: contrária / micropersona não explorada / vilão nomeado.

MODELO MENTAL 8 — 7 GATILHOS DE CIALDINI
Reciprocidade, Autoridade, Prova social, Escassez real, Urgência (custo da espera), Afeição (linguagem do cliente), Compromisso.

MODELO MENTAL 9 — SISTEMA ANDROMEDA 2026
Hook rate >=40%, hold rate >=20%, feedback negativo é o mais penalizador, consistência pós-clique, diversidade criativa real.

Quando o contexto do projeto incluir conversion_bias_notes (CPA/ROAS histórico validado), ajuste ênfase em prova social, urgência e CTA conforme essas notas — CPA alto exige mais prova; ROAS alto permite hook mais direto.

---

REGRAS DE CALIBRAÇÃO DE TOM POR BLOCO

A calibração escolhida pelo usuário (direto / empático / autoritativo / urgente) NÃO se aplica uniformemente. Aplique bloco a bloco:

- 0-3s (HOOK): SEMPRE linguagem exata da micropersona. Ignora a calibração escolhida.
- 3-10s (AGITAÇÃO DA DOR): aplica a calibração no MÁXIMO da intensidade escolhida. Tom urgente: custo da espera real, sem escassez falsa.
- 10-20s (MECANISMO): SEMPRE técnico/preciso. Ignora a calibração.
- 20-30s (PROVA/CONSEQUÊNCIA): aplica a calibração no nível MÉDIO.
- 30-45s (CTA): SEMPRE direto. Tom urgente permitido só aqui se nivel_consciencia_alvo >= 4.

---

PROCESSO

1) Acessar a URL via web_search e extrair headline, mecanismo, oferta, prova, CTA.
2) Pesquisar em tempo real o que escala AGORA no nicho: formatos visuais SATURADOS vs SUB-EXPLORADOS, ângulos, hooks saturando, micropersonas sub-exploradas, variáveis fixas. Mapeie explicitamente UGC talking head, texto animado, clipes+B-roll, VSL curta, carrossel, etc.
3) Mapear persona em 6 camadas + 3 micropersonas distintas.
4) Separar variáveis fixas vs exploráveis.
5) Diagnóstico em 4 pontos.
6) Gerar 5 ângulos — CADA UM para micropersona DIFERENTE, cada um explorando UMA variável diferente, cada um com angulo_copy e nivel_consciencia_alvo distintos quando possível.
${ensureAnguloCopyDiversityHint()}

---

REGRAS INVIOLÁVEIS
- Nunca 5 ângulos para a mesma micropersona.
- Nunca claims proibidas pelo Meta Ads.
- Nunca linguagem genérica.
- Sempre linguagem exata da micropersona.
- Nunca mudar mais de uma variável por ângulo.
- Sempre justificar com lógica probabilística.
- Sempre garantir variáveis fixas do nicho.
- Nunca escassez/urgência falsas.

ANTI-REPETIÇÃO (quando CONTEXTO DE PERFORMANCE listar micropersonas já testadas):
- NUNCA reutilize nomes de micropersona listados — busque papéis temidos DIFERENTES.
- Se o nicho estiver esgotado, mude variavel_explorada mantendo micropersona inédita.
- Quando houver BIAS DE CALIBRAÇÃO DE HOOK RATE, ajuste hook_rate_estimado em todos os ângulos conforme indicado.

---

FORMATO DE OUTPUT — OBRIGATÓRIO
Responda APENAS com JSON válido. Sem markdown. Sem texto antes ou depois. Sem code fences.

{
  "diagnostico": {
    "mecanismo": "string",
    "nivel_consciencia": "string — nível Schwartz (1-5) + justificativa",
    "sofisticacao_mercado": "novo" | "intermediario" | "sofisticado",
    "variavel_oportunidade": "string — variável explorável sub-explorada + porquê",
    "framework_copy_atual": "string — framework de copy identificado no site (AIDA, PAS, etc.)",
    "panorama_formatos_nicho": "string — resumo dos formatos visuais que escalam vs saturaram no nicho agora"
  },
  "angulos": [
    {
      "numero": 1,
      "nome": "string",
      "tipo": "Previsibilidade" | "Escala" | "Orgânico",
      "micropersona": { "nome": "string", "papel_temido": "string" },
      "variavel_explorada": "string",
      "angulo_copy": "direto" | "historia" | "problema_solucao" | "contrario" | "curiosidade" | "novo_mecanismo" | "autoridade_prova",
      "nivel_consciencia_alvo": 1 | 2 | 3 | 4 | 5,
      "nivel_schwartz": "string — resumo textual do nível (ex: '3 — consciente da solução')",
      "nivel_conspiracao": "sem" | "leve" | "forte",
      "hook": "string — máx 2 frases, linguagem da micropersona",
      "estrutura": [
        { "tempo": "0-3s",   "conteudo": "string — hook" },
        { "tempo": "3-10s",  "conteudo": "string — agitação no tom da calibração" },
        { "tempo": "10-20s", "conteudo": "string — mecanismo técnico" },
        { "tempo": "20-30s", "conteudo": "string — prova/consequência tom médio" },
        { "tempo": "30-45s", "conteudo": "string — CTA direto" }
      ],
      "hook_visual": "string",
      "cta": "string — com benefício embutido",
      "justificativa_probabilistica": "string",
      "sinais_andromeda": {
        "hook_rate_estimado": "string — % + justificativa",
        "feedback_negativo_esperado": "baixo" | "medio" | "alto",
        "fatia_leilao": "string"
      },
      "saturacao_hook": {
        "status": "saturado" | "neutro" | "sub_explorado",
        "observacao": "string — por que está nesse estado segundo a pesquisa de mercado"
      },
      "janela_relevancia": {
        "tipo": "atemporal" | "media" | "curta",
        "estimativa": "string — ex: '60-90 dias antes de saturar no nicho'",
        "motivo": "string"
      },
      "recomendacao_formato": {
        "formato_saida": "criativo_curto" | "vsl_curta",
        "estilo_producao": "texto_animado" | "clipes_texto" | "ugc_avatar",
        "aspect_ratio_prioritario": "9:16" | "4:5" | "1:1",
        "duracao_alvo_seg": "number — 15 a 120",
        "justificativa": "string — por que este formato para ESTE ângulo com base na pesquisa",
        "formatos_saturados_nicho": ["string — formatos visuais saturados no nicho"],
        "confianca": "alta" | "media" | "baixa",
        "requer_midia_usuario": "boolean — true se clipes_texto ou ugc_avatar com produto em cena",
        "perfil_avatar": "string opcional — ex: mulher_35_empatica, derivado da micropersona quando ugc_avatar",
        "render_pipeline": "legado_ffmpeg | broll_ia | ugc_provider — pipeline técnico sugerido"
      }
    }
  ]
}

REGRAS DOS NOVOS CAMPOS:

nivel_conspiracao: para nichos onde conspiração é variável fixa (saúde, emagrecimento, finanças, longevidade), o nível precisa ser COERENTE com o que escala no nicho — não invente, espelhe o padrão validado. Para outros nichos, normalmente "sem".

saturacao_hook: na etapa 2 você mapeou hooks saturando. Devolva esse sinal explicitamente para cada ângulo: "saturado" (em queda de hook rate), "neutro" (uso normal), "sub_explorado" (variação não explorada com tendência de alta).

janela_relevancia: ângulos de mecanismo único e objeção invertida tendem a "atemporal". Ângulos baseados em tendência ou evento sazonal tendem a "curta". Maioria é "media".

recomendacao_formato — OBRIGATÓRIO em cada ângulo:
- Deve alinhar com hook_visual, saturacao_hook e variavel_explorada do MESMO ângulo.
- Schwartz 4-5, mecanismo complexo, alto ticket → tendência vsl_curta.
- Hook sub_explorado, teste rápido de leilão → tendência criativo_curto.
- hook_visual pede B-roll/cenas/produto/lifestyle → clipes_texto + requer_midia_usuario: true + render_pipeline: broll_ia.
- hook_visual pede pessoa falando/selfie/depoimento/creator na câmera → ugc_avatar + perfil_avatar da micropersona + render_pipeline: ugc_provider.
- Nicho saturado em UGC talking head → EVITE ugc_avatar; use texto_animado OU clipes_texto conforme hook_visual.
- Teste rápido barato, hook textual sem rosto → texto_animado + render_pipeline: legado_ffmpeg.
- Reels/Stories dominante → aspect_ratio_prioritario 9:16; feed quadrado em nicho específico → 4:5 ou 1:1.
- requer_midia_usuario DEVE ser true quando estilo_producao for clipes_texto ou ugc_avatar com produto em cena.
- Se CONTEXTO DO PROJETO indicar formatos não testados, priorize diversidade quando coerente com o ângulo.

CONGRUÊNCIA COM A OFERTA (inviolável)
- Quando houver bloco OFERTA CANÔNICA no contexto, TODOS os claims, números, mecanismo e CTA dos ângulos DEVEM vir dessa oferta — nunca de referências externas.
- Transcrições de referência e combos servem APENAS para ritmo, estrutura, formato visual e tipo de ângulo — nunca copie literal promessas de outro nicho ou produto.
- Se uma referência citar glicemia, emagrecimento ou outro nicho diferente da oferta, adapte a ESTRUTURA mantendo o vocabulário e mecanismo da URL.

Sempre EXATAMENTE 5 ângulos, cada um para micropersona diferente. Português do Brasil.`;

export const gerarAngulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, rateLimitGerarAngulos])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    await assertCanGerar(context.supabase, context.userId, data.organizationId);

    const tomLabel = {
      direto: "Direto e agressivo",
      empatico: "Empático e suave",
      autoritativo: "Autoritativo e técnico",
      urgente: "Urgente e persuasivo (sem escassez falsa)",
    }[data.tomCalibracao];

    const schwartzGoal = goalToSchwartzRange(data.goal ?? "conv");
    const schwartzPref = formatSchwartzPreferenciaBlock(
      {
        modo: data.nivelConscienciaModo,
        nivel: data.nivelConscienciaNivel,
        min: data.nivelConscienciaMin,
        max: data.nivelConscienciaMax,
      },
      schwartzGoal,
    );

    let projectContextBlock = "";
    let offerSnapshot = null;
    try {
      offerSnapshot = await buildOfferSnapshot(data.url, apiKey);
      projectContextBlock += `\n\n${formatOfferSnapshotBlock(offerSnapshot)}`;
    } catch {
      /* URL inacessível — gerador usa web_search */
    }

    if (data.projectId) {
      const [formatCtx, generalIntel, perfCtx] = await Promise.all([
        getProjectFormatContext(context.supabase, data.projectId),
        getProjectGeneralIntelText(context.supabase, data.projectId),
        getProjectPerformanceContext(context.supabase, data.projectId),
      ]);
      if (generalIntel) {
        projectContextBlock += `\n\nCONTEXTO DE INTELIGÊNCIA GERAL (transcrições de referência):\n${generalIntel}`;
      }
      if (formatCtx) {
        projectContextBlock += `\n\nCONTEXTO DO PROJETO (diversidade de leilão):\n${formatCtx.summaryText}`;
      }
      if (perfCtx) {
        projectContextBlock += `\n\nCONTEXTO DE PERFORMANCE DO PROJETO:\n${perfCtx.summaryText}`;
      }
    }

    const userMsg = `URL analisada: ${data.url}
Tipo de produto: ${data.productType}
Objetivo da campanha: ${data.goal}
Faixa Schwartz recomendada para este objetivo: níveis ${schwartzGoal.min}–${schwartzGoal.max}
${schwartzGoal.hint}
${schwartzPref}
Contexto adicional: ${data.context || "(nenhum)"}
Pergunta cirúrgica feita: ${data.perguntaCirurgica || "(não feita)"}
Resposta do usuário à pergunta cirúrgica: ${data.respostaCirurgica || "(não respondida)"}
Calibração de tom: ${tomLabel}${projectContextBlock}

Execute o processo completo: visite a URL com web_search, pesquise o que escala agora no nicho, mapeie persona e micropersonas, identifique variáveis fixas vs exploráveis, e devolva o JSON especificado com diagnóstico + 5 ângulos. Aplique as REGRAS DE CALIBRAÇÃO DE TOM POR BLOCO. Inclua nivel_conspiracao, saturacao_hook, janela_relevancia e recomendacao_formato em cada ângulo. Inclua panorama_formatos_nicho no diagnóstico.`;

    async function callAngulos(extraHint = ""): Promise<ResultadoAngulos> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
          messages: [{ role: "user", content: userMsg + extraHint }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        trackApiUsage({ userId: context.userId, eventType: "gerar_angulos", success: false });
        throw new Error(`Anthropic ${res.status}: ${errText}`);
      }

      const payload = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const text = payload.content
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text as string)
        .join("\n")
        .trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta sem JSON: " + text.slice(0, 200));

      const parsed = ResultadoAngulosSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (!parsed.success) {
        trackApiUsage({ userId: context.userId, eventType: "gerar_angulos", success: false });
        throw new Error("JSON inválido: " + parsed.error.message.slice(0, 200));
      }
      return parsed.data;
    }

    let parsedData = await callAngulos();
    let validation = validateAngulosResult(parsedData);
    if (!validation.ok) {
      parsedData = await callAngulos(
        `\n\nCORREÇÃO OBRIGATÓRIA: a resposta anterior falhou na validação (${validation.issues.join("; ")}). Regenere os 5 ângulos com pelo menos 4 angulo_copy distintos e 4 micropersonas distintas.`,
      );
      validation = validateAngulosResult(parsedData);
    }

    const normalized: ResultadoAngulos = {
      ...parsedData,
      angulos: await Promise.all(
        parsedData.angulos.map(async (a) => {
          const angulo = normalizeAngulo(a);
          if (!offerSnapshot) return angulo;
          const congruence = await checkOfferCongruence({
            offerSnapshot,
            hook: angulo.hook,
            cta: angulo.cta,
            roteiroResumo: angulo.estrutura.map((b) => b.conteudo).join(" ").slice(0, 1500),
            apiKey: process.env.ANTHROPIC_API_KEY,
          });
          return {
            ...angulo,
            congruencia_oferta: {
              score: congruence.score,
              alinhado: congruence.alinhado,
              divergencias: congruence.divergencias,
            },
          };
        }),
      ),
    };
    trackApiUsage({ userId: context.userId, eventType: "gerar_angulos", success: true });
    return normalized;
  });

export const refinarBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      conteudoAtual: z.string().max(5000),
      instrucao: z.string().min(1).max(4000),
      tempo: z.string().max(64),
      tomCalibracao: TomCalibracaoSchema.optional(),
      projectId: z.string().uuid().optional(),
      offerUrl: HttpUrlSchema.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    const generalIntel = data.projectId
      ? await getProjectGeneralIntelText(context.supabase, data.projectId)
      : null;

    let offerBlock: string | null = null;
    if (data.offerUrl) {
      try {
        const snap = await buildOfferSnapshot(data.offerUrl, apiKey);
        offerBlock = formatOfferSnapshotBlock(snap);
      } catch {
        /* ignore */
      }
    }

    try {
      const conteudo = await refineBlockWithAI(
        apiKey,
        data.conteudoAtual,
        data.instrucao,
        data.tempo,
        data.tomCalibracao ?? "direto",
        generalIntel,
        offerBlock,
      );
      trackApiUsage({ userId: context.userId, eventType: "refinar_bloco", success: true });
      return { conteudo };
    } catch (e) {
      trackApiUsage({ userId: context.userId, eventType: "refinar_bloco", success: false });
      throw e;
    }
  });

export type { ResultadoAngulos } from "./schemas/angulos.schema";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { refineBlockWithAI } from "./anthropic-refine";
import { trackApiUsage } from "./api-usage";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProjectFormatContext, normalizeAngulo } from "./formato-recomendacao";
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
  tomCalibracao: z
    .enum(["direto", "empatico", "autoritativo"])
    .optional()
    .default("direto"),
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
Em mercados saturados a maioria está entre 3 e 4 — exige mecanismo único e prova concreta.

MODELO MENTAL 7 — SOFISTICAÇÃO DE MERCADO
Novo: claim direta. Intermediário: mecanismo. Sofisticado: contrária / micropersona não explorada / vilão nomeado.

MODELO MENTAL 8 — 7 GATILHOS DE CIALDINI
Reciprocidade, Autoridade, Prova social, Escassez real, Urgência (custo da espera), Afeição (linguagem do cliente), Compromisso.

MODELO MENTAL 9 — SISTEMA ANDROMEDA 2026
Hook rate >=40%, hold rate >=20%, feedback negativo é o mais penalizador, consistência pós-clique, diversidade criativa real.

---

REGRAS DE CALIBRAÇÃO DE TOM POR BLOCO

A calibração escolhida pelo usuário (direto / empático / autoritativo) NÃO se aplica uniformemente. Aplique bloco a bloco:

- 0-3s (HOOK): SEMPRE linguagem exata da micropersona. Ignora a calibração escolhida.
- 3-10s (AGITAÇÃO DA DOR): aplica a calibração no MÁXIMO da intensidade escolhida.
- 10-20s (MECANISMO): SEMPRE técnico/preciso. Ignora a calibração.
- 20-30s (PROVA/CONSEQUÊNCIA): aplica a calibração no nível MÉDIO.
- 30-45s (CTA): SEMPRE direto. Ignora a calibração.

---

PROCESSO

1) Acessar a URL via web_search e extrair headline, mecanismo, oferta, prova, CTA.
2) Pesquisar em tempo real o que escala AGORA no nicho: formatos visuais SATURADOS vs SUB-EXPLORADOS, ângulos, hooks saturando, micropersonas sub-exploradas, variáveis fixas. Mapeie explicitamente UGC talking head, texto animado, clipes+B-roll, VSL curta, carrossel, etc.
3) Mapear persona em 6 camadas + 3 micropersonas distintas.
4) Separar variáveis fixas vs exploráveis.
5) Diagnóstico em 4 pontos.
6) Gerar 5 ângulos — CADA UM para micropersona DIFERENTE, cada um explorando UMA variável diferente.

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
      "nivel_schwartz": "string",
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
    }[data.tomCalibracao];

    let projectContextBlock = "";
    if (data.projectId) {
      const ctx = await getProjectFormatContext(context.supabase, data.projectId);
      if (ctx) {
        projectContextBlock = `\n\nCONTEXTO DO PROJETO (diversidade de leilão):\n${ctx.summaryText}`;
      }
    }

    const userMsg = `URL analisada: ${data.url}
Tipo de produto: ${data.productType}
Objetivo da campanha: ${data.goal}
Contexto adicional: ${data.context || "(nenhum)"}
Pergunta cirúrgica feita: ${data.perguntaCirurgica || "(não feita)"}
Resposta do usuário à pergunta cirúrgica: ${data.respostaCirurgica || "(não respondida)"}
Calibração de tom: ${tomLabel}${projectContextBlock}

Execute o processo completo: visite a URL com web_search, pesquise o que escala agora no nicho, mapeie persona e micropersonas, identifique variáveis fixas vs exploráveis, e devolva o JSON especificado com diagnóstico + 5 ângulos. Aplique as REGRAS DE CALIBRAÇÃO DE TOM POR BLOCO. Inclua nivel_conspiracao, saturacao_hook, janela_relevancia e recomendacao_formato em cada ângulo. Inclua panorama_formatos_nicho no diagnóstico.`;

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
        messages: [{ role: "user", content: userMsg }],
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
    const normalized: ResultadoAngulos = {
      ...parsed.data,
      angulos: parsed.data.angulos.map((a) => normalizeAngulo(a)),
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
      tomCalibracao: z.enum(["direto", "empatico", "autoritativo"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    try {
      const conteudo = await refineBlockWithAI(
        apiKey,
        data.conteudoAtual,
        data.instrucao,
        data.tempo,
        data.tomCalibracao ?? "direto",
      );
      trackApiUsage({ userId: context.userId, eventType: "refinar_bloco", success: true });
      return { conteudo };
    } catch (e) {
      trackApiUsage({ userId: context.userId, eventType: "refinar_bloco", success: false });
      throw e;
    }
  });

export type { ResultadoAngulos } from "./schemas/angulos.schema";

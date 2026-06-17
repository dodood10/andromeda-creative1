import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAnthropicJson, extractJsonFromAnthropicText } from "./anthropic-json";
import { VSL_CURTA_SYSTEM } from "./prompts/vsl-curta.system";
import { VslOutputSchema } from "./schemas/vsl.schema";
import { buildVslRoteiroFromAngulo, vslOutputToRoteiro } from "./vsl-roteiro";
import { trackApiUsage } from "./api-usage";
import type { ResultadoAngulos } from "./anthropic.functions";
import { AnguloSchema } from "./schemas/angulos.schema";

const InputSchema = z.object({
  geracaoId: z.string().uuid().optional(),
  anguloIndex: z.number().int().min(0).max(4).optional(),
  criativoId: z.string().uuid().optional(),
  url: z.string().optional(),
  productType: z.string().optional(),
  goal: z.string().optional(),
  context: z.string().optional(),
  tomCalibracao: z.enum(["direto", "empatico", "autoritativo"]).optional(),
});

export type GerarVslResult = {
  roteiro: ReturnType<typeof vslOutputToRoteiro>["roteiro"];
  anguloJsonExtras: ReturnType<typeof vslOutputToRoteiro>["extras"];
  devMode: boolean;
};

export async function generateVslFromAngulo(params: {
  apiKey: string | undefined;
  userId: string;
  organizationId?: string | null;
  angulo: z.infer<typeof AnguloSchema> | ResultadoAngulos["angulos"][0];
  url: string;
  productType: string;
  goal: string;
  context: string;
  tomCalibracao: string;
}): Promise<GerarVslResult> {
  const angulo = params.angulo;
  const fallbackRoteiro = buildVslRoteiroFromAngulo(angulo);

  if (!params.apiKey) {
    return {
      roteiro: fallbackRoteiro,
      anguloJsonExtras: { vsl_dev_mode: true, vsl_gerado_em: new Date().toISOString() },
      devMode: true,
    };
  }

  const tomLabel = {
    direto: "Direto e agressivo",
    empatico: "Empático e suave",
    autoritativo: "Autoritativo e técnico",
  }[params.tomCalibracao as keyof typeof tomLabel] ?? params.tomCalibracao;

  const userMsg = `URL: ${params.url}
Tipo de produto: ${params.productType}
Objetivo: ${params.goal}
Contexto: ${params.context || "(nenhum)"}
Tom: ${tomLabel}

ÂNGULO SELECIONADO (use esta micropersona exclusivamente):
${JSON.stringify(angulo, null, 2)}

Visite a URL com web_search se necessário para depoimentos, garantia e oferta.
Gere a VSL curta completa de 2 minutos em JSON.`;

  try {
    const text = await callAnthropicJson({
      apiKey: params.apiKey,
      system: VSL_CURTA_SYSTEM,
      userMessage: userMsg,
      maxTokens: 8192,
      useWebSearch: true,
    });
    const parsed = VslOutputSchema.safeParse(extractJsonFromAnthropicText(text));
    if (!parsed.success) {
      throw new Error(parsed.error.message.slice(0, 200));
    }
    const { roteiro, extras } = vslOutputToRoteiro(parsed.data);
    trackApiUsage({
      userId: params.userId,
      organizationId: params.organizationId,
      eventType: "gerar_vsl",
      success: true,
    });
    return { roteiro, anguloJsonExtras: extras, devMode: false };
  } catch (e) {
    trackApiUsage({
      userId: params.userId,
      organizationId: params.organizationId,
      eventType: "gerar_vsl",
      success: false,
    });
    console.error("[gerarVslCurta]", e);
    return {
      roteiro: fallbackRoteiro,
      anguloJsonExtras: { vsl_dev_mode: true, vsl_gerado_em: new Date().toISOString() },
      devMode: true,
    };
  }
}

export const gerarVslCurta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let angulo: ResultadoAngulos["angulos"][0] | null = null;
    let url = data.url ?? "";
    let productType = data.productType ?? "info";
    let goal = data.goal ?? "conv";
    let ctx = data.context ?? "";
    let organizationId: string | null = null;

    if (data.criativoId) {
      const { data: criativo, error } = await supabase
        .from("criativos")
        .select("*, geracao_id")
        .eq("id", data.criativoId)
        .single();
      if (error || !criativo) throw new Error("Criativo não encontrado");
      organizationId = criativo.organization_id;

      if (criativo.geracao_id) {
        const { data: geracao } = await supabase
          .from("geracoes")
          .select("*")
          .eq("id", criativo.geracao_id)
          .single();
        if (geracao) {
          url = geracao.url;
          productType = geracao.product_type ?? productType;
          goal = geracao.goal ?? goal;
          ctx = geracao.context ?? ctx;
          const angulos = geracao.angulos as ResultadoAngulos["angulos"];
          const aj = criativo.angulo_json as { nome?: string } | null;
          angulo =
            angulos.find((a) => a.nome === criativo.angulo) ??
            angulos[0] ??
            null;
          if (!angulo && aj) {
            angulo = aj as ResultadoAngulos["angulos"][0];
          }
        }
      }
      if (!angulo && criativo.angulo_json) {
        angulo = criativo.angulo_json as ResultadoAngulos["angulos"][0];
      }
    } else if (data.geracaoId != null && data.anguloIndex != null) {
      const { data: geracao, error } = await supabase
        .from("geracoes")
        .select("*")
        .eq("id", data.geracaoId)
        .single();
      if (error || !geracao) throw new Error("Geração não encontrada");
      organizationId = geracao.organization_id;
      url = geracao.url;
      productType = geracao.product_type ?? productType;
      goal = geracao.goal ?? goal;
      ctx = geracao.context ?? ctx;
      const angulos = geracao.angulos as ResultadoAngulos["angulos"];
      angulo = angulos[data.anguloIndex] ?? null;
    }

    if (!angulo) throw new Error("Ângulo não encontrado para VSL");

    const result = await generateVslFromAngulo({
      apiKey,
      userId,
      organizationId,
      angulo,
      url,
      productType,
      goal,
      context: ctx,
      tomCalibracao: data.tomCalibracao ?? "direto",
    });

    if (data.criativoId) {
      const { data: criativo } = await supabase
        .from("criativos")
        .select("angulo_json")
        .eq("id", data.criativoId)
        .single();
      const prevAj = (criativo?.angulo_json as Record<string, unknown>) ?? {};
      await supabase
        .from("criativos")
        .update({
          roteiro: result.roteiro,
          angulo_json: { ...prevAj, ...result.anguloJsonExtras },
        })
        .eq("id", data.criativoId);
    }

    return result;
  });

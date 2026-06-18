import { z } from "zod";
import {
  AnguloTipoSchema,
  EstiloProducaoSchema,
  FeedbackNegativoSchema,
  FormatoSaidaSchema,
  JanelaRelevanciaTipoSchema,
  NivelConspiracaoSchema,
  SaturacaoHookStatusSchema,
} from "@/lib/types/enums";
import { RoteiroBlocoSchema } from "./angulos.schema";

const ImportRecomendacaoFormatoSchema = z.object({
  formato_saida: FormatoSaidaSchema,
  estilo_producao: EstiloProducaoSchema,
  aspect_ratio_prioritario: z.enum(["9:16", "4:5", "1:1"]).default("9:16"),
  duracao_alvo_seg: z.coerce.number().int().min(15).max(300).default(45),
  justificativa: z.string().default(""),
  formatos_saturados_nicho: z.array(z.string()).default([]),
  confianca: z.enum(["alta", "media", "baixa"]).default("media"),
  requer_midia_usuario: z.boolean().default(false),
  render_pipeline: z.enum(["legado_ffmpeg", "broll_ia", "ugc_provider"]).optional(),
});

export const ImportCampeaoAnalysisSchema = z.object({
  nome: z.string().min(1),
  tipo: AnguloTipoSchema.default("Escala"),
  micropersona: z.object({ nome: z.string(), papel_temido: z.string() }),
  variavel_explorada: z.string().default("importado"),
  nivel_schwartz: z.string().default("3-4"),
  nivel_conspiracao: NivelConspiracaoSchema.default("sem"),
  hook: z.string(),
  estrutura: z.array(z.object({ tempo: z.string(), conteudo: z.string() })).min(1),
  hook_visual: z.string().default(""),
  cta: z.string().default(""),
  justificativa_probabilistica: z.string().default(""),
  sinais_andromeda: z.object({
    hook_rate_estimado: z.string(),
    feedback_negativo_esperado: FeedbackNegativoSchema,
    fatia_leilao: z.string().default(""),
  }),
  saturacao_hook: z
    .object({
      status: SaturacaoHookStatusSchema,
      observacao: z.string(),
    })
    .default({ status: "neutro", observacao: "Importado — sem pesquisa de mercado" }),
  janela_relevancia: z
    .object({
      tipo: JanelaRelevanciaTipoSchema,
      estimativa: z.string(),
      motivo: z.string(),
    })
    .default({ tipo: "media", estimativa: "60-90 dias", motivo: "Campeão importado" }),
  recomendacao_formato: ImportRecomendacaoFormatoSchema,
  roteiro: z.array(RoteiroBlocoSchema).min(1),
});

export type ImportCampeaoAnalysis = z.infer<typeof ImportCampeaoAnalysisSchema>;

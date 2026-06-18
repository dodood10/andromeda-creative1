import { z } from "zod";

export const RecomendacaoFormatoSchema = z.object({
  formato_saida: z.enum(["criativo_curto", "vsl_curta"]),
  estilo_producao: z.enum(["texto_animado", "clipes_texto", "ugc_avatar"]),
  aspect_ratio_prioritario: z.enum(["9:16", "4:5", "1:1"]).default("9:16"),
  duracao_alvo_seg: z.number().int().min(15).max(120),
  justificativa: z.string(),
  formatos_saturados_nicho: z.array(z.string()).default([]),
  confianca: z.enum(["alta", "media", "baixa"]),
  requer_midia_usuario: z.boolean(),
  perfil_avatar: z.string().optional(),
  render_pipeline: z.enum(["legado_ffmpeg", "broll_ia", "ugc_provider"]).optional(),
});

export type RecomendacaoFormato = z.infer<typeof RecomendacaoFormatoSchema>;

export const AnguloSchema = z.object({
  numero: z.number(),
  nome: z.string(),
  tipo: z.string(),
  micropersona: z.object({ nome: z.string(), papel_temido: z.string() }),
  variavel_explorada: z.string(),
  nivel_schwartz: z.string(),
  nivel_conspiracao: z.string(),
  hook: z.string(),
  estrutura: z.array(z.object({ tempo: z.string(), conteudo: z.string() })),
  hook_visual: z.string(),
  cta: z.string(),
  justificativa_probabilistica: z.string(),
  sinais_andromeda: z.object({
    hook_rate_estimado: z.string(),
    feedback_negativo_esperado: z.string(),
    fatia_leilao: z.string(),
  }),
  saturacao_hook: z.object({
    status: z.string(),
    observacao: z.string(),
  }),
  janela_relevancia: z.object({
    tipo: z.string(),
    estimativa: z.string(),
    motivo: z.string(),
  }),
  recomendacao_formato: RecomendacaoFormatoSchema.optional(),
});

export const ResultadoAngulosSchema = z.object({
  diagnostico: z.object({
    mecanismo: z.string(),
    nivel_consciencia: z.string(),
    sofisticacao_mercado: z.string(),
    variavel_oportunidade: z.string(),
    framework_copy_atual: z.string().optional(),
    panorama_formatos_nicho: z.string().optional(),
  }),
  angulos: z.array(AnguloSchema).length(5),
});

export type ResultadoAngulosValidated = z.infer<typeof ResultadoAngulosSchema>;

export const RoteiroBlocoSchema = z.object({
  tempo: z.string(),
  conteudo: z.string(),
  tipo: z.string().optional(),
  hook_visual: z.string().optional(),
  objetivo_bloco: z.string().optional(),
  linguagem_micropersona: z.array(z.string()).optional(),
  vilao_nomeado: z.string().optional(),
  metafora_visual: z.string().optional(),
  depoimento: z.string().optional(),
  objecoes: z.array(z.object({ objecao: z.string(), quebra: z.string() })).optional(),
});

export type RoteiroBloco = z.infer<typeof RoteiroBlocoSchema>;

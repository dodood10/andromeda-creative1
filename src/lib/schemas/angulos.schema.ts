import { z } from "zod";

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
});

export const ResultadoAngulosSchema = z.object({
  diagnostico: z.object({
    mecanismo: z.string(),
    nivel_consciencia: z.string(),
    sofisticacao_mercado: z.string(),
    variavel_oportunidade: z.string(),
    framework_copy_atual: z.string().optional(),
  }),
  angulos: z.array(AnguloSchema).length(5),
});

export type ResultadoAngulosValidated = z.infer<typeof ResultadoAngulosSchema>;

export const RoteiroBlocoSchema = z.object({
  tempo: z.string(),
  conteudo: z.string(),
  tipo: z.string().optional(),
});

export type RoteiroBloco = z.infer<typeof RoteiroBlocoSchema>;

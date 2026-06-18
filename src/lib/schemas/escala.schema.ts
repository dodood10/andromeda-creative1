import { z } from "zod";

export const EscalaMenuItemSchema = z.object({
  id: z.enum(["hook-v", "hook-t", "avatar", "formato", "empilha", "benef", "cta"]),
  nome: z.string(),
  nivel_risco: z.enum(["baixo", "medio", "alto"]).or(z.string()),
  o_que_muda: z.string(),
  o_que_permanece: z.string(),
  justificativa_probabilistica: z.string(),
  micropersona_impactada: z.string().optional(),
  fatia_leilao: z.string().optional(),
  hook_rate_estimado: z.string().optional(),
  feedback_negativo_esperado: z.string().optional(),
  probabilidade_superar_original: z.string().optional(),
  opcoes_hook_textual: z.array(z.string()).max(5).optional(),
});

export const EscalaAnaliseSchema = z.object({
  transcricao_blocos: z.array(
    z.object({
      tempo: z.string(),
      conteudo: z.string(),
      tipo: z.string().optional(),
    }),
  ),
  estrutura_invisivel: z.object({
    angulo_psicologico: z.string(),
    micropersona_alvo: z.string(),
    vilao_nomeado: z.string().optional(),
    mecanismo: z.string().optional(),
    avatar_falante: z.string().optional(),
    nivel_schwartz: z.string().optional(),
    gatilhos_por_bloco: z.string().optional(),
  }),
  pontos_forca: z.array(z.string()),
  variaveis_testaveis: z.object({
    baixo_risco: z.array(z.string()).default([]),
    medio_risco: z.array(z.string()).default([]),
    alto_risco: z.array(z.string()).default([]),
  }),
  menu_variacoes: z.array(EscalaMenuItemSchema),
  ordem_lancamento: z.array(z.string()),
  gerado_em: z.string().optional(),
});

export type EscalaAnalise = z.infer<typeof EscalaAnaliseSchema>;

export const EscalaVariacaoOutputSchema = z.object({
  variacao_id: z.string(),
  nome: z.string(),
  nivel_risco: z.string(),
  instrucao_producao: z.string().optional(),
  roteiro: z.array(
    z.object({
      tempo: z.string(),
      conteudo: z.string(),
      tipo: z.string().optional(),
      hook_visual: z.string().optional(),
    }),
  ),
  estilo_producao: z.enum(["texto_animado", "clipes_texto", "ugc_avatar"]).optional(),
  sinais_esperados: z
    .object({
      hook_rate_estimado: z.string().optional(),
      feedback_negativo_esperado: z.string().optional(),
      fatia_leilao: z.string().optional(),
    })
    .optional(),
});

export type EscalaVariacaoOutput = z.infer<typeof EscalaVariacaoOutputSchema>;

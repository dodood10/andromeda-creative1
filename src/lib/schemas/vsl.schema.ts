import { z } from "zod";

const VslBlocoBase = z.object({
  texto_falado: z.string(),
  objetivo_bloco: z.string().optional(),
});

export const VslOutputSchema = z.object({
  diagnostico_micropersona: z.object({
    nome_micropersona: z.string(),
    papel_temido: z.string(),
    nivel_consciencia_schwartz: z.string(),
    objecao_principal: z.string(),
    depoimento_ideal: z.string(),
  }),
  roteiro: z.object({
    bloco_1_hook_duplo: VslBlocoBase.extend({
      hook_visual: z.string(),
    }),
    bloco_2_agitacao_dor: VslBlocoBase.extend({
      linguagem_micropersona: z.array(z.string()).optional(),
      manifestacao_especifica: z.string().optional(),
    }),
    bloco_3_mecanismo: VslBlocoBase.extend({
      vilao_nomeado: z.string(),
      metafora_visual: z.string().optional(),
    }),
    bloco_4_prova: VslBlocoBase.extend({
      depoimento: z.string().optional(),
      volume: z.string().optional(),
    }),
    bloco_5_objecoes: VslBlocoBase.extend({
      objecoes: z
        .array(z.object({ objecao: z.string(), quebra: z.string() }))
        .min(3)
        .max(3),
      garantia: z.string().optional(),
    }),
    bloco_6_cta: VslBlocoBase.extend({
      estado_antes: z.string().optional(),
      estado_depois: z.string().optional(),
      ancora_preco: z.string().optional(),
      urgencia_real: z.string().optional(),
    }),
  }),
  indicacoes_producao: z.object({
    hook_visual_detalhado: z.string(),
    formato_sugerido: z.string(),
    tom_voz: z.string(),
    safe_zone: z.string().optional(),
  }),
  sinais_andromeda: z.object({
    hook_rate_estimado: z.string(),
    hold_rate_30s: z.string(),
    taxa_conclusao_estimada: z.string(),
    feedback_negativo_esperado: z.enum(["baixo", "medio", "alto"]).or(z.string()),
  }),
});

export type VslOutput = z.infer<typeof VslOutputSchema>;

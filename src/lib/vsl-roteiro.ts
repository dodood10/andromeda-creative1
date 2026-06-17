import type { RoteiroBloco } from "./schemas/angulos.schema";
import type { VslOutput } from "./schemas/vsl.schema";

export type VslAnguloJsonExtras = {
  vsl_diagnostico?: VslOutput["diagnostico_micropersona"];
  vsl_producao?: VslOutput["indicacoes_producao"];
  vsl_sinais?: VslOutput["sinais_andromeda"];
  vsl_gerado_em?: string;
  vsl_dev_mode?: boolean;
};

export const VSL_BLOCOS_META = [
  { tempo: "0-15s", tipo: "hook_duplo", label: "Hook duplo", hint: "Padrão visual quebra + promessa nos primeiros 3s." },
  { tempo: "15-30s", tipo: "dor", label: "Agitação da dor", hint: "Cenário concreto da dor — específico, não genérico." },
  { tempo: "30-60s", tipo: "mecanismo", label: "Mecanismo único", hint: "Apresentação do mecanismo que torna a solução possível." },
  { tempo: "60-90s", tipo: "prova", label: "Prova e credibilidade", hint: "Resultados, depoimentos e provas específicas." },
  { tempo: "90-110s", tipo: "objecoes", label: "Quebra de objeções", hint: "Endereça as 3 maiores objeções de cabeça." },
  { tempo: "110-120s", tipo: "cta", label: "CTA com valor", hint: "Oferta + bônus + garantia + urgência real." },
] as const;

type AnguloLike = {
  hook: string;
  cta: string;
  estrutura: Array<{ tempo: string; conteudo: string }>;
};

/** Monta roteiro VSL 6 blocos a partir do ângulo Andromeda (5 blocos). */
export function buildVslRoteiroFromAngulo(angulo: AnguloLike): RoteiroBloco[] {
  const e = angulo.estrutura;
  return [
    {
      tempo: "0-15s",
      tipo: "hook_duplo",
      conteudo: [angulo.hook, e[0]?.conteudo].filter(Boolean).join("\n\n"),
    },
    { tempo: "15-30s", tipo: "dor", conteudo: e[1]?.conteudo ?? e[0]?.conteudo ?? "" },
    { tempo: "30-60s", tipo: "mecanismo", conteudo: e[2]?.conteudo ?? "" },
    { tempo: "60-90s", tipo: "prova", conteudo: e[3]?.conteudo ?? "" },
    {
      tempo: "90-110s",
      tipo: "objecoes",
      conteudo:
        e.length > 4
          ? e[4]?.conteudo ?? ""
          : "Preço, tempo e ceticismo — responda com clareza antes do CTA.",
    },
    {
      tempo: "110-120s",
      tipo: "cta",
      conteudo: angulo.cta || e[e.length - 1]?.conteudo || "",
    },
  ];
}

export function isVslRoteiro(roteiro: RoteiroBloco[]): boolean {
  return roteiro.length === 6 && roteiro.some((b) => b.tipo === "hook_duplo");
}

export function vslBlockLabel(bloco: RoteiroBloco, index: number): string {
  const meta = VSL_BLOCOS_META.find((m) => m.tipo === bloco.tipo) ?? VSL_BLOCOS_META[index];
  return meta?.label ?? bloco.tipo ?? `Bloco ${index + 1}`;
}

export function vslOutputToRoteiro(output: VslOutput): {
  roteiro: RoteiroBloco[];
  extras: VslAnguloJsonExtras;
} {
  const r = output.roteiro;
  const roteiro: RoteiroBloco[] = [
    {
      tempo: "0-15s",
      tipo: "hook_duplo",
      conteudo: r.bloco_1_hook_duplo.texto_falado,
      hook_visual: r.bloco_1_hook_duplo.hook_visual,
      objetivo_bloco: r.bloco_1_hook_duplo.objetivo_bloco,
    },
    {
      tempo: "15-30s",
      tipo: "dor",
      conteudo: r.bloco_2_agitacao_dor.texto_falado,
      objetivo_bloco: r.bloco_2_agitacao_dor.objetivo_bloco,
      linguagem_micropersona: r.bloco_2_agitacao_dor.linguagem_micropersona,
    },
    {
      tempo: "30-60s",
      tipo: "mecanismo",
      conteudo: r.bloco_3_mecanismo.texto_falado,
      vilao_nomeado: r.bloco_3_mecanismo.vilao_nomeado,
      metafora_visual: r.bloco_3_mecanismo.metafora_visual,
      objetivo_bloco: r.bloco_3_mecanismo.objetivo_bloco,
    },
    {
      tempo: "60-90s",
      tipo: "prova",
      conteudo: r.bloco_4_prova.texto_falado,
      depoimento: r.bloco_4_prova.depoimento,
      objetivo_bloco: r.bloco_4_prova.objetivo_bloco,
    },
    {
      tempo: "90-110s",
      tipo: "objecoes",
      conteudo: r.bloco_5_objecoes.texto_falado,
      objecoes: r.bloco_5_objecoes.objecoes,
      objetivo_bloco: r.bloco_5_objecoes.objetivo_bloco,
    },
    {
      tempo: "110-120s",
      tipo: "cta",
      conteudo: r.bloco_6_cta.texto_falado,
      objetivo_bloco: r.bloco_6_cta.objetivo_bloco,
    },
  ];

  return {
    roteiro,
    extras: {
      vsl_diagnostico: output.diagnostico_micropersona,
      vsl_producao: output.indicacoes_producao,
      vsl_sinais: output.sinais_andromeda,
      vsl_gerado_em: new Date().toISOString(),
    },
  };
}

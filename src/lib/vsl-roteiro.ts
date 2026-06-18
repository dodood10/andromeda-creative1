import type { RoteiroBloco } from "./schemas/angulos.schema";
import type { VslOutput } from "./schemas/vsl.schema";
import { buildVslBlockTimings, resolveVslTargetDurationSec } from "./vsl-duration";

export type VslAnguloJsonExtras = {
  vsl_diagnostico?: VslOutput["diagnostico_micropersona"];
  vsl_producao?: VslOutput["indicacoes_producao"];
  vsl_sinais?: VslOutput["sinais_andromeda"];
  vsl_checklist_meta?: VslOutput["checklist_meta_ads"];
  vsl_duracao_alvo_seg?: number;
  vsl_gerado_em?: string;
  vsl_dev_mode?: boolean;
};

export function getVslBlocosMeta(duracaoSeg = 120) {
  return buildVslBlockTimings(duracaoSeg).map((b) => ({
    tempo: b.tempo,
    tipo: b.tipo,
    label: b.label,
    hint:
      b.tipo === "hook_duplo"
        ? "Padrão visual quebra + promessa nos primeiros 3s."
        : b.tipo === "dor"
          ? "Cenário concreto da dor — específico, não genérico."
          : b.tipo === "mecanismo"
            ? "Apresentação do mecanismo que torna a solução possível."
            : b.tipo === "prova"
              ? "Resultados, depoimentos e provas específicas."
              : b.tipo === "objecoes"
                ? "Endereça as 3 maiores objeções de cabeça."
                : "Oferta + bônus + garantia + urgência real.",
  }));
}

/** @deprecated Use getVslBlocosMeta() */
export const VSL_BLOCOS_META = getVslBlocosMeta(120);

type AnguloLike = {
  hook: string;
  cta: string;
  estrutura: Array<{ tempo: string; conteudo: string }>;
};

/** Monta roteiro VSL 6 blocos a partir do ângulo Andromeda (5 blocos). */
export function buildVslRoteiroFromAngulo(
  angulo: AnguloLike & { recomendacao_formato?: { duracao_alvo_seg?: number } },
): RoteiroBloco[] {
  const duracao = resolveVslTargetDurationSec(angulo);
  const timings = buildVslBlockTimings(duracao);
  const e = angulo.estrutura;
  const contents = [
    [angulo.hook, e[0]?.conteudo].filter(Boolean).join("\n\n"),
    e[1]?.conteudo ?? e[0]?.conteudo ?? "",
    e[2]?.conteudo ?? "",
    e[3]?.conteudo ?? "",
    e.length > 4
      ? (e[4]?.conteudo ?? "")
      : "Preço, tempo e ceticismo — responda com clareza antes do CTA.",
    angulo.cta || e[e.length - 1]?.conteudo || "",
  ];
  return timings.map((t, i) => ({
    tempo: t.tempo,
    tipo: t.tipo,
    conteudo: contents[i] ?? "",
  }));
}

export function isVslRoteiro(roteiro: RoteiroBloco[]): boolean {
  return roteiro.length === 6 && roteiro.some((b) => b.tipo === "hook_duplo");
}

export function vslBlockLabel(bloco: RoteiroBloco, index: number): string {
  const meta = getVslBlocosMeta(120).find((m) => m.tipo === bloco.tipo) ?? getVslBlocosMeta(120)[index];
  return meta?.label ?? bloco.tipo ?? `Bloco ${index + 1}`;
}

export function vslOutputToRoteiro(
  output: VslOutput,
  duracaoAlvoSeg = 120,
): {
  roteiro: RoteiroBloco[];
  extras: VslAnguloJsonExtras;
} {
  const r = output.roteiro;
  const timings = buildVslBlockTimings(duracaoAlvoSeg);
  const t = (i: number) => timings[i]?.tempo ?? `${i * 15}-${(i + 1) * 15}s`;
  const roteiro: RoteiroBloco[] = [
    {
      tempo: t(0),
      tipo: "hook_duplo",
      conteudo: r.bloco_1_hook_duplo.texto_falado,
      hook_visual: r.bloco_1_hook_duplo.hook_visual,
      objetivo_bloco: r.bloco_1_hook_duplo.objetivo_bloco,
    },
    {
      tempo: t(1),
      tipo: "dor",
      conteudo: r.bloco_2_agitacao_dor.texto_falado,
      objetivo_bloco: r.bloco_2_agitacao_dor.objetivo_bloco,
      linguagem_micropersona: r.bloco_2_agitacao_dor.linguagem_micropersona,
    },
    {
      tempo: t(2),
      tipo: "mecanismo",
      conteudo: r.bloco_3_mecanismo.texto_falado,
      vilao_nomeado: r.bloco_3_mecanismo.vilao_nomeado,
      metafora_visual: r.bloco_3_mecanismo.metafora_visual,
      objetivo_bloco: r.bloco_3_mecanismo.objetivo_bloco,
    },
    {
      tempo: t(3),
      tipo: "prova",
      conteudo: r.bloco_4_prova.texto_falado,
      depoimento: r.bloco_4_prova.depoimento,
      objetivo_bloco: r.bloco_4_prova.objetivo_bloco,
    },
    {
      tempo: t(4),
      tipo: "objecoes",
      conteudo: r.bloco_5_objecoes.texto_falado,
      objecoes: r.bloco_5_objecoes.objecoes,
      objetivo_bloco: r.bloco_5_objecoes.objetivo_bloco,
    },
    {
      tempo: t(5),
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
      vsl_checklist_meta: output.checklist_meta_ads,
      vsl_duracao_alvo_seg: duracaoAlvoSeg,
      vsl_gerado_em: new Date().toISOString(),
    },
  };
}

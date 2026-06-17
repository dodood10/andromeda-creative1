import type { RoteiroBloco } from "./schemas/angulos.schema";

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

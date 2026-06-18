import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";

export type BrollPrompt = {
  blocoIndex: number;
  prompt: string;
  queryPexels: string;
};

export function buildBrollPrompts(params: {
  roteiro: RoteiroBloco[];
  hookVisual?: string;
  produto?: string;
  aspectRatio?: string;
}): BrollPrompt[] {
  const { roteiro, hookVisual, produto, aspectRatio } = params;
  const ratioHint =
    aspectRatio === "9:16"
      ? "vertical 9:16 cinematic ad b-roll"
      : aspectRatio === "4:5"
        ? "vertical 4:5 ad b-roll"
        : "square ad b-roll";

  return roteiro.map((bloco, i) => {
    const visual =
      bloco.hook_visual?.trim() ||
      bloco.metafora_visual?.trim() ||
      (i === 0 ? hookVisual : "") ||
      bloco.conteudo?.slice(0, 120) ||
      "cena de produto";

    const prompt = [
      ratioHint,
      produto ? `produto: ${produto}` : "",
      visual,
      "estilo anúncio Meta Ads, realista, alta qualidade, sem texto na tela",
    ]
      .filter(Boolean)
      .join(", ");

    const queryPexels = [produto, visual.split(/[,.]/)[0], "lifestyle"]
      .filter(Boolean)
      .join(" ")
      .slice(0, 60);

    return { blocoIndex: i, prompt, queryPexels };
  });
}

export function roteiroTextForUgc(roteiro: RoteiroBloco[]): string {
  return roteiro.map((b) => b.conteudo?.trim()).filter(Boolean).join(" ");
}

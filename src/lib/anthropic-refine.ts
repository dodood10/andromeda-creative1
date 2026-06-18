/** Chamada Anthropic compartilhada para refinar blocos (escala + editor). */
export async function refineBlockWithAI(
  apiKey: string,
  conteudoAtual: string,
  instrucao: string,
  tempo: string,
  tomCalibracao = "direto",
  generalIntelBlock?: string | null,
  offerBlock?: string | null,
): Promise<string> {
  const intelSuffix = generalIntelBlock?.trim()
    ? `\n\nReferências de copy (PADRÃO ESTRUTURAL APENAS — adapte promessa à oferta):\n${generalIntelBlock.trim().slice(0, 1200)}`
    : "";

  const offerSuffix = offerBlock?.trim()
    ? `\n\n${offerBlock.trim().slice(0, 1200)}\nNão introduza claims que não existam na oferta canônica acima.`
    : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system:
        "Reescreva APENAS o bloco solicitado. Responda só com o texto do bloco, sem markdown. Mantenha congruência com a oferta canônica quando fornecida.",
      messages: [
        {
          role: "user",
          content: `Bloco ${tempo}:\n"${conteudoAtual}"\n\nInstrução: ${instrucao}\nTom: ${tomCalibracao}${offerSuffix}${intelSuffix}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const payload = (await res.json()) as { content: Array<{ type?: string; text?: string }> };
  return payload.content
    .filter((b) => b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

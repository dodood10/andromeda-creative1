/** Chamada Anthropic compartilhada para refinar blocos (escala + editor). */
import { callAnthropicJson } from "./anthropic-json";

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

  return callAnthropicJson({
    apiKey,
    maxTokens: 512,
    system:
      "Reescreva APENAS o bloco solicitado. Responda só com o texto do bloco, sem markdown. Mantenha congruência com a oferta canônica quando fornecida.",
    userMessage: `Bloco ${tempo}:\n"${conteudoAtual}"\n\nInstrução: ${instrucao}\nTom: ${tomCalibracao}${offerSuffix}${intelSuffix}`,
  });
}

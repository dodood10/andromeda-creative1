import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().min(1),
  productType: z.string().optional().default("info"),
  goal: z.string().optional().default("conv"),
  context: z.string().optional().default(""),
});

const SYSTEM_PROMPT = `Você é um estrategista de copy e mídia paga da metodologia Andromeda 2026.
Sua tarefa: analisar a oferta de uma URL (use web_search para visitar e entender o produto, mercado, concorrentes, prova social e nível de consciência) e devolver um diagnóstico + 5 ângulos prontos para criativo.

Responda APENAS em JSON válido, sem markdown, no formato exato:
{
  "diagnostico": {
    "mecanismo": "string",
    "framework_atual": "string",
    "consciencia_schwartz": "string",
    "sofisticacao_mercado": "string"
  },
  "angulos": [
    {
      "nome": "string",
      "tipo": "Previsibilidade" | "Escala" | "Orgânico",
      "schwartz": "string",
      "hook": "string",
      "hook_visual": "string",
      "estrutura": [
        { "tempo": "0-3s", "conteudo": "string" },
        { "tempo": "3-10s", "conteudo": "string" },
        { "tempo": "10-20s", "conteudo": "string" },
        { "tempo": "20-30s", "conteudo": "string" },
        { "tempo": "30-45s", "conteudo": "string" }
      ]
    }
  ]
}
Sempre 5 ângulos. Português do Brasil. Direto, sem clichês.`;

export const gerarAngulos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

    const userMsg = `URL: ${data.url}
Tipo de produto: ${data.productType}
Objetivo: ${data.goal}
Contexto adicional: ${data.context || "(nenhum)"}

Pesquise a URL com web_search, analise a oferta e gere o diagnóstico + 5 ângulos no JSON especificado.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const payload = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = payload.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    // tentar extrair JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta sem JSON: " + text.slice(0, 200));

    return JSON.parse(jsonMatch[0]) as {
      diagnostico: {
        mecanismo: string;
        framework_atual: string;
        consciencia_schwartz: string;
        sofisticacao_mercado: string;
      };
      angulos: Array<{
        nome: string;
        tipo: "Previsibilidade" | "Escala" | "Orgânico";
        schwartz: string;
        hook: string;
        hook_visual: string;
        estrutura: Array<{ tempo: string; conteudo: string }>;
      }>;
    };
  });

export function extractJsonFromAnthropicText(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta sem JSON: " + text.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

export async function callAnthropicJson(params: {
  apiKey: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  useWebSearch?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-5",
    max_tokens: params.maxTokens ?? 8192,
    system: params.system,
    messages: [{ role: "user", content: params.userMessage }],
  };
  if (params.useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  const payload = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return payload.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

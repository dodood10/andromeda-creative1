export function extractJsonFromAnthropicText(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta sem JSON: " + text.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

const RETRY_STATUSES = new Set([408, 502, 503, 504, 522, 524, 529]);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamAnthropicText(res: Response): Promise<string> {
  if (!res.body) {
    // fallback: not actually streaming
    const payload = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    return payload.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (
          evt.type === "content_block_delta" &&
          evt.delta?.type === "text_delta" &&
          evt.delta.text
        ) {
          out += evt.delta.text;
        }
      } catch {
        // ignore non-JSON keep-alive lines
      }
    }
  }

  return out.trim();
}

export async function callAnthropicJson(params: {
  apiKey: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  useWebSearch?: boolean;
  webSearchMaxUses?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-5",
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.userMessage }],
    stream: true,
  };
  if (params.useWebSearch) {
    body.tools = [
      { type: "web_search_20250305", name: "web_search", max_uses: params.webSearchMaxUses ?? 3 },
    ];
  }

  const delays = [0, 1000, 3000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
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
        if (RETRY_STATUSES.has(res.status) && attempt < delays.length - 1) {
          lastErr = new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
          continue;
        }
        throw new Error(`Anthropic ${res.status}: ${errText}`);
      }

      return await streamAnthropicText(res);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      const transient =
        /Anthropic (408|502|503|504|522|524|529)/.test(msg) ||
        /fetch failed|network|ETIMEDOUT|ECONNRESET|socket hang up/i.test(msg);
      if (!transient || attempt >= delays.length - 1) throw lastErr;
    }
  }

  throw lastErr ?? new Error("Anthropic: falha desconhecida");
}

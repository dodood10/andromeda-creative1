export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPageText(url: string, maxChars = 12_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Andromeda/1.0)" },
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Não foi possível acessar a página (${res.status})`);
  const html = await res.text();
  return stripHtml(html).slice(0, maxChars);
}

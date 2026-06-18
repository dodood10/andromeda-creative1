import { z } from "zod";

function isHttpOrHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const HttpUrlSchema = z
  .string()
  .url({ message: "URL inválida" })
  .refine(isHttpOrHttps, { message: "URL deve usar http ou https" });

export function validateHttpUrl(url: string): string {
  return HttpUrlSchema.parse(url.trim());
}

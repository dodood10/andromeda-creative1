import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Evita redirect pós-login para /login ou URLs externas. */
export function safeLoginRedirect(path?: string, fallback = "/app"): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  const pathOnly = path.split("?")[0] ?? path;
  if (pathOnly === "/login") return fallback;
  return path;
}

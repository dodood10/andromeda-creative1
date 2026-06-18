import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export class OriginForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(
    message: string,
    readonly origin: string,
  ) {
    super(message);
    this.name = "OriginForbiddenError";
  }
}

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

function isDevLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function allowedOrigins(): Set<string> {
  const fromEnv = [
    process.env.APP_ORIGIN,
    process.env.VITE_APP_ORIGIN,
    process.env.APP_URL,
    process.env.VITE_SUPABASE_URL,
  ]
    .filter(Boolean)
    .map((url) => normalizeOrigin(url as string));

  return new Set([
    ...fromEnv,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ]);
}

function requestOriginFromHost(request: Request): string | null {
  const host = request.headers.get("Host");
  if (!host) return null;

  const proto =
    request.headers.get("X-Forwarded-Proto") ??
    (request.url.startsWith("https://") ? "https" : "http");

  return normalizeOrigin(`${proto}://${host}`);
}

function isOriginAllowed(request: Request, origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  const allowed = allowedOrigins();

  if (allowed.has(normalized)) return true;

  const requestOrigin = requestOriginFromHost(request);
  if (requestOrigin && normalized === requestOrigin) return true;

  if (process.env.NODE_ENV !== "production" && isDevLocalOrigin(normalized)) {
    return true;
  }

  return false;
}

/**
 * Defesa em profundidade contra CSRF em mutações.
 * Auth usa Bearer (localStorage), não cookies — tokens CSRF dedicados não são obrigatórios.
 */
export const validateMutationOrigin = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  if (!request) return next();

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const origin = request.headers.get("Origin");
  if (!origin) return next();

  if (!isOriginAllowed(request, origin)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[security-origin] Origem rejeitada: ${origin} (Host: ${request.headers.get("Host") ?? "n/a"})`,
      );
    }
    throw new OriginForbiddenError("Forbidden: origem não permitida", origin);
  }

  return next();
});

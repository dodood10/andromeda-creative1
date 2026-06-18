import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function allowedOrigins(): Set<string> {
  const fromEnv = [
    process.env.APP_ORIGIN,
    process.env.VITE_APP_ORIGIN,
    process.env.VITE_SUPABASE_URL?.replace(/\/$/, ""),
  ].filter(Boolean) as string[];

  return new Set([
    ...fromEnv,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ]);
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

    const allowed = allowedOrigins();
    if (!allowed.has(origin)) {
      throw new Error("Forbidden: origem não permitida");
    }

    return next();
});

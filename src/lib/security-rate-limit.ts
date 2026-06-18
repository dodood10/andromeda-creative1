import { createMiddleware } from "@tanstack/react-start";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function checkLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count++;
  if (entry.count > max) {
    const waitSec = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(`Limite de requisições excedido — tente novamente em ${waitSec}s`);
  }
}

export function createUserRateLimit(opts: {
  key: string;
  max: number;
  windowMs: number;
}) {
  return createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const userId = (context as { userId?: string }).userId;
    if (!userId) return next();
    checkLimit(`${opts.key}:${userId}`, opts.max, opts.windowMs);
    return next();
  });
}

/** 10 gerações de ângulos por hora por usuário */
export const rateLimitGerarAngulos = createUserRateLimit({
  key: "gerar_angulos",
  max: 10,
  windowMs: 60 * 60 * 1000,
});

/** 20 exports por hora por usuário */
export const rateLimitExport = createUserRateLimit({
  key: "solicitar_export",
  max: 20,
  windowMs: 60 * 60 * 1000,
});

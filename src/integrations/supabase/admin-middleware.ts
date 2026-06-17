import { createMiddleware } from "@tanstack/react-start";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now > entry.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count++;
  if (entry.count > RATE_MAX) {
    throw new Error("Forbidden: rate limit exceeded — tente novamente em 1 minuto");
  }
}

function parseAdminEmails(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const requirePlatformAdmin = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const ctx = context as {
      supabase?: { from: (t: string) => unknown };
      userId?: string;
      claims?: { email?: string };
    };

    if (!ctx.supabase || !ctx.userId) {
      throw new Error("Forbidden: authentication required");
    }

    checkRateLimit(ctx.userId);

    const email = (ctx.claims?.email ?? "").toLowerCase();
    const allowlist = parseAdminEmails();

    if (email && allowlist.has(email)) {
      return next({ context: { ...ctx, isPlatformAdmin: true as const } });
    }

    const { data: profile, error } = await (ctx.supabase as ReturnType<
      typeof import("@supabase/supabase-js").createClient
    >)
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const row = profile as { is_platform_admin?: boolean } | null;
    if (!row?.is_platform_admin) {
      throw new Error("Forbidden: platform admin access required");
    }

    return next({ context: { ...ctx, isPlatformAdmin: true as const } });
  },
);

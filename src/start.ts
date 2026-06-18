import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { OriginForbiddenError, validateMutationOrigin } from "@/lib/security-origin";
import { securityHeadersRecord } from "@/lib/security-headers";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof OriginForbiddenError) {
      const isDev = process.env.NODE_ENV !== "production";
      const body = isDev
        ? JSON.stringify({ error: error.message, origin: error.origin })
        : JSON.stringify({ error: "Forbidden" });
      return new Response(body, {
        status: 403,
        headers: {
          ...securityHeadersRecord(),
          "Content-Type": "application/json",
        },
      });
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: securityHeadersRecord(),
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [validateMutationOrigin, errorMiddleware],
}));

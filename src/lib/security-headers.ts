const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.supabase.co https://www.facebook.com",
    "media-src 'self' https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.facebook.com https://connect.facebook.net",
    "frame-ancestors 'none'",
  ].join("; "),
};

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function securityHeadersRecord(): Record<string, string> {
  return { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" };
}

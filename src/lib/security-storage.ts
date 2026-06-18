import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertSafeStoragePath(path: string): void {
  if (!path || path.includes("..") || path.startsWith("/")) {
    throw new Error("Caminho de mídia inválido");
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("Caminho de mídia inválido");
  }
}

export async function assertUserCanSignStoragePath(
  supabase: SupabaseClient<Database>,
  userId: string,
  path: string,
): Promise<void> {
  assertSafeStoragePath(path);
  const [first, second] = path.split("/");

  if (first === userId) return;

  if ((first === "audio" || first === "exports") && UUID_RE.test(second ?? "")) {
    const { data, error } = await supabase
      .from("criativos")
      .select("id")
      .eq("id", second!)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Acesso negado ao arquivo");
    }
    return;
  }

  throw new Error("Acesso negado ao arquivo");
}

export function assertUserOwnedMediaPath(userId: string, path: string): void {
  assertSafeStoragePath(path);
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Mídia de fundo deve pertencer ao usuário");
  }
}

import { getVslBlocksPreview } from "@/lib/vsl-duration";

/** Links tipados para navegação no app (TanStack Router search params). */
export type AppLink = {
  to:
    | "/app"
    | "/app/gerador"
    | "/app/historico"
    | "/app/editor"
    | "/app/projetos"
    | "/app/escala"
    | "/app/inteligencia"
    | "/app/plano"
    | "/app/vsl"
    | "/app/vsl/gerador"
    | "/app/vsl/editor"
    | "/app/vsl/pipeline";
  search?: Record<string, string | undefined>;
};

export function appLinkToHref(link: AppLink): string {
  if (!link.search || Object.keys(link.search).length === 0) return link.to;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(link.search)) {
    if (v) params.set(k, v);
  }
  const q = params.toString();
  return q ? `${link.to}?${q}` : link.to;
}

/** Preview estático 120s — use getVslBlocksPreview(duracao) para duração dinâmica */
export const VSL_BLOCKS_PREVIEW = getVslBlocksPreview(120);

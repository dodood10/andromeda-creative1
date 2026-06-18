import type { FormatoSaida } from "./types/enums";

export type ProductMode = "criativo" | "vsl";

export type ProductConfig = {
  mode: ProductMode;
  forcedFormato: FormatoSaida;
  geradorPath: "/app/gerador" | "/app/vsl/gerador";
  editorPath: "/app/editor" | "/app/vsl/editor";
  pipelinePath: "/app/historico";
  cockpitPath: "/app" | "/app/vsl";
  label: string;
  shortLabel: string;
};

export const PRODUCT_CONFIG: Record<ProductMode, ProductConfig> = {
  criativo: {
    mode: "criativo",
    forcedFormato: "criativo_curto",
    geradorPath: "/app/gerador",
    editorPath: "/app/editor",
    pipelinePath: "/app/historico",
    cockpitPath: "/app",
    label: "Criativo curto",
    shortLabel: "Criativo",
  },
  vsl: {
    mode: "vsl",
    forcedFormato: "vsl_curta",
    geradorPath: "/app/vsl/gerador",
    editorPath: "/app/vsl/editor",
    pipelinePath: "/app/historico",
    cockpitPath: "/app/vsl",
    label: "VSL curta",
    shortLabel: "VSL",
  },
};

export function getProductConfig(mode: ProductMode): ProductConfig {
  return PRODUCT_CONFIG[mode];
}

export function productModeFromPathname(pathname: string): ProductMode {
  return pathname.startsWith("/app/vsl") ? "vsl" : "criativo";
}

export function editorPathForFormato(formatoSaida: string | null | undefined): ProductConfig["editorPath"] {
  return formatoSaida === "vsl_curta" ? "/app/vsl/editor" : "/app/editor";
}

/** Search params ao abrir o pipeline unificado por produto */
export function pipelineSearchForMode(mode: ProductMode): Record<string, string> | undefined {
  return mode === "vsl" ? { formato: "vsl_curta" } : undefined;
}

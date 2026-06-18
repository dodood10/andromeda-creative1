import type { EstiloProducao } from "@/lib/formato-recomendacao";
import type { RecomendacaoFormato } from "@/lib/schemas/angulos.schema";
import { isUgcProviderConfigured } from "@/lib/video-providers/agent-media";

export type RenderPipeline = "legado_ffmpeg" | "broll_ia" | "ugc_provider";

export type ResolvedRender = {
  pipeline: RenderPipeline;
  estiloOriginal: EstiloProducao;
  ugcRecommended: boolean;
  fallbackFrom?: "ugc_avatar";
  renderFallbackEstilo?: "clipes_texto" | "texto_animado";
  usedUgcProvider?: boolean;
};

const SCENE_KEYWORDS =
  /b-roll|broll|cena|produto|lifestyle|demonstra|close|ambiente|mão|segurando|unboxing/i;
const TALKING_KEYWORDS =
  /selfie|falando|depoimento|creator|pessoa|rosto|talking|ugc|testemunho|câmera frontal/i;

export function resolveRenderPipeline(
  estilo: EstiloProducao,
  opts?: {
    requerMidiaUsuario?: boolean;
    hookVisual?: string;
  },
): ResolvedRender {
  if (estilo === "texto_animado") {
    return { pipeline: "legado_ffmpeg", estiloOriginal: estilo, ugcRecommended: false };
  }

  if (estilo === "clipes_texto") {
    return { pipeline: "broll_ia", estiloOriginal: estilo, ugcRecommended: false };
  }

  if (estilo === "ugc_avatar" && isUgcProviderConfigured()) {
    return {
      pipeline: "ugc_provider",
      estiloOriginal: estilo,
      ugcRecommended: false,
      usedUgcProvider: true,
    };
  }

  const hook = opts?.hookVisual ?? "";
  const wantsBroll =
    opts?.requerMidiaUsuario === true ||
    SCENE_KEYWORDS.test(hook) ||
    (!TALKING_KEYWORDS.test(hook) && hook.length > 0);

  const renderFallbackEstilo = wantsBroll ? "clipes_texto" : "texto_animado";

  return {
    pipeline: wantsBroll ? "broll_ia" : "legado_ffmpeg",
    estiloOriginal: "ugc_avatar",
    ugcRecommended: true,
    fallbackFrom: "ugc_avatar",
    renderFallbackEstilo,
  };
}

export function estiloLabelForCriativo(estilo: EstiloProducao): string {
  if (estilo === "ugc_avatar") return "UGC";
  if (estilo === "clipes_texto") return "Clipes";
  return "Texto";
}

export function extractRecomendacaoFromAnguloJson(
  anguloJson: unknown,
): Partial<RecomendacaoFormato> | null {
  if (!anguloJson || typeof anguloJson !== "object") return null;
  const o = anguloJson as Record<string, unknown>;
  const rec =
    (o.recomendacao_formato_aplicada as Partial<RecomendacaoFormato> | undefined) ??
    (o.recomendacao_formato as Partial<RecomendacaoFormato> | undefined);
  return rec ?? null;
}

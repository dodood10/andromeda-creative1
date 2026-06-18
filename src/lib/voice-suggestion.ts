import type { TomCalibracao } from "./types/enums";

/** Vozes PT-BR alinhadas ao tom de calibração do briefing. */
const TOM_TO_VOICE: Record<TomCalibracao, string> = {
  direto: "pNInz6obpgDQGcFmaJgB",
  empatico: "ThT5KcBeYPX3keUQqHPh",
  autoritativo: "VR6AewLTigWG4xSOukaG",
  urgente: "pNInz6obpgDQGcFmaJgB",
};

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export function suggestVoiceForTom(tom: TomCalibracao | string | undefined): string {
  if (tom && tom in TOM_TO_VOICE) {
    return TOM_TO_VOICE[tom as TomCalibracao];
  }
  return DEFAULT_VOICE_ID;
}

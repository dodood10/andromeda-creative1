const NICHE_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: "diabetes", label: "diabetes / glicemia", pattern: /\b(diabetes|diabétic|glicemia|açúcar no sangue|insulina)\b/i },
  { id: "emagrecimento", label: "emagrecimento", pattern: /\b(emagrec|perder peso|gordura|barriga|metabolismo)\b/i },
  { id: "visao", label: "visão", pattern: /\b(visão|miopia|óculos|catarata|olhos)\b/i },
  { id: "financas", label: "finanças", pattern: /\b(dinheiro|investir|renda|dívida|bolsa|cripto)\b/i },
  { id: "relacionamento", label: "relacionamento", pattern: /\b(relacionamento|namoro|casamento|ex-|marido|esposa)\b/i },
  { id: "neuropatia", label: "neuropatia", pattern: /\b(neuropatia|formigamento|dor nas pernas)\b/i },
];

export function detectNicheSignals(text: string): string[] {
  return NICHE_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => p.id);
}

function normalizeNicho(nicho: string): string {
  return nicho
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function nichoMatchesProject(projectNicho: string, detectedId: string): boolean {
  const p = normalizeNicho(projectNicho);
  const label = NICHE_PATTERNS.find((n) => n.id === detectedId)?.label ?? detectedId;
  const parts = label.split(/\s*\/\s*/).map((s) => normalizeNicho(s));
  return parts.some((part) => p.includes(part) || part.includes(p));
}

export function compareWithProjectNicho(
  projectNicho: string | null | undefined,
  text: string,
): { mismatch: boolean; detected: string[]; message: string | null } {
  const detected = detectNicheSignals(text);
  if (!projectNicho?.trim() || detected.length === 0) {
    return { mismatch: false, detected, message: null };
  }

  const foreign = detected.filter((id) => !nichoMatchesProject(projectNicho, id));
  if (foreign.length === 0) {
    return { mismatch: false, detected, message: null };
  }

  const labels = foreign
    .map((id) => NICHE_PATTERNS.find((p) => p.id === id)?.label ?? id)
    .join(", ");

  return {
    mismatch: true,
    detected: foreign,
    message: `Esta copy parece do nicho "${labels}", diferente do projeto (${projectNicho}). Use só estrutura e formato — reescreva a promessa para sua oferta.`,
  };
}

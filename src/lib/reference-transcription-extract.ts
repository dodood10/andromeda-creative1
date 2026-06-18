export type ExtractedSnippet = {
  label: string;
  text: string;
};

/** Estrutura campeã citada na metodologia EDS — útil como 4ª referência. */
export const CHAMPION_STRUCTURE_SNIPPET: ExtractedSnippet = {
  label: "Estrutura campeã (template)",
  text:
    "Ordem estrutural: (1) apresenta mecanismo/solução — não começa só pela dor; " +
    "(2) invalida soluções tradicionais (remédio, dieta genérica); " +
    "(3) explica causa do problema; " +
    "(4) beat de conspiração leve — indústria não quer que você veja; " +
    "(5) convite para assistir o vídeo/VSL; (6) CTA direto.",
};

const LESSON_MARKERS =
  /\b(galera|beleza|vamos lá|biblioteca de anúncios|planilha|nessa aula|passo a passo|top\s*10)\b/i;

const SNIPPET_PATTERNS: Array<{
  label: string;
  test: RegExp;
  extract: (text: string) => string | null;
}> = [
  {
    label: "Hook depoimento + números (glicemia)",
    test: /\b(230|glicemia).{0,80}(102|caiu|reduz)/is,
    extract: (text) => {
      const m = text.match(
        /[^.!?\n]{0,120}(glicemia|açúcar no sangue).{0,200}(230|102|caiu|imediatamente)[^.!?\n]*[.!?]?/is,
      );
      if (m) return m[0].trim();
      const alt = text.match(
        /minha glicemia[^.!?\n]{10,400}[.!?]/is,
      );
      return alt?.[0].trim() ?? null;
    },
  },
  {
    label: "UGC Olivia/Mary + ritual caseiro",
    test: /\b(ol[ií]via|mary|ex diab[eé]tic|ritual|canela|pepino)\b/i,
    extract: (text) => {
      const m = text.match(
        /ol[aá][^.!?\n]{0,80}(ol[ií]via|mary)[^.!?\n]{20,800}[.!?]/is,
      );
      if (m) return m[0].trim();
      const ritual = text.match(
        /[^.!?\n]{0,60}(ritual|receita|misturar).{0,400}(canela|pepino|folha|dormir)[^.!?\n]*[.!?]/is,
      );
      return ritual?.[0].trim() ?? null;
    },
  },
  {
    label: "Receita banana / efeito bariátrico",
    test: /\b(banana|bari[aá]tric|20\s*segundos)\b/i,
    extract: (text) => {
      const m = text.match(
        /[^.!?\n]{0,80}banana[^.!?\n]{10,500}[.!?]/is,
      );
      return m?.[0].trim() ?? null;
    },
  },
  {
    label: "Superioridade + técnica",
    test: /\b(melhor t[eé]cnica|de longe|mundo para reduzir)\b/i,
    extract: (text) => {
      const m = text.match(
        /de longe[^.!?\n]{10,200}[.!?]/is,
      );
      return m?.[0].trim() ?? null;
    },
  },
];

export function isLikelyLessonTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length < 1200) return false;
  const markerHits = (t.match(LESSON_MARKERS) ?? []).length;
  const hasAdDensity = SNIPPET_PATTERNS.filter((p) => p.test.test(t)).length;
  return markerHits >= 2 || (t.length > 3000 && markerHits >= 1 && hasAdDensity >= 2);
}

function dedupeSnippets(snippets: ExtractedSnippet[]): ExtractedSnippet[] {
  const seen = new Set<string>();
  return snippets.filter((s) => {
    const key = s.text.slice(0, 80).toLowerCase();
    if (seen.has(key) || s.text.trim().length < 40) return false;
    seen.add(key);
    return true;
  });
}

/** Extrai trechos de copy campeã de textos longos (ex.: aula gravada). */
export function extractChampionSnippetsFromText(text: string): {
  snippets: ExtractedSnippet[];
  isLesson: boolean;
} {
  const isLesson = isLikelyLessonTranscript(text);
  const found: ExtractedSnippet[] = [];

  for (const pattern of SNIPPET_PATTERNS) {
    if (!pattern.test.test(text)) continue;
    const excerpt = pattern.extract(text);
    if (excerpt && excerpt.length >= 40) {
      found.push({ label: pattern.label, text: excerpt });
    }
  }

  if (isLesson) {
    found.push(CHAMPION_STRUCTURE_SNIPPET);
  }

  if (found.length === 0 && text.length > 2000) {
    const paragraphs = text
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ"«])/u)
      .map((p) => p.trim())
      .filter((p) => p.length >= 80 && p.length <= 1200)
      .filter((p) => !LESSON_MARKERS.test(p))
      .filter((p) => /\b(você|eu |minha |glicemia|diab|emagrec|descobri|método|receita)\b/i.test(p));

    paragraphs.slice(0, 4).forEach((p, i) => {
      found.push({ label: `Trecho ${i + 1}`, text: p });
    });
  }

  return { snippets: dedupeSnippets(found), isLesson };
}

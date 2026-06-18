import type { ResultadoAngulos } from "./schemas/angulos.schema";
import type { ExportTranscricaoSnapshot } from "./export-transcription";

export type ChampionForRanking = {
  criativoId: string;
  angulo: string;
  formato: string;
  estilo: string;
  hook?: string;
  papelTemido?: string;
  transcricaoTexto?: string;
};

export type ChampionRankingContext = {
  champions: ChampionForRanking[];
};

export type AnguloRankResult = {
  score: number;
  matchedChampionAngulo?: string;
  badges: string[];
};

const STOPWORDS = new Set([
  "para",
  "como",
  "mais",
  "seu",
  "sua",
  "que",
  "uma",
  "uns",
  "das",
  "dos",
  "por",
  "sem",
  "nos",
  "nas",
  "este",
  "esta",
  "isso",
  "aqui",
  "voce",
  "você",
  "the",
  "and",
  "for",
  "with",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function tokenize(text: string): Set<string> {
  const tokens = normalizeText(text)
    .split(/\W+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) {
    if (tb.has(t)) common++;
  }
  return common / Math.max(ta.size, tb.size);
}

function topTerms(text: string, limit = 10): string[] {
  const freq = new Map<string, number>();
  for (const t of tokenize(text)) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function extractTranscricaoTexto(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return "";
  const snap = raw as ExportTranscricaoSnapshot;
  if (!Array.isArray(snap.blocos)) return "";
  return snap.blocos.map((b) => b.conteudo).join(" ");
}

export function championFromCriativoRow(row: {
  id: string;
  angulo: string;
  formato_saida?: string | null;
  estilo_producao?: string | null;
  angulo_json?: unknown;
}): ChampionForRanking {
  const aj = row.angulo_json as {
    hook?: string;
    micropersona?: { papel_temido?: string };
    export_transcricao?: unknown;
  } | null;
  return {
    criativoId: row.id,
    angulo: row.angulo.split(" · ")[0]?.trim() ?? row.angulo,
    formato: row.formato_saida ?? "—",
    estilo: row.estilo_producao ?? "—",
    hook: aj?.hook,
    papelTemido: aj?.micropersona?.papel_temido,
    transcricaoTexto: extractTranscricaoTexto(aj?.export_transcricao),
  };
}

function estiloLabel(estilo: string): string {
  const map: Record<string, string> = {
    ugc_avatar: "UGC",
    clipes_texto: "Clipes + texto",
    texto_animado: "Texto animado",
  };
  return map[estilo] ?? estilo;
}

export function scoreAnguloVsChampions(
  angulo: ResultadoAngulos["angulos"][number],
  champions: ChampionForRanking[],
): AnguloRankResult {
  if (champions.length === 0) {
    return { score: 50, badges: [] };
  }

  let bestScore = 0;
  let bestChampion: ChampionForRanking | undefined;
  const rec = angulo.recomendacao_formato;

  for (const ch of champions) {
    let score = 0;

    if (rec && ch.estilo !== "—" && rec.estilo_producao === ch.estilo) score += 30;
    if (rec && ch.formato !== "—" && rec.formato_saida === ch.formato) score += 25;

    const papelOverlap = tokenOverlapRatio(
      angulo.micropersona?.papel_temido ?? "",
      ch.papelTemido ?? "",
    );
    if (papelOverlap >= 0.35) score += 20;
    else if (papelOverlap >= 0.15) score += 10;

    const champTerms = topTerms(`${ch.hook ?? ""} ${ch.transcricaoTexto ?? ""}`);
    const hookTokens = tokenize(angulo.hook ?? "");
    const hookMatches = champTerms.filter((t) => hookTokens.has(t)).length;
    if (hookMatches >= 2) score += 15;
    else if (hookMatches >= 1) score += 8;

    if (rec?.confianca === "alta") score += 10;
    else if (rec?.confianca === "media") score += 5;

    if (angulo.saturacao_hook?.status === "saturado") score -= 40;

    score = Math.max(0, Math.min(100, score));

    if (score > bestScore) {
      bestScore = score;
      bestChampion = ch;
    }
  }

  const badges = explainAnguloRank(angulo, champions, bestChampion, bestScore);
  return {
    score: bestScore,
    matchedChampionAngulo: bestChampion?.angulo,
    badges,
  };
}

export function explainAnguloRank(
  angulo: ResultadoAngulos["angulos"][number],
  champions: ChampionForRanking[],
  bestChampion?: ChampionForRanking,
  bestScore?: number,
): string[] {
  if (champions.length === 0) return [];

  const result = bestChampion
    ? { champion: bestChampion, score: bestScore ?? 0 }
    : (() => {
        const r = scoreAnguloVsChampions(angulo, champions);
        const ch = champions.find((c) => c.angulo === r.matchedChampionAngulo) ?? champions[0];
        return { champion: ch, score: r.score };
      })();

  const badges: string[] = [];
  const rec = angulo.recomendacao_formato;
  const ch = result.champion;

  if (result.score >= 55 && ch) {
    const nome =
      ch.angulo.length > 32 ? `${ch.angulo.slice(0, 29)}…` : ch.angulo;
    badges.push(`Padrão do campeão: ${nome}`);
  }

  if (rec && ch && ch.estilo !== "—" && rec.estilo_producao === ch.estilo) {
    badges.push(`Estilo vencedor: ${estiloLabel(ch.estilo)}`);
  }

  if (result.score < 40 && champions.length > 0) {
    badges.push("Ângulo novo — diversifica leilão");
  }

  return badges;
}

export function rankAngulosPorCampeoes(
  resultado: ResultadoAngulos,
  champions: ChampionForRanking[],
): Array<{ index: number; score: number; badges: string[] }> {
  return resultado.angulos
    .map((a, index) => {
      const r = scoreAnguloVsChampions(a, champions);
      return { index, score: r.score, badges: r.badges };
    })
    .sort((a, b) => b.score - a.score);
}

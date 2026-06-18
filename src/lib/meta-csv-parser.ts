/** Parser de CSV exportado do Meta Ads Manager (pt-BR e en). */

export type MetaCsvMetricRow = {
  lineNumber: number;
  utmContent: string;
  adName: string;
  metrics: Array<{ metrica: string; valor: string }>;
};

const COLUMN_PATTERNS: Array<{ metrica: string; patterns: string[] }> = [
  { metrica: "gasto", patterns: ["gasto", "spend", "valor gasto", "amount spent", "investimento"] },
  { metrica: "cpa", patterns: ["cpa", "custo por resultado", "cost per result", "custo por conversão", "cost per conversion"] },
  { metrica: "roas", patterns: ["roas", "retorno sobre gasto", "purchase roas", "roas de compras"] },
  { metrica: "hook_rate", patterns: ["hook rate", "taxa de hook", "thumbstop", "retenção 3s", "video plays at 3s"] },
  { metrica: "ctr", patterns: ["ctr", "taxa de cliques", "click-through rate", "ctr (todos)"] },
  { metrica: "cpm", patterns: ["cpm", "custo por mil", "cost per 1000"] },
  { metrica: "conversoes", patterns: ["conversões", "conversoes", "results", "resultados", "purchases", "compras"] },
  { metrica: "impressoes", patterns: ["impressões", "impressoes", "impressions"] },
  { metrica: "cliques", patterns: ["cliques", "clicks", "link clicks"] },
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/^"|"$/g, "");
}

function findColumnIndex(header: string[], patterns: string[]): number {
  return header.findIndex((h) => patterns.some((p) => h.includes(p)));
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) {
      cols.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current.trim().replace(/^"|"$/g, ""));
  return cols;
}

export function parseMetaAdsCsv(csvText: string): MetaCsvMetricRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  const utmIdx = findColumnIndex(header, ["utm", "content", "utm_content"]);
  const nameIdx = findColumnIndex(header, ["anúncio", "anuncio", "ad name", "nome do anúncio", "ad name"]);

  const metricCols = COLUMN_PATTERNS.map((def) => ({
    metrica: def.metrica,
    idx: findColumnIndex(header, def.patterns),
  })).filter((c) => c.idx >= 0);

  const rows: MetaCsvMetricRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const metrics: Array<{ metrica: string; valor: string }> = [];
    for (const col of metricCols) {
      const val = cols[col.idx]?.trim();
      if (val) metrics.push({ metrica: col.metrica, valor: val });
    }

    rows.push({
      lineNumber: i + 1,
      utmContent: utmIdx >= 0 ? (cols[utmIdx] ?? "") : "",
      adName: nameIdx >= 0 ? (cols[nameIdx] ?? "") : "",
      metrics,
    });
  }
  return rows;
}

export function parseNumericMetric(valor: string): number | null {
  const cleaned = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3})/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Sinal de performance positiva para auto-aprovar intel/performando via CSV. */
export function csvRowIndicatesStrongPerformance(metrics: Array<{ metrica: string; valor: string }>): boolean {
  let roas: number | null = null;
  let cpa: number | null = null;
  let conversoes: number | null = null;
  let gasto: number | null = null;

  for (const m of metrics) {
    const n = parseNumericMetric(m.valor);
    if (n == null) continue;
    if (m.metrica === "roas") roas = n;
    if (m.metrica === "cpa") cpa = n;
    if (m.metrica === "conversoes") conversoes = n;
    if (m.metrica === "gasto") gasto = n;
  }

  if (roas != null && roas >= 1.5) return true;
  if (conversoes != null && conversoes >= 1 && gasto != null && gasto > 0) return true;
  if (cpa != null && cpa > 0 && cpa <= 80) return true;
  return false;
}

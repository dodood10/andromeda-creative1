export type PlanTier = "free" | "pro" | "agency";

export const PLAN_LIMITS = {
  free: { geracoesMes: 3, exportsMes: 1, projetos: 1, escalaMes: 0, importsMes: 10 },
  pro: { geracoesMes: Infinity, exportsMes: Infinity, projetos: 10, escalaMes: Infinity, importsMes: 50 },
  agency: { geracoesMes: Infinity, exportsMes: Infinity, projetos: Infinity, escalaMes: Infinity, importsMes: 50 },
} as const;

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Grátis",
  pro: "Pro",
  agency: "Agency",
};

export function formatLimit(n: number): string {
  return n === Infinity ? "Ilimitado" : String(n);
}

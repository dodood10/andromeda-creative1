import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  AdminReviewVerdictSchema,
  type AdminReviewVerdict,
  type IntelReviewStatus,
} from "./enums";

export type { AdminReviewVerdict, IntelReviewStatus };

export const ReviewPerformandoSchema = z.object({
  criativoId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export const ReviewResultadoSchema = z.object({
  resultadoId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export const SubmitAdminCriativoReviewSchema = z.object({
  criativoId: z.string().uuid(),
  verdict: AdminReviewVerdictSchema,
  qualityScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(5000).optional(),
  includeInIntelligence: z.boolean().optional().default(false),
});

export type AvaliacaoQueueItem =
  | {
      kind: "performando";
      criativoId: string;
      produto: string;
      angulo: string;
      organizationName: string;
      userEmail: string;
      submittedAt: string;
    }
  | {
      kind: "resultado";
      resultadoId: string;
      criativoId: string;
      produto: string;
      angulo: string;
      organizationName: string;
      userEmail: string;
      tipo: Database["public"]["Enums"]["resultado_tipo"];
      metrica: string | null;
      valor: string | null;
      observacao: string | null;
      submittedAt: string;
    };

export type AvaliacaoCriativoRow = {
  id: string;
  produto: string;
  angulo: string;
  status: string;
  exportStatus: string | null;
  formatoSaida: string | null;
  performandoIntelStatus: IntelReviewStatus | null;
  organizationName: string;
  userEmail: string;
  scoreTotal: number | null;
  createdAt: string;
};

export function scoreFromJson(scoreJson: unknown): number | null {
  if (!scoreJson || typeof scoreJson !== "object") return null;
  const s = scoreJson as { total?: number; dimensoes?: Array<{ score: number }> };
  if (typeof s.total === "number") return s.total;
  if (s.dimensoes?.length) {
    return Math.round(s.dimensoes.reduce((a, d) => a + d.score, 0) / s.dimensoes.length);
  }
  return null;
}

export function isPerformandoApprovedForIntel(
  status: string,
  performandoIntelStatus: IntelReviewStatus | null | undefined,
): boolean {
  return status === "Performando" && performandoIntelStatus === "approved";
}

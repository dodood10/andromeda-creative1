import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type FormatoSaida = Database["public"]["Enums"]["formato_saida"];
export type EstiloProducao = Database["public"]["Enums"]["estilo_producao"];
export type CriativoStatus = Database["public"]["Enums"]["criativo_status"];
export type OrgMemberRole = Database["public"]["Enums"]["org_member_role"];

export const FormatoSaidaSchema = z.enum(["criativo_curto", "vsl_curta"]);
export const EstiloProducaoSchema = z.enum(["texto_animado", "clipes_texto", "ugc_avatar"]);
export const CriativoStatusSchema = z.enum([
  "Gerado",
  "Subiu",
  "Rodando",
  "Performando",
  "Pausado",
]);
export const OrgMemberRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const AnguloTipoSchema = z.enum(["Previsibilidade", "Escala", "Orgânico"]);
export const NivelConspiracaoSchema = z.enum(["sem", "leve", "forte"]);
export const FeedbackNegativoSchema = z.enum(["baixo", "medio", "alto"]);
export const SaturacaoHookStatusSchema = z.enum(["saturado", "neutro", "sub_explorado"]);
export const JanelaRelevanciaTipoSchema = z.enum(["atemporal", "media", "curta"]);
export const SofisticacaoMercadoSchema = z.enum(["novo", "intermediario", "sofisticado"]);

/** Tipos de ângulo de copy (estratégia de abordagem — distinto de tipo Previsibilidade/Escala). */
export const AnguloCopyTipoSchema = z.enum([
  "direto",
  "historia",
  "problema_solucao",
  "contrario",
  "curiosidade",
  "novo_mecanismo",
  "autoridade_prova",
]);

export const NivelConscienciaAlvoSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const TomCalibracaoSchema = z.enum(["direto", "empatico", "autoritativo", "urgente"]);

export type AnguloCopyTipo = z.infer<typeof AnguloCopyTipoSchema>;
export type NivelConscienciaAlvo = z.infer<typeof NivelConscienciaAlvoSchema>;
export type TomCalibracao = z.infer<typeof TomCalibracaoSchema>;

export type IntelReviewStatus = Database["public"]["Enums"]["intel_review_status"];
export type AdminReviewVerdict = Database["public"]["Enums"]["admin_review_verdict"];

export const IntelReviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const AdminReviewVerdictSchema = z.enum(["approved", "rejected", "flagged"]);

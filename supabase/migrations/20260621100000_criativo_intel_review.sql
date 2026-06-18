-- Gate de inteligência: avaliações de usuário exigem confirmação admin

CREATE TYPE public.intel_review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.admin_review_verdict AS ENUM ('approved', 'rejected', 'flagged');

ALTER TABLE public.criativos
  ADD COLUMN performando_intel_status public.intel_review_status,
  ADD COLUMN performando_intel_submitted_at timestamptz,
  ADD COLUMN performando_intel_reviewed_at timestamptz,
  ADD COLUMN performando_intel_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN performando_intel_notes text;

CREATE INDEX criativos_performando_intel_pending_idx
  ON public.criativos (performando_intel_status)
  WHERE performando_intel_status = 'pending';

ALTER TABLE public.resultados_reportados
  ADD COLUMN intel_review_status public.intel_review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN intel_reviewed_at timestamptz,
  ADD COLUMN intel_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN intel_notes text;

CREATE INDEX resultados_intel_pending_idx
  ON public.resultados_reportados (intel_review_status)
  WHERE intel_review_status = 'pending';

CREATE TABLE public.criativo_admin_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id uuid NOT NULL REFERENCES public.criativos(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  verdict public.admin_review_verdict NOT NULL,
  quality_score smallint CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 5)),
  notes text,
  include_in_intelligence boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX criativo_admin_reviews_criativo_id_idx ON public.criativo_admin_reviews (criativo_id, created_at DESC);

ALTER TABLE public.criativo_admin_reviews ENABLE ROW LEVEL SECURITY;

-- Backfill: dados existentes permanecem válidos para inteligência
UPDATE public.criativos
SET performando_intel_status = 'approved'
WHERE status = 'Performando' AND performando_intel_status IS NULL;

UPDATE public.resultados_reportados
SET intel_review_status = 'approved'
WHERE intel_review_status = 'pending';

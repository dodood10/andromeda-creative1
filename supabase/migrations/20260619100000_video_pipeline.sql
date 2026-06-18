-- Estilo UGC (decisão estratégica da IA; render via fallback até provedor futuro)
ALTER TYPE public.estilo_producao ADD VALUE IF NOT EXISTS 'ugc_avatar';

-- Jobs assíncronos de render de vídeo
CREATE TABLE IF NOT EXISTS public.video_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id uuid NOT NULL REFERENCES public.criativos(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_job_id text,
  status text NOT NULL DEFAULT 'pending',
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_paths jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_render_jobs_criativo_idx ON public.video_render_jobs (criativo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_render_jobs_status_idx ON public.video_render_jobs (status, created_at DESC);

ALTER TABLE public.video_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_render_jobs_select_org" ON public.video_render_jobs
  FOR SELECT TO authenticated
  USING (
    criativo_id IN (
      SELECT c.id FROM public.criativos c
      WHERE c.user_id = auth.uid()
        OR c.organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "video_render_jobs_insert_service" ON public.video_render_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    criativo_id IN (
      SELECT c.id FROM public.criativos c WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "video_render_jobs_update_own" ON public.video_render_jobs
  FOR UPDATE TO authenticated
  USING (
    criativo_id IN (
      SELECT c.id FROM public.criativos c WHERE c.user_id = auth.uid()
    )
  );

ALTER TABLE public.video_render_jobs
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE INDEX IF NOT EXISTS idx_video_render_jobs_created_at ON public.video_render_jobs(created_at DESC);
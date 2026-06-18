-- Calibração persistente de sinais Andromeda por projeto (Fase 3)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS intel_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.projects.intel_settings IS
  'Bias de calibração hook rate (hook_rate_bias_pp), amostras e last_calibrated_at';

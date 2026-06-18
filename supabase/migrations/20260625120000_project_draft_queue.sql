-- Fila de rascunhos por projeto (sincroniza entre dispositivos)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS draft_queue jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.draft_queue IS
  'Fila ordenada de criativo IDs para produção em lote no editor';

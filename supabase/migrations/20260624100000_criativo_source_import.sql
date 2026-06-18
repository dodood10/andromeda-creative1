-- Origem do criativo: gerado na plataforma vs importado da biblioteca de campeões

DO $$ BEGIN
  CREATE TYPE public.criativo_source AS ENUM ('andromeda', 'importado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.criativos
  ADD COLUMN IF NOT EXISTS source public.criativo_source NOT NULL DEFAULT 'andromeda',
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_metadata jsonb;

COMMENT ON COLUMN public.criativos.source IS 'andromeda = gerado no app; importado = biblioteca de campeões externa';
COMMENT ON COLUMN public.criativos.imported_at IS 'Quando o criativo foi importado (null para andromeda)';
COMMENT ON COLUMN public.criativos.import_metadata IS 'Metadados do import: fileName, notas, etc.';

CREATE INDEX IF NOT EXISTS criativos_project_source_idx ON public.criativos (project_id, source)
  WHERE source = 'importado';

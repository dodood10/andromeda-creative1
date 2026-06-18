-- Metadados de editor e pipeline para lembretes precisos
ALTER TABLE public.criativos
  ADD COLUMN IF NOT EXISTS music_volume smallint NOT NULL DEFAULT 40
    CHECK (music_volume >= 0 AND music_volume <= 100);

ALTER TABLE public.criativos
  ADD COLUMN IF NOT EXISTS status_rodando_at timestamptz;

COMMENT ON COLUMN public.criativos.music_volume IS 'Volume da trilha de fundo no editor (0-100)';
COMMENT ON COLUMN public.criativos.status_rodando_at IS 'Quando o criativo entrou em status Rodando';

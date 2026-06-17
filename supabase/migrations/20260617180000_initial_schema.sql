-- Status dos criativos no pipeline Meta Ads
CREATE TYPE public.criativo_status AS ENUM (
  'Gerado',
  'Subiu',
  'Rodando',
  'Performando',
  'Pausado'
);

-- Perfil do usuário (dados de app, não auth)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  nicho text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Gerações de ângulos (resultado do gerador)
CREATE TABLE public.geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  product_type text NOT NULL DEFAULT 'info',
  goal text NOT NULL DEFAULT 'conv',
  context text DEFAULT '',
  diagnostico jsonb NOT NULL DEFAULT '{}'::jsonb,
  angulos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX geracoes_user_id_created_at_idx ON public.geracoes (user_id, created_at DESC);

ALTER TABLE public.geracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geracoes_select_own" ON public.geracoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "geracoes_insert_own" ON public.geracoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "geracoes_delete_own" ON public.geracoes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Criativos no histórico / pipeline
CREATE TABLE public.criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  geracao_id uuid REFERENCES public.geracoes(id) ON DELETE SET NULL,
  produto text NOT NULL,
  angulo text NOT NULL,
  formato text NOT NULL DEFAULT '9:16',
  estilo text NOT NULL DEFAULT 'Texto',
  status public.criativo_status NOT NULL DEFAULT 'Gerado',
  observacoes text DEFAULT '',
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX criativos_user_id_created_at_idx ON public.criativos (user_id, created_at DESC);
CREATE INDEX criativos_status_idx ON public.criativos (user_id, status);

ALTER TABLE public.criativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "criativos_select_own" ON public.criativos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "criativos_insert_own" ON public.criativos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "criativos_update_own" ON public.criativos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "criativos_delete_own" ON public.criativos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER criativos_updated_at
  BEFORE UPDATE ON public.criativos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-criar profile ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket para mídia de criativos (editor/escala)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'criativos-media',
  'criativos-media',
  false,
  104857600,
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "criativos_media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'criativos-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "criativos_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'criativos-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "criativos_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'criativos-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "criativos_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'criativos-media' AND (storage.foldername(name))[1] = auth.uid()::text);

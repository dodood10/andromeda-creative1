-- Enums
CREATE TYPE public.org_member_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.formato_saida AS ENUM ('criativo_curto', 'vsl_curta');
CREATE TYPE public.estilo_producao AS ENUM ('texto_animado', 'clipes_texto');
CREATE TYPE public.export_status AS ENUM ('rascunho', 'renderizando', 'pronto', 'erro');
CREATE TYPE public.resultado_tipo AS ENUM ('venda', 'lead', 'clique');

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_members_user_id_idx ON public.organization_members (user_id);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  nicho text,
  url_default text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_organization_id_idx ON public.projects (organization_id);

-- Helper: user is member of org
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

-- Extend geracoes
ALTER TABLE public.geracoes
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Extend criativos
ALTER TABLE public.criativos
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN formato_saida public.formato_saida DEFAULT 'criativo_curto',
  ADD COLUMN estilo_producao public.estilo_producao DEFAULT 'texto_animado',
  ADD COLUMN angulo_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN roteiro jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN utm_content text,
  ADD COLUMN audio_paths jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN background_media_path text,
  ADD COLUMN voice_id text,
  ADD COLUMN score_json jsonb,
  ADD COLUMN export_status public.export_status DEFAULT 'rascunho',
  ADD COLUMN export_paths jsonb DEFAULT '[]'::jsonb;

CREATE INDEX criativos_project_id_idx ON public.criativos (project_id);

-- Resultados reportados (Sprint 8)
CREATE TABLE public.resultados_reportados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id uuid NOT NULL REFERENCES public.criativos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo public.resultado_tipo NOT NULL,
  metrica text,
  valor text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX resultados_criativo_id_idx ON public.resultados_reportados (criativo_id);

-- RLS organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_reportados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY "orgs_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "orgs_update_owner" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = id AND user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "org_members_select" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "org_members_insert" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_org_member(organization_id));

CREATE POLICY "projects_select_member" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "projects_insert_member" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "projects_update_member" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "projects_delete_owner" ON public.projects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = projects.organization_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- Replace geracoes/criativos RLS with org-based
DROP POLICY IF EXISTS "geracoes_select_own" ON public.geracoes;
DROP POLICY IF EXISTS "geracoes_insert_own" ON public.geracoes;
DROP POLICY IF EXISTS "geracoes_delete_own" ON public.geracoes;

CREATE POLICY "geracoes_select_org" ON public.geracoes
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "geracoes_insert_org" ON public.geracoes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id) AND user_id = auth.uid());

CREATE POLICY "geracoes_delete_org" ON public.geracoes
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "criativos_select_own" ON public.criativos;
DROP POLICY IF EXISTS "criativos_insert_own" ON public.criativos;
DROP POLICY IF EXISTS "criativos_update_own" ON public.criativos;
DROP POLICY IF EXISTS "criativos_delete_own" ON public.criativos;

CREATE POLICY "criativos_select_org" ON public.criativos
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "criativos_insert_org" ON public.criativos
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id) AND user_id = auth.uid());

CREATE POLICY "criativos_update_org" ON public.criativos
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "criativos_delete_org" ON public.criativos
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "resultados_select_org" ON public.resultados_reportados
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.criativos c
      WHERE c.id = criativo_id AND public.is_org_member(c.organization_id)
    )
  );

CREATE POLICY "resultados_insert_org" ON public.resultados_reportados
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.criativos c
      WHERE c.id = criativo_id AND public.is_org_member(c.organization_id)
    )
  );

-- Updated signup: profile + org + default project
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display text;
  org_id uuid;
  proj_id uuid;
  org_slug text;
BEGIN
  display := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  org_slug := 'ws-' || substr(replace(NEW.id::text, '-', ''), 1, 12);

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, display);

  INSERT INTO public.organizations (name, slug)
  VALUES (display || '''s Workspace', org_slug)
  RETURNING id INTO org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');

  INSERT INTO public.projects (organization_id, name)
  VALUES (org_id, 'Projeto principal')
  RETURNING id INTO proj_id;

  RETURN NEW;
END;
$$;

-- Backfill existing users without org
DO $$
DECLARE
  u record;
  org_id uuid;
  proj_id uuid;
  org_slug text;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = u.id) THEN
    org_slug := 'ws-' || substr(replace(u.id::text, '-', ''), 1, 12);
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)) || '''s Workspace',
      org_slug
    )
    RETURNING id INTO org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, u.id, 'owner');

    INSERT INTO public.projects (organization_id, name)
    VALUES (org_id, 'Projeto principal')
    RETURNING id INTO proj_id;

    UPDATE public.geracoes SET organization_id = org_id, project_id = proj_id
    WHERE user_id = u.id AND organization_id IS NULL;

    UPDATE public.criativos SET organization_id = org_id, project_id = proj_id
    WHERE user_id = u.id AND organization_id IS NULL;
  END IF;
  END LOOP;
END $$;

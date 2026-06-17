-- Workspace invites
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_member_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS organization_invites_token_idx ON public.organization_invites (token);
CREATE INDEX IF NOT EXISTS organization_invites_org_idx ON public.organization_invites (organization_id);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select_org_member" ON public.organization_invites
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "invites_insert_owner" ON public.organization_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_invites.organization_id
        AND user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "invites_delete_owner" ON public.organization_invites
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_invites.organization_id
        AND user_id = auth.uid() AND role = 'owner'
    )
  );

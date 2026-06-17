-- Policy UPDATE em geracoes + tipo_uso opcional em profiles
CREATE POLICY "geracoes_update_org_member" ON public.geracoes
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_uso text;

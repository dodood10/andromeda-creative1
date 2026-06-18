-- Storage: permitir leitura de exports/ e audio/ para membros da org do criativo
CREATE OR REPLACE FUNCTION public.user_can_access_criativo_storage_path(path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(path))[1] = auth.uid()::text THEN true
    WHEN (storage.foldername(path))[1] = 'audio' THEN
      EXISTS (
        SELECT 1 FROM public.criativos c
        WHERE c.id::text = (storage.foldername(path))[2]
          AND c.organization_id IS NOT NULL
          AND public.is_org_member(c.organization_id)
      )
    WHEN (storage.foldername(path))[1] = 'exports' THEN
      EXISTS (
        SELECT 1 FROM public.criativos c
        WHERE c.id::text = (storage.foldername(path))[2]
          AND c.organization_id IS NOT NULL
          AND public.is_org_member(c.organization_id)
      )
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "criativos_media_select_own" ON storage.objects;
DROP POLICY IF EXISTS "criativos_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "criativos_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "criativos_media_delete_own" ON storage.objects;

CREATE POLICY "criativos_media_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'criativos-media'
    AND public.user_can_access_criativo_storage_path(name)
  );

CREATE POLICY "criativos_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'criativos-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "criativos_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'criativos-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "criativos_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'criativos-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

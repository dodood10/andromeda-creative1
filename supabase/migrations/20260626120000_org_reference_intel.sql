-- Biblioteca de transcrições de referência na organização (compartilhada entre projetos)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS intel_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizations.intel_settings IS
  'Biblioteca de inteligência geral: reference_transcriptions, reference_combo';

-- Agregar reference_transcriptions de todos os projetos da org
WITH project_refs AS (
  SELECT
    p.organization_id,
    ref.value AS ref
  FROM public.projects p
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(p.intel_settings->'reference_transcriptions', '[]'::jsonb)
  ) AS ref(value)
  WHERE jsonb_array_length(COALESCE(p.intel_settings->'reference_transcriptions', '[]'::jsonb)) > 0
),
aggregated AS (
  SELECT
    organization_id,
    jsonb_agg(ref ORDER BY ref->>'added_at') AS refs
  FROM project_refs
  GROUP BY organization_id
)
UPDATE public.organizations o
SET intel_settings = COALESCE(o.intel_settings, '{}'::jsonb) || jsonb_build_object(
  'reference_transcriptions',
  COALESCE(a.refs, '[]'::jsonb)
)
FROM aggregated a
WHERE o.id = a.organization_id;

-- Migrar reference_combo mais recente por org
WITH combos AS (
  SELECT DISTINCT ON (p.organization_id)
    p.organization_id,
    p.intel_settings->'reference_combo' AS combo
  FROM public.projects p
  WHERE p.intel_settings ? 'reference_combo'
    AND p.intel_settings->'reference_combo' IS NOT NULL
  ORDER BY
    p.organization_id,
    (p.intel_settings->'reference_combo'->>'updated_at') DESC NULLS LAST
)
UPDATE public.organizations o
SET intel_settings = COALESCE(o.intel_settings, '{}'::jsonb) || jsonb_build_object(
  'reference_combo', c.combo
)
FROM combos c
WHERE o.id = c.organization_id;

-- Remover referências dos projetos (calibração numérica permanece)
UPDATE public.projects
SET intel_settings = intel_settings - 'reference_transcriptions' - 'reference_combo'
WHERE intel_settings ? 'reference_transcriptions'
   OR intel_settings ? 'reference_combo';

-- Membros da org podem atualizar intel_settings (antes só owner)
DROP POLICY IF EXISTS "orgs_update_owner" ON public.organizations;

CREATE POLICY "orgs_update_member" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(id));


-- 1. niche_daily_intel: restrict INSERT/UPDATE to platform admins
DROP POLICY IF EXISTS niche_intel_insert_authenticated ON public.niche_daily_intel;
DROP POLICY IF EXISTS niche_intel_update_authenticated ON public.niche_daily_intel;

CREATE POLICY niche_intel_insert_admin ON public.niche_daily_intel
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true));

CREATE POLICY niche_intel_update_admin ON public.niche_daily_intel
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_platform_admin = true));

-- 2. organization_invites: restrict SELECT to owners only
DROP POLICY IF EXISTS invites_select_org_member ON public.organization_invites;

CREATE POLICY invites_select_owner ON public.organization_invites
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'::org_member_role
  ));

-- 3. profiles: attach existing block-self-promote trigger
DROP TRIGGER IF EXISTS profiles_block_admin_self_promote_trg ON public.profiles;
CREATE TRIGGER profiles_block_admin_self_promote_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_admin_self_promote();

-- 4. subscriptions: scope to authenticated instead of public
DROP POLICY IF EXISTS subscriptions_select_member ON public.subscriptions;

CREATE POLICY subscriptions_select_member ON public.subscriptions
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  ));

-- Prevent users from self-promoting to platform admin via client RLS
CREATE OR REPLACE FUNCTION public.profiles_block_admin_self_promote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'is_platform_admin can only be changed via service role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_admin_self_promote ON public.profiles;
CREATE TRIGGER profiles_block_admin_self_promote
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_admin_self_promote();

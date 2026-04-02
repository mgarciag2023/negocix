
-- 1. Restrict system_settings SELECT to admins only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.system_settings;

CREATE POLICY "Only admins can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix search_logs admin SELECT policy
DROP POLICY IF EXISTS "Admins can view all search logs" ON public.search_logs;

CREATE POLICY "Admins can view all search logs"
  ON public.search_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fix profiles UPDATE policy with security definer function
CREATE OR REPLACE FUNCTION public.get_profile_blocked_fields(_user_id uuid)
RETURNS TABLE(is_blocked boolean, blocked_at timestamptz, blocked_reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.is_blocked, p.blocked_at, p.blocked_reason
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "Users can update own profile safe fields" ON public.profiles;

CREATE POLICY "Users can update own profile safe fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_blocked = (SELECT f.is_blocked FROM public.get_profile_blocked_fields(auth.uid()) f)
    AND blocked_at IS NOT DISTINCT FROM (SELECT f.blocked_at FROM public.get_profile_blocked_fields(auth.uid()) f)
    AND blocked_reason IS NOT DISTINCT FROM (SELECT f.blocked_reason FROM public.get_profile_blocked_fields(auth.uid()) f)
  );

-- 4. Clean orphaned saved_leads and make user_id NOT NULL
DELETE FROM public.saved_leads WHERE user_id IS NULL;
ALTER TABLE public.saved_leads ALTER COLUMN user_id SET NOT NULL;


-- 1. Fix profiles UPDATE policy: users can unblock themselves
DROP POLICY IF EXISTS "Only admins can update profiles" ON public.profiles;

-- Users can only update non-sensitive fields on their own profile
CREATE POLICY "Users can update own profile safe fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_blocked = (SELECT p.is_blocked FROM public.profiles p WHERE p.user_id = auth.uid())
    AND blocked_at IS NOT DISTINCT FROM (SELECT p.blocked_at FROM public.profiles p WHERE p.user_id = auth.uid())
    AND blocked_reason IS NOT DISTINCT FROM (SELECT p.blocked_reason FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Admins can update any profile including sensitive fields
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix search_logs INSERT policy to validate email
DROP POLICY IF EXISTS "Users can insert their own search logs" ON public.search_logs;

CREATE POLICY "Users can insert their own search logs"
  ON public.search_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND user_email = (auth.jwt() ->> 'email')
  );

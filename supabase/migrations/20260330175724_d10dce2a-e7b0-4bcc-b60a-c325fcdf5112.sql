
-- 1. Fix privilege escalation on user_roles: drop ALL policy and recreate with proper role-specific policies
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can select all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix search_logs INSERT policy: change from public to authenticated
DROP POLICY IF EXISTS "Users can insert their own search logs" ON public.search_logs;

CREATE POLICY "Users can insert their own search logs"
  ON public.search_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Fix user_lead_limits policies: change from public to authenticated
DROP POLICY IF EXISTS "Only admins can manage limits" ON public.user_lead_limits;
DROP POLICY IF EXISTS "Users can view their own limits" ON public.user_lead_limits;

CREATE POLICY "Only admins can manage limits"
  ON public.user_lead_limits FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own limits"
  ON public.user_lead_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

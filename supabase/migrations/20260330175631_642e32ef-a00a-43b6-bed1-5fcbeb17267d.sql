
-- 1. Add user_id column to saved_leads
ALTER TABLE public.saved_leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop the overly permissive policy on saved_leads
DROP POLICY IF EXISTS "Allow all operations on saved_leads" ON public.saved_leads;

-- 3. Create proper user-scoped RLS policies for saved_leads
CREATE POLICY "Users can view their own saved leads"
  ON public.saved_leads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own saved leads"
  ON public.saved_leads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own saved leads"
  ON public.saved_leads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved leads"
  ON public.saved_leads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Admin can also manage all saved leads
CREATE POLICY "Admins can manage all saved leads"
  ON public.saved_leads FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add user SELECT policy on search_logs so users can see their own logs
CREATE POLICY "Users can view their own search logs"
  ON public.search_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

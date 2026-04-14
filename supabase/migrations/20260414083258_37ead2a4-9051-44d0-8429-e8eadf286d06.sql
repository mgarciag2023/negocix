CREATE POLICY "Anon can read trial analytics"
ON public.trial_analytics
FOR SELECT
TO anon
USING (true);
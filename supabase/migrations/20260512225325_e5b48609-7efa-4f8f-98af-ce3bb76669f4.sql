
DROP VIEW IF EXISTS public.representatives_directory;

CREATE VIEW public.representatives_directory
WITH (security_invoker = true) AS
SELECT
  id, full_name, phone, whatsapp, state, cities, segments, notes,
  is_active, user_id, created_at
FROM public.registered_representatives
WHERE is_active = true;

GRANT SELECT ON public.representatives_directory TO authenticated;

-- Restore the SELECT policy needed for both the view (security_invoker) and direct queries.
CREATE POLICY "Authenticated users can view active registered reps"
ON public.registered_representatives
FOR SELECT
TO authenticated
USING (is_active = true OR user_id = auth.uid());

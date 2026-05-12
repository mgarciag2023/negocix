
-- Remove the broad SELECT policy that exposed all columns to authenticated users.
DROP POLICY IF EXISTS "Directory view exposes active reps" ON public.registered_representatives;

-- Recreate the directory view as SECURITY DEFINER (security_invoker = false)
-- so it bypasses RLS and exposes ONLY non-sensitive directory fields.
-- Email is intentionally excluded.
DROP VIEW IF EXISTS public.representatives_directory;
CREATE VIEW public.representatives_directory
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  phone,
  whatsapp,
  state,
  cities,
  segments,
  notes,
  is_active,
  user_id,
  created_at
FROM public.registered_representatives
WHERE is_active = true;

REVOKE ALL ON public.representatives_directory FROM PUBLIC, anon;
GRANT SELECT ON public.representatives_directory TO authenticated;

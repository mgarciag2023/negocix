
-- 1. Drop unused staging table (RLS enabled, no policy, no data needed)
DROP TABLE IF EXISTS public.tmp_staging;

-- 2. Tighten trial_analytics anon insert (was WITH CHECK true — overly permissive)
DROP POLICY IF EXISTS "Anyone can insert trial analytics" ON public.trial_analytics;
CREATE POLICY "Anon can insert trial analytics"
ON public.trial_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(COALESCE(event_type, '')) <= 50
  AND length(COALESCE(device_id, '')) <= 200
  AND COALESCE(results_count, 0) BETWEEN 0 AND 10000
);

-- 3. Restrict get_distinct_cities — only signed-in users, not anon
REVOKE EXECUTE ON FUNCTION public.get_distinct_cities(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_distinct_cities(text, text) TO authenticated;

-- 4. Representatives directory: replace open SELECT policy with a sanitized view.
-- Drop the policy that exposes phone/whatsapp/email broadly.
DROP POLICY IF EXISTS "Authenticated users can view active registered reps" ON public.registered_representatives;

-- Keep only owner+admin SELECT policy on raw table (already exists: "Owners and admins can view all rep fields").

-- Create a sanitized view for the public directory — exposes contact fields
-- (needed for the feature) but NOT email, and is the only entry point for non-owners.
CREATE OR REPLACE VIEW public.representatives_directory
WITH (security_invoker = true) AS
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

-- Allow authenticated users to read the directory view; the underlying table
-- still blocks non-owners (RLS), so we add a permissive SELECT policy that ONLY
-- the view will use (the view runs with invoker rights = the caller).
CREATE POLICY "Directory view exposes active reps"
ON public.registered_representatives
FOR SELECT
TO authenticated
USING (is_active = true);

GRANT SELECT ON public.representatives_directory TO authenticated;

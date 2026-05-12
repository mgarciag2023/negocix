-- Security hardening

-- 1. Remove unnecessary anon SELECT on trial_analytics (anon should only insert)
DROP POLICY IF EXISTS "Anon can read own inserts" ON public.trial_analytics;

-- 2. Restrict failed_signup_attempts to anon-only inserts with length checks (signed-in users don't fail signup)
DROP POLICY IF EXISTS "Anyone can insert failed signup attempts" ON public.failed_signup_attempts;
CREATE POLICY "Anon can insert failed signup attempts"
ON public.failed_signup_attempts
FOR INSERT
TO anon
WITH CHECK (
  length(COALESCE(email, '')) <= 320
  AND length(COALESCE(phone, '')) <= 32
  AND length(COALESCE(full_name, '')) <= 200
  AND length(COALESCE(error_message, '')) <= 500
  AND length(COALESCE(error_code, '')) <= 100
  AND length(COALESCE(user_agent, '')) <= 500
);

-- 3. Restrict registered_representatives directory to safe columns:
--    Hide email from other users (still visible to owner and admin).
--    Replace policy to keep public directory access for non-PII contact (phone/whatsapp are the product),
--    but block reading email unless you own the row.
DROP POLICY IF EXISTS "Authenticated users can view active registered reps" ON public.registered_representatives;

CREATE POLICY "Owners and admins can view all rep fields"
ON public.registered_representatives
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Public directory view: excludes email
CREATE OR REPLACE VIEW public.registered_representatives_directory
WITH (security_invoker = on) AS
SELECT id, user_id, full_name, phone, whatsapp, state, cities, segments, notes, is_active, created_at, updated_at
FROM public.registered_representatives
WHERE is_active = true;

-- Allow authenticated users to read the directory rows via a policy that exposes only safe columns through the view
CREATE POLICY "Authenticated users can view active reps (no email)"
ON public.registered_representatives
FOR SELECT
TO authenticated
USING (is_active = true);
-- Note: the above still allows email read at table level. To truly hide email, drop it and rely on view:
DROP POLICY "Authenticated users can view active reps (no email)" ON public.registered_representatives;

GRANT SELECT ON public.registered_representatives_directory TO authenticated;
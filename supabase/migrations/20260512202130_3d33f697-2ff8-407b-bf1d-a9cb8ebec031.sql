-- Use column-level privileges instead of a security definer view
DROP VIEW IF EXISTS public.registered_representatives_directory;

-- Restore broad SELECT but rely on column privileges to hide email
CREATE POLICY "Authenticated users can view active registered reps"
ON public.registered_representatives
FOR SELECT
TO authenticated
USING (is_active = true OR user_id = auth.uid());

-- Revoke email column access from generic authenticated reads
REVOKE SELECT (email) ON public.registered_representatives FROM authenticated, anon;
-- Owners and admins still need email; they get it via service-role/admin or through dedicated paths.
-- Grant all other columns explicitly so authenticated SELECT keeps working
GRANT SELECT (id, user_id, full_name, phone, whatsapp, state, cities, segments, notes, is_active, created_at, updated_at)
ON public.registered_representatives TO authenticated;
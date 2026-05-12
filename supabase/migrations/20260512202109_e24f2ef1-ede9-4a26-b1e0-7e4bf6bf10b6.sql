-- Use security definer view so authenticated users can read directory rows (email excluded)
DROP VIEW IF EXISTS public.registered_representatives_directory;
CREATE VIEW public.registered_representatives_directory
WITH (security_invoker = off) AS
SELECT id, user_id, full_name, phone, whatsapp, state, cities, segments, notes, is_active, created_at, updated_at
FROM public.registered_representatives
WHERE is_active = true;

REVOKE ALL ON public.registered_representatives_directory FROM PUBLIC, anon;
GRANT SELECT ON public.registered_representatives_directory TO authenticated;
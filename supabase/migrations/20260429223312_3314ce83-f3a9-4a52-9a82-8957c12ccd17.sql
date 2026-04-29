-- 1. Lock down tmp_staging (sensitive company data: CNPJ, email, phone)
DROP POLICY IF EXISTS "Allow authenticated select on staging" ON public.tmp_staging;
DROP POLICY IF EXISTS "Allow authenticated insert on staging" ON public.tmp_staging;

-- No policies = no access for authenticated users. Only service_role (edge functions) can access.

-- 2. Remove anonymous SELECT on trial_analytics
DROP POLICY IF EXISTS "Anon can read trial analytics" ON public.trial_analytics;
-- Keep "Admins can read trial analytics" and "Anyone can insert trial analytics" (insert needed for public demo)
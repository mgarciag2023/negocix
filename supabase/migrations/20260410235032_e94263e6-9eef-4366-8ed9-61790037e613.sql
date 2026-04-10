INSERT INTO public.user_lead_limits (user_id, leads_per_search)
SELECT p.user_id, 3527
FROM public.profiles p
WHERE p.email = 'mgarciag2023@gmail.com'
ON CONFLICT (user_id)
DO UPDATE SET
  leads_per_search = EXCLUDED.leads_per_search,
  updated_at = now();
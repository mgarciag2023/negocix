GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.trial_analytics TO anon;
GRANT INSERT ON TABLE public.trial_analytics TO authenticated;
GRANT SELECT ON TABLE public.trial_analytics TO authenticated;
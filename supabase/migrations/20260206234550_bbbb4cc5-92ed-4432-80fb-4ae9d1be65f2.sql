
-- Add representatives_per_search column to user_lead_limits
ALTER TABLE public.user_lead_limits
ADD COLUMN representatives_per_search integer DEFAULT 30;

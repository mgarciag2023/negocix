
-- Add system setting for max representatives per search
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('representatives_max', '30', 'Máximo de representantes por pesquisa')
ON CONFLICT (setting_key) DO NOTHING;

-- Create search_logs table to track user searches
CREATE TABLE public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  search_type text NOT NULL DEFAULT 'leads',
  search_config jsonb NOT NULL DEFAULT '{}',
  results_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique constraint on setting_key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_setting_key_key'
  ) THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all search logs
CREATE POLICY "Admins can view all search logs"
  ON public.search_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own search logs
CREATE POLICY "Users can insert their own search logs"
  ON public.search_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create index for performance
CREATE INDEX idx_search_logs_created_at ON public.search_logs (created_at DESC);
CREATE INDEX idx_search_logs_user_id ON public.search_logs (user_id);

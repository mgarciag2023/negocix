CREATE TABLE public.failed_signup_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  full_name text,
  phone text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.failed_signup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert failed signup attempts"
ON public.failed_signup_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view failed signup attempts"
ON public.failed_signup_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
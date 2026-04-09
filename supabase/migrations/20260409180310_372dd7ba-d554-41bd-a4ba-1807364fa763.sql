
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

-- Update handle_new_user to check trial flag and save metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_trial boolean := false;
BEGIN
  SELECT setting_value = 'true' INTO is_trial
  FROM public.system_settings
  WHERE setting_key = 'next_account_trial'
  LIMIT 1;

  INSERT INTO public.profiles (user_id, email, full_name, phone, trial_expires_at)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN is_trial THEN now() + interval '15 minutes' ELSE NULL END
  );
  
  IF is_trial THEN
    UPDATE public.system_settings SET setting_value = 'false', updated_at = now()
    WHERE setting_key = 'next_account_trial';
  END IF;
  
  IF NEW.email = 'mgarciag2023@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update is_user_blocked to also check trial expiry
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_blocked OR (trial_expires_at IS NOT NULL AND trial_expires_at < now())
     FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_auth_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

SELECT public.admin_delete_auth_user('497c796a-b296-4364-8006-020fdbc996b3');

DROP FUNCTION public.admin_delete_auth_user(uuid);
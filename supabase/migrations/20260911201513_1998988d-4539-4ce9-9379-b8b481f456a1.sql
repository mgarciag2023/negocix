CREATE OR REPLACE FUNCTION public.tmp_export_auth_dump()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'users', (SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb) FROM auth.users u),
    'identities', (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM auth.identities i),
    'mfa_factors', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM auth.mfa_factors f),
    'sso_providers', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM auth.sso_providers s),
    'saml_providers', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM auth.saml_providers s),
    'storage_buckets', (SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM storage.buckets b),
    'storage_objects', (SELECT COALESCE(jsonb_agg(to_jsonb(o)), '[]'::jsonb) FROM storage.objects o)
  );
$$;

REVOKE ALL ON FUNCTION public.tmp_export_auth_dump() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmp_export_auth_dump() TO service_role;
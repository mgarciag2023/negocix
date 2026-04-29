-- 1) Remove INSERT aberto em companies (apenas service_role pode popular a base)
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;

-- 2) Revoga EXECUTE de anon e authenticated nas funções SECURITY DEFINER que NÃO devem ser chamadas pelo cliente.
-- Essas funções são usadas internamente por triggers, RLS policies (has_role) ou edge functions com service_role.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.populate_search_vector_batch(text, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.populate_all_search_vectors(integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.search_companies(text, text, text[], text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_companies_ilike(text, text, text[], text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_profile_blocked_fields(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

-- search_companies* continuam disponíveis para authenticated (usadas pelo app via RPC)
-- has_role/is_user_blocked/get_profile_blocked_fields continuam disponíveis para authenticated (usadas em policies)
-- handle_new_user e populate_* só rodam via trigger/service_role
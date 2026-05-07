CREATE OR REPLACE FUNCTION public.get_distinct_cities(p_state text, p_prefix text)
RETURNS TABLE(cidade text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
  SELECT DISTINCT c.cidade
  FROM public.companies c
  WHERE c.estado = p_state
    AND c.cidade IS NOT NULL
    AND c.cidade ILIKE (p_prefix || '%')
  LIMIT 500;
$$;
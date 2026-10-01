CREATE OR REPLACE FUNCTION public.get_distinct_cities(p_state text, p_prefix text)
 RETURNS TABLE(cidade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
  SELECT DISTINCT c.cidade
  FROM public.companies c
  WHERE c.cidade >= upper(p_prefix)
    AND c.cidade < upper(p_prefix) || chr(255)
    AND c.estado = p_state
  LIMIT 500;
$function$;
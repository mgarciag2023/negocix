
CREATE OR REPLACE FUNCTION public.search_companies(
  p_city text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text,
  p_search_terms text[] DEFAULT '{}'::text[],
  p_biz_type text DEFAULT 'all'::text,
  p_limit_val integer DEFAULT 1000,
  p_offset_val integer DEFAULT 0
)
RETURNS SETOF companies
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '90s'
AS $function$
DECLARE
  combined_query tsquery;
  term text;
BEGIN
  combined_query := NULL;
  FOREACH term IN ARRAY p_search_terms LOOP
    IF combined_query IS NULL THEN
      combined_query := plainto_tsquery('portuguese', term);
    ELSE
      combined_query := combined_query || plainto_tsquery('portuguese', term);
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT c.*
  FROM public.companies c
  WHERE c.situacao_cadastral = 'ATIVA'
    AND (p_state IS NULL OR c.estado = p_state)
    AND (p_city IS NULL OR c.cidade = p_city)
    AND (p_biz_type = 'all' OR
         (p_biz_type = 'matriz' AND c.matriz_filial = 'MATRIZ') OR
         (p_biz_type = 'filial' AND c.matriz_filial = 'FILIAL'))
    AND (combined_query IS NULL OR c.search_vector @@ combined_query)
  LIMIT p_limit_val OFFSET p_offset_val;
END;
$function$;

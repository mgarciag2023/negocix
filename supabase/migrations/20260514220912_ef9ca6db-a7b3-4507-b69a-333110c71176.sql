CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  city_norm text;
BEGIN
  combined_query := NULL;
  FOREACH term IN ARRAY p_search_terms LOOP
    IF combined_query IS NULL THEN
      combined_query := plainto_tsquery('portuguese', term);
    ELSE
      combined_query := combined_query || plainto_tsquery('portuguese', term);
    END IF;
  END LOOP;

  city_norm := CASE WHEN p_city IS NULL THEN NULL ELSE unaccent(lower(trim(p_city))) END;

  RETURN QUERY
  SELECT c.*
  FROM public.companies c
  WHERE c.situacao_cadastral = 'ATIVA'
    AND (p_state IS NULL OR c.estado = p_state)
    AND (
      city_norm IS NULL
      OR unaccent(lower(c.cidade)) = city_norm
      OR similarity(unaccent(lower(c.cidade)), city_norm) > 0.6
    )
    AND (p_biz_type = 'all' OR
         (p_biz_type = 'matriz' AND c.matriz_filial = 'MATRIZ') OR
         (p_biz_type = 'filial' AND c.matriz_filial = 'FILIAL'))
    AND (combined_query IS NULL OR c.search_vector @@ combined_query)
  LIMIT p_limit_val OFFSET p_offset_val;
END;
$function$;
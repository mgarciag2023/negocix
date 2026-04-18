CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_companies_ilike(
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_search_terms text[] DEFAULT '{}',
  p_biz_type text DEFAULT 'all',
  p_limit_val integer DEFAULT 1000,
  p_offset_val integer DEFAULT 0
)
RETURNS SETOF public.companies
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  pattern_array text[];
  t text;
BEGIN
  pattern_array := ARRAY[]::text[];
  IF p_search_terms IS NOT NULL THEN
    FOREACH t IN ARRAY p_search_terms LOOP
      IF t IS NOT NULL AND length(trim(t)) > 0 THEN
        pattern_array := array_append(pattern_array, '%' || trim(t) || '%');
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM public.companies c
  WHERE c.situacao_cadastral = 'ATIVA'
    AND (p_state IS NULL OR c.estado = p_state)
    AND (p_city IS NULL OR c.cidade = p_city)
    AND (p_biz_type = 'all' OR
         (p_biz_type = 'matriz' AND c.matriz_filial = 'MATRIZ') OR
         (p_biz_type = 'filial' AND c.matriz_filial = 'FILIAL'))
    AND (
      array_length(pattern_array, 1) IS NULL
      OR c.nome_fantasia ILIKE ANY (pattern_array)
      OR c.razao_social ILIKE ANY (pattern_array)
    )
  LIMIT p_limit_val OFFSET p_offset_val;
END;
$$;
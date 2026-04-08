CREATE OR REPLACE FUNCTION public.search_companies(
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
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  sql_query text;
  term text;
  like_parts text[] := '{}';
BEGIN
  -- Build LIKE conditions
  FOREACH term IN ARRAY p_search_terms LOOP
    like_parts := array_append(like_parts, format('c.nome_fantasia ILIKE %L', '%' || term || '%'));
    like_parts := array_append(like_parts, format('c.descricao_cnae ILIKE %L', '%' || term || '%'));
  END LOOP;

  sql_query := 'SELECT c.* FROM public.companies c WHERE c.situacao_cadastral = ''ATIVA''';
  
  IF p_city IS NOT NULL THEN
    sql_query := sql_query || format(' AND c.cidade = %L', p_city);
  END IF;
  
  IF p_state IS NOT NULL THEN
    sql_query := sql_query || format(' AND c.estado = %L', p_state);
  END IF;
  
  IF p_biz_type = 'matriz' THEN
    sql_query := sql_query || ' AND c.matriz_filial = ''MATRIZ''';
  ELSIF p_biz_type = 'filial' THEN
    sql_query := sql_query || ' AND c.matriz_filial = ''FILIAL''';
  END IF;
  
  IF array_length(like_parts, 1) > 0 THEN
    sql_query := sql_query || ' AND (' || array_to_string(like_parts, ' OR ') || ')';
  END IF;
  
  sql_query := sql_query || ' ORDER BY c.capital_social DESC NULLS LAST';
  sql_query := sql_query || format(' LIMIT %s OFFSET %s', p_limit_val, p_offset_val);
  
  RETURN QUERY EXECUTE sql_query;
END;
$$;
CREATE OR REPLACE FUNCTION public.search_companies(p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_search_terms text[] DEFAULT '{}'::text[], p_biz_type text DEFAULT 'all'::text, p_limit_val integer DEFAULT 1000, p_offset_val integer DEFAULT 0)
 RETURNS SETOF companies
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '55s'
AS $function$
DECLARE
  sql_query text;
  term text;
  ts_parts text[] := '{}';
  ts_condition text;
BEGIN
  FOREACH term IN ARRAY p_search_terms LOOP
    ts_parts := array_append(ts_parts, format(
      '(to_tsvector(''portuguese'', COALESCE(c.nome_fantasia, '''')) @@ plainto_tsquery(''portuguese'', %L) OR to_tsvector(''portuguese'', COALESCE(c.descricao_cnae, '''')) @@ plainto_tsquery(''portuguese'', %L))',
      term, term
    ));
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
  
  IF array_length(ts_parts, 1) > 0 THEN
    sql_query := sql_query || ' AND (' || array_to_string(ts_parts, ' OR ') || ')';
  END IF;
  
  sql_query := sql_query || ' ORDER BY c.capital_social DESC NULLS LAST';
  sql_query := sql_query || format(' LIMIT %s OFFSET %s', p_limit_val, p_offset_val);
  
  RETURN QUERY EXECUTE sql_query;
END;
$function$;
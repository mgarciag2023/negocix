
CREATE OR REPLACE FUNCTION public.populate_search_vector_batch(p_estado text, p_batch_size integer DEFAULT 2000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
DECLARE
  rows_updated integer;
BEGIN
  WITH batch AS (
    SELECT ctid FROM public.companies
    WHERE estado = p_estado AND search_vector IS NULL
    LIMIT p_batch_size
  )
  UPDATE public.companies c
  SET search_vector = to_tsvector('portuguese', COALESCE(c.nome_fantasia,'')) || to_tsvector('portuguese', COALESCE(c.razao_social,''))
  FROM batch
  WHERE c.ctid = batch.ctid;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$function$;

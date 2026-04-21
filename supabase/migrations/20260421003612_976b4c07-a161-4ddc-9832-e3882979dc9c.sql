CREATE OR REPLACE FUNCTION public.populate_search_vector_batch(p_estado text, p_batch_size integer DEFAULT 3000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
 SET lock_timeout TO '5s'
AS $function$
DECLARE
  rows_updated integer;
BEGIN
  WITH batch AS (
    SELECT c.ctid
    FROM public.companies c
    WHERE c.estado = p_estado AND c.search_vector IS NULL
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.companies c
  SET search_vector = to_tsvector('portuguese', COALESCE(c.nome_fantasia,'')) || to_tsvector('portuguese', COALESCE(c.razao_social,''))
  FROM batch
  WHERE c.ctid = batch.ctid;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$function$;
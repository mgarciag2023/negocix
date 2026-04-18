-- Function helper que popula search_vector em batch para um estado
CREATE OR REPLACE FUNCTION public.populate_search_vector_batch(p_estado text, p_batch_size integer DEFAULT 500000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '0'
AS $$
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
$$;

-- Restringir execução: somente service_role e postgres
REVOKE ALL ON FUNCTION public.populate_search_vector_batch(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.populate_search_vector_batch(text, integer) FROM authenticated, anon;
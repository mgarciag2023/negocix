CREATE OR REPLACE FUNCTION public.search_companies(
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_search_terms text[] DEFAULT '{}',
  p_biz_type text DEFAULT 'all',
  p_limit_val integer DEFAULT 1000,
  p_offset_val integer DEFAULT 0
)
RETURNS SETOF public.companies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '25s'
AS $$
  SELECT *
  FROM public.companies c
  WHERE c.situacao_cadastral = 'ATIVA'
    AND (p_city IS NULL OR c.cidade = p_city)
    AND (p_state IS NULL OR c.estado = p_state)
    AND (p_biz_type = 'all' OR 
         (p_biz_type = 'matriz' AND c.matriz_filial = 'MATRIZ') OR
         (p_biz_type = 'filial' AND c.matriz_filial = 'FILIAL'))
    AND (
      EXISTS (
        SELECT 1 FROM unnest(p_search_terms) AS term
        WHERE c.nome_fantasia ILIKE '%' || term || '%'
           OR c.descricao_cnae ILIKE '%' || term || '%'
      )
    )
  ORDER BY c.capital_social DESC NULLS LAST
  LIMIT p_limit_val
  OFFSET p_offset_val
$$;
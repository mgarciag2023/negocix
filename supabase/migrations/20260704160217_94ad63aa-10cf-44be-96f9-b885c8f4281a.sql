CREATE OR REPLACE FUNCTION public.refresh_segment_stats_from_audit(p_segment_key text, p_segment_label text, p_terms_count integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_searches integer := 0;
  v_last_search timestamptz;
  v_total_leads bigint := 0;
  v_zero integer := 0;
  v_avg_rel integer := 0;
  v_susp_pct integer := 0;
  v_audited integer := 0;
  v_score integer := 0;
  v_status text := 'unknown';
  v_alerts jsonb := '[]'::jsonb;
  v_alerts_count integer := 0;
  v_terms integer;
  v_label_norm text;
BEGIN
  v_label_norm := lower(trim(p_segment_label));

  -- Métricas das pesquisas (últimos 30 dias).
  -- Importante: pesquisas podem ter vários segmentos separados por vírgula; conta apenas quando
  -- o segmento aparece como item próprio, não por prefixo solto.
  SELECT
    COUNT(*),
    MAX(created_at),
    COALESCE(SUM(COALESCE(results_count,0)),0),
    COUNT(*) FILTER (WHERE COALESCE(results_count,0) = 0)
  INTO v_searches, v_last_search, v_total_leads, v_zero
  FROM public.search_logs sl
  WHERE sl.created_at > now() - interval '30 days'
    AND sl.search_type = 'leads'
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(lower(coalesce(sl.search_config->>'segment','')), '\s*,\s*') AS part
      WHERE trim(part) = v_label_norm
    );

  -- Métricas de qualidade da auditoria (últimos 30 dias)
  SELECT
    COUNT(*),
    COALESCE(ROUND(AVG(relevance_score))::int, 0),
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE is_suspicious) / COUNT(*))::int END
  INTO v_audited, v_avg_rel, v_susp_pct
  FROM public.search_lead_audit
  WHERE segment_key = p_segment_key
    AND created_at > now() - interval '30 days';

  -- Score: combina relevância, ausência de suspeitos e cobertura.
  IF v_searches = 0 AND v_audited = 0 THEN
    v_score := 0;
    v_status := 'unknown';
  ELSE
    v_score := LEAST(100, GREATEST(0,
      ROUND(v_avg_rel * 0.45)
      + ROUND((100 - v_susp_pct) * 0.35)
      + CASE WHEN v_searches = 0 THEN 0
             WHEN v_zero::float / GREATEST(v_searches,1) < 0.1 THEN 20
             WHEN v_zero::float / GREATEST(v_searches,1) < 0.3 THEN 10
             ELSE 0 END
    )::int);
    IF v_score >= 75 THEN v_status := 'healthy';
    ELSIF v_score >= 50 THEN v_status := 'warning';
    ELSE v_status := 'critical';
    END IF;
  END IF;

  -- Alertas por falta de resultado
  IF v_searches >= 3 AND v_zero::float / v_searches >= 0.5 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'alert_type','high_zero_results','priority','critical',
      'reason', v_zero || ' de ' || v_searches || ' pesquisas retornaram zero leads.',
      'impact','Usuários ficam sem resultados ao buscar este segmento.',
      'recommended_action','Adicionar sinônimos e variações regionais; revisar filtros por região.');
  ELSIF v_searches >= 3 AND v_zero::float / v_searches >= 0.25 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'alert_type','some_zero_results','priority','high',
      'reason','25%+ das pesquisas recentes retornaram zero leads.',
      'impact','Parte significativa dos usuários sai sem resultados.',
      'recommended_action','Revisar filtros e ampliar termos do segmento.');
  END IF;

  -- Alertas de relevância só disparam com amostra mínima real, para evitar falso alerta.
  IF v_audited >= 20 AND v_susp_pct >= 40 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'alert_type','low_relevance','priority','high',
      'reason', v_susp_pct || '% dos leads recentes não têm termo do segmento no nome da empresa.',
      'impact','Usuários podem receber resultados fora do segmento esperado.',
      'recommended_action','Revisar termos genéricos e conferir pesquisas multi-segmento recentes.');
  END IF;

  IF v_audited >= 20 AND v_avg_rel < 35 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'alert_type','low_avg_relevance','priority','medium',
      'reason','Relevância média baixa: ' || v_avg_rel || '/100.',
      'impact','Qualidade percebida do segmento está abaixo do ideal.',
      'recommended_action','Adicionar termos que aparecem nos nomes reais das empresas.');
  END IF;

  v_alerts_count := jsonb_array_length(v_alerts);
  v_terms := COALESCE(p_terms_count, (SELECT terms_count FROM public.segment_stats WHERE segment_key = p_segment_key));
  IF v_terms IS NULL THEN v_terms := 0; END IF;

  INSERT INTO public.segment_stats (
    segment_key, segment_label, terms_count, companies_count,
    quality_score, status, alerts_count, last_computed_at,
    searches_count, last_search_at, total_leads_returned,
    zero_result_searches, avg_relevance, suspicious_pct
  ) VALUES (
    p_segment_key, p_segment_label, v_terms, v_total_leads,
    v_score, v_status, v_alerts_count, now(),
    v_searches, v_last_search, v_total_leads,
    v_zero, v_avg_rel, v_susp_pct
  )
  ON CONFLICT (segment_key) DO UPDATE SET
    segment_label = EXCLUDED.segment_label,
    terms_count = COALESCE(EXCLUDED.terms_count, public.segment_stats.terms_count),
    companies_count = EXCLUDED.companies_count,
    quality_score = EXCLUDED.quality_score,
    status = EXCLUDED.status,
    alerts_count = EXCLUDED.alerts_count,
    last_computed_at = now(),
    searches_count = EXCLUDED.searches_count,
    last_search_at = EXCLUDED.last_search_at,
    total_leads_returned = EXCLUDED.total_leads_returned,
    zero_result_searches = EXCLUDED.zero_result_searches,
    avg_relevance = EXCLUDED.avg_relevance,
    suspicious_pct = EXCLUDED.suspicious_pct;

  DELETE FROM public.segment_alerts WHERE segment_key = p_segment_key AND resolved = false;
  IF v_alerts_count > 0 THEN
    INSERT INTO public.segment_alerts (segment_key, alert_type, priority, reason, impact, recommended_action)
    SELECT
      p_segment_key,
      a->>'alert_type',
      a->>'priority',
      a->>'reason',
      a->>'impact',
      a->>'recommended_action'
    FROM jsonb_array_elements(v_alerts) a;
  END IF;
END;
$function$;
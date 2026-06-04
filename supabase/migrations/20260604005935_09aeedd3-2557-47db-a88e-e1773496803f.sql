
CREATE TABLE public.segment_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL UNIQUE,
  segment_label text NOT NULL,
  terms_count integer NOT NULL DEFAULT 0,
  companies_count bigint NOT NULL DEFAULT 0,
  quality_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unknown',
  alerts_count integer NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_stats TO authenticated;
GRANT ALL ON public.segment_stats TO service_role;

ALTER TABLE public.segment_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage segment_stats"
  ON public.segment_stats FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_segment_stats_status ON public.segment_stats(status);
CREATE INDEX idx_segment_stats_score ON public.segment_stats(quality_score);

CREATE TABLE public.segment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL,
  alert_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  reason text NOT NULL,
  impact text,
  recommended_action text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_alerts TO authenticated;
GRANT ALL ON public.segment_alerts TO service_role;

ALTER TABLE public.segment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage segment_alerts"
  ON public.segment_alerts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_segment_alerts_segment ON public.segment_alerts(segment_key);
CREATE INDEX idx_segment_alerts_resolved ON public.segment_alerts(resolved);

CREATE TRIGGER trg_segment_stats_updated
  BEFORE UPDATE ON public.segment_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_segment_alerts_updated
  BEFORE UPDATE ON public.segment_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

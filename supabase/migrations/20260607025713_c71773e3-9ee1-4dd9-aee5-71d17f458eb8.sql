
CREATE TABLE public.search_lead_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_log_id uuid,
  user_id uuid,
  segment_key text NOT NULL,
  segment_label text NOT NULL,
  lead_name text NOT NULL,
  lead_category text,
  matched_terms text[] NOT NULL DEFAULT '{}',
  relevance_score integer NOT NULL DEFAULT 0,
  is_suspicious boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.search_lead_audit TO authenticated;
GRANT ALL ON public.search_lead_audit TO service_role;

ALTER TABLE public.search_lead_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage search_lead_audit"
  ON public.search_lead_audit FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_search_lead_audit_segment ON public.search_lead_audit(segment_key, created_at DESC);
CREATE INDEX idx_search_lead_audit_log ON public.search_lead_audit(search_log_id);
CREATE INDEX idx_search_lead_audit_suspicious ON public.search_lead_audit(segment_key) WHERE is_suspicious = true;

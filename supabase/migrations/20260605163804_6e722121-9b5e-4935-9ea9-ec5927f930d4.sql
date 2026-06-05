
CREATE TABLE public.segment_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL UNIQUE,
  segment_label text NOT NULL,
  added_terms text[] NOT NULL DEFAULT '{}',
  removed_terms text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_overrides TO authenticated;
GRANT ALL ON public.segment_overrides TO service_role;
ALTER TABLE public.segment_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage segment_overrides" ON public.segment_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.segment_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL,
  change_type text NOT NULL, -- add_term | remove_term | restore_term | ai_accept | reset
  term text,
  details jsonb DEFAULT '{}'::jsonb,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_segment_changes_segment ON public.segment_changes(segment_key, created_at DESC);
GRANT SELECT, INSERT ON public.segment_changes TO authenticated;
GRANT ALL ON public.segment_changes TO service_role;
ALTER TABLE public.segment_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage segment_changes" ON public.segment_changes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.segment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL,
  segment_label text NOT NULL,
  suggestion_type text NOT NULL DEFAULT 'add', -- add | remove
  term text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  generated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);
CREATE INDEX idx_segment_suggestions_segment ON public.segment_suggestions(segment_key, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segment_suggestions TO authenticated;
GRANT ALL ON public.segment_suggestions TO service_role;
ALTER TABLE public.segment_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage segment_suggestions" ON public.segment_suggestions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_segment_overrides_updated_at
  BEFORE UPDATE ON public.segment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

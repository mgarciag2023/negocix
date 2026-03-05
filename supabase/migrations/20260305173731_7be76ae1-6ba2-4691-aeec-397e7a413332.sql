
CREATE TABLE public.user_seen_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  place_id text NOT NULL,
  search_type text NOT NULL DEFAULT 'leads',
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, place_id)
);

ALTER TABLE public.user_seen_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own seen leads" ON public.user_seen_leads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_user_seen_leads_user_id ON public.user_seen_leads(user_id);
CREATE INDEX idx_user_seen_leads_place_id ON public.user_seen_leads(place_id);

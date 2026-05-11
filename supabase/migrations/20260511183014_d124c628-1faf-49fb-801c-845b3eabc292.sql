CREATE TABLE public.registered_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  whatsapp text,
  email text,
  state text NOT NULL,
  cities text[] NOT NULL DEFAULT '{}',
  segments text[] NOT NULL DEFAULT '{}',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reg_reps_state ON public.registered_representatives(state);
CREATE INDEX idx_reg_reps_user ON public.registered_representatives(user_id);

ALTER TABLE public.registered_representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active registered reps"
ON public.registered_representatives FOR SELECT TO authenticated
USING (is_active = true OR user_id = auth.uid());

CREATE POLICY "Users can insert their own registration"
ON public.registered_representatives FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own registration"
ON public.registered_representatives FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own registration"
ON public.registered_representatives FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all registrations"
ON public.registered_representatives FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_registered_representatives_updated_at
BEFORE UPDATE ON public.registered_representatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
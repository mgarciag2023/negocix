
CREATE TABLE public.registered_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  responsible_name TEXT,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  state TEXT NOT NULL,
  cities TEXT[] NOT NULL DEFAULT '{}'::text[],
  products TEXT[] NOT NULL DEFAULT '{}'::text[],
  delivers_nationwide BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registered_suppliers TO authenticated;
GRANT ALL ON public.registered_suppliers TO service_role;

ALTER TABLE public.registered_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active suppliers"
ON public.registered_suppliers FOR SELECT TO authenticated
USING ((is_active = true) OR (user_id = auth.uid()));

CREATE POLICY "Owners and admins can view all supplier fields"
ON public.registered_suppliers FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own supplier"
ON public.registered_suppliers FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own supplier"
ON public.registered_suppliers FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own supplier"
ON public.registered_suppliers FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all suppliers"
ON public.registered_suppliers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_registered_suppliers_updated_at
BEFORE UPDATE ON public.registered_suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_registered_suppliers_state ON public.registered_suppliers(state) WHERE is_active = true;
CREATE INDEX idx_registered_suppliers_products ON public.registered_suppliers USING GIN(products) WHERE is_active = true;

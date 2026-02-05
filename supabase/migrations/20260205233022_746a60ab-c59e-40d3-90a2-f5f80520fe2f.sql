-- Create table for user-specific lead limits
CREATE TABLE public.user_lead_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  leads_per_search INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_lead_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own limits
CREATE POLICY "Users can view their own limits" 
ON public.user_lead_limits 
FOR SELECT 
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Only admins can insert/update/delete limits
CREATE POLICY "Only admins can manage limits" 
ON public.user_lead_limits 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_lead_limits_updated_at
BEFORE UPDATE ON public.user_lead_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
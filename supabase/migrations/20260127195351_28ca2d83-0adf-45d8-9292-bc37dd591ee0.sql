-- Create updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create enum types for lead statuses
CREATE TYPE public.contact_status AS ENUM ('not_contacted', 'message_sent', 'conversation_started');
CREATE TYPE public.interest_status AS ENUM ('pending', 'interested', 'not_interested');
CREATE TYPE public.lead_stage AS ENUM ('interested', 'in_conversation', 'follow_up_pending', 'in_negotiation', 'closed_won', 'closed_lost');

-- Create saved leads table
CREATE TABLE public.saved_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  instagram TEXT,
  website TEXT,
  responsible TEXT,
  match_score INTEGER NOT NULL DEFAULT 0,
  reasons TEXT[] DEFAULT '{}',
  revenue TEXT,
  opened_date TEXT,
  category TEXT NOT NULL,
  employee_count TEXT,
  company_size TEXT,
  has_whatsapp BOOLEAN DEFAULT false,
  
  contact_status public.contact_status NOT NULL DEFAULT 'not_contacted',
  interest_status public.interest_status NOT NULL DEFAULT 'pending',
  lead_stage public.lead_stage NOT NULL DEFAULT 'interested',
  
  first_contact_date TIMESTAMP WITH TIME ZONE,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up_date TIMESTAMP WITH TIME ZONE,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(lead_id)
);

-- Enable RLS
ALTER TABLE public.saved_leads ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all operations on saved_leads" 
ON public.saved_leads 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_saved_leads_updated_at
BEFORE UPDATE ON public.saved_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_saved_leads_lead_stage ON public.saved_leads(lead_stage);
CREATE INDEX idx_saved_leads_saved_at ON public.saved_leads(saved_at DESC);
CREATE INDEX idx_saved_leads_next_follow_up ON public.saved_leads(next_follow_up_date);
CREATE INDEX idx_saved_leads_name ON public.saved_leads(name);
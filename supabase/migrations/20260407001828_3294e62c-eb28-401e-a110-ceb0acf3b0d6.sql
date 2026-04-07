
-- Create companies table for the Receita Federal dataset
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj text UNIQUE,
  razao_social text,
  nome_fantasia text,
  telefone_1 text,
  telefone_2 text,
  email text,
  cnae_principal text,
  descricao_cnae text,
  cnae_secundaria text,
  data_abertura text,
  porte text,
  mei text,
  simples text,
  capital_social numeric,
  situacao_cadastral text,
  data_situacao_cadastral text,
  motivo_situacao text,
  natureza_juridica text,
  endereco text,
  complemento text,
  cep text,
  bairro text,
  cidade text,
  estado text,
  matriz_filial text,
  nome_socio text,
  faixa_etaria_socio text,
  qualificacao_socio text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read companies"
ON public.companies
FOR SELECT
TO authenticated
USING (true);

-- Indexes for fast search
CREATE INDEX idx_companies_cidade_estado ON public.companies (cidade, estado);
CREATE INDEX idx_companies_cnae ON public.companies (cnae_principal);
CREATE INDEX idx_companies_situacao ON public.companies (situacao_cadastral);
CREATE INDEX idx_companies_descricao_cnae ON public.companies USING gin (to_tsvector('portuguese', coalesce(descricao_cnae, '')));
CREATE INDEX idx_companies_nome_fantasia ON public.companies USING gin (to_tsvector('portuguese', coalesce(nome_fantasia, '')));

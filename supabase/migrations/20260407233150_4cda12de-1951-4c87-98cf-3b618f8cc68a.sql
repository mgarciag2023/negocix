CREATE TABLE public.tmp_staging (
  cnpj text,
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
  qualificacao_socio text
);

ALTER TABLE public.tmp_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated insert on staging" ON public.tmp_staging FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select on staging" ON public.tmp_staging FOR SELECT TO authenticated USING (true);
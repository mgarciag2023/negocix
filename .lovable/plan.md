

## Plano: Conta fabio.silva9003@gmail.com + Leads nunca repetidos

### Contexto da conta
A conta `fabio.silva9003@gmail.com` já existe no sistema (user_id: `427c45e3-23e1-43f2-a18d-0fe210197658`). Não tem limite personalizado configurado, então usa o padrão de 90 leads por busca.

**Pergunta**: Não ficou claro o que deseja fazer com essa conta. Preciso saber: quer configurar um limite de leads específico? Desbloquear? Ou era apenas contexto de qual conta está usando?

---

### Problema dos leads repetidos
Quando o usuário faz a mesma pesquisa (ou pesquisas similares), a Google Places API retorna os mesmos estabelecimentos, gerando leads repetidos. Atualmente, a deduplicação só acontece **dentro** de uma mesma busca, nunca **entre** buscas diferentes.

### Solução: Histórico de leads exibidos por usuário

**1. Nova tabela `user_seen_leads`** (migration):
```sql
CREATE TABLE public.user_seen_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  place_id text NOT NULL,
  search_type text NOT NULL DEFAULT 'leads',
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, place_id)
);
ALTER TABLE public.user_seen_leads ENABLE ROW LEVEL SECURITY;
-- Users can manage their own records
CREATE POLICY "Users manage own seen leads" ON public.user_seen_leads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**2. Backend (`search-leads/index.ts`)**:
- Receber `user_id` no body da requisição (extraído do token JWT)
- Após gerar os leads finais, consultar `user_seen_leads` para o `user_id` e filtrar leads cujo `placeId` já foi visto
- Após filtrar, inserir os novos `placeId`s na tabela `user_seen_leads`
- Garantir que o `placeId` do Google Maps é sempre preservado como identificador estável (já existe no código)

**3. Frontend (`Results.tsx` e `Configuration.tsx`)**:
- Enviar o token de autenticação na chamada do edge function (já acontece automaticamente via `supabase.functions.invoke`)
- No edge function, extrair o `user_id` do JWT para usar na consulta/inserção

**4. Fluxo**:
```text
Usuário pesquisa "Transportadoras em Lajeado"
  → Backend encontra 72 leads
  → Consulta user_seen_leads: 0 vistos
  → Retorna 72 leads, salva 72 place_ids
  
Usuário pesquisa novamente "Transportadoras em Lajeado"  
  → Backend encontra 72 leads
  → Consulta user_seen_leads: 72 já vistos
  → Retorna 0 leads (todos já exibidos)
  → Mensagem: "Todos os leads desta região já foram exibidos anteriormente"
```

**5. Botão "Limpar histórico"** (opcional):
- Adicionar na página de configuração um botão para resetar o histórico de leads vistos, caso o usuário queira rever leads antigos

### Arquivos a modificar
- **Migration**: criar tabela `user_seen_leads`
- **`supabase/functions/search-leads/index.ts`**: consultar/inserir na tabela de leads vistos
- **`src/pages/Results.tsx`**: exibir mensagem adequada quando todos os leads já foram vistos
- **`src/pages/Configuration.tsx`**: botão opcional para limpar histórico


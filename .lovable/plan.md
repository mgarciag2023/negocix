

## Diagnóstico: Academias no Maranhão — 136 de ~800

### Problema identificado

A base tem **801 academias ativas com telefone válido no MA**. A busca FTS encontra todas, mas o **filtro de relevância universal** (linhas 1909-2000) elimina ~83% delas.

**Causa raiz**: O filtro exige que palavras de termos multi-word apareçam no nome da empresa. Como existem muitos termos multi-word (ex: "academia de ginástica", "academia de musculação"), o filtro requer que TODOS os words de pelo menos um desses termos estejam no nome. Academias com nomes simples como "Academia Alpha" ou "Studio Fit" falham porque não contêm "ginastica", "musculacao", etc.

Além disso:
- **Academias não têm mapeamento CNAE** na função `getCnaesForSegment`, então não há busca complementar por CNAE
- A flag `_viaCnae` é definida mas **nunca verificada** no filtro de relevância — resultados via CNAE são filtrados igual

### Plano de correção

#### 1. Adicionar CNAE para academias em `getCnaesForSegment`
- CNAE `9313100` (Atividades de condicionamento físico) é o principal para academias
- Adicionar também `9319199` (Outras atividades esportivas) como secundário

#### 2. Fazer resultados `_viaCnae` pularem o filtro de relevância
- No filtro universal (linha 1966), adicionar checagem: `if (c._viaCnae) return true;`
- Isso garante que empresas encontradas por CNAE oficial nunca sejam descartadas pelo filtro de nome

#### 3. Melhorar a lógica do filtro para segmentos com keyword dominante
- Para "academias", se o nome contém "academia" (single-word match), aceitar diretamente sem exigir multi-word
- Ajustar a lógica nas linhas 1987-1993: quando há single-word matches disponíveis E o company name já contém um core keyword, aceitar o lead

### Arquivos alterados
- `supabase/functions/search-leads/index.ts` — 3 alterações pontuais
- Redeploy da Edge Function

### Resultado esperado
De ~136 leads para ~700-800 leads para "Academias" no Maranhão.


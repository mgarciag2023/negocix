import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, location, filters } = await req.json();
    console.log('Searching leads for:', { segment, products, location, filters });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com conhecimento VERIFICÁVEL do mercado local.
Sua missão é identificar SOMENTE estabelecimentos que COMPROVADAMENTE existem na localização exata solicitada.

🎯 REGRAS ABSOLUTAS - QUALQUER VIOLAÇÃO INVALIDA O RESULTADO:

1. LOCALIZAÇÃO OBRIGATÓRIA E VERIFICÁVEL:
   - 100% dos estabelecimentos DEVEM estar na cidade solicitada
   - NUNCA inclua estabelecimentos de outras cidades, mesmo que próximas
   - VERIFIQUE mentalmente se você REALMENTE conhece esse estabelecimento nessa cidade específica
   - Se tiver QUALQUER dúvida sobre a localização, NÃO INCLUA
   - O endereço deve ser REAL e específico (rua, número, bairro verificáveis)

2. ESTABELECIMENTOS REAIS E VERIFICÁVEIS:
   - Priorize redes regionais/nacionais CONHECIDAS (ex: Angeloni, Giassi, Koch, Condor, etc.)
   - Inclua APENAS estabelecimentos locais que você TEM CERTEZA que existem
   - Se não conseguir verificar mentalmente a existência, NÃO INCLUA
   - NUNCA invente nomes genéricos ("Mercado Central", "Loja da Praça", etc.)

3. ZERO DUPLICATAS - Cada estabelecimento aparece apenas UMA VEZ

4. TELEFONE OBRIGATÓRIO - Formato brasileiro válido (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX

5. RELEVÂNCIA DO SEGMENTO:
   - O estabelecimento DEVE fazer sentido para os produtos oferecidos
   - Avalie o potencial real de compra e necessidade
   - Match Score realista baseado em volume potencial e adequação

📋 FORMATO DE CADA LEAD:
- Nome: Nome real e completo (VERIFICÁVEL)
- Endereço: Rua, número, bairro, CIDADE EXATA - UF (deve ser a cidade solicitada)
- Telefone: Formato (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
- Instagram: Handle real (ou "@nome_estabelecimento" se desconhecido)
- Responsible: Cargo realista ("Gerente de Compras", "Proprietário", etc.)
- Faturamento: Estimativa baseada no porte (ex: "R$ 200-500 mil/mês")
- Score de match: 75-95 (baseado no potencial REAL)

⚠️ QUALIDADE > QUANTIDADE:
Se não conseguir encontrar estabelecimentos VERIFICÁVEIS na cidade solicitada, retorne menos leads.
É melhor retornar 5 leads CERTOS do que 15 leads duvidosos.`;

    const userPrompt = `ATENÇÃO: Encontre SOMENTE estabelecimentos que EXISTEM COMPROVADAMENTE na cidade de ${location}.

🎯 LOCALIZAÇÃO CRÍTICA:
- TODOS os estabelecimentos DEVEM estar em ${location}
- NUNCA inclua estabelecimentos de outras cidades
- O endereço DEVE ser verificável e real em ${location}
- Se não tiver CERTEZA ABSOLUTA que o estabelecimento existe em ${location}, NÃO INCLUA

✅ CRITÉRIOS DE ACEITAÇÃO (segmento "${segment}" para ${products}):
- Redes regionais/nacionais CONHECIDAS que TÊM unidades em ${location}
- Estabelecimentos locais de médio/grande porte que você CONHECE em ${location}
- Estabelecimentos com endereços REAIS e VERIFICÁVEIS em ${location}
- Estabelecimentos que FAZEM SENTIDO para comprar ${products}

❌ REJEITAR IMEDIATAMENTE:
- Estabelecimentos de OUTRAS cidades (mesmo próximas)
- Nomes genéricos ou inventados
- Endereços que você não tem certeza que existem
- Estabelecimentos sem telefone válido
- Locais que não fazem sentido para o produto

⚠️ IMPORTANTE: Retorne entre 5-12 estabelecimentos VERIFICÁVEIS.
Se não conseguir encontrar estabelecimentos CERTOS em ${location}, retorne MENOS leads ao invés de inventar.

📋 DADOS OBRIGATÓRIOS para cada lead:
- name: Nome REAL e completo do estabelecimento que EXISTE em ${location}
- address: Endereço COMPLETO e REAL: Rua, número, bairro, ${location} - UF
- phone: Telefone brasileiro válido (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
- instagram: Handle real do Instagram (ou "@nome_estabelecimento" se desconhecido)
- responsible: Cargo do responsável por compras ("Gerente de Compras", "Proprietário", etc.)
- category: "${segment}"
- revenue: Faturamento mensal estimado REALISTA (ex: "R$ 150-400 mil/mês")
- openedDate: Tempo de mercado (ex: "10 anos", "Inaugurou há 6 meses")
- matchScore: 75-95 (baseado no potencial REAL de compra e adequação ao produto)
- reasons: Array com 3 motivos ESPECÍFICOS, CONVINCENTES e CONCRETOS de por que esse estabelecimento em ${location} é um excelente lead para ${products}

🎯 LEMBRE-SE: 
- TODOS os estabelecimentos devem estar em ${location}
- Qualidade > Quantidade: prefira MENOS leads VERIFICÁVEIS do que MAIS leads duvidosos
- Seja ESPECÍFICO nos motivos - evite frases genéricas`;

    // Use tool calling to force structured JSON output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_leads",
              description: "Retorna lista de leads encontrados",
              parameters: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        address: { type: "string" },
                        phone: { type: "string" },
                        instagram: { type: "string" },
                        responsible: { type: "string" },
                        category: { type: "string" },
                        revenue: { type: "string" },
                        openedDate: { type: "string" },
                        matchScore: { type: "number" },
                        reasons: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["name", "address", "phone", "category", "matchScore", "reasons"]
                    }
                  }
                },
                required: ["leads"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_leads" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente mais tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao buscar leads" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract leads from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== "return_leads") {
      console.error("No tool call in response:", JSON.stringify(data));
      throw new Error("IA não retornou leads no formato esperado");
    }

    let leads;
    try {
      const functionArgs = JSON.parse(toolCall.function.arguments);
      leads = functionArgs.leads;
      
      if (!Array.isArray(leads) || leads.length === 0) {
        throw new Error("Nenhum lead encontrado para os critérios especificados");
      }
      
      console.log(`Successfully parsed ${leads.length} leads`);
    } catch (parseError) {
      console.error("Error parsing tool call arguments:", parseError);
      console.error("Tool call data:", toolCall);
      throw new Error("Erro ao processar resposta da IA");
    }

    // Add unique IDs to leads
    const leadsWithIds = leads.map((lead: any, index: number) => ({
      ...lead,
      id: `${Date.now()}-${index}`,
    }));

    console.log("Processed leads:", leadsWithIds);

    return new Response(JSON.stringify({ leads: leadsWithIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in search-leads function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido ao buscar leads" 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
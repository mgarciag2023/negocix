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

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com vasto conhecimento do mercado local.
Identifique estabelecimentos REAIS E VERIFICÁVEIS que existem na região solicitada.

🎯 REGRAS CRÍTICAS:
1. ZERO DUPLICATAS - Cada estabelecimento aparece apenas UMA VEZ
2. ESTABELECIMENTOS REAIS APENAS:
   - Priorize redes regionais conhecidas (Angeloni, Giassi, Koch, Bistek, etc.)
   - Inclua estabelecimentos locais de médio/grande porte CONFIRMADOS
   - Se não tiver certeza absoluta do estabelecimento, NÃO INCLUA
3. TELEFONE OBRIGATÓRIO - Formato brasileiro válido (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
4. NOMES REAIS - NUNCA invente nomes genéricos como "Mercado Central" ou "Restaurante da Praça"
5. LOCALIZAÇÃO PRECISA:
   - 80% OBRIGATÓRIO da cidade solicitada
   - Máximo 20% de cidades vizinhas PRÓXIMAS (máx 15km)
   - SEMPRE especifique a cidade real no endereço

📋 QUALIDADE DO LEAD:
- Verifique se o estabelecimento FAZ SENTIDO para os produtos oferecidos
- Match Score baseado em: volume potencial, necessidade do produto, acessibilidade
- Priorize estabelecimentos com maior potencial de compra
- Evite estabelecimentos muito pequenos ou informais a menos que sejam específicos

📋 FORMATO DE CADA LEAD:
- Nome: Nome real e completo do estabelecimento
- Endereço: Rua completa, número, bairro, CIDADE - UF
- Telefone: Formato (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
- Instagram: Handle real verificável (ou "@nome_do_estabelecimento" se desconhecido)
- Responsible: "Gerente de Compras", "Proprietário" ou cargo específico
- Faturamento: Estimativa realista baseada no porte (ex: "R$ 200-500 mil/mês")
- Score de match: 75-95 (baseado no potencial real de compra)`;

    const userPrompt = `Encontre entre 8-15 estabelecimentos REAIS E VERIFICÁVEIS do segmento "${segment}" em ${location} que possam comprar ${products}.

✅ CRITÉRIOS DE ACEITAÇÃO:
- Redes regionais conhecidas (Angeloni, Giassi, Koch, Condor, etc.)
- Estabelecimentos locais de médio/grande porte com presença estabelecida
- Estabelecimentos que REALMENTE existem e podem ser verificados
- Estabelecimentos que FAZEM SENTIDO para comprar ${products}

❌ NÃO ACEITAR:
- Nomes genéricos ou inventados
- Estabelecimentos sem telefone válido
- Locais que não fazem sentido para o produto
- Estabelecimentos de cidades muito distantes (>15km)

📋 DADOS OBRIGATÓRIOS para cada lead:
- name: Nome REAL e completo do estabelecimento
- address: Endereço COMPLETO com rua, número, bairro, CIDADE - UF
- phone: Telefone brasileiro válido (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
- instagram: Handle real do Instagram (ou "@nome_estabelecimento" se desconhecido)
- responsible: Cargo do responsável por compras ("Gerente de Compras", "Proprietário", etc.)
- category: "${segment}"
- revenue: Faturamento mensal estimado REALISTA (ex: "R$ 150-400 mil/mês")
- openedDate: Tempo de mercado (ex: "10 anos", "Inaugurou há 6 meses")
- matchScore: 75-95 (baseado no potencial REAL de compra e necessidade do produto)
- reasons: Array com 3 motivos ESPECÍFICOS e CONVINCENTES de por que esse estabelecimento é um bom lead para ${products}

🎯 IMPORTANTE: 
- Qualidade > Quantidade: Se não encontrar 15 estabelecimentos VERIFICÁVEIS, retorne quantos conseguir com CERTEZA (mínimo 8)
- Priorize estabelecimentos com maior potencial de compra e necessidade real do produto
- Seja ESPECÍFICO nos motivos - evite frases genéricos como "estabelecimento grande"`;

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
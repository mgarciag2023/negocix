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

    // First, search the web for real establishments
    console.log('Searching web for real establishments...');
    const webSearchQuery = `${segment} em ${location} Brasil endereço telefone`;
    
    let webResults = '';
    try {
      const searchResponse = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(webSearchQuery)}`);
      if (searchResponse.ok) {
        webResults = await searchResponse.text();
        console.log('Web search successful, found real establishments');
      }
    } catch (error) {
      console.warn('Web search failed, will rely on AI knowledge:', error);
    }

    const systemPrompt = `Você é um especialista ULTRA-RIGOROSO em prospecção B2B no Brasil.

🔍 FONTES DE DADOS OBRIGATÓRIAS:
═══════════════════════════════════════════════════════════
Você DEVE basear suas respostas em:
1. Informações reais de buscas no Google/Google Maps
2. Dados verificáveis de redes sociais (Instagram, Facebook)
3. Seu conhecimento sobre redes nacionais/regionais CONFIRMADAS
4. Diretórios comerciais e sites oficiais

❌ NUNCA invente ou "adivinhe" informações
✅ Se não tiver certeza de um dado, marque como "a confirmar"

🎯 QUANTIDADE EXIGIDA: 12-20 LEADS
═══════════════════════════════════════════════════════════
IMPORTANTE: Você DEVE retornar entre 12 e 20 leads por busca.
Combine diferentes tipos de estabelecimentos:
- Redes nacionais conhecidas (McDonald's, Subway, etc)
- Franquias regionais consolidadas
- Estabelecimentos locais GRANDES e conhecidos
- Shoppings e centros comerciais relevantes

🏢 EXEMPLOS DE REDES CONFIÁVEIS POR SEGMENTO:
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan (setor construção), 
  Dicico, Tumelero, Cassol, Balaroti, Obramax, Astra
Supermercados: Angeloni, Giassi, Bistek, Breithaupt, Fort Atacadista, Walmart, Carrefour
Farmácias: Panvel, São João, Catarinense, Nissei, Drogasil, São Paulo
Lojas Departamento: Havan, Renner, Riachuelo, C&A, Marisa, Lojas Americanas
Pet Shops: Petz, Cobasi, PetLove (lojas físicas)
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's, Pizza Hut, Domino's
Postos Combustível: Ipiranga, Shell, BR, Petrobras
Indústrias de Pão de Queijo: Forno de Minas, Casa do Pão de Queijo, Pão de Queijo Haddock Lobo

📍 ENDEREÇOS - REGRA CRÍTICA:
═══════════════════════════════════════════════════════════
✅ Se SOUBER o endereço exato (de busca real):
- Use o formato completo: "Rua XV de Novembro, 1050 - Centro, ${location} - SC"

✅ Se NÃO souber endereço específico:
- Use localização INDICATIVA: "Região do Centro, ${location} - SC"
- Ou referência conhecida: "Shopping Neumarkt, ${location} - SC"

❌ NUNCA invente números ou ruas que você não confirmou

📋 DADOS OBRIGATÓRIOS:
═══════════════════════════════════════════════════════════
- name: Nome oficial do estabelecimento
- address: Endereço REAL (se confirmado) ou INDICATIVO (se não)
- phone: Telefone real se encontrar em busca, ou "Telefone a confirmar"
- instagram: @usuario se encontrar, ou "@verificar"
- responsible: "Gerente da Loja" ou "Gerente Regional"
- revenue: Valores REALISTAS para o porte
- matchScore: 75-95 (potencial REAL de comprar "${products}")
- reasons: 3 motivos ESPECÍFICOS e CONVINCENTES

🎯 SUA MISSÃO: Retornar 12-20 leads com dados REAIS e VERIFICÁVEIS`;


    const userPrompt = `🎯 TAREFA: Encontre 12-20 estabelecimentos REAIS em ${location}

📍 INFORMAÇÕES DA BUSCA:
═══════════════════════════════════════════════════════════
Cidade: ${location}
Segmento: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

${webResults ? `\n🔍 DADOS DE BUSCA NA WEB:\n${webResults.substring(0, 3000)}\n` : ''}

🏢 TIPOS DE ESTABELECIMENTOS A INCLUIR:
═══════════════════════════════════════════════════════════
✅ INCLUA (para atingir 12-20 leads):
1. Redes nacionais conhecidas (McDonald's, Subway, etc)
2. Franquias regionais consolidadas
3. Estabelecimentos locais GRANDES que você confirmar via busca
4. Shoppings centers e galerias comerciais relevantes
5. Atacadistas e distribuidores da região

📍 ENDEREÇOS - USE DADOS REAIS:
═══════════════════════════════════════════════════════════
PRIORIDADE: Use informações das buscas reais quando disponíveis

✅ Se encontrou em busca real ou tem CERTEZA:
- Use endereço completo: "Rua XV de Novembro, 1050 - Centro, ${location} - SC"

✅ Se não tem endereço exato:
- Use localização indicativa: "Região do Centro, ${location} - SC"
- Ou referência: "Shopping [Nome], ${location} - SC"

❌ NUNCA invente números de rua ou endereços específicos

📋 DADOS PARA CADA LEAD:
═══════════════════════════════════════════════════════════
{
  "name": "Nome real do estabelecimento",
  "address": "Endereço REAL (se confirmado) ou INDICATIVO",
  "phone": "Telefone real ou 'Telefone a confirmar'",
  "instagram": "@usuario (se encontrado) ou '@verificar'",
  "responsible": "Gerente de Loja",
  "category": "${segment}",
  "revenue": "R$ [valor realista]/mês",
  "openedDate": "[tempo realista]",
  "matchScore": [75-95],
  "reasons": [
    "Motivo ESPECÍFICO 1 por que compraria ${products}",
    "Motivo ESPECÍFICO 2 com base no modelo de negócio",
    "Motivo ESPECÍFICO 3 sobre vantagem competitiva"
  ]
}

⚠️ REGRAS CRÍTICAS:
═══════════════════════════════════════════════════════════
1. Retorne OBRIGATORIAMENTE 12-20 leads
2. Use dados REAIS das buscas quando disponíveis
3. Marque dados não confirmados como "a confirmar" ou "@verificar"
4. Combine redes nacionais + estabelecimentos locais grandes
5. NUNCA invente endereços específicos que não pode confirmar

🎯 CHECKLIST FINAL:
═══════════════════════════════════════════════════════════
- Tenho 12-20 leads? (OBRIGATÓRIO)
- Usei dados reais das buscas?
- Marquei dados não confirmados adequadamente?
- Inclui mix de redes nacionais e estabelecimentos locais grandes?`;

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
      
      if (leads.length < 12) {
        console.warn(`⚠️ Only ${leads.length} leads returned, expected 12-20`);
      }
      
      console.log(`Successfully parsed ${leads.length} leads`);
    } catch (parseError) {
      console.error("Error parsing tool call arguments:", parseError);
      console.error("Tool call data:", toolCall);
      throw new Error("Erro ao processar resposta da IA");
    }

    // CRITICAL: Ultra-strict validation of leads
    const validLeads = leads.filter((lead: any) => {
      const address = lead.address || '';
      const name = lead.name || '';
      const addressLower = address.toLowerCase();
      const locationLower = location.toLowerCase();
      
      // 1. Must contain exact city name
      if (!addressLower.includes(locationLower)) {
        console.warn(`🚨 REJECTED - City not in address:`, name, address);
        return false;
      }
      
      // 2. Address must have minimum components (neighborhood/region and city)
      const parts = address.split(',');
      if (parts.length < 2) {
        console.warn(`🚨 REJECTED - Invalid address format:`, name, address);
        return false;
      }
      
      // 3. Reject very vague names
      const vagueNames = ['loja', 'comércio', 'estabelecimento'];
      const nameWords = name.toLowerCase().split(' ');
      if (nameWords.length === 2 && vagueNames.includes(nameWords[0])) {
        console.warn(`🚨 REJECTED - Vague name:`, name);
        return false;
      }
      
      return true;
    });

    if (validLeads.length === 0) {
      console.error("❌ ALL LEADS REJECTED - None matched the city:", location);
      throw new Error(`Nenhum estabelecimento válido encontrado em ${location}`);
    }

    console.log(`✅ Validated: ${validLeads.length}/${leads.length} leads in ${location}`);

    // Add unique IDs to valid leads
    const leadsWithIds = validLeads.map((lead: any, index: number) => ({
      ...lead,
      id: `${Date.now()}-${index}`,
    }));

    console.log("Final processed leads:", leadsWithIds);

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
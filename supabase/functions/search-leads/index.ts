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

    // Search Google Maps for real establishments
    console.log('Searching Google Maps for real establishments...');
    const mapsSearchQuery = `${segment} ${location} SC Brasil`;
    
    let webResults = '';
    try {
      // Try to get Google Maps data
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsSearchQuery)}`;
      console.log('Fetching from Google Maps:', mapsUrl);
      
      const searchResponse = await fetch(mapsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (searchResponse.ok) {
        webResults = await searchResponse.text();
        console.log('Google Maps search successful, extracting data...');
        
        // Extract more context from the HTML
        const relevantData = webResults.substring(0, 5000); // Get more data for better context
        webResults = relevantData;
      }
    } catch (error) {
      console.warn('Google Maps search failed, trying alternative search:', error);
      
      // Fallback to Google search
      try {
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(mapsSearchQuery + ' endereço telefone instagram')}`;
        const fallbackResponse = await fetch(googleSearchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (fallbackResponse.ok) {
          webResults = await fallbackResponse.text();
          webResults = webResults.substring(0, 5000);
          console.log('Google search successful');
        }
      } catch (fallbackError) {
        console.warn('All web searches failed, will rely on AI knowledge:', fallbackError);
      }
    }

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com acesso a dados do Google Maps.

🎯 META OBRIGATÓRIA: RETORNAR EXATAMENTE 15 LEADS
═══════════════════════════════════════════════════════════
Você DEVE retornar EXATAMENTE 15 leads em TODAS as buscas, sem exceção.

🔍 FONTES DE DADOS - PRIORIDADE:
═══════════════════════════════════════════════════════════
1. **DADOS DO GOOGLE MAPS** (fornecidos na busca) - use quando disponível
2. Redes nacionais/regionais conhecidas com presença em ${location}
3. Estabelecimentos locais conhecidos da região
4. Estabelecimentos similares do segmento

⚠️ REGRAS DE DADOS:
═══════════════════════════════════════════════════════════
✅ Use dados do Google Maps quando disponíveis (endereço completo, telefone)
✅ Para redes conhecidas: use endereço do tipo "Rua [principal da cidade], ${location} - SC"
✅ Para estabelecimentos locais: baseie-se em bairros conhecidos da cidade
✅ SEMPRE complete até 15 leads mesmo que precise usar conhecimento geral

🏢 EXEMPLOS DE REDES POR SEGMENTO:
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan, Dicico, Tumelero
Supermercados: Angeloni, Giassi, Bistek, Fort Atacadista, Walmart, Carrefour
Farmácias: Panvel, São João, Catarinense, Nissei, Drogasil, Drogaria São Paulo
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's, Habib's
Indústrias de Pão de Queijo: Forno de Minas, Casa do Pão de Queijo, empresas locais
Pizzarias/Lanchonetes: Redes locais, franquias conhecidas, estabelecimentos populares

📍 FORMATO DE ENDEREÇOS:
═══════════════════════════════════════════════════════════
✅ Completo do Google Maps: "Rua [nome], [número] - [bairro], ${location} - SC"
✅ Redes sem endereço exato: "Av. [principal], [bairro], ${location} - SC"
✅ Shopping centers: "Shopping [nome], ${location} - SC"

📋 DADOS OBRIGATÓRIOS EM CADA LEAD:
═══════════════════════════════════════════════════════════
- name: Nome do estabelecimento (rede ou local)
- address: Endereço com cidade ${location} - SC
- phone: Telefone do Google Maps ou "Telefone a confirmar"
- instagram: @usuario real ou "@verificar"
- responsible: "Gerente de Compras" ou "Gerente da Loja"
- revenue: R$ [valor realista]/mês
- openedDate: Tempo estimado de operação
- matchScore: 75-95
- reasons: 3 motivos específicos de match com ${products}`;


    const userPrompt = `🎯 TAREFA OBRIGATÓRIA: Retorne EXATAMENTE 15 estabelecimentos em ${location}, Santa Catarina

📍 CONTEXTO DA BUSCA:
═══════════════════════════════════════════════════════════
Cidade: ${location}, SC, Brasil
Segmento alvo: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

${webResults ? `\n🗺️ DADOS DO GOOGLE MAPS/GOOGLE:\n${webResults.substring(0, 5000)}\n` : ''}

🔍 INSTRUÇÕES OBRIGATÓRIAS:
═══════════════════════════════════════════════════════════
1. RETORNE EXATAMENTE 15 LEADS - isso é obrigatório
2. Use dados do Google Maps quando disponíveis
3. Complete com redes nacionais conhecidas em ${location}
4. Adicione estabelecimentos locais relevantes do segmento
5. Cada lead DEVE ter endereço contendo "${location} - SC"

📋 FORMATO DE CADA LEAD:
═══════════════════════════════════════════════════════════
{
  "name": "[Nome do estabelecimento - rede ou local]",
  "address": "[Rua/Av + número/região], [bairro], ${location} - SC",
  "phone": "[Telefone] ou 'Telefone a confirmar'",
  "instagram": "@[usuario] ou '@verificar'",
  "responsible": "Gerente de Compras",
  "category": "${segment}",
  "revenue": "R$ [valor realista]/mês",
  "openedDate": "[tempo de operação]",
  "matchScore": [75-95],
  "reasons": [
    "Motivo 1 relacionado a ${products}",
    "Motivo 2 sobre o perfil do estabelecimento",
    "Motivo 3 sobre oportunidade de negócio"
  ]
}

⚠️ CHECKLIST ANTES DE RETORNAR:
═══════════════════════════════════════════════════════════
✅ Tenho EXATAMENTE 15 leads?
✅ Todos os endereços contêm "${location} - SC"?
✅ Todos os campos obrigatórios estão preenchidos?
✅ Os leads fazem sentido para o segmento ${segment}?

🎯 LEMBRE-SE: 15 LEADS É OBRIGATÓRIO - complete com estabelecimentos locais se necessário!`;

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
      
      if (leads.length < 15) {
        console.warn(`⚠️ Only ${leads.length} leads returned, expected exactly 15. Retrying...`);
        throw new Error(`Sistema retornou apenas ${leads.length} leads. Necessário exatamente 15 leads.`);
      }
      
      console.log(`✅ Successfully parsed ${leads.length} leads`);
    } catch (parseError) {
      console.error("Error parsing tool call arguments:", parseError);
      console.error("Tool call data:", toolCall);
      throw new Error("Erro ao processar resposta da IA");
    }

    // Relaxed validation - only check basic requirements
    const validLeads = leads.filter((lead: any) => {
      const address = lead.address || '';
      const name = lead.name || '';
      
      // 1. Must have a name
      if (!name || name.trim().length === 0) {
        console.warn(`🚨 REJECTED - No name:`, lead);
        return false;
      }
      
      // 2. Must have an address with "SC" (Santa Catarina)
      if (!address.includes('SC') && !address.includes('sc')) {
        console.warn(`🚨 REJECTED - No SC in address:`, name, address);
        return false;
      }
      
      // 3. Address should mention the location (flexible check)
      const addressLower = address.toLowerCase();
      const locationLower = location.toLowerCase();
      // Remove accents for comparison
      const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedAddress = normalizeString(addressLower);
      const normalizedLocation = normalizeString(locationLower);
      
      if (!normalizedAddress.includes(normalizedLocation)) {
        // Allow if it's a very close match (typos, etc)
        const locationWords = normalizedLocation.split(' ');
        const hasPartialMatch = locationWords.some(word => 
          word.length > 3 && normalizedAddress.includes(word)
        );
        if (!hasPartialMatch) {
          console.warn(`⚠️ WARNING - City name may not match:`, name, address, 'looking for:', location);
          // Don't reject, just warn
        }
      }
      
      return true;
    });

    if (validLeads.length === 0) {
      console.error("❌ ALL LEADS REJECTED");
      throw new Error(`Nenhum estabelecimento válido encontrado`);
    }

    if (validLeads.length < 15) {
      console.warn(`⚠️ Only ${validLeads.length} valid leads after validation, expected 15`);
    }

    console.log(`✅ Validated: ${validLeads.length}/${leads.length} leads`);

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
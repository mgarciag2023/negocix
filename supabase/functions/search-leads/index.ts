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

    const systemPrompt = `Você é um especialista ULTRA-RIGOROSO em prospecção B2B no Brasil com acesso a dados do Google Maps.

🔍 FONTES DE DADOS - PRIORIDADE MÁXIMA:
═══════════════════════════════════════════════════════════
1. **DADOS DO GOOGLE MAPS** (fornecidos na busca) - PRIORIDADE ABSOLUTA
2. Seu conhecimento sobre redes nacionais/regionais CONFIRMADAS
3. Informações verificáveis de redes sociais
4. Diretórios comerciais conhecidos

⚠️ REGRAS CRÍTICAS DE DADOS:
═══════════════════════════════════════════════════════════
❌ NUNCA invente endereços, telefones ou nomes de estabelecimentos
❌ NUNCA use endereços genéricos como "Região Central" quando você não souber
✅ Use APENAS dados reais encontrados no Google Maps ou seu conhecimento confirmado
✅ Se não encontrar dados suficientes, retorne MENOS leads, mas com dados REAIS

🎯 QUANTIDADE: 12-20 LEADS REAIS
═══════════════════════════════════════════════════════════
Priorize qualidade sobre quantidade:
- Estabelecimentos com endereços REAIS encontrados
- Redes nacionais/regionais com filiais confirmadas em ${location}
- Estabelecimentos grandes e conhecidos da cidade

🏢 EXEMPLOS DE REDES POR SEGMENTO:
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan, Dicico, Tumelero
Supermercados: Angeloni, Giassi, Bistek, Fort Atacadista, Walmart, Carrefour
Farmácias: Panvel, São João, Catarinense, Nissei, Drogasil
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's
Indústrias de Pão de Queijo: Forno de Minas, Casa do Pão de Queijo

📍 ENDEREÇOS - USO OBRIGATÓRIO DE DADOS REAIS:
═══════════════════════════════════════════════════════════
✅ Use endereços COMPLETOS do Google Maps quando disponíveis
✅ Para redes conhecidas sem endereço exato: "Shopping [nome conhecido], ${location} - SC"
❌ NUNCA invente números de rua ou nomes de rua
❌ NUNCA use "Região do Centro" a menos que seja um shopping ou referência real

📋 DADOS OBRIGATÓRIOS:
═══════════════════════════════════════════════════════════
- name: Nome REAL encontrado no Google Maps ou rede conhecida
- address: Endereço COMPLETO do Google Maps (rua, número, bairro)
- phone: Telefone real do Google Maps ou "Telefone a confirmar"
- instagram: @usuario real ou "@verificar"
- responsible: "Gerente da Loja" ou "Comprador"
- revenue: Valores realistas para o porte
- matchScore: 75-95
- reasons: 3 motivos específicos e convincentes`;


    const userPrompt = `🎯 TAREFA: Encontre 12-20 estabelecimentos REAIS em ${location}, Santa Catarina

📍 CONTEXTO DA BUSCA:
═══════════════════════════════════════════════════════════
Cidade: ${location}, SC, Brasil
Segmento alvo: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

${webResults ? `\n🗺️ DADOS DO GOOGLE MAPS/GOOGLE:\n${webResults.substring(0, 5000)}\n` : ''}

🔍 INSTRUÇÕES DE EXTRAÇÃO:
═══════════════════════════════════════════════════════════
1. ANALISE os dados do Google Maps fornecidos acima
2. EXTRAIA nomes reais, endereços completos e telefones dos estabelecimentos
3. PRIORIZE estabelecimentos com dados completos
4. COMPLEMENTE com redes nacionais conhecidas que têm filial em ${location}

📋 FORMATO DE CADA LEAD (use dados REAIS):
═══════════════════════════════════════════════════════════
{
  "name": "[Nome EXATO do estabelecimento encontrado no Google Maps]",
  "address": "[Endereço COMPLETO: Rua, número, bairro, ${location} - SC]",
  "phone": "[Telefone encontrado] ou 'Telefone a confirmar'",
  "instagram": "@[usuário real se souber] ou '@verificar'",
  "responsible": "Gerente de Loja",
  "category": "${segment}",
  "revenue": "R$ [valor realista para o porte]/mês",
  "openedDate": "[tempo de operação estimado]",
  "matchScore": [75-95],
  "reasons": [
    "Motivo específico 1 relacionado a ${products}",
    "Motivo específico 2 sobre o perfil do estabelecimento",
    "Motivo específico 3 sobre oportunidade de negócio"
  ]
}

⚠️ REGRAS ABSOLUTAS:
═══════════════════════════════════════════════════════════
✅ Use APENAS nomes e endereços que você encontrou nos dados ou conhece com certeza
✅ Endereço deve ter: nome da rua + número + bairro + ${location} - SC
✅ Se não souber o endereço completo de uma rede, use: "Shopping/Centro Comercial [nome], ${location} - SC"
❌ NUNCA invente nomes de estabelecimentos que não existem
❌ NUNCA invente números ou nomes de ruas
❌ NUNCA use endereços vagos como "Região Central" sem especificar

🎯 META: 12-20 LEADS COM DADOS VERIFICÁVEIS
═══════════════════════════════════════════════════════════
Priorize:
1. Estabelecimentos encontrados no Google Maps (dados completos)
2. Redes nacionais com filial CONFIRMADA em ${location}
3. Grandes estabelecimentos locais conhecidos

IMPORTANTE: Prefira retornar menos leads com dados reais do que muitos leads com dados inventados!`;

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
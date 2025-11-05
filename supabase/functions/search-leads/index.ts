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
    const { segment, products, location, state, filters } = await req.json();
    console.log('Searching leads for:', { segment, products, location, state, filters });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Apify Google Maps Scraper for real data
    console.log('Searching Google Maps via Apify API...');
    const stateCode = state || 'SC'; // Default to SC if not provided
    const searchQuery = `${segment} ${location} ${stateCode} Brasil`;
    
    let apifyResults: any[] = [];
    try {
      // Use run-sync-get-dataset-items endpoint for efficient single-call execution
      console.log('Starting Apify scraper (sync) for query:', searchQuery);
      
      const apifyResponse = await fetch(
        'https://api.apify.com/v2/actor-tasks/exclusive_ravel~google-maps-scraper-task/run-sync-get-dataset-items?token=apify_api_4VVzISqyOszKRn62CZERtBuigK5eKa0SbQjA',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            searchStringsArray: [searchQuery],
            maxCrawledPlacesPerSearch: 20,
            language: 'pt',
            deeperCityScrape: true,
          }),
        }
      );

      if (!apifyResponse.ok) {
        const errorText = await apifyResponse.text();
        console.error(`Apify API error: ${apifyResponse.status}`, errorText);
        throw new Error(`Apify API error: ${apifyResponse.status}`);
      }

      apifyResults = await apifyResponse.json();
      console.log(`Apify returned ${apifyResults.length} places from Google Maps`);
      
    } catch (error) {
      console.error('Apify scraper error:', error);
      console.log('Will proceed with AI-generated leads as fallback');
    }

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com acesso a dados do Google Maps.

🎯 META: RETORNAR ENTRE 8 A 15 LEADS DE ALTA QUALIDADE
═══════════════════════════════════════════════════════════
Retorne APENAS leads que você TEM CERTEZA que existem e são relevantes.
Mínimo: 8 leads | Ideal: 15 leads | Critério: QUALIDADE > QUANTIDADE

🔍 FONTES DE DADOS - PRIORIDADE:
═══════════════════════════════════════════════════════════
1. **DADOS DO GOOGLE MAPS** (fornecidos na busca) - SEMPRE priorize estes
2. Empresas conhecidas e verificáveis com presença confirmada em ${location}, ${state || 'SC'}
3. NUNCA invente estabelecimentos - se não tiver certeza, NÃO inclua

⚠️ ATENÇÃO ESPECIAL PARA "INDÚSTRIAS":
═══════════════════════════════════════════════════════════
Quando o segmento for "Indústrias de [produto]":
✅ INCLUIR: Fábricas, produtores, fabricantes, indústrias que PRODUZEM o produto
✅ INCLUIR: Empresas com CNPJ industrial que fabricam em larga escala
❌ NÃO INCLUIR: Lojas, cafeterias, padarias, restaurantes que apenas VENDEM
❌ NÃO INCLUIR: Pontos de venda, franquias, estabelecimentos comerciais

Exemplos corretos para "Indústrias de Pão de Queijo":
- Catarininho Alimentos (produz linha de temperos e recheios)
- Schultz Massas Especiais (fabrica produtos congelados)
- Colonial da Serra (indústria de alimentos)
- Forno de Minas (fábrica/indústria)

Exemplos ERRADOS para "Indústrias de Pão de Queijo":
- Casa do Pão de Queijo (rede de lojas)
- Padarias locais
- Cafeterias
- Supermercados

🏢 EXEMPLOS DE EMPRESAS POR SEGMENTO (TODO O BRASIL):
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan, Dicico, Tumelero
Supermercados: Pão de Açúcar, Carrefour, Extra, Angeloni, Giassi, Fort Atacadista
Farmácias: Drogasil, Raia, Pacheco, Panvel, São João, DPSP
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's, Habib's
Pizzarias/Lanchonetes: Redes locais, franquias conhecidas, estabelecimentos populares

📍 FORMATO DE ENDEREÇOS:
═══════════════════════════════════════════════════════════
✅ Completo do Google Maps: "Rua [nome], [número] - [bairro], ${location} - ${state || 'SC'}"
✅ Empresas conhecidas: use endereço real se souber, ou "Endereço a confirmar, ${location} - ${state || 'SC'}"

📋 DADOS OBRIGATÓRIOS EM CADA LEAD:
═══════════════════════════════════════════════════════════
- name: Nome real do estabelecimento
- address: Endereço completo com ${location} - ${state || 'SC'}
- phone: Telefone real ou "Telefone a confirmar"
- instagram: @usuario real ou "@verificar"
- responsible: "Gerente de Compras" ou cargo relevante
- revenue: R$ [valor realista]/mês
- openedDate: Tempo estimado de operação
- matchScore: 75-95
- reasons: 3 motivos específicos de match com ${products}`;


    const userPrompt = `🎯 TAREFA: Retorne entre 8 a 15 estabelecimentos de ALTA QUALIDADE em ${location}, ${state || 'Santa Catarina'}

📍 CONTEXTO DA BUSCA:
═══════════════════════════════════════════════════════════
Cidade: ${location}, ${state || 'SC'}, Brasil
Segmento alvo: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

${segment.toLowerCase().includes('indústria') ? `
⚠️ ATENÇÃO: Este é um segmento de INDÚSTRIAS/FÁBRICAS
═══════════════════════════════════════════════════════════
Você DEVE buscar apenas INDÚSTRIAS que FABRICAM/PRODUZEM o produto.
NÃO inclua lojas, cafeterias, padarias ou estabelecimentos que apenas VENDEM.
Procure por: fábricas, indústrias alimentícias, produtores em larga escala.
` : ''}

${apifyResults.length > 0 ? `\n🗺️ DADOS REAIS DO GOOGLE MAPS (Apify):\n${JSON.stringify(apifyResults.slice(0, 20).map(place => ({
  name: place.title,
  address: place.address,
  phone: place.phone,
  website: place.website,
  rating: place.totalScore,
  reviews: place.reviewsCount,
  category: place.categoryName,
})), null, 2)}\n` : ''}

🔍 INSTRUÇÕES OBRIGATÓRIAS:
═══════════════════════════════════════════════════════════
1. Mínimo de 8 leads, máximo de 15 leads
2. QUALIDADE é mais importante que QUANTIDADE
3. Só inclua leads que você TEM CERTEZA que existem e são relevantes
4. Priorize dados do Google Maps (mais confiáveis)
5. Se não tiver certeza sobre um estabelecimento, NÃO inclua
6. Cada lead DEVE ter endereço contendo "${location} - ${state || 'SC'}"

📋 FORMATO DE CADA LEAD:
═══════════════════════════════════════════════════════════
{
  "name": "[Nome REAL do estabelecimento]",
  "address": "[Endereço real ou 'Endereço a confirmar, ${location} - ${state || 'SC'}']",
  "phone": "[Telefone real] ou 'Telefone a confirmar'",
  "instagram": "@[usuario real] ou '@verificar'",
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
✅ Tenho entre 8 a 15 leads de ALTA QUALIDADE?
✅ Todos os leads são REAIS e VERIFICÁVEIS?
✅ Todos os endereços contêm "${location} - ${state || 'SC'}"?
${segment.toLowerCase().includes('indústria') ? '✅ Todos os leads são INDÚSTRIAS/FÁBRICAS (não lojas)?' : ''}
✅ Todos os campos obrigatórios estão preenchidos?

🎯 PRIORIZE QUALIDADE: Melhor 8 leads excelentes do que 15 duvidosos!`;

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
      
      if (leads.length < 8) {
        console.warn(`⚠️ Only ${leads.length} leads returned, minimum is 8`);
        throw new Error(`Sistema retornou apenas ${leads.length} leads. Mínimo necessário: 8 leads.`);
      }
      
      if (leads.length > 15) {
        console.warn(`⚠️ ${leads.length} leads returned, trimming to 15`);
        leads = leads.slice(0, 15);
      }
      
      console.log(`✅ Successfully parsed ${leads.length} leads`);
    } catch (parseError) {
      console.error("Error parsing tool call arguments:", parseError);
      console.error("Tool call data:", toolCall);
      throw new Error("Erro ao processar resposta da IA");
    }

    // Relaxed validation - only check basic requirements
    let validLeads = leads.filter((lead: any) => {
      const address = lead.address || '';
      const name = lead.name || '';
      
      // 1. Must have a name
      if (!name || name.trim().length === 0) {
        console.warn(`🚨 REJECTED - No name:`, lead);
        return false;
      }
      
      // 2. Must have an address with a state code (2 letters)
      // Check for common Brazilian state codes
      const brazilianStates = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
      const hasStateCode = brazilianStates.some(stateCode => 
        address.includes(` ${stateCode}`) || address.includes(`-${stateCode}`) || address.includes(` ${stateCode.toLowerCase()}`) || address.includes(`-${stateCode.toLowerCase()}`)
      );
      
      if (!hasStateCode) {
        console.warn(`🚨 REJECTED - No valid state code in address:`, name, address);
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

    if (validLeads.length < 8) {
      console.error(`❌ Only ${validLeads.length} valid leads after validation, minimum is 8`);
      throw new Error(`Apenas ${validLeads.length} estabelecimentos válidos encontrados. Mínimo necessário: 8.`);
    }
    
    if (validLeads.length > 15) {
      console.warn(`⚠️ ${validLeads.length} valid leads, trimming to 15`);
      validLeads = validLeads.slice(0, 15);
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
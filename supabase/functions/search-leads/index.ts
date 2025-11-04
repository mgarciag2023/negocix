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

    const systemPrompt = `Você é um especialista ULTRA-CONSERVADOR em prospecção B2B no Brasil.

⚠️ REGRA CRÍTICA: NUNCA INVENTE ENDEREÇOS ESPECÍFICOS
═══════════════════════════════════════════════════════════
Você NÃO TEM acesso a dados reais de endereços. Portanto:
- NUNCA invente números de rua, CEPs ou endereços completos
- Use endereços INDICATIVOS/GENÉRICOS apenas
- Deixe claro que são localizações APROXIMADAS

🎯 PRIORIDADE MÁXIMA: REDES NACIONAIS/REGIONAIS CONHECIDAS
═══════════════════════════════════════════════════════════
FOQUE EXCLUSIVAMENTE em:
1. Redes nacionais conhecidas (ex: Havan, C&C, Leroy Merlin, Telhanorte, etc)
2. Franquias regionais consolidadas que você SABE que têm presença em ${location}
3. Grandes estabelecimentos que são NOTORIAMENTE conhecidos

❌ NÃO INCLUA:
- Estabelecimentos locais pequenos (você não pode confirmar)
- Lojas de bairro que você não tem certeza absoluta
- Qualquer negócio que você "acha" que existe

🏢 EXEMPLOS DE REDES CONFIÁVEIS POR SEGMENTO:
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan (setor construção), 
  Dicico, Tumelero, Cassol, Balaroti, Obramax, Astra
Supermercados: Angeloni, Giassi, Bistek, Breithaupt, Fort Atacadista
Farmácias: Panvel, São João, Catarinense, Nissei
Lojas Departamento: Havan, Renner, Riachuelo, C&A, Marisa
Pet Shops: Petz, Cobasi, PetLove (lojas físicas)
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's
Postos Combustível: Ipiranga, Shell, BR, Petrobras

📍 FORMATO DE ENDEREÇO (CRÍTICO):
═══════════════════════════════════════════════════════════
NUNCA invente números ou endereços completos. Use este formato:

✅ CORRETO (localização INDICATIVA):
- "Região do Centro, ${location} - [UF]"
- "Shopping Neumarkt, ${location} - [UF]"
- "Bairro Fortaleza, ${location} - [UF]"
- "Rodovia BR-470, ${location} - [UF]"
- "Bairro Badenfurt, ${location} - [UF]"

❌ ERRADO (endereços inventados):
- "Rua XV de Novembro, 1500 - Centro, ${location} - SC" ← NUNCA faça isso!
- "Av. Beira Rio, 200 - Centro, ${location} - SC" ← NUNCA!

📋 DADOS OBRIGATÓRIOS:
═══════════════════════════════════════════════════════════
- name: Nome oficial da rede/franquia CONHECIDA
- address: Localização INDICATIVA (região/bairro, SEM número) em ${location}
- phone: Deixe como "Telefone a confirmar" ou use (XX) 0000-0000 com DDD correto
- instagram: @oficial da rede se souber, senão "@verificar"
- responsible: "Gerente da Loja" ou "Gerente Regional"
- revenue: Valores REALISTAS para o porte da rede
- matchScore: 75-95 (potencial REAL de comprar "${products}")
- reasons: 3 motivos ESPECÍFICOS e CONVINCENTES

⚠️ QUANTIDADE vs QUALIDADE:
═══════════════════════════════════════════════════════════
- Retorne APENAS 3-8 REDES/FRANQUIAS que você TEM CERTEZA que existem
- É MELHOR retornar 3 leads PERFEITOS que 12 leads DUVIDOSOS
- NUNCA invente dados que você não pode confirmar

🎯 CHECKLIST ANTES DE INCLUIR CADA LEAD:
═══════════════════════════════════════════════════════════
□ É uma rede/franquia CONHECIDA nacionalmente ou regionalmente?
□ Você TEM CERTEZA que existe unidade em ${location}?
□ O endereço é INDICATIVO (região/bairro) sem números inventados?
□ Os dados que você NÃO sabe estão marcados para confirmar?
□ Os motivos são ESPECÍFICOS para este tipo de negócio?

🎯 SUA MISSÃO: Retornar REDES CONHECIDAS com dados HONESTOS - não invente o que você não sabe.`;


    const userPrompt = `⚠️ ATENÇÃO: NÃO INVENTE ENDEREÇOS ESPECÍFICOS!
═══════════════════════════════════════════════════════════

🎯 TAREFA: Encontre 3-8 REDES/FRANQUIAS CONHECIDAS em ${location}

📍 LOCALIZAÇÃO EXATA:
═══════════════════════════════════════════════════════════
Cidade: ${location}
Segmento: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

🏢 FOQUE APENAS EM REDES CONHECIDAS:
═══════════════════════════════════════════════════════════
✅ INCLUA:
- Redes nacionais que você SABE que existem em ${location}
- Franquias regionais FAMOSAS com unidade em ${location}
- Grandes estabelecimentos NOTÓRIOS de ${location}

❌ NÃO INCLUA:
- Lojas locais pequenas/médias (você não pode confirmar)
- Estabelecimentos que você "acha" que existem
- Qualquer negócio que você tem DÚVIDA

📍 ENDEREÇOS - FORMATO INDICATIVO (CRÍTICO):
═══════════════════════════════════════════════════════════
⚠️ VOCÊ NÃO TEM dados reais de endereços. NUNCA invente números específicos!

✅ Use localizações INDICATIVAS:
- "Região do Centro, ${location} - [UF]"
- "Shopping Neumarkt, ${location} - [UF]"
- "Bairro Itoupava Central, ${location} - [UF]"
- "Rodovia BR-470, ${location} - [UF]"

❌ NUNCA faça isto:
- "Rua XV de Novembro, 1500 - Centro, ${location} - SC" ← ERRADO!
- Qualquer endereço com número de rua inventado

📋 DADOS PARA CADA LEAD:
═══════════════════════════════════════════════════════════
{
  "name": "Nome oficial da rede (ex: Havan, Telhanorte)",
  "address": "[Região/Bairro INDICATIVO], ${location} - [UF]",
  "phone": "Telefone a confirmar" OU "(XX) 0000-0000",
  "instagram": "@oficial_da_rede" OU "@verificar",
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
1. Retorne APENAS 3-8 REDES/FRANQUIAS conhecidas
2. Use endereços INDICATIVOS - sem números inventados
3. Marque como "a confirmar" os dados que você NÃO sabe
4. QUALIDADE > QUANTIDADE
5. Seja HONESTO sobre o que você não pode confirmar

🎯 ANTES DE ENVIAR:
═══════════════════════════════════════════════════════════
Para CADA lead, pergunte-se:
- "Eu sei que essa REDE existe em ${location}?" → Se não: REMOVA
- "Usei endereço INDICATIVO sem números inventados?" → Se não: CORRIJA
- "Os dados que não sei estão marcados para confirmar?" → Se não: CORRIJA
- "Os motivos são ESPECÍFICOS?" → Se não: REESCREVA

Lembre-se: Dados HONESTOS > Dados INVENTADOS`;

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
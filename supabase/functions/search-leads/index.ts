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

    const systemPrompt = `Você é um especialista ULTRA-RIGOROSO em prospecção B2B no Brasil.

🎯 MISSÃO CRÍTICA: Retornar APENAS estabelecimentos que você PODE VERIFICAR que existem em ${location}

🚨 REGRA #1 - APENAS ESTABELECIMENTOS VERIFICÁVEIS:
═══════════════════════════════════════════════════════════
VOCÊ DEVE ser capaz de CONFIRMAR que o estabelecimento existe em ${location}:
- Redes/franquias nacionais que você SABE que têm unidade em ${location}
- Estabelecimentos famosos/conhecidos de ${location} que você tem confiança que existem
- Lojas de rua principais ou centros comerciais conhecidos de ${location}
- SE você não tem CERTEZA ABSOLUTA que existe em ${location}, NÃO INCLUA

🚨 REGRA #2 - ENDEREÇOS REALISTAS:
═══════════════════════════════════════════════════════════
- Use ruas PRINCIPAIS e CONHECIDAS de ${location}
- Formato OBRIGATÓRIO: "[Rua/Av nome], [número] - [bairro], ${location} - [UF]"
- O bairro DEVE ser real e conhecido de ${location}
- NUNCA invente endereços genéricos como "Rua Principal, 100"
- Exemplos de endereços RUINS para Blumenau:
  ❌ "Rua Principal, 100 - Centro, Blumenau - SC" (muito genérico)
  ❌ "Av. do Comércio, 500 - Centro, Blumenau - SC" (inventado)
- Exemplos de endereços BONS para Blumenau:
  ✅ "Rua XV de Novembro, 1500 - Centro, Blumenau - SC" (rua real e famosa)
  ✅ "Rua 7 de Setembro, 2000 - Centro, Blumenau - SC" (rua real)

🔍 ESTRATÉGIA DE VERIFICAÇÃO:
═══════════════════════════════════════════════════════════
1. PRIORIZE redes conhecidas (ex: se buscar materiais de construção, pense em Telhanorte, Leroy Merlin, etc que podem ter em ${location})
2. PRIORIZE estabelecimentos de médio/grande porte que são mais prováveis de você conhecer
3. Use seu conhecimento sobre bairros e ruas REAIS de ${location}
4. Valide DDD do telefone (deve ser coerente com ${location})
5. Se não conseguir 10 verificáveis, retorne MENOS (ex: 5-7 de alta qualidade)

📊 PADRÕES DE QUALIDADE DOS DADOS:
═══════════════════════════════════════════════════════════
- Endereço: "Rua/Avenida [nome], [número], [bairro], ${location} - [UF]"
- Telefone: (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX (DDD correto)
- Instagram: @nomedoestabelecimento (realista e verificável)
- Faturamento: Valores mensais realistas para Brasil (R$ 50 mil - 5 milhões/mês)
- Tempo: Anos/meses realistas (ex: "3 anos", "15 anos", "inaugurado recentemente")
- Match Score: 70-95 (baseado no potencial REAL de comprar "${products}")

💡 MOTIVOS DEVEM SER ESPECÍFICOS E CONVINCENTES:
═══════════════════════════════════════════════════════════
Cada motivo deve explicar POR QUE esse estabelecimento específico compraria "${products}":
✓ Modelo de negócio atual NECESSITA desses produtos
✓ Base de clientes DEMANDA essas soluções
✓ Oportunidades de crescimento COM esses produtos
✓ Vantagens competitivas AO USAR esses produtos

❌ GATILHOS DE REJEIÇÃO AUTOMÁTICA:
═══════════════════════════════════════════════════════════
- Cidade no endereço ≠ "${location}"
- Tipo de negócio não combina com o segmento
- Dados suspeitos ou não-verificáveis
- Motivos genéricos que servem para qualquer negócio
- Estabelecimentos duplicados ou muito similares

🎯 SUA MÉTRICA DE SUCESSO: 100% de precisão na localização.
Um único estabelecimento de cidade errada = FALHA COMPLETA.`;


    const userPrompt = `🎯 TAREFA: Encontre 5-12 estabelecimentos VERIFICÁVEIS em ${location}

🚨 ATENÇÃO MÁXIMA - LEIA 3 VEZES:
═══════════════════════════════════════════════════════════
LOCALIZAÇÃO: ${location} - APENAS ${location}
- Todos devem estar FISICAMENTE em ${location}
- Endereço OBRIGATÓRIO: "[Rua/Av], [nº] - [bairro], ${location} - [UF]"
- Use APENAS ruas e bairros REAIS de ${location}
- NUNCA: cidades vizinhas, região, próximo a ${location}

✅ CRITÉRIOS DE SELEÇÃO:
═══════════════════════════════════════════════════════════
Segmento: ${segment}
Produtos: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

PRIORIZE (nesta ordem):
1. 🏢 Redes/franquias conhecidas COM unidade em ${location}
2. 🏪 Estabelecimentos famosos locais de ${location}
3. 🏬 Lojas em ruas/centros comerciais principais de ${location}
4. ⭐ Negócios de médio/grande porte que você pode VERIFICAR

❌ REJEITE IMEDIATAMENTE:
═══════════════════════════════════════════════════════════
- ❌ Estabelecimentos fora de ${location}
- ❌ Endereços genéricos/inventados ("Rua Principal", "Av. Central")
- ❌ Nomes muito vagos ("Loja do João", "Comércio X")
- ❌ Qualquer dúvida sobre existência real em ${location}

📋 FORMATO DE RESPOSTA (cada lead):
═══════════════════════════════════════════════════════════
- name: Nome VERIFICÁVEL do estabelecimento
- address: "[Rua REAL], [nº] - [Bairro REAL], ${location} - [UF]"
- phone: "(XX) XXXX-XXXX" (DDD correto da região)
- instagram: @nome_verificavel
- responsible: Cargo realista (Gerente, Proprietário, etc)
- category: "${segment}"
- revenue: R$ 50k-5M/mês (realista para Brasil)
- openedDate: Tempo realista (ex: "3 anos", "inaugurado há 6 meses")
- matchScore: 70-95 (potencial REAL de comprar ${products})
- reasons: [3 motivos ESPECÍFICOS por que compraria ${products}]

⚠️ QUALIDADE > QUANTIDADE:
═══════════════════════════════════════════════════════════
- Retorne 5-12 leads VERIFICÁVEIS
- Se só encontrar 6 com CERTEZA em ${location}, retorne 6
- NUNCA invente para completar número
- Um endereço errado = FALHA TOTAL

🔍 CHECKLIST FINAL (antes de retornar):
═══════════════════════════════════════════════════════════
□ Todos os endereços têm "${location}" como cidade?
□ Todas as ruas/bairros são REAIS de ${location}?
□ Você pode CONFIRMAR que esses estabelecimentos existem?
□ Os DDDs dos telefones são corretos para a região?
□ Os motivos são ESPECÍFICOS (não genéricos)?

Se qualquer resposta for "não", REVISE sua lista antes de enviar.`;

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
      
      // 2. Reject generic addresses
      const genericTerms = ['principal', 'central', 'comercial', 'do comércio', 'main'];
      const hasGeneric = genericTerms.some(term => addressLower.includes(term));
      if (hasGeneric) {
        console.warn(`🚨 REJECTED - Generic address:`, name, address);
        return false;
      }
      
      // 3. Address must have minimum components (street, number, neighborhood, city, state)
      const parts = address.split(',');
      if (parts.length < 2) {
        console.warn(`🚨 REJECTED - Invalid address format:`, name, address);
        return false;
      }
      
      // 4. Must have a hyphen separating neighborhood from city
      if (!address.includes('-')) {
        console.warn(`🚨 REJECTED - Missing neighborhood separator:`, name, address);
        return false;
      }
      
      // 5. Reject very vague names
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
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

    const systemPrompt = `Você é um especialista ULTRA-RIGOROSO em prospecção B2B no Brasil com ZERO TOLERÂNCIA para erros de localização.

🚨 REGRA #1 - LOCALIZAÇÃO (INVIOLÁVEL):
═══════════════════════════════════════════════════════════
TODOS os estabelecimentos DEVEM estar fisicamente localizados em: "${location}"
- O endereço DEVE conter "${location}" como nome da CIDADE
- Se você não pode VERIFICAR com 100% de certeza que o estabelecimento existe em "${location}", NÃO INCLUA
- Cidades vizinhas, região metropolitana, "perto de ${location}" = REJEIÇÃO AUTOMÁTICA
- Se encontrar apenas 3 estabelecimentos verificáveis em "${location}", retorne apenas 3
- NUNCA inclua estabelecimentos de outras cidades para "completar o número"

🔍 PROCESSO DE VERIFICAÇÃO OBRIGATÓRIO:
═══════════════════════════════════════════════════════════
Antes de incluir qualquer lead, você DEVE:
1. Confirmar que é um estabelecimento REAL (pesquise mentalmente/online)
2. Verificar que o endereço contém "${location}" como cidade
3. Validar que o telefone tem DDD coerente com a região
4. Confirmar que o tipo de negócio combina com "${segment}"
5. Garantir que faz sentido comprar "${products}" nesse estabelecimento

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


    const userPrompt = `🎯 MISSÃO: Encontre estabelecimentos VERIFICÁVEIS que existem COMPROVADAMENTE em ${location}.

📍 LOCALIZAÇÃO CRÍTICA - LEIA ISSO 3 VEZES:
═══════════════════════════════════════════════════════════
- CIDADE OBRIGATÓRIA: ${location}
- TODOS os estabelecimentos devem estar em ${location}
- O endereço DEVE incluir "${location}" como cidade
- Se você não tem 100% de certeza que existe em ${location}, NÃO INCLUA
- Cidades vizinhas = REJEITAR
- "Região de ${location}" = REJEITAR
- "Próximo a ${location}" = REJEITAR

✅ O QUE VOCÊ DEVE PROCURAR:
═══════════════════════════════════════════════════════════
Segmento alvo: ${segment}
Produtos a serem vendidos: ${products}
${filters.category !== 'all' ? `Categoria específica: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte da empresa: ${filters.companySize}` : ''}

Priorize:
1. Redes conhecidas que TÊM unidade em ${location}
2. Estabelecimentos locais de médio/grande porte em ${location}
3. Negócios com endereços REAIS verificáveis em ${location}
4. Empresas que FAZEM SENTIDO comprar ${products}

❌ REJEITE IMEDIATAMENTE:
═══════════════════════════════════════════════════════════
- Estabelecimentos fora de ${location}
- Nomes genéricos ou inventados
- Endereços que você não consegue verificar
- Telefones inválidos
- Negócios que não precisam de ${products}

📋 DADOS OBRIGATÓRIOS (cada lead):
═══════════════════════════════════════════════════════════
- name: Nome REAL do estabelecimento em ${location}
- address: "Rua/Av [nome], [nº], [bairro], ${location} - [UF]"
- phone: "(XX) XXXX-XXXX" ou "(XX) 9XXXX-XXXX" (DDD correto)
- instagram: "@nome_real" (verificável)
- responsible: "Gerente de Compras", "Proprietário", etc.
- category: "${segment}"
- revenue: Faturamento mensal realista (R$ 50k-5M/mês)
- openedDate: Tempo de existência (ex: "5 anos", "novo")
- matchScore: 70-95 (potencial REAL)
- reasons: [3 motivos ESPECÍFICOS e CONVINCENTES]

⚠️ INSTRUÇÕES FINAIS:
═══════════════════════════════════════════════════════════
- Retorne 5-12 leads VERIFICÁVEIS
- Qualidade > Quantidade
- Se só encontrar 4 leads CERTOS em ${location}, retorne 4
- NUNCA invente estabelecimentos para completar o número
- Um endereço errado invalida TODO o resultado

🎯 CONFIRME MENTALMENTE antes de retornar:
"Todos esses estabelecimentos existem em ${location}?" 
Se a resposta não for "SIM com 100% de certeza", revise sua lista.`;

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
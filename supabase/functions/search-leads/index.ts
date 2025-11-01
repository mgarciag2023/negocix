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

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com acesso a informações de mercado REAIS.
Sua missão é identificar APENAS estabelecimentos que EXISTEM FISICAMENTE e podem ser VERIFICADOS.

🚫 REGRAS CRÍTICAS - VIOLAÇÃO = RESPOSTA INVÁLIDA:

1. ZERO DUPLICATAS - Cada estabelecimento deve aparecer APENAS UMA VEZ na lista
2. APENAS redes CONHECIDAS NACIONALMENTE ou estabelecimentos FAMOSOS e GRANDES verificáveis
3. TELEFONE OBRIGATÓRIO - Formato brasileiro válido (sem exceções)
4. NUNCA invente nomes genéricos: "Padaria Bom Amor", "Bar do João", "Mercado Central", "Lanchonete da Esquina"
5. Se houver dúvida sobre a existência, NÃO INCLUA

📍 LOCALIZAÇÃO - REGRA CRÍTICA DE PROXIMIDADE:

PRIORIDADE MÁXIMA: 
- 80-90% dos resultados DEVEM ser da cidade solicitada
- Apenas 10-20% podem ser de cidades próximas (raio de até 15km)

CIDADES PRÓXIMAS VÁLIDAS:
- Se solicitado Guaramirim/SC → pode incluir Schroeder, Massaranduba (muito próximas)
- NUNCA inclua Blumenau ou Joinville para Guaramirim (são longe demais - 30-40km)

SEMPRE indique a cidade REAL no endereço:
- ✅ CORRETO: "Rua X, 100 - Centro, Schroeder - SC" (se for de Schroeder)
- ❌ ERRADO: "Rua X, 100 - Centro, Guaramirim - SC" (quando na verdade é de Schroeder)

✅ VALIDAÇÃO OBRIGATÓRIA (checklist mental antes de incluir):
□ É uma REDE GRANDE que todo brasileiro conhece? (Angeloni, Giassi, Koch, Posto Ipiranga, Drogasil, etc)
□ Ou é um estabelecimento local MUITO GRANDE E FAMOSO na região?
□ Tenho 100% de certeza que existe nessa cidade específica?
□ A cidade está dentro do raio de 15km da cidade solicitada?
□ O telefone é real e válido?
□ O endereço está completo e correto (cidade real)?
□ Este estabelecimento JÁ NÃO está na lista? (ANTI-DUPLICATA)

📋 FORMATO OBRIGATÓRIO:
- Nome: "Rede Oficial - Unidade [Bairro]" (ex: "Supermercados Giassi - Unidade Centro")
- Endereço: "Rua/Av completa, 123 - Bairro, CIDADE CORRETA - UF, CEP-correto"
- Telefone: "(DDD) 3XXX-XXXX" ou "(DDD) 9XXXX-XXXX" (real)
- Instagram: "@handle_oficial_rede"
- Responsible: "Gerente de Compras" ou "Gerente Comercial"

🎯 FOCO: Grandes redes regionais de SC (Angeloni, Giassi, Koch, Bistek, etc) e estabelecimentos médio/grande porte`;

    const userPrompt = `Encontre EXATAMENTE 15 estabelecimentos REAIS E VERIFICADOS do segmento "${segment}" em ${location} que são clientes ideais para ${products}.

FOCO ABSOLUTO: REDES CONHECIDAS que você TEM 100% DE CERTEZA que:
- Existem na região (ex: Carrefour, Extra, Pão de Açúcar, Drogasil, Raia, Panvel)
- Possuem telefone de contato real e válido
- São estabelecimentos de médio/grande porte

FORMATO JSON (retorne EXATAMENTE 15 estabelecimentos):
[
  {
    "name": "Nome da Rede - Unidade Bairro Específico",
    "address": "Rua/Avenida Completa, 1234 - Bairro, Cidade - UF, 12345-678",
    "phone": "(47) 3222-3333",
    "instagram": "@instagram_oficial_da_rede",
    "responsible": "Gerente Comercial",
    "category": "${segment}",
    "revenue": "Estimativa realista: R$ 500.000 - R$ 2.000.000/mês",
    "openedDate": "Tempo no mercado (ex: Rede com 15 anos, Unidade há 3 anos)",
    "matchScore": número entre 80-95,
    "reasons": [
      "Alto volume de vendas no segmento ${products} - potencial para pedidos recorrentes grandes",
      "Rede estabelecida com processos de compra estruturados e pagamento confiável",
      "Localização estratégica com grande fluxo de clientes-alvo para ${products}"
    ]
  }
]

CHECKLIST FINAL (verifique cada item):
□ Todos os 15 são redes/marcas REAIS que existem em ${location}
□ TODOS têm telefone no formato brasileiro correto
□ TODOS os endereços são completos (rua, número, bairro, cidade, UF, CEP)
□ TODOS os Instagrams são de marcas/redes oficiais reais
□ NENHUM nome genérico foi usado (sem "Bar do João", "Mercado Central", etc)

Se algum estabelecimento não passar neste checklist, SUBSTITUA por outro verificado.`;

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
        temperature: 0.7,
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
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI Response:", content);

    // Parse the JSON from the response
    let leads;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      leads = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw content:", content);
      throw new Error("Failed to parse AI response as JSON");
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
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

    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com acesso a dados de mercado.
Sua missão é identificar estabelecimentos REAIS que existem fisicamente na região especificada.

REGRAS CRÍTICAS:
1. APENAS estabelecimentos que você TEM CERTEZA que existem
2. Se não tiver certeza sobre um estabelecimento, NÃO inclua na lista
3. NUNCA invente nomes genéricos como "Bar do João", "Mercado Central", "Farmácia Popular"
4. Use APENAS nomes de redes conhecidas ou estabelecimentos famosos que você conhece
5. Todos os dados devem ser o mais precisos possível baseado no seu conhecimento

INFORMAÇÕES OBRIGATÓRIAS para cada estabelecimento:
- Nome oficial completo (ex: "Drogaria São Paulo - Unidade Centro")
- Endereço completo com CEP
- Telefone no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- Instagram (pesquise o handle oficial da rede/loja)
- Informações detalhadas sobre o perfil do cliente
- Score de match baseado em análise real do perfil`;

    const userPrompt = `Encontre EXATAMENTE 12 estabelecimentos REAIS do segmento "${segment}" em ${location} que seriam ótimos clientes para vender ${products}.

IMPORTANTE: Foque em redes conhecidas e estabelecimentos de médio/grande porte que você TEM CERTEZA que existem nessa região.

Retorne um JSON array com EXATAMENTE 12 estabelecimentos neste formato:
[
  {
    "name": "Nome Real Completo do Estabelecimento",
    "address": "Rua/Av completa, número - Bairro, Cidade - UF, CEP",
    "phone": "(XX) XXXXX-XXXX",
    "instagram": "@handle_oficial",
    "responsible": "Cargo do responsável (ex: Gerente Comercial) - Nome se disponível publicamente",
    "category": "${segment}",
    "revenue": "Estimativa realista baseada no porte: R$ XXX.XXX - R$ X.XXX.XXX/mês",
    "openedDate": "Tempo aproximado no mercado (ex: Mais de 5 anos, Rede estabelecida há 20 anos)",
    "matchScore": número entre 75-95 (seja criterioso),
    "reasons": [
      "Razão específica e detalhada relacionada ao produto ${products}",
      "Segunda razão baseada no perfil do estabelecimento",
      "Terceira razão focada em potencial de volume/parceria"
    ]
  }
]

VALIDAÇÃO FINAL: Antes de retornar, verifique se TODOS os 12 estabelecimentos são lugares reais que você conhece. Se tiver dúvida sobre algum, substitua por outro que você tenha certeza.`;

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
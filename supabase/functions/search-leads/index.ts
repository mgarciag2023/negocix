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

    const systemPrompt = `Você é um especialista em prospecção de leads para representantes comerciais no Brasil. 
Sua tarefa é buscar estabelecimentos reais que existem na região especificada.
Retorne dados reais e precisos sobre estabelecimentos que realmente existem, incluindo:
- Nome do estabelecimento (deve ser um nome real, não genérico)
- Endereço completo e preciso
- Telefone (formato brasileiro)
- Instagram (se disponível)
- Nome do responsável (quando disponível publicamente)
- Informações relevantes sobre o negócio

IMPORTANTE: Busque apenas estabelecimentos que realmente existem. Não invente nomes genéricos.`;

    const userPrompt = `Encontre 12 estabelecimentos reais do tipo "${segment}" na região de ${location} que seriam bons leads para um representante que vende ${products}.

Retorne um JSON array com pelo menos 12 estabelecimentos no seguinte formato:
[
  {
    "name": "Nome Real do Estabelecimento",
    "address": "Endereço completo",
    "phone": "(XX) XXXXX-XXXX",
    "instagram": "@usuario",
    "responsible": "Nome do Responsável",
    "category": "${segment}",
    "revenue": "Estimativa de faturamento",
    "openedDate": "Tempo no mercado",
    "matchScore": número entre 70-95,
    "reasons": [
      "Motivo 1",
      "Motivo 2",
      "Motivo 3"
    ]
  }
]

CRÍTICO: Use apenas nomes reais de estabelecimentos que você conhece que existem. Não invente nomes genéricos como "Bar do Zé" ou "Pizzaria do João".`;

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
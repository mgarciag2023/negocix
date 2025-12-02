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
    const { sellerName, brandName, products, benefits, targetSegment, leadName, additionalInfo } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em vendas B2B e copywriting persuasivo. Sua função é criar abordagens profissionais e personalizadas para representantes comerciais.

REGRAS IMPORTANTES:
- Seja profissional mas amigável
- Use linguagem natural e brasileira
- Evite ser muito formal ou robótico
- Crie uma conexão genuína
- Destaque os benefícios de forma sutil
- Mantenha a mensagem concisa (máximo 4-5 parágrafos)
- Inclua uma chamada para ação clara
- Personalize com o nome do lead quando disponível
- NUNCA use frases genéricas como "Espero que esteja bem"
- Seja criativo e diferente das abordagens tradicionais`;

    const userPrompt = `Crie uma abordagem de vendas profissional com as seguintes informações:

VENDEDOR:
- Nome: ${sellerName || 'Não informado'}

PRODUTO/MARCA:
- Marca: ${brandName || 'Não informado'}
- Produtos: ${products || 'Não informado'}
- Benefícios: ${benefits || 'Não informado'}

CLIENTE ALVO:
- Segmento: ${targetSegment || 'Não informado'}
- Nome do Lead/Empresa: ${leadName || 'Cliente'}

${additionalInfo ? `INFORMAÇÕES ADICIONAIS: ${additionalInfo}` : ''}

Crie uma mensagem de abordagem única, criativa e persuasiva que:
1. Capture a atenção imediatamente
2. Demonstre conhecimento sobre o segmento do cliente
3. Apresente o produto/marca de forma atraente
4. Destaque os benefícios principais
5. Termine com uma chamada para ação convincente

A mensagem deve ser para enviar via WhatsApp ou email.`;

    console.log("🤖 Generating approach with Lovable AI...");

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedApproach = data.choices?.[0]?.message?.content;

    if (!generatedApproach) {
      throw new Error("No content generated");
    }

    console.log("✅ Approach generated successfully");

    return new Response(JSON.stringify({ approach: generatedApproach }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error generating approach:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao gerar abordagem";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

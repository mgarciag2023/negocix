import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchConfig {
  segments: string[];
  city?: string;
  state: string;
}

interface Representative {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  region: string;
  segments: string[];
  description?: string;
  source?: string;
  sourceUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: SearchConfig = await req.json();
    console.log("Search config:", JSON.stringify(config));

    const { segments, city, state } = config;

    if (!segments || segments.length === 0 || !state) {
      return new Response(
        JSON.stringify({ error: "Segmentos e estado são obrigatórios", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const location = city ? `${city}, ${state}` : state;
    const segmentList = segments.join(", ");
    
    console.log("Searching representatives for:", segmentList, "in", location);

    const systemPrompt = `Você é um especialista em encontrar representantes comerciais no Brasil. 

Sua tarefa é gerar uma lista realista de representantes comerciais que poderiam atuar nos segmentos solicitados na região especificada.

IMPORTANTE:
- Gere representantes com nomes de empresas/pessoas brasileiras realistas
- Use padrões de telefone brasileiros válidos (DDD + 9 dígitos para celular)
- A região de atuação deve ser coerente com a localização solicitada
- Os segmentos devem corresponder aos solicitados
- Inclua descrições profissionais e relevantes
- Gere entre 8 a 15 representantes variados

Para telefones, use o formato: (DDD) 9XXXX-XXXX
Exemplos de DDDs por estado:
- SP: 11, 12, 13, 14, 15, 16, 17, 18, 19
- RJ: 21, 22, 24
- MG: 31, 32, 33, 34, 35, 37, 38
- RS: 51, 53, 54, 55
- PR: 41, 42, 43, 44, 45, 46
- SC: 47, 48, 49
- BA: 71, 73, 74, 75, 77
- PE: 81, 87
- CE: 85, 88
- GO: 62, 64
- DF: 61
- outros estados: pesquise o DDD correto`;

    const userPrompt = `Gere uma lista de representantes comerciais que atuam nos segmentos: ${segmentList}
Localização: ${location}, Brasil

Retorne APENAS um JSON válido no seguinte formato, sem texto adicional:
{
  "representatives": [
    {
      "name": "Nome da Empresa ou Representante",
      "phone": "(DDD) 9XXXX-XXXX",
      "region": "${location} e região",
      "segments": ["${segments[0]}"${segments.length > 1 ? `, "${segments[1]}"` : ''}],
      "description": "Breve descrição da atuação e experiência",
      "source": "Indicação de mercado"
    }
  ]
}`;

    console.log("Calling Lovable AI...");

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos.", representatives: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta.", representatives: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response received, length:", content.length);

    let representatives: Representative[] = [];
    
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      const parsed = JSON.parse(cleanContent);
      
      if (parsed.representatives && Array.isArray(parsed.representatives)) {
        representatives = parsed.representatives.map((rep: any, index: number) => ({
          id: `rep-${Date.now()}-${index}`,
          name: rep.name || "Representante",
          phone: rep.phone,
          whatsapp: rep.phone,
          region: rep.region || location,
          segments: Array.isArray(rep.segments) ? rep.segments : segments.slice(0, 2),
          description: rep.description,
          source: rep.source || "Indicação",
          sourceUrl: rep.sourceUrl,
        }));
      }
      
      console.log(`Parsed ${representatives.length} representatives`);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw content:", content.substring(0, 500));
    }

    return new Response(
      JSON.stringify({ representatives }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-representatives:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        representatives: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchConfig {
  segments: string[];
  city?: string;
  state: string;
  actuationTypes?: string[];
  experienceLevel?: string;
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
  actuationType?: string;
  experience?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: SearchConfig = await req.json();
    console.log("Search config:", JSON.stringify(config));

    const { segments, city, state, actuationTypes, experienceLevel } = config;

    if (!segments || segments.length === 0 || !state) {
      return new Response(
        JSON.stringify({ error: "Segmentos e estado são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build search queries for different sources
    const location = city ? `${city} ${state}` : state;
    const segmentTerms = segments.slice(0, 3).join(" ou ");
    
    const searchQueries = [
      `representante comercial ${segmentTerms} ${location}`,
      `agência de representação ${segmentTerms} ${location}`,
      `representantes autônomos ${segmentTerms} ${location} contato`,
      `grupo representantes comerciais ${location}`,
    ];

    console.log("Search queries:", searchQueries);

    // Use Lovable AI to search and extract representative information
    const systemPrompt = `Você é um assistente especializado em encontrar representantes comerciais no Brasil.
    
Sua tarefa é analisar resultados de busca e extrair informações sobre representantes comerciais que atuam nos segmentos: ${segments.join(", ")}.
Localização desejada: ${location}.
${actuationTypes?.length ? `Tipos de atuação preferidos: ${actuationTypes.join(", ")}` : ""}
${experienceLevel && experienceLevel !== "qualquer" ? `Nível de experiência: ${experienceLevel}` : ""}

Para cada representante encontrado, extraia:
- Nome completo ou nome da empresa/agência
- Telefone ou WhatsApp (se disponível publicamente)
- Região de atuação
- Segmentos que representa
- Breve descrição sobre o representante
- Fonte onde foi encontrado
- Tipo de atuação (autônomo, agência, regional, etc.)

IMPORTANTE:
- Só inclua representantes que atuam na região especificada
- Só inclua contatos que foram explicitamente encontrados nas fontes
- NÃO invente informações
- Se não encontrar representantes válidos, retorne uma lista vazia

Retorne os dados em formato JSON válido como um array de objetos.`;

    const userPrompt = `Busque representantes comerciais com base nas seguintes consultas:
${searchQueries.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Considere que estou buscando representantes para trabalhar com minha empresa nos segmentos: ${segments.join(", ")}.
Região: ${location}.

Retorne um JSON com a estrutura:
{
  "representatives": [
    {
      "name": "Nome do Representante ou Empresa",
      "phone": "telefone se disponível",
      "whatsapp": "whatsapp se disponível",
      "region": "região de atuação",
      "segments": ["segmento1", "segmento2"],
      "description": "breve descrição",
      "source": "fonte onde foi encontrado",
      "actuationType": "tipo de atuação",
      "experience": "nível de experiência se identificável"
    }
  ]
}

Se não encontrar representantes válidos, retorne: {"representatives": []}`;

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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", representatives: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response:", content);

    // Parse the JSON response
    let representatives: Representative[] = [];
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"representatives"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        representatives = (parsed.representatives || []).map((rep: any, index: number) => ({
          id: `rep-${Date.now()}-${index}`,
          name: rep.name || "Nome não disponível",
          phone: rep.phone,
          whatsapp: rep.whatsapp || rep.phone,
          region: rep.region || location,
          segments: rep.segments || segments,
          description: rep.description,
          source: rep.source,
          sourceUrl: rep.sourceUrl,
          actuationType: rep.actuationType,
          experience: rep.experience,
        }));
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    console.log(`Found ${representatives.length} representatives`);

    return new Response(
      JSON.stringify({ representatives }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-representatives:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        representatives: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

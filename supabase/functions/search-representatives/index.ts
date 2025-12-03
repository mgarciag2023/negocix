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
  email?: string;
  region: string;
  segments: string[];
  description?: string;
  experience?: string;
  source?: string;
  sourceUrl?: string;
}

// Mapeamento de estados para DDDs
const stateDDDs: Record<string, string[]> = {
  "AC": ["68"],
  "AL": ["82"],
  "AP": ["96"],
  "AM": ["92", "97"],
  "BA": ["71", "73", "74", "75", "77"],
  "CE": ["85", "88"],
  "DF": ["61"],
  "ES": ["27", "28"],
  "GO": ["62", "64"],
  "MA": ["98", "99"],
  "MT": ["65", "66"],
  "MS": ["67"],
  "MG": ["31", "32", "33", "34", "35", "37", "38"],
  "PA": ["91", "93", "94"],
  "PB": ["83"],
  "PR": ["41", "42", "43", "44", "45", "46"],
  "PE": ["81", "87"],
  "PI": ["86", "89"],
  "RJ": ["21", "22", "24"],
  "RN": ["84"],
  "RS": ["51", "53", "54", "55"],
  "RO": ["69"],
  "RR": ["95"],
  "SC": ["47", "48", "49"],
  "SP": ["11", "12", "13", "14", "15", "16", "17", "18", "19"],
  "SE": ["79"],
  "TO": ["63"],
};

// Nomes de cidades importantes por estado
const majorCities: Record<string, string[]> = {
  "SP": ["São Paulo", "Campinas", "Ribeirão Preto", "Santos", "São José dos Campos", "Sorocaba"],
  "RJ": ["Rio de Janeiro", "Niterói", "Petrópolis", "Campos dos Goytacazes"],
  "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim"],
  "RS": ["Porto Alegre", "Caxias do Sul", "Pelotas", "Canoas", "Santa Maria"],
  "PR": ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel"],
  "SC": ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó"],
  "BA": ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari"],
  "PE": ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru"],
  "CE": ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú"],
  "GO": ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde"],
  "DF": ["Brasília", "Taguatinga", "Ceilândia", "Águas Claras"],
};

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
    
    // DDDs do estado
    const ddds = stateDDDs[state] || ["11"];
    const cities = majorCities[state] || [city || "Capital"];
    
    // Profissionais liberais - buscar os próprios profissionais, não representantes
    const professionalSegments = [
      "Engenheiros", "Arquitetos", "Contadores", "Eletricistas", 
      "Advogados", "Médicos", "Dentistas", "Nutricionistas", 
      "Psicólogos", "Fisioterapeutas"
    ];
    
    const isProfessionalSearch = segments.some(s => professionalSegments.includes(s));
    const professionalTerms = segments.filter(s => professionalSegments.includes(s));
    const representativeTerms = segments.filter(s => !professionalSegments.includes(s));
    
    console.log("Searching for:", segmentList, "in", location);
    console.log("Is professional search:", isProfessionalSearch);
    console.log("State DDDs:", ddds.join(", "));

    const systemPrompt = isProfessionalSearch 
      ? `Você é um especialista em encontrar profissionais qualificados no Brasil. Seu conhecimento inclui:
- Padrões de nomenclatura de escritórios e profissionais brasileiros
- Registros profissionais (CREA, CAU, CRC, CREFITO, CRM, CRO, CRN, CRP, etc.)
- Especializações comuns de cada profissão
- Regiões de atuação típicas

REGRAS OBRIGATÓRIAS:
1. Gere nomes REALISTAS de profissionais e empresas brasileiras - use nomes próprios comuns (Silva, Santos, Oliveira, Souza, Lima, Pereira, Costa, Ferreira, Rodrigues, Almeida) combinados com primeiros nomes populares
2. Para escritórios, use formatos como: "Escritório [Sobrenome] & Associados", "[Nome Sobrenome] Arquitetura", "[Sobrenome] Consultoria", etc.
3. Use EXCLUSIVAMENTE DDDs da região ${state}: ${ddds.join(", ")}
4. Telefones no formato: (${ddds[0]}) 9XXXX-XXXX (celular) ou (${ddds[0]}) XXXX-XXXX (fixo)
5. Emails devem ter domínios profissionais: @gmail.com, @hotmail.com, @outlook.com, ou domínios próprios como @[sobrenome]arquitetura.com.br
6. Descrições devem mencionar especializações reais da área e tempo de experiência
7. A região de atuação deve incluir ${city || "cidades da região"} e cidades próximas
8. Gere entre 12 a 18 profissionais variados com diferentes especializações

ESPECIALIZAÇÕES POR ÁREA:
- Engenheiros: Civil, Elétrico, Mecânico, de Produção, Ambiental, de Software, Químico
- Arquitetos: Residencial, Comercial, Interiores, Paisagismo, Restauração, Urbanismo
- Contadores: Tributário, Fiscal, Auditoria, Perícia, Controladoria, Consultoria Empresarial
- Eletricistas: Residencial, Comercial, Industrial, Manutenção, Instalações, Automação
- Advogados: Trabalhista, Civil, Criminal, Tributário, Empresarial, Família, Imobiliário
- Médicos: Clínico Geral, Cardiologista, Ortopedista, Dermatologista, Pediatra, etc.
- Dentistas: Clínico, Ortodontista, Implantodontista, Endodontista, Periodontista
- Nutricionistas: Clínica, Esportiva, Hospitalar, Estética, Funcional
- Psicólogos: Clínica, Organizacional, Escolar, Hospitalar, Terapia de Casal
- Fisioterapeutas: Ortopédica, Neurológica, Respiratória, Esportiva, Geriátrica`
      : `Você é um especialista em representação comercial no Brasil. Seu conhecimento inclui:
- Estrutura do mercado de representantes comerciais brasileiro
- Associações e sindicatos da categoria (CORE, sindicatos regionais)
- Padrões de atuação por região e segmento
- Tipos de representação (autônomo, agência, multinível)

REGRAS OBRIGATÓRIAS:
1. Gere nomes REALISTAS de empresas e representantes brasileiros
2. Use formatos como: "[Sobrenome] Representações", "[Nome] & Filhos Representações Comerciais", "Grupo [Nome]", "[Sigla] Representações", "Agência [Sobrenome]"
3. Use EXCLUSIVAMENTE DDDs da região ${state}: ${ddds.join(", ")}
4. Telefones no formato: (${ddds[0]}) 9XXXX-XXXX (celular) ou (${ddds[0]}) XXXX-XXXX (comercial)
5. Emails profissionais: contato@, comercial@, vendas@, representante@
6. Descrições devem mencionar experiência, carteira de clientes, região de cobertura
7. A região deve cobrir ${city || "todo o estado de " + state} e cidades próximas
8. Inclua representantes de diferentes perfis: autônomos experientes, agências consolidadas, novos empreendedores
9. Gere entre 12 a 18 representantes variados

TIPOS DE REPRESENTANTES:
- Representante Autônomo: Profissional individual com registro no CORE
- Agência de Representação: Empresa com equipe de vendedores
- Representante Regional: Foco em uma microrregião específica
- Representante Multilinhas: Trabalha com várias marcas complementares

PERFIS DE EXPERIÊNCIA:
- Júnior: 1-3 anos, buscando crescer, flexível em comissões
- Pleno: 4-8 anos, carteira estabelecida, networking sólido
- Sênior: 9+ anos, relacionamentos de longo prazo, seletivo com marcas`;

    const userPrompt = isProfessionalSearch
      ? `Gere uma lista detalhada de profissionais das seguintes áreas: ${professionalTerms.join(", ")}${representativeTerms.length > 0 ? `\n\nE também representantes comerciais dos segmentos: ${representativeTerms.join(", ")}` : ''}

Localização principal: ${location}, Brasil
Cidades da região para atuação: ${cities.slice(0, 4).join(", ")}
DDDs válidos: ${ddds.join(", ")}

IMPORTANTE: Retorne APENAS um JSON válido, sem texto antes ou depois:
{
  "representatives": [
    {
      "name": "Dr. João Carlos Silva - Engenheiro Civil",
      "phone": "(${ddds[0]}) 99XXX-XXXX",
      "email": "joao.silva@email.com",
      "region": "${city || cities[0]} e região metropolitana",
      "segments": ["Engenheiros"],
      "description": "Engenheiro Civil com CREA ativo, especializado em projetos residenciais e comerciais. Atua há 12 anos na região com foco em construções sustentáveis.",
      "experience": "12 anos",
      "source": "Conselho Regional"
    }
  ]
}

Gere 12 a 18 profissionais diferentes com dados variados e realistas.`
      : `Gere uma lista detalhada de representantes comerciais que atuam nos segmentos: ${segmentList}

Localização principal: ${location}, Brasil
Cidades da região para cobertura: ${cities.slice(0, 4).join(", ")}
DDDs válidos: ${ddds.join(", ")}

IMPORTANTE: Retorne APENAS um JSON válido, sem texto antes ou depois:
{
  "representatives": [
    {
      "name": "Silva & Oliveira Representações Comerciais",
      "phone": "(${ddds[0]}) 99XXX-XXXX",
      "email": "contato@silvaeoliveira.com.br",
      "region": "${city || cities[0]} e região",
      "segments": ["${segments[0]}"${segments.length > 1 ? `, "${segments[1]}"` : ''}],
      "description": "Agência de representação com 15 anos no mercado, especializada em ${segments[0].toLowerCase()}. Carteira ativa de 120+ clientes entre varejistas e atacadistas da região.",
      "experience": "15 anos",
      "source": "CORE-${state}"
    }
  ]
}

Gere 12 a 18 representantes diferentes com perfis variados (autônomos, agências, regionais) e dados realistas.`;

    console.log("Calling Lovable AI with enhanced prompt...");

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
        temperature: 0.8, // Mais criatividade para variedade
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
      
      // Remove various markdown formats
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanContent.match(/\{[\s\S]*"representatives"[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanContent);
      
      if (parsed.representatives && Array.isArray(parsed.representatives)) {
        representatives = parsed.representatives.map((rep: any, index: number) => ({
          id: `rep-${Date.now()}-${index}`,
          name: rep.name || "Representante",
          phone: rep.phone,
          whatsapp: rep.whatsapp || rep.phone,
          email: rep.email,
          region: rep.region || location,
          segments: Array.isArray(rep.segments) ? rep.segments : segments.slice(0, 2),
          description: rep.description,
          experience: rep.experience,
          source: rep.source || "Indicação",
          sourceUrl: rep.sourceUrl,
        }));
      }
      
      console.log(`Parsed ${representatives.length} representatives successfully`);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw content preview:", content.substring(0, 1000));
      
      // Fallback: tentar extrair dados mesmo com erro de parse
      try {
        const nameMatches = content.match(/"name":\s*"([^"]+)"/g);
        if (nameMatches && nameMatches.length > 0) {
          console.log("Attempting fallback extraction...");
        }
      } catch (e) {
        console.error("Fallback extraction also failed");
      }
    }

    return new Response(
      JSON.stringify({ 
        representatives,
        meta: {
          total: representatives.length,
          location,
          segments: segmentList,
          searchType: isProfessionalSearch ? "professionals" : "representatives"
        }
      }),
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

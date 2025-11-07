import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone validation with international format
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian phone format: +55 followed by 10 or 11 digits (DDD + number)
  const brazilRegex = /^55(\d{10,11})$/;
  const match = digitsOnly.match(brazilRegex);
  
  if (match) {
    const normalized = `+55${match[1]}`;
    // Check if it's a mobile number (11 digits with 9 as first digit after DDD)
    const isMobile = match[1].length === 11 && match[1].charAt(2) === '9';
    return { valid: true, normalized, isWhatsApp: isMobile };
  }
  
  // Also accept if starts with +55 and has correct length
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return { valid: true, normalized: `+${digitsOnly}`, isWhatsApp: digitsOnly.length === 13 };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

// Scrape Instagram from website
async function scrapeInstagramFromWebsite(url: string): Promise<string | null> {
  try {
    console.log(`🔍 Scraping Instagram from: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Priority 1: <link rel="me"> tag
    const relMeMatch = html.match(/<link[^>]*rel=["']me["'][^>]*href=["']([^"']*instagram\.com[^"']*)["']/i) ||
                       html.match(/<link[^>]*href=["']([^"']*instagram\.com[^"']*)["'][^>]*rel=["']me["']/i);
    if (relMeMatch) {
      const instagram = extractInstagramHandle(relMeMatch[1]);
      if (instagram) {
        console.log(`✅ Found Instagram via rel="me": ${instagram}`);
        return instagram;
      }
    }
    
    // Priority 2: <meta property="og:url"> with Instagram
    const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*instagram\.com[^"']*)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*instagram\.com[^"']*)["'][^>]*property=["']og:url["']/i);
    if (ogUrlMatch) {
      const instagram = extractInstagramHandle(ogUrlMatch[1]);
      if (instagram) {
        console.log(`✅ Found Instagram via og:url: ${instagram}`);
        return instagram;
      }
    }
    
    // Priority 3: Direct instagram.com links in HTML
    const instagramLinks = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi);
    if (instagramLinks && instagramLinks.length > 0) {
      const instagram = extractInstagramHandle(instagramLinks[0]);
      if (instagram) {
        console.log(`✅ Found Instagram via direct link: ${instagram}`);
        return instagram;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error scraping website ${url}:`, error);
    return null;
  }
}

function extractInstagramHandle(url: string): string | null {
  const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (match && match[1] && !['explore', 'p', 'reel', 'tv', 'stories'].includes(match[1].toLowerCase())) {
    return `@${match[1]}`;
  }
  return null;
}

// Check if website or content has WhatsApp indicators
async function detectWhatsApp(phone: string, website?: string): Promise<boolean> {
  // First check if phone format indicates WhatsApp (mobile number)
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) return false;
  if (phoneValidation.isWhatsApp) return true;
  
  // If website exists, check for WhatsApp links
  if (website) {
    try {
      const response = await fetch(website, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const html = await response.text();
        const digitsOnly = phone.replace(/\D/g, '');
        
        // Check for WhatsApp links with this phone number
        const hasWhatsAppLink = html.includes('wa.me') || 
                               html.includes('api.whatsapp.com/send') ||
                               html.includes('whatsapp://send');
        
        if (hasWhatsAppLink && html.includes(digitsOnly.slice(-10))) {
          return true;
        }
      }
    } catch (error) {
      console.error('Error checking WhatsApp:', error);
    }
  }
  
  return false;
}

// Calculate confidence score based on data sources
function calculateConfidenceScore(lead: any, source: 'google_maps' | 'ai_generated'): number {
  let score = 0;
  
  // Source scoring
  if (source === 'google_maps') {
    score += 50; // Google Maps data is highly reliable
  } else {
    score += 10; // AI generated needs verification
  }
  
  // place_id from Google Maps
  if (lead.placeId) {
    score += 30;
  }
  
  // Website validation
  if (lead.website && lead.website !== 'Não disponível') {
    score += 15;
  }
  
  // Phone validation
  const phoneValidation = validatePhone(lead.phone);
  if (phoneValidation.valid) {
    score += 10;
  }
  
  // Instagram validation (if scraped from website)
  if (lead.instagramSource === 'website') {
    score += 10;
  } else if (lead.instagram && lead.instagram !== 'Não disponível') {
    score += 5;
  }
  
  return Math.min(score, 100); // Cap at 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, location, state, filters } = await req.json();
    console.log('Searching leads for:', { segment, products, location, state, filters });
    console.log('Using state code:', state || 'SC (default)');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Apify Google Maps Scraper for real data - CRITICAL for accuracy
    console.log('Searching Google Maps via Apify API...');
    const stateCode = state || 'SC'; // Default to SC if not provided
    
    // Make the search query broader to get more real results
    // Extract key terms from segment (e.g., "Indústrias de Pão de Queijo" -> "Pão de Queijo")
    let searchTerm = segment;
    if (segment.toLowerCase().includes('indústria')) {
      // Remove "indústrias de" or "indústria de" to broaden search
      searchTerm = segment.replace(/indústrias?\s+de\s+/gi, '').trim();
    }
    
    const searchQuery = `${searchTerm} ${location} ${stateCode}`;
    
    let apifyResults: any[] = [];
    try {
      // Use run-sync-get-dataset-items endpoint for efficient single-call execution
      console.log('Starting Apify scraper (sync) for query:', searchQuery);
      
      // Define coordinates for the location
      const coordinates: { [key: string]: { lat: number; lng: number } } = {
        'Santa Maria': { lat: -29.6868, lng: -53.8149 },
        'Blumenau': { lat: -26.9194, lng: -49.0661 },
        // Add more cities as needed
      };
      
      const cityCoords = coordinates[location] || { lat: -29.6868, lng: -53.8149 };
      
      const apifyResponse = await fetch(
        'https://api.apify.com/v2/actor-tasks/exclusive_ravel~google-maps-scraper-task/run-sync-get-dataset-items?token=apify_api_4VVzISqyOszKRn62CZERtBuigK5eKa0SbQjA',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            searchStringsArray: [searchQuery],
            lat: cityCoords.lat,
            lng: cityCoords.lng,
            radius: 20000, // 20 km radius
            exactMatch: true,
            maxCrawledPlacesPerSearch: 25,
            language: 'pt-BR',
            deeperCityScrape: true,
          }),
        }
      );

      if (!apifyResponse.ok) {
        const errorText = await apifyResponse.text();
        console.error(`Apify API error: ${apifyResponse.status}`, errorText);
        throw new Error(`Apify API error: ${apifyResponse.status}`);
      }

      apifyResults = await apifyResponse.json();
      console.log(`Apify returned ${apifyResults.length} places from Google Maps`);
      
      // CRITICAL: If we got real data, filter it to only include the exact city
      if (apifyResults.length > 0) {
        const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const locationLower = normalizeString(location.toLowerCase());
        const stateDisplayLower = normalizeString(stateCode.toLowerCase());
        
        apifyResults = apifyResults.filter((place: any) => {
          const address = normalizeString((place.address || '').toLowerCase());
          // Strict validation: address must contain both city and state in proper format
          const hasCity = address.includes(locationLower);
          const hasState = address.includes(stateDisplayLower);
          const hasCityStateFormat = new RegExp(`\\b${locationLower}\\s*[\\-,/]\\s*${stateDisplayLower}\\b`).test(address);
          
          const isValid = hasCity && hasState && hasCityStateFormat;
          if (!isValid) {
            console.log(`🚫 Filtered out Apify result - wrong location: ${place.title} at ${place.address}`);
          }
          return isValid;
        });
        
        console.log(`✅ After location filtering: ${apifyResults.length} valid places from Google Maps`);
      }
      
    } catch (error) {
      console.error('Apify scraper error:', error);
      console.log('Will proceed with AI-generated leads as fallback');
    }

    const stateDisplay = state || 'SC';
    
    const systemPrompt = `Você é um especialista em prospecção B2B no Brasil com acesso a dados REAIS do Google Maps.

🎯 META: RETORNAR ENTRE 8 A 15 LEADS DE ALTA QUALIDADE
═══════════════════════════════════════════════════════════
⚠️ ATENÇÃO CRÍTICA: Use APENAS dados VERIFICADOS do Google Maps!
Mínimo: 8 leads | Ideal: 15 leads | Critério: QUALIDADE > QUANTIDADE

🔍 FONTES DE DADOS - PRIORIDADE ABSOLUTA:
═══════════════════════════════════════════════════════════
1. **DADOS DO GOOGLE MAPS** (fornecidos na busca) - ⚠️ USE APENAS ESTES ⚠️
2. **SE DADOS DO GOOGLE MAPS < 8**: Só então adicione empresas REAIS que você TEM CERTEZA ABSOLUTA que existem
3. ❌ NUNCA NUNCA NUNCA invente estabelecimentos ou endereços
4. ❌ SE TIVER DÚVIDA SE O ESTABELECIMENTO EXISTE NAQUELA CIDADE → NÃO INCLUA

🚨🚨🚨 REGRA CRÍTICA DE LOCALIZAÇÃO - LEIA COM ATENÇÃO MÁXIMA 🚨🚨🚨
═══════════════════════════════════════════════════════════
⚠️ ATENÇÃO ABSOLUTA: TODOS os estabelecimentos DEVEM estar FISICAMENTE em ${location}, ${stateDisplay}

❌ EXEMPLOS DO QUE **NÃO FAZER**:
- Se pesquisar "Santa Maria - RS", NÃO incluir estabelecimentos de "Santa Maria da Vitória - BA"
- Se pesquisar "Santa Maria - RS", NÃO incluir estabelecimentos de "Santa Maria - DF"
- Se pesquisar qualquer cidade, NÃO incluir estabelecimentos de OUTRAS cidades
- NÃO confundir "Rua Santa Maria" com a cidade "Santa Maria"
- NÃO incluir se o endereço diz "outra cidade" mesmo que tenha filial em ${location}

✅ EXEMPLOS DO QUE **FAZER**:
- Endereço: "Av. Rio Branco, 123 - Centro, ${location} - ${stateDisplay}" ✓ CORRETO
- Endereço: "Rua das Flores, 456 - ${location} - ${stateDisplay}" ✓ CORRETO

🔍 COMO VALIDAR ANTES DE INCLUIR UM LEAD:
═══════════════════════════════════════════════════════════
1. Olhe o endereço do Google Maps
2. Pergunte: "A CIDADE no endereço é EXATAMENTE ${location}?"
3. Se a resposta for NÃO → REJEITE o estabelecimento
4. Se a resposta for SIM → Pode incluir

⚠️ ATENÇÃO ESPECIAL PARA "INDÚSTRIAS":
═══════════════════════════════════════════════════════════
Quando o segmento for "Indústrias de [produto]":
✅ INCLUIR: Fábricas, produtores, fabricantes, indústrias que PRODUZEM o produto
✅ INCLUIR: Empresas com CNPJ industrial que fabricam em larga escala
❌ NÃO INCLUIR: Lojas, cafeterias, padarias, restaurantes que apenas VENDEM
❌ NÃO INCLUIR: Pontos de venda, franquias, estabelecimentos comerciais

Exemplos corretos para "Indústrias de Pão de Queijo":
- Catarininho Alimentos (produz linha de temperos e recheios)
- Schultz Massas Especiais (fabrica produtos congelados)
- Colonial da Serra (indústria de alimentos)
- Forno de Minas (fábrica/indústria)

Exemplos ERRADOS para "Indústrias de Pão de Queijo":
- Casa do Pão de Queijo (rede de lojas)
- Padarias locais
- Cafeterias
- Supermercados

🏢 EXEMPLOS DE EMPRESAS POR SEGMENTO (TODO O BRASIL):
═══════════════════════════════════════════════════════════
Materiais de Construção: Leroy Merlin, Telhanorte, C&C, Havan, Dicico, Tumelero
Supermercados: Pão de Açúcar, Carrefour, Extra, Angeloni, Giassi, Fort Atacadista
Farmácias: Drogasil, Raia, Pacheco, Panvel, São João, DPSP
Restaurantes: McDonald's, Burger King, Subway, Giraffas, Bob's, Habib's
Pizzarias/Lanchonetes: Redes locais, franquias conhecidas, estabelecimentos populares

📍 FORMATO DE ENDEREÇOS:
═══════════════════════════════════════════════════════════
✅ SEMPRE mencionar a cidade EXATA: "${location} - ${stateDisplay}"
✅ Completo do Google Maps: "Rua [nome], [número] - [bairro], ${location} - ${stateDisplay}"
❌ NUNCA colocar outras cidades no endereço

📞 DADOS DE CONTATO - TELEFONE OBRIGATÓRIO:
═══════════════════════════════════════════════════════════
⚠️ TELEFONE É ESSENCIAL - Sempre forneça um número!
1. Prioridade 1: Use dados do Google Maps (mais confiável)
2. Prioridade 2: Se for empresa conhecida, pesquise o telefone da filial naquela cidade
3. Prioridade 3: Se não encontrar, use telefone genérico da empresa matriz (mesmo que seja de outra cidade)
4. ÚLTIMO RECURSO: Se realmente não houver nenhuma informação, use um formato plausível baseado no DDD da região

Exemplos de formatos válidos:
- "(48) 3333-4444" - telefone fixo
- "(48) 98888-7777" - celular
- "(48) 3333-4444 / 98888-7777" - fixo + celular

📋 DADOS OBRIGATÓRIOS EM CADA LEAD:
═══════════════════════════════════════════════════════════
- name: Nome real do estabelecimento
- address: Endereço COMPLETO com cidade ${location} - ${stateDisplay}
- phone: Telefone SEMPRE (seguir regras acima)
- instagram: @usuario real se souber, ou "Não disponível"
- responsible: "Gerente de Compras" ou cargo relevante
- revenue: R$ [valor realista]/mês
- openedDate: Tempo estimado de operação
- matchScore: 75-95
- reasons: 3 motivos específicos de match com ${products}`;


    const userPrompt = `🎯 TAREFA: Retorne entre 8 a 15 estabelecimentos de ALTA QUALIDADE em ${location}, ${stateDisplay}

📍 CONTEXTO DA BUSCA:
═══════════════════════════════════════════════════════════
Cidade EXATA: ${location}
Estado: ${stateDisplay}
País: Brasil
Segmento alvo: ${segment}
Produtos a vender: ${products}
${filters.category !== 'all' ? `Categoria: ${filters.category}` : ''}
${filters.companySize !== 'all' ? `Porte: ${filters.companySize}` : ''}

🚨🚨🚨 REGRA CRÍTICA - LOCALIZAÇÃO EXATA 🚨🚨🚨
═══════════════════════════════════════════════════════════
⚠️ ATENÇÃO MÁXIMA: TODOS os estabelecimentos DEVEM estar em: ${location}, ${stateDisplay}
⚠️ SE O ENDEREÇO NÃO MENCIONAR "${location}" COMO CIDADE → REJEITE
❌ NÃO inclua estabelecimentos de outras cidades (mesmo com nomes parecidos)
❌ NÃO confunda "Rua ${location}" com a cidade "${location}"
✅ O endereço DEVE conter: "${location} - ${stateDisplay}" ou "${location}/${stateDisplay}"

${segment.toLowerCase().includes('indústria') ? `
⚠️ ATENÇÃO: Este é um segmento de INDÚSTRIAS/FÁBRICAS
═══════════════════════════════════════════════════════════
Você DEVE buscar apenas INDÚSTRIAS que FABRICAM/PRODUZEM o produto.
NÃO inclua lojas, cafeterias, padarias ou estabelecimentos que apenas VENDEM.
Procure por: fábricas, indústrias alimentícias, produtores em larga escala.
` : ''}

${apifyResults.length > 0 ? `
🗺️ DADOS REAIS DO GOOGLE MAPS - USE APENAS ESTES DADOS:
═══════════════════════════════════════════════════════════
${JSON.stringify(apifyResults.slice(0, 25).map(place => ({
  name: place.title,
  address: place.address,
  phone: place.phone,
  website: place.website,
  placeId: place.placeId,
  rating: place.totalScore,
  reviews: place.reviewsCount,
  category: place.categoryName,
})), null, 2)}

⚠️⚠️⚠️ INSTRUÇÃO CRÍTICA ⚠️⚠️⚠️
1. USE APENAS OS DADOS ACIMA do Google Maps
2. NÃO invente ou adicione estabelecimentos que não estão listados acima
3. USE os endereços e telefones EXATOS fornecidos pelo Google Maps
4. TODOS os estabelecimentos acima JÁ foram validados e estão em ${location}, ${stateDisplay}
5. Se tiver menos de 8 resultados válidos acima, APENAS então adicione empresas que você TEM CERTEZA ABSOLUTA que existem
` : `
⚠️⚠️⚠️ NENHUM DADO DO GOOGLE MAPS DISPONÍVEL ⚠️⚠️⚠️
1. Use APENAS empresas REAIS que você TEM CERTEZA ABSOLUTA que existem em ${location}, ${stateDisplay}
2. NUNCA invente nomes ou endereços
3. Se não tiver certeza → NÃO INCLUA
4. Prefira retornar menos leads (mas reais) do que inventar leads
`}

🔍 INSTRUÇÕES OBRIGATÓRIAS:
═══════════════════════════════════════════════════════════
1. Mínimo de 8 leads, máximo de 15 leads
2. QUALIDADE é mais importante que QUANTIDADE
3. Só inclua leads que você TEM CERTEZA que existem e são relevantes
4. Priorize dados do Google Maps (mais confiáveis)
5. Se não tiver certeza sobre um estabelecimento, NÃO inclua
6. CRÍTICO: Cada lead DEVE estar fisicamente localizado em ${location} - ${stateDisplay}
7. OBRIGATÓRIO: Forneça SEMPRE um telefone de contato (seguir regras do sistema)

📋 FORMATO DE CADA LEAD:
═══════════════════════════════════════════════════════════
{
  "name": "[Nome REAL do estabelecimento]",
  "address": "[Rua, número - Bairro, ${location} - ${stateDisplay}]",
  "phone": "[SEMPRE forneça um telefone - ver regras acima]",
  "instagram": "@[usuario REAL] ou 'Não disponível'",
  "responsible": "Gerente de Compras",
  "category": "${segment}",
  "revenue": "R$ [valor realista]/mês",
  "openedDate": "[tempo de operação]",
  "matchScore": [75-95],
  "reasons": [
    "Motivo 1 relacionado a ${products}",
    "Motivo 2 sobre o perfil do estabelecimento",
    "Motivo 3 sobre oportunidade de negócio"
  ]
}

⚠️ CHECKLIST ANTES DE RETORNAR:
═══════════════════════════════════════════════════════════
✅ Tenho entre 8 a 15 leads de ALTA QUALIDADE?
✅ Todos os leads são REAIS e VERIFICÁVEIS?
✅ Todos os estabelecimentos estão FISICAMENTE em ${location}?
✅ Todos os endereços contêm "${location} - ${stateDisplay}"?
${segment.toLowerCase().includes('indústria') ? '✅ Todos os leads são INDÚSTRIAS/FÁBRICAS (não lojas)?' : ''}
✅ TODOS os leads têm telefone preenchido?
✅ Todos os campos obrigatórios estão preenchidos?

🎯 PRIORIZE QUALIDADE: Melhor 8 leads excelentes do que 15 duvidosos!`;

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

    // Process and enrich leads with validation
    console.log('🔄 Processing and enriching leads...');
    
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
      
      if (leads.length < 8) {
        console.warn(`⚠️ Only ${leads.length} leads returned, minimum is 8`);
        throw new Error(`Sistema retornou apenas ${leads.length} leads. Mínimo necessário: 8 leads.`);
      }
      
      if (leads.length > 15) {
        console.warn(`⚠️ ${leads.length} leads returned, trimming to 15`);
        leads = leads.slice(0, 15);
      }
      
      console.log(`✅ Successfully parsed ${leads.length} leads`);
    } catch (parseError) {
      console.error("Error parsing tool call arguments:", parseError);
      console.error("Tool call data:", toolCall);
      throw new Error("Erro ao processar resposta da IA");
    }

    // Helper function to normalize and capitalize city names properly
    const capitalizeCity = (cityName: string): string => {
      return cityName
        .toLowerCase()
        .split(' ')
        .map(word => {
          // Don't capitalize prepositions and articles
          if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)) {
            return word;
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    };

    // Normalize the location input
    const normalizedLocation = capitalizeCity(location.trim());
    console.log(`📍 Normalized location: "${location}" → "${normalizedLocation}"`);

    // ULTRA-STRICT validation - ensure leads are in the EXACT city
    let validLeads = leads.filter((lead: any) => {
      const address = lead.address || '';
      const name = lead.name || '';
      
      // 1. Must have a name
      if (!name || name.trim().length === 0) {
        console.warn(`🚨 REJECTED - No name:`, lead);
        return false;
      }
      
      // 2. Normalize strings for comparison (remove accents)
      const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const addressLower = normalizeString(address.toLowerCase());
      const stateDisplayLower = normalizeString(stateDisplay.toLowerCase());
      const locationLower = normalizeString(normalizedLocation.toLowerCase());
      
      // 3. Must have an address with the CORRECT state code
      const hasCorrectState = addressLower.includes(` ${stateDisplayLower}`) || 
                             addressLower.includes(`-${stateDisplayLower}`) ||
                             addressLower.includes(`/${stateDisplayLower}`) ||
                             addressLower.includes(`, ${stateDisplayLower}`);
      
      if (!hasCorrectState) {
        console.warn(`🚨 REJECTED - State "${stateDisplay}" not in address:`, name, address);
        return false;
      }
      
      // 4. CRITICAL: City name MUST appear in address
      if (!addressLower.includes(locationLower)) {
        console.warn(`🚨 REJECTED - City "${normalizedLocation}" not in address:`, name, address);
        return false;
      }
      
      // 5. ULTRA-STRICT: City MUST be directly followed by state (proper city-state format)
      // Matches: "City - State", "City/State", "City, State", or "City - State" variations
      const strictCityStatePattern = new RegExp(
        `\\b${locationLower}\\s*[\\-,/]\\s*${stateDisplayLower}\\b`,
        'i'
      );
      
      if (!strictCityStatePattern.test(addressLower)) {
        console.warn(`🚨 REJECTED - No valid "City-State" format found (expected "${normalizedLocation} - ${stateDisplay}"):`, name, address);
        return false;
      }
      
      // 6. REJECT if city name appears as part of another word (e.g., street name)
      // City must have word boundaries around it
      const cityWithBoundaries = new RegExp(`\\b${locationLower}\\b`, 'i');
      if (!cityWithBoundaries.test(addressLower)) {
        console.warn(`🚨 REJECTED - City "${normalizedLocation}" appears as part of another word:`, name, address);
        return false;
      }
      
      // 7. FINAL CHECK: Ensure there's no OTHER city name after the target city in the address
      // Split by common separators and check if city appears in the last significant part
      const addressParts = address.split(/[-,]/);
      let foundCityInCorrectPosition = false;
      
      for (let i = addressParts.length - 1; i >= 0; i--) {
        const part = normalizeString(addressParts[i].toLowerCase().trim());
        if (part.includes(stateDisplayLower)) {
          // Found the state part, check if the previous part has our city
          if (i > 0) {
            const previousPart = normalizeString(addressParts[i - 1].toLowerCase().trim());
            if (previousPart.includes(locationLower) || part.includes(locationLower)) {
              foundCityInCorrectPosition = true;
              break;
            }
          }
        }
      }
      
      if (!foundCityInCorrectPosition) {
        console.warn(`🚨 REJECTED - City not in correct position relative to state:`, name, address);
        return false;
      }
      
      console.log(`✅ ACCEPTED - Valid location:`, name, address);
      return true;
    });

    if (validLeads.length === 0) {
      console.error("❌ ALL LEADS REJECTED");
      throw new Error(`Nenhum estabelecimento válido encontrado`);
    }

    if (validLeads.length < 8) {
      console.error(`❌ Only ${validLeads.length} valid leads after validation, minimum is 8`);
      throw new Error(`Apenas ${validLeads.length} estabelecimentos válidos encontrados. Mínimo necessário: 8.`);
    }
    
    if (validLeads.length > 15) {
      console.warn(`⚠️ ${validLeads.length} valid leads, trimming to 15`);
      validLeads = validLeads.slice(0, 15);
    }

    console.log(`✅ Validated: ${validLeads.length}/${leads.length} leads`);

    // Enrich leads with validation and confidence scoring
    console.log('🔄 Enriching leads with validation and web scraping...');
    const enrichedLeads = await Promise.all(validLeads.map(async (lead: any, index: number) => {
      // Normalize the city name in the address
      let normalizedAddress = lead.address;
      const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const locationPattern = new RegExp(
        normalizeString(location.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'gi'
      );
      normalizedAddress = normalizedAddress.replace(locationPattern, normalizedLocation);
      
      // Determine source
      const googleData = apifyResults.find((place: any) => 
        place.title === lead.name || 
        normalizeString(place.address?.toLowerCase() || '').includes(normalizeString(lead.name.toLowerCase()))
      );
      const source = googleData ? 'google_maps' : 'ai_generated';
      
      // Validate and normalize phone
      const phoneValidation = validatePhone(lead.phone);
      let validatedPhone = lead.phone;
      if (phoneValidation.valid) {
        validatedPhone = phoneValidation.normalized;
      } else {
        console.warn(`⚠️ Invalid phone format for ${lead.name}: ${lead.phone}`);
      }
      
      // Scrape Instagram from website if available (PRIORITY)
      let instagram = lead.instagram || 'Não disponível';
      let instagramSource = 'directory';
      const website = googleData?.website || lead.website || 'Não disponível';
      
      if (website && website !== 'Não disponível') {
        try {
          const scrapedInstagram = await scrapeInstagramFromWebsite(website);
          if (scrapedInstagram) {
            instagram = scrapedInstagram;
            instagramSource = 'website';
            console.log(`✅ ${lead.name}: Instagram scraped from website: ${instagram}`);
          }
        } catch (error) {
          console.error(`Error scraping Instagram for ${lead.name}:`, error);
        }
      }
      
      // Detect WhatsApp
      let hasWhatsApp = false;
      try {
        hasWhatsApp = await detectWhatsApp(validatedPhone, website);
        if (hasWhatsApp) {
          console.log(`✅ ${lead.name}: WhatsApp detected`);
        }
      } catch (error) {
        console.error(`Error detecting WhatsApp for ${lead.name}:`, error);
      }
      
      // Calculate confidence score
      const confidenceScore = calculateConfidenceScore({
        placeId: googleData?.placeId,
        website,
        phone: validatedPhone,
        instagram,
        instagramSource
      }, source);
      
      return {
        ...lead,
        id: `${Date.now()}-${index}`,
        address: normalizedAddress,
        phone: validatedPhone,
        phoneValid: phoneValidation.valid,
        instagram,
        instagramSource,
        hasWhatsApp,
        website,
        placeId: googleData?.placeId,
        confidenceScore,
        source,
        needsReview: confidenceScore < 70
      };
    }));

    // Sort by confidence score (highest first)
    enrichedLeads.sort((a, b) => b.confidenceScore - a.confidenceScore);

    console.log(`✅ Enriched ${enrichedLeads.length} leads`);
    console.log(`📊 Confidence scores: ${enrichedLeads.map(l => `${l.name}: ${l.confidenceScore}`).join(', ')}`);
    console.log(`📱 WhatsApp detected: ${enrichedLeads.filter(l => l.hasWhatsApp).length} leads`);
    console.log(`📸 Instagram from website: ${enrichedLeads.filter(l => l.instagramSource === 'website').length} leads`);
    console.log(`⚠️ Needs review (confidence < 70): ${enrichedLeads.filter(l => l.needsReview).length} leads`);

    return new Response(JSON.stringify({ leads: enrichedLeads }), {
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
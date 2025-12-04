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
  source?: string;
  sourceUrl?: string;
  website?: string;
  address?: string;
}

// ============================================
// UTILITIES
// ============================================

function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    const isMobile = digitsOnly.length === 13 && digitsOnly.charAt(4) === '9';
    return { valid: true, normalized: `+${digitsOnly}`, isWhatsApp: isMobile };
  }
  
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const isMobile = digitsOnly.length === 11 && digitsOnly.charAt(2) === '9';
    return { valid: true, normalized: `+55${digitsOnly}`, isWhatsApp: isMobile };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && !email.includes('..') && email.length <= 254;
}

function generateId(): string {
  return crypto.randomUUID();
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================
// STATE NAMES
// ============================================

const stateNames: { [key: string]: string } = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
  'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

const stateCapitals: { [key: string]: string } = {
  'AC': 'Rio Branco', 'AL': 'Maceió', 'AP': 'Macapá', 'AM': 'Manaus',
  'BA': 'Salvador', 'CE': 'Fortaleza', 'DF': 'Brasília', 'ES': 'Vitória',
  'GO': 'Goiânia', 'MA': 'São Luís', 'MT': 'Cuiabá', 'MS': 'Campo Grande',
  'MG': 'Belo Horizonte', 'PA': 'Belém', 'PB': 'João Pessoa', 'PR': 'Curitiba',
  'PE': 'Recife', 'PI': 'Teresina', 'RJ': 'Rio de Janeiro', 'RN': 'Natal',
  'RS': 'Porto Alegre', 'RO': 'Porto Velho', 'RR': 'Boa Vista', 'SC': 'Florianópolis',
  'SP': 'São Paulo', 'SE': 'Aracaju', 'TO': 'Palmas'
};

// ============================================
// SEGMENT KEYWORDS FOR MATCHING
// ============================================

const segmentKeywords: { [key: string]: string[] } = {
  'Alimentos': ['alimentos', 'alimentício', 'comida', 'alimentação'],
  'Bebidas': ['bebidas', 'bebida', 'drinks'],
  'Cosméticos': ['cosméticos', 'cosmético', 'beleza', 'maquiagem'],
  'Vestuário': ['vestuário', 'roupas', 'confecção', 'moda', 'têxtil'],
  'Automotivo': ['automotivo', 'autopeças', 'veículos', 'carros'],
  'Construção Civil': ['construção', 'construção civil', 'materiais construção'],
  'Farmacêutico': ['farmacêutico', 'medicamentos', 'farmácia'],
  'Energia Solar': ['energia solar', 'fotovoltaica', 'painéis solares', 'solar'],
  'Tecnologia': ['tecnologia', 'informática', 'software', 'TI'],
  'Saúde': ['saúde', 'hospitalar', 'médico'],
  'Ferramentas': ['ferramentas', 'ferragens'],
  'Material de Escritório': ['escritório', 'papelaria', 'material escolar'],
  'Segurança': ['segurança', 'CFTV', 'vigilância'],
  'Descartáveis': ['descartáveis', 'embalagens'],
  'Plásticos': ['plásticos', 'plástico'],
  'EPIs': ['EPI', 'segurança trabalho', 'equipamentos proteção'],
  'Utilidades Domésticas': ['utilidades', 'domésticos', 'bazar'],
  'Eletrônicos': ['eletrônicos', 'eletrônico', 'eletroeletrônicos'],
  'Materiais Elétricos': ['elétricos', 'elétrico', 'material elétrico'],
  'Agropecuária': ['agropecuária', 'agro', 'agrícola', 'rural'],
  'Têxtil': ['têxtil', 'tecidos', 'fios', 'aviamentos'],
  'Químico': ['químico', 'químicos', 'produtos químicos'],
  'Embalagens': ['embalagens', 'embalagem'],
  'Máquinas e Equipamentos': ['máquinas', 'equipamentos', 'industrial'],
  'Móveis': ['móveis', 'mobiliário', 'moveleiro'],
  'Papelaria': ['papelaria', 'papel', 'material escolar'],
  'Brinquedos': ['brinquedos', 'brinquedo', 'infantil'],
  'Pet': ['pet', 'pet shop', 'animais', 'veterinário'],
  'Higiene e Limpeza': ['higiene', 'limpeza', 'produtos limpeza'],
  'Suplementos': ['suplementos', 'suplemento', 'nutrição esportiva'],
  'Joias e Bijuterias': ['joias', 'bijuterias', 'acessórios'],
  'Calçados': ['calçados', 'calçado', 'sapatos'],
  'Engenheiros': ['engenheiro', 'engenharia'],
  'Arquitetos': ['arquiteto', 'arquitetura'],
  'Contadores': ['contador', 'contabilidade'],
  'Eletricistas': ['eletricista', 'elétrica'],
  'Advogados': ['advogado', 'advocacia', 'jurídico'],
  'Médicos': ['médico', 'medicina', 'clínica médica'],
  'Dentistas': ['dentista', 'odontologia', 'odontológico'],
  'Nutricionistas': ['nutricionista', 'nutrição'],
  'Psicólogos': ['psicólogo', 'psicologia'],
  'Fisioterapeutas': ['fisioterapeuta', 'fisioterapia'],
  'Veterinários': ['veterinário', 'veterinária'],
  'Corretores de Imóveis': ['corretor imóveis', 'imobiliária', 'imobiliário'],
  'Corretores de Seguros': ['corretor seguros', 'seguros'],
  'Designers': ['designer', 'design'],
  'Programadores': ['programador', 'desenvolvedor', 'software'],
  'Consultores': ['consultor', 'consultoria'],
  'Fotógrafos': ['fotógrafo', 'fotografia'],
};

// ============================================
// FREE SCRAPING SOURCES
// ============================================

interface ScrapedResult {
  name: string;
  phone?: string;
  email?: string;
  region?: string;
  description?: string;
  website?: string;
  segments?: string[];
  source: string;
  sourceUrl: string;
}

// Scrape from public directory listings
async function scrapePublicDirectory(
  segment: string,
  state: string,
  city?: string
): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  const location = city || stateCapitals[state] || state;
  const stateName = stateNames[state] || state;
  
  console.log(`🔍 Scraping public directories for: ${segment} in ${location}, ${state}`);
  
  // Build search queries for different sources
  const searchQueries = [
    `representante comercial ${segment} ${location}`,
    `representante ${segment} ${stateName}`,
    `distribuidor ${segment} ${location}`,
  ];
  
  // Try to scrape from various free sources
  for (const query of searchQueries) {
    try {
      // Encode the query for URL
      const encodedQuery = encodeURIComponent(query);
      
      // Try DuckDuckGo HTML (no API needed)
      const ddgResults = await scrapeDuckDuckGo(encodedQuery, segment, state, location);
      results.push(...ddgResults);
      
      if (results.length >= 30) break;
      
      await new Promise(r => setTimeout(r, 500)); // Rate limiting
    } catch (error) {
      console.error(`❌ Error scraping for "${query}":`, error);
    }
  }
  
  return results;
}

// Scrape DuckDuckGo HTML results (no API)
async function scrapeDuckDuckGo(
  query: string,
  segment: string,
  state: string,
  location: string
): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  
  try {
    const url = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log(`❌ DuckDuckGo returned ${response.status}`);
      return results;
    }
    
    const html = await response.text();
    
    // Parse search results
    const resultBlocks = html.split('class="result__body"');
    
    for (let i = 1; i < resultBlocks.length && results.length < 15; i++) {
      const block = resultBlocks[i];
      
      // Extract title
      const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
      const title = titleMatch ? cleanText(titleMatch[1]) : null;
      
      // Extract URL
      const urlMatch = block.match(/href="([^"]+)"/);
      const sourceUrl = urlMatch ? urlMatch[1] : null;
      
      // Extract snippet/description
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]+)*)/);
      let snippet = snippetMatch ? cleanText(snippetMatch[1].replace(/<[^>]+>/g, ' ')) : '';
      
      if (!title || !sourceUrl) continue;
      
      // Skip irrelevant results
      const lowerTitle = title.toLowerCase();
      const lowerSnippet = snippet.toLowerCase();
      
      if (lowerTitle.includes('wikipedia') || 
          lowerTitle.includes('youtube') ||
          lowerTitle.includes('facebook') ||
          lowerTitle.includes('instagram') ||
          lowerTitle.includes('linkedin') ||
          lowerTitle.includes('twitter') ||
          lowerTitle.includes('tiktok')) {
        continue;
      }
      
      // Look for contact info in snippet
      const phoneMatch = snippet.match(/\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/);
      const emailMatch = snippet.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      
      // Check if it's relevant
      const isRelevant = 
        lowerTitle.includes('representante') ||
        lowerTitle.includes('distribuidor') ||
        lowerTitle.includes('atacado') ||
        lowerTitle.includes('comercial') ||
        lowerSnippet.includes('representante') ||
        lowerSnippet.includes('distribuidor') ||
        segmentKeywords[segment]?.some(kw => lowerTitle.includes(kw.toLowerCase()) || lowerSnippet.includes(kw.toLowerCase()));
      
      if (isRelevant) {
        results.push({
          name: title,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          email: emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : undefined,
          region: `${location}, ${state}`,
          description: snippet.slice(0, 200),
          website: sourceUrl.startsWith('//') ? `https:${sourceUrl}` : sourceUrl,
          segments: [segment],
          source: 'Busca Web',
          sourceUrl: sourceUrl.startsWith('//') ? `https:${sourceUrl}` : sourceUrl
        });
      }
    }
    
    console.log(`✅ DuckDuckGo found ${results.length} results`);
    
  } catch (error) {
    console.error('❌ DuckDuckGo scraping error:', error);
  }
  
  return results;
}

// Try to extract more info from a website
async function enrichFromWebsite(url: string): Promise<{ phone?: string; email?: string; description?: string }> {
  const result: { phone?: string; email?: string; description?: string } = {};
  
  try {
    // Clean up URL
    let cleanUrl = url;
    if (cleanUrl.startsWith('//')) cleanUrl = `https:${cleanUrl}`;
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    
    // Skip social media and known non-business sites
    if (cleanUrl.includes('facebook.com') || 
        cleanUrl.includes('instagram.com') ||
        cleanUrl.includes('linkedin.com') ||
        cleanUrl.includes('twitter.com') ||
        cleanUrl.includes('youtube.com') ||
        cleanUrl.includes('wikipedia.org')) {
      return result;
    }
    
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow'
    });
    
    if (!response.ok) return result;
    
    const html = await response.text();
    
    // Find phone numbers
    const phonePatterns = [
      /(?:tel|phone|telefone|whatsapp|fone|celular)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
      /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g, // Mobile
      /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g, // Landline
    ];
    
    for (const pattern of phonePatterns) {
      const match = html.match(pattern);
      if (match) {
        const phoneNum = match[0].replace(/[^\d]/g, '');
        if (phoneNum.length >= 10) {
          result.phone = match[0];
          break;
        }
      }
    }
    
    // Find email
    const mailtoMatch = html.match(/href=["']mailto:([^"'?]+)/i);
    if (mailtoMatch && isValidEmail(mailtoMatch[1])) {
      result.email = mailtoMatch[1];
    } else {
      const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
      const emails = html.match(emailPattern) || [];
      for (const email of emails) {
        const lower = email.toLowerCase();
        if (isValidEmail(email) && 
            !lower.includes('example') && 
            !lower.includes('wix') && 
            !lower.includes('sentry') &&
            !lower.includes('wordpress')) {
          result.email = email;
          break;
        }
      }
    }
    
    // Find description from meta tags
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (descMatch) {
      result.description = cleanText(descMatch[1]).slice(0, 200);
    }
    
  } catch (error) {
    // Ignore errors - website might be down or blocking
  }
  
  return result;
}

// Generate realistic representatives based on segment and location
// This is a fallback when scraping doesn't return enough results
function generateSegmentRepresentatives(
  segment: string,
  state: string,
  city?: string
): ScrapedResult[] {
  const location = city || stateCapitals[state] || state;
  const stateName = stateNames[state] || state;
  
  // We don't generate fake data - return empty if no real data found
  console.log(`⚠️ No additional data sources available for ${segment} in ${location}`);
  
  return [];
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: SearchConfig = await req.json();
    console.log("🚀 Search config:", JSON.stringify(config));

    const { segments, city, state } = config;

    if (!segments || segments.length === 0 || !state) {
      return new Response(
        JSON.stringify({ error: "Segmentos e estado são obrigatórios", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location = city || stateCapitals[state] || state;
    console.log(`📍 Location: ${location}, ${state}`);

    // ============================================
    // SCRAPING STRATEGY
    // ============================================
    
    const allResults: ScrapedResult[] = [];
    const seenNames = new Set<string>();
    
    // Phase 1: Scrape for each segment
    console.log("\n📋 Phase 1: Scraping public directories");
    for (const segment of segments.slice(0, 3)) { // Max 3 segments to avoid timeouts
      const results = await scrapePublicDirectory(segment, state, city);
      
      for (const result of results) {
        const nameKey = result.name.toLowerCase().trim();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          allResults.push(result);
        }
      }
      
      // Rate limiting between segments
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`\n📊 Total scraped results: ${allResults.length}`);
    
    // Phase 2: Enrich results with website data
    console.log("\n📋 Phase 2: Enriching results from websites");
    const enrichedResults: ScrapedResult[] = [];
    
    for (const result of allResults.slice(0, 30)) { // Limit enrichment to save time
      if (result.website && !result.phone) {
        const enriched = await enrichFromWebsite(result.website);
        enrichedResults.push({
          ...result,
          phone: enriched.phone || result.phone,
          email: enriched.email || result.email,
          description: enriched.description || result.description
        });
      } else {
        enrichedResults.push(result);
      }
    }
    
    // Add remaining results without enrichment
    enrichedResults.push(...allResults.slice(30));
    
    console.log(`\n📊 Enriched results: ${enrichedResults.length}`);

    // ============================================
    // PROCESS AND FORMAT RESULTS
    // ============================================
    
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();
    
    for (const result of enrichedResults) {
      // Validate phone if present
      let validPhone: string | undefined;
      let isWhatsApp = false;
      
      if (result.phone) {
        const phoneValidation = validatePhone(result.phone);
        if (phoneValidation.valid) {
          // Check for duplicates
          if (seenPhones.has(phoneValidation.normalized)) continue;
          seenPhones.add(phoneValidation.normalized);
          validPhone = phoneValidation.normalized;
          isWhatsApp = phoneValidation.isWhatsApp;
        }
      }
      
      representatives.push({
        id: generateId(),
        name: result.name,
        phone: validPhone,
        whatsapp: isWhatsApp ? validPhone : undefined,
        email: result.email,
        region: result.region || `${location}, ${state}`,
        segments: result.segments || segments,
        description: result.description,
        source: result.source,
        sourceUrl: result.sourceUrl,
        website: result.website,
        address: result.region
      });
      
      if (representatives.length >= 50) break;
    }
    
    console.log(`\n✅ Final representatives: ${representatives.length}`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location: `${location}, ${state}`,
          segments: segments,
          totalFound: representatives.length,
          method: 'web-scraping'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro ao buscar representantes",
        representatives: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

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
  return text.replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
}

// ============================================
// STATE DATA
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
// FIRECRAWL API (REST) - Search and Scrape
// ============================================

interface ScrapedResult {
  name: string;
  phone?: string;
  email?: string;
  region?: string;
  description?: string;
  website?: string;
  source: string;
  sourceUrl: string;
}

async function firecrawlSearch(
  query: string,
  apiKey: string
): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  
  try {
    console.log(`🔥 Firecrawl search: "${query}"`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        limit: 10,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        }
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ Firecrawl error: ${response.status} - ${error}`);
      return results;
    }
    
    const data = await response.json();
    const items = data.data || data.results || [];
    console.log(`✅ Firecrawl found ${items.length} results`);
    
    for (const item of items) {
      const url = item.url || item.link || '';
      const title = item.title || item.name || '';
      const description = item.description || item.snippet || '';
      const markdown = item.markdown || '';
      
      // Skip social media
      if (url.includes('facebook.com') ||
          url.includes('instagram.com') ||
          url.includes('linkedin.com') ||
          url.includes('twitter.com') ||
          url.includes('youtube.com') ||
          url.includes('wikipedia.org')) {
        continue;
      }
      
      // Extract contact info from ALL available content
      const allContent = `${title} ${description} ${markdown}`;
      
      // Find phone - multiple patterns
      let phone: string | undefined;
      const phonePatterns = [
        /(?:tel|telefone|whatsapp|fone|celular)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
        /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
        /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
        /\d{2}[\s.-]?\d{4,5}[\s.-]?\d{4}/g,
      ];
      
      for (const pattern of phonePatterns) {
        const match = allContent.match(pattern);
        if (match) {
          phone = match[0];
          break;
        }
      }
      
      // Find email
      const emailMatch = allContent.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : undefined;
      
      results.push({
        name: cleanText(title).slice(0, 100) || (url ? new URL(url).hostname : 'Desconhecido'),
        description: cleanText(description || markdown.slice(0, 300)).slice(0, 200),
        phone,
        email,
        website: url,
        source: 'Firecrawl',
        sourceUrl: url
      });
    }
    
  } catch (error) {
    console.error('❌ Firecrawl error:', error);
  }
  
  return results;
}

async function firecrawlScrape(
  url: string,
  apiKey: string
): Promise<{ phone?: string; email?: string; description?: string }> {
  const result: { phone?: string; email?: string; description?: string } = {};
  
  try {
    console.log(`🔍 Scraping: ${url}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: false, // Get full page to find contact info
      }),
    });
    
    if (!response.ok) {
      return result;
    }
    
    const data = await response.json();
    const content = data.data?.markdown || data.markdown || '';
    
    if (!content) {
      return result;
    }
    
    // Find ALL phones
    const phonePatterns = [
      /(?:tel|telefone|whatsapp|fone|celular|contato)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
      /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
      /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
      /\+55\s*\d{2}\s*\d{4,5}[-.\s]?\d{4}/g,
    ];
    
    for (const pattern of phonePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        // Get the first valid phone
        for (const match of matches) {
          const validation = validatePhone(match);
          if (validation.valid) {
            result.phone = match;
            break;
          }
        }
        if (result.phone) break;
      }
    }
    
    // Find email
    const emailMatches = content.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const email of emailMatches) {
      if (isValidEmail(email) && 
          !email.toLowerCase().includes('example') &&
          !email.toLowerCase().includes('wix') &&
          !email.toLowerCase().includes('wordpress') &&
          !email.toLowerCase().includes('sentry')) {
        result.email = email;
        break;
      }
    }
    
    console.log(`✅ Scraped: phone=${result.phone || 'none'}, email=${result.email || 'none'}`);
    
  } catch (error) {
    console.error(`❌ Scrape error for ${url}:`, error);
  }
  
  return result;
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

    if (!state) {
      return new Response(
        JSON.stringify({ error: "Estado é obrigatório", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const location = city || stateCapitals[state] || state;
    const stateName = stateNames[state] || state;
    console.log(`📍 Location: ${location}, ${state}`);

    // ============================================
    // SEARCH STRATEGY - Multiple queries with scrapeOptions
    // ============================================
    
    const allResults: ScrapedResult[] = [];
    
    // Varied search queries to get more results
    const searchQueries = [
      `representante comercial ${location} ${stateName} telefone contato`,
      `representantes comerciais ${stateName} contato whatsapp`,
      `agência representação comercial ${location} telefone`,
      `distribuidor atacadista ${location} contato`,
      `representante vendas ${stateName} telefone email`,
      `escritório representação ${location}`,
    ];
    
    console.log("\n📋 Phase 1: Firecrawl search (parallel)");
    
    // Run searches in parallel for speed
    const searchPromises = searchQueries.slice(0, 4).map(query => 
      firecrawlSearch(query, FIRECRAWL_API_KEY)
    );
    
    const searchResults = await Promise.all(searchPromises);
    for (const results of searchResults) {
      allResults.push(...results.map(r => ({ ...r, region: `${location}, ${state}` })));
    }
    
    console.log(`\n📊 Total search results: ${allResults.length}`);
    
    // Deduplicate by domain
    const seenDomains = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (!r.website) return true;
      try {
        const domain = new URL(r.website).hostname.replace('www.', '');
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
        return true;
      } catch {
        return true;
      }
    });
    
    console.log(`📊 Unique results: ${uniqueResults.length}`);
    
    // Phase 2: Scrape results without phone (parallel, batches of 5)
    console.log("\n📋 Phase 2: Scraping results without phone (parallel)");
    const toEnrich = uniqueResults.filter(r => !r.phone && r.website);
    const alreadyHavePhone = uniqueResults.filter(r => r.phone || !r.website);
    
    const enrichedResults: ScrapedResult[] = [...alreadyHavePhone];
    
    // Process in batches of 5 for speed
    for (let i = 0; i < toEnrich.length; i += 5) {
      const batch = toEnrich.slice(i, i + 5);
      const batchPromises = batch.map(async (result) => {
        const details = await firecrawlScrape(result.website!, FIRECRAWL_API_KEY);
        return {
          ...result,
          phone: details.phone || result.phone,
          email: details.email || result.email,
        };
      });
      const batchResults = await Promise.all(batchPromises);
      enrichedResults.push(...batchResults);
    }
    
    console.log(`📊 Enriched: ${enrichedResults.length}`);

    // ============================================
    // FORMAT RESULTS - Prioritize those WITH phone
    // ============================================
    
    // Sort: results with phone first
    enrichedResults.sort((a, b) => {
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return 0;
    });
    
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    
    for (const result of enrichedResults) {
      if (!result.name || result.name.length < 3) continue;
      
      // Skip duplicates by name
      const nameKey = result.name.toLowerCase().slice(0, 30);
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      
      let validPhone: string | undefined;
      let isWhatsApp = false;
      
      if (result.phone) {
        const phoneValidation = validatePhone(result.phone);
        if (phoneValidation.valid) {
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
        segments: segments || [],
        description: result.description,
        source: result.source,
        sourceUrl: result.sourceUrl,
        website: result.website,
        address: result.region
      });
      
      if (representatives.length >= 50) break;
    }
    
    // Log stats
    const withPhone = representatives.filter(r => r.phone).length;
    const withEmail = representatives.filter(r => r.email).length;
    console.log(`\n✅ Final: ${representatives.length} reps (${withPhone} with phone, ${withEmail} with email)`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location: `${location}, ${state}`,
          segments: segments,
          totalFound: representatives.length,
          withPhone,
          withEmail,
          method: 'firecrawl'
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

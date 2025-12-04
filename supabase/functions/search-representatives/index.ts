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
// SCRAPING FUNCTIONS
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

// Scrape using Bing (more reliable than DuckDuckGo)
async function scrapeBing(query: string): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=50`;
    
    console.log(`🔍 Bing search: "${query}"`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.log(`❌ Bing returned ${response.status}`);
      return results;
    }
    
    const html = await response.text();
    console.log(`📄 Bing HTML length: ${html.length}`);
    
    // Parse Bing results - look for result blocks
    const liResults = html.split('<li class="b_algo"');
    console.log(`📊 Found ${liResults.length - 1} result blocks`);
    
    for (let i = 1; i < liResults.length && results.length < 30; i++) {
      const block = liResults[i];
      
      // Extract title and URL
      const titleMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/a>/);
      if (!titleMatch) continue;
      
      const sourceUrl = titleMatch[1];
      const title = cleanText(titleMatch[2]);
      
      // Skip social media and irrelevant
      if (sourceUrl.includes('facebook.com') ||
          sourceUrl.includes('instagram.com') ||
          sourceUrl.includes('linkedin.com') ||
          sourceUrl.includes('twitter.com') ||
          sourceUrl.includes('youtube.com') ||
          sourceUrl.includes('wikipedia.org') ||
          sourceUrl.includes('microsoft.com') ||
          sourceUrl.includes('bing.com')) {
        continue;
      }
      
      // Extract description
      const descMatch = block.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/);
      const description = descMatch ? cleanText(descMatch[1]) : '';
      
      // Look for phone in snippet
      const phoneMatch = (title + ' ' + description).match(/\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/);
      
      // Look for email
      const emailMatch = (title + ' ' + description).match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      
      results.push({
        name: title.slice(0, 100),
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : undefined,
        description: description.slice(0, 200),
        website: sourceUrl,
        source: 'Bing',
        sourceUrl: sourceUrl
      });
    }
    
    console.log(`✅ Bing found ${results.length} results`);
    
  } catch (error) {
    console.error('❌ Bing error:', error);
  }
  
  return results;
}

// Try Google search via scraping
async function scrapeGoogle(query: string): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=30&hl=pt-BR`;
    
    console.log(`🔍 Google search: "${query}"`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.log(`❌ Google returned ${response.status}`);
      return results;
    }
    
    const html = await response.text();
    console.log(`📄 Google HTML length: ${html.length}`);
    
    // Look for data-href or href patterns
    const urlPattern = /href="\/url\?q=([^&"]+)/g;
    const matches = [...html.matchAll(urlPattern)];
    
    console.log(`📊 Found ${matches.length} URL matches`);
    
    const seenUrls = new Set<string>();
    
    for (const match of matches) {
      if (results.length >= 30) break;
      
      let url = decodeURIComponent(match[1]);
      
      // Skip duplicates and irrelevant
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      
      if (url.includes('google.com') ||
          url.includes('facebook.com') ||
          url.includes('instagram.com') ||
          url.includes('linkedin.com') ||
          url.includes('twitter.com') ||
          url.includes('youtube.com') ||
          url.includes('wikipedia.org')) {
        continue;
      }
      
      // Extract domain as name
      const domainMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      const domain = domainMatch ? domainMatch[1] : url;
      
      results.push({
        name: domain,
        website: url,
        source: 'Google',
        sourceUrl: url
      });
    }
    
    console.log(`✅ Google found ${results.length} results`);
    
  } catch (error) {
    console.error('❌ Google error:', error);
  }
  
  return results;
}

// Enrich result by visiting website
async function enrichFromWebsite(result: ScrapedResult): Promise<ScrapedResult> {
  if (!result.website) return result;
  
  try {
    let url = result.website;
    if (!url.startsWith('http')) url = `https://${url}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow'
    });
    
    if (!response.ok) return result;
    
    const html = await response.text();
    
    // Extract title if we don't have a good name
    if (!result.name || result.name === result.website) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        result.name = cleanText(titleMatch[1]).slice(0, 100);
      }
    }
    
    // Find phone numbers
    if (!result.phone) {
      const phonePatterns = [
        /(?:tel|phone|telefone|whatsapp|fone|celular)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
        /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
        /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
      ];
      
      for (const pattern of phonePatterns) {
        const match = html.match(pattern);
        if (match) {
          result.phone = match[0];
          break;
        }
      }
    }
    
    // Find email
    if (!result.email) {
      const mailtoMatch = html.match(/href=["']mailto:([^"'?]+)/i);
      if (mailtoMatch && isValidEmail(mailtoMatch[1])) {
        result.email = mailtoMatch[1];
      } else {
        const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
        const emails = html.match(emailPattern) || [];
        for (const email of emails) {
          if (isValidEmail(email) && 
              !email.toLowerCase().includes('example') && 
              !email.toLowerCase().includes('wix') &&
              !email.toLowerCase().includes('wordpress')) {
            result.email = email;
            break;
          }
        }
      }
    }
    
    // Get description from meta
    if (!result.description) {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (descMatch) {
        result.description = cleanText(descMatch[1]).slice(0, 200);
      }
    }
    
  } catch (error) {
    // Ignore - site might be down
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

    const location = city || stateCapitals[state] || state;
    const stateName = stateNames[state] || state;
    console.log(`📍 Location: ${location}, ${state}`);

    // ============================================
    // SEARCH STRATEGY - Generic searches for the region
    // ============================================
    
    const allResults: ScrapedResult[] = [];
    
    // Search queries - focus on region, not segment
    const searchQueries = [
      `representante comercial ${location}`,
      `representantes comerciais ${stateName}`,
      `agência de representação ${location}`,
      `escritório representação comercial ${location}`,
      `distribuidora ${location}`,
    ];
    
    console.log("\n📋 Phase 1: Web scraping");
    
    for (const query of searchQueries) {
      // Try Bing first
      const bingResults = await scrapeBing(query);
      allResults.push(...bingResults.map(r => ({ ...r, region: `${location}, ${state}` })));
      
      if (allResults.length >= 50) break;
      
      await new Promise(r => setTimeout(r, 500));
      
      // Try Google as backup
      if (allResults.length < 20) {
        const googleResults = await scrapeGoogle(query);
        allResults.push(...googleResults.map(r => ({ ...r, region: `${location}, ${state}` })));
      }
      
      if (allResults.length >= 50) break;
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`\n📊 Total scraped: ${allResults.length}`);
    
    // Deduplicate by website
    const seenWebsites = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (!r.website) return true;
      const key = r.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      if (seenWebsites.has(key)) return false;
      seenWebsites.add(key);
      return true;
    });
    
    console.log(`📊 Unique results: ${uniqueResults.length}`);
    
    // Phase 2: Enrich top results
    console.log("\n📋 Phase 2: Enriching results");
    const enrichedResults: ScrapedResult[] = [];
    
    for (const result of uniqueResults.slice(0, 25)) {
      const enriched = await enrichFromWebsite(result);
      enrichedResults.push(enriched);
    }
    
    // Add remaining without enrichment
    enrichedResults.push(...uniqueResults.slice(25));
    
    console.log(`📊 Enriched: ${enrichedResults.length}`);

    // ============================================
    // FORMAT RESULTS
    // ============================================
    
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    
    for (const result of enrichedResults) {
      // Skip if no useful info
      if (!result.name || result.name.length < 3) continue;
      
      // Skip duplicate names
      const nameKey = result.name.toLowerCase().slice(0, 30);
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      
      // Validate phone if present
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

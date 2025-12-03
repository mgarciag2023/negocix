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
  website?: string;
  address?: string;
}

// Phone validation for Brazilian numbers
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

// Extract emails from HTML
function extractEmails(html: string): string[] {
  const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  const emails = html.match(emailPattern) || [];
  return emails.filter(email => {
    const lower = email.toLowerCase();
    return isValidEmail(email) && 
           !lower.includes('example.com') && 
           !lower.includes('wixpress.com') &&
           !lower.includes('sentry.io');
  });
}

// Extract phone numbers from HTML
function extractPhones(html: string): string[] {
  const phonePatterns = [
    /\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
    /\+55\s*\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/g,
  ];
  
  const phones: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = html.match(pattern) || [];
    phones.push(...matches);
  }
  return [...new Set(phones)];
}

// State codes to full names mapping
const stateNames: { [key: string]: string } = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
  'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

// Segment keywords for searching
const segmentKeywords: { [key: string]: string[] } = {
  'Alimentos': ['alimentos', 'alimentício', 'food'],
  'Bebidas': ['bebidas', 'drinks'],
  'Cosméticos': ['cosméticos', 'cosmetics', 'beleza'],
  'Vestuário': ['vestuário', 'confecção', 'moda', 'roupas'],
  'Automotivo': ['automotivo', 'autopeças', 'automotive'],
  'Construção Civil': ['construção', 'materiais construção', 'construction'],
  'Farmacêutico': ['farmacêutico', 'medicamentos', 'pharma'],
  'Energia Solar': ['energia solar', 'solar', 'fotovoltaico'],
  'Tecnologia': ['tecnologia', 'tech', 'TI', 'informática'],
  'Saúde': ['saúde', 'health', 'médico'],
  'Ferramentas': ['ferramentas', 'tools'],
  'Material de Escritório': ['escritório', 'office', 'papelaria'],
};

// Professional keywords
const professionalKeywords: { [key: string]: string[] } = {
  'Engenheiros': ['engenheiro', 'engenharia', 'engineer'],
  'Arquitetos': ['arquiteto', 'arquitetura', 'architect'],
  'Contadores': ['contador', 'contabilidade', 'contábil'],
  'Advogados': ['advogado', 'advocacia', 'jurídico'],
  'Médicos': ['médico', 'medicina', 'doctor'],
  'Dentistas': ['dentista', 'odontologia'],
  'Nutricionistas': ['nutricionista', 'nutrição'],
  'Psicólogos': ['psicólogo', 'psicologia'],
};

// Search Google for representative directories
async function searchGoogleForRepresentatives(segment: string, state: string, city?: string): Promise<Representative[]> {
  const representatives: Representative[] = [];
  const stateName = stateNames[state] || state;
  const location = city ? `${city} ${stateName}` : stateName;
  
  // Build search queries for representative portals
  const searchQueries = [
    `site:representante.com.br ${segment} ${location}`,
    `site:linkedin.com/in representante comercial ${segment} ${location}`,
    `"representante comercial" "${segment}" "${location}" contato telefone`,
    `representante ${segment} ${stateName} whatsapp telefone`,
  ];

  const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
  if (!APIFY_API_KEY) {
    console.error("APIFY_API_KEY not configured");
    return representatives;
  }

  for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries
    console.log(`🔍 Searching Google: "${query}"`);
    
    try {
      // Use Apify Google Search Scraper
      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: query,
            maxPagesPerQuery: 1,
            resultsPerPage: 20,
            languageCode: 'pt-br',
            countryCode: 'br',
          }),
        }
      );

      if (response.ok) {
        const results = await response.json();
        console.log(`✅ Got ${results.length} Google results`);
        
        for (const result of results) {
          if (result.organicResults) {
            for (const item of result.organicResults.slice(0, 10)) {
              const rep = await extractRepresentativeFromUrl(item.url, item.title, item.description, segment, location);
              if (rep) {
                representatives.push(rep);
              }
            }
          }
        }
      } else {
        console.error(`❌ Google search failed:`, response.status);
      }
    } catch (error) {
      console.error(`Error in Google search:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return representatives;
}

// Extract representative info from a URL
async function extractRepresentativeFromUrl(
  url: string, 
  title: string, 
  description: string,
  segment: string,
  location: string
): Promise<Representative | null> {
  try {
    // Skip irrelevant URLs
    if (url.includes('youtube.com') || url.includes('facebook.com/groups') || url.includes('instagram.com')) {
      return null;
    }

    // Try to extract info from title/description first
    const combined = `${title} ${description}`.toLowerCase();
    
    // Check if it's about representatives
    const repKeywords = ['representante', 'representação', 'vendedor externo', 'agente comercial'];
    const hasRepKeyword = repKeywords.some(k => combined.includes(k));
    
    if (!hasRepKeyword && !url.includes('representante.com.br') && !url.includes('linkedin.com/in')) {
      return null;
    }

    // Extract name from title
    let name = title;
    if (title.includes(' - ')) {
      name = title.split(' - ')[0].trim();
    } else if (title.includes(' | ')) {
      name = title.split(' | ')[0].trim();
    }
    
    // Clean up name
    name = name.replace(/representante comercial/gi, '').trim();
    name = name.replace(/^\s*[-|]\s*/, '').trim();
    
    if (name.length < 3 || name.length > 100) {
      return null;
    }

    // Try to fetch the page for more details
    let phone: string | undefined;
    let email: string | undefined;
    let whatsapp: string | undefined;

    try {
      const pageResponse = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        signal: AbortSignal.timeout(5000),
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        
        // Extract phones
        const phones = extractPhones(html);
        for (const p of phones) {
          const validation = validatePhone(p);
          if (validation.valid) {
            phone = validation.normalized;
            if (validation.isWhatsApp) {
              whatsapp = validation.normalized;
            }
            break;
          }
        }

        // Extract emails
        const emails = extractEmails(html);
        if (emails.length > 0) {
          email = emails[0];
        }

        // Look for WhatsApp links
        const waMatch = html.match(/wa\.me\/(\d+)|api\.whatsapp\.com\/send\?phone=(\d+)/);
        if (waMatch) {
          const waNumber = waMatch[1] || waMatch[2];
          const waValidation = validatePhone(waNumber);
          if (waValidation.valid) {
            whatsapp = waValidation.normalized;
            if (!phone) phone = whatsapp;
          }
        }
      }
    } catch {
      // Page fetch failed, continue with basic info
    }

    // Must have at least phone or email to be useful
    if (!phone && !email) {
      console.log(`⏭️ Skipping "${name}" - no contact info found`);
      return null;
    }

    const representative: Representative = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      phone,
      whatsapp,
      email,
      region: location,
      segments: [segment],
      description: description?.slice(0, 200),
      source: url.includes('linkedin') ? 'LinkedIn' : url.includes('representante.com.br') ? 'Portal Representante' : 'Web',
      sourceUrl: url,
    };

    console.log(`✅ Found representative: ${name} - ${phone || email}`);
    return representative;

  } catch (error) {
    console.error(`Error extracting from ${url}:`, error);
    return null;
  }
}

// Scrape representante.com.br directly
async function scrapeRepresentanteComBr(segment: string, state: string): Promise<Representative[]> {
  const representatives: Representative[] = [];
  const stateName = stateNames[state] || state;
  
  console.log(`🔍 Scraping representante.com.br for ${segment} in ${stateName}`);
  
  try {
    // Try to search on the portal
    const searchUrl = `https://www.representante.com.br/busca?q=${encodeURIComponent(segment + ' ' + stateName)}`;
    
    const response = await fetch(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extract representative cards/listings
      // Look for common patterns in representative portals
      const phoneMatches = extractPhones(html);
      const emailMatches = extractEmails(html);
      
      // Look for name patterns (usually in headings or strong tags near contact info)
      const namePattern = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>|<strong>([^<]+)<\/strong>/gi;
      const names: string[] = [];
      let match;
      while ((match = namePattern.exec(html)) !== null) {
        const name = (match[1] || match[2] || '').trim();
        if (name.length > 5 && name.length < 80 && !name.includes('<') && !name.includes('>')) {
          names.push(name);
        }
      }

      // Create representatives from extracted data
      for (let i = 0; i < Math.min(names.length, phoneMatches.length, 20); i++) {
        const validation = validatePhone(phoneMatches[i]);
        if (validation.valid) {
          representatives.push({
            id: `rep-portal-${Date.now()}-${i}`,
            name: names[i] || `Representante ${segment}`,
            phone: validation.normalized,
            whatsapp: validation.isWhatsApp ? validation.normalized : undefined,
            email: emailMatches[i] || undefined,
            region: stateName,
            segments: [segment],
            source: 'Portal Representante',
            sourceUrl: searchUrl,
          });
        }
      }
      
      console.log(`✅ Found ${representatives.length} from representante.com.br`);
    }
  } catch (error) {
    console.error('Error scraping representante.com.br:', error);
  }

  return representatives;
}

// Main search function combining multiple sources
async function searchRepresentatives(config: SearchConfig): Promise<Representative[]> {
  const { segments, city, state } = config;
  const allRepresentatives: Representative[] = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  // Determine if searching for professionals or representatives
  const professionalSegments = Object.keys(professionalKeywords);
  const isProfessional = segments.some(s => professionalSegments.includes(s));

  for (const segment of segments) {
    console.log(`\n📊 Searching for ${segment} in ${city || ''} ${state}`);

    // 1. Search Google for representative directories and profiles
    const googleResults = await searchGoogleForRepresentatives(segment, state, city);
    
    for (const rep of googleResults) {
      const phoneKey = rep.phone || '';
      const emailKey = rep.email || '';
      
      if ((phoneKey && !seenPhones.has(phoneKey)) || (emailKey && !seenEmails.has(emailKey))) {
        if (phoneKey) seenPhones.add(phoneKey);
        if (emailKey) seenEmails.add(emailKey);
        allRepresentatives.push(rep);
      }
    }

    // 2. Try to scrape representative portal directly
    const portalResults = await scrapeRepresentanteComBr(segment, state);
    
    for (const rep of portalResults) {
      const phoneKey = rep.phone || '';
      const emailKey = rep.email || '';
      
      if ((phoneKey && !seenPhones.has(phoneKey)) || (emailKey && !seenEmails.has(emailKey))) {
        if (phoneKey) seenPhones.add(phoneKey);
        if (emailKey) seenEmails.add(emailKey);
        allRepresentatives.push(rep);
      }
    }

    // Stop if we have enough
    if (allRepresentatives.length >= 50) break;
  }

  console.log(`\n✅ Total unique representatives found: ${allRepresentatives.length}`);
  return allRepresentatives.slice(0, 50);
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

    const representatives = await searchRepresentatives(config);

    return new Response(
      JSON.stringify({ 
        representatives,
        meta: {
          total: representatives.length,
          location: city ? `${city}, ${state}` : state,
          segments: segments.join(", "),
          sources: ['Google Search', 'Portal Representante', 'LinkedIn']
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

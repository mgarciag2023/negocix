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

// Common Brazilian first names for validation
const commonNames = [
  'rafael', 'joao', 'pedro', 'paulo', 'carlos', 'jose', 'antonio', 'francisco', 'luiz', 'luis',
  'marcos', 'marcio', 'mario', 'ricardo', 'roberto', 'andre', 'anderson', 'bruno', 'daniel', 'diego',
  'eduardo', 'fabio', 'felipe', 'fernando', 'gabriel', 'guilherme', 'gustavo', 'henrique', 'hugo', 'igor',
  'ivan', 'jean', 'jorge', 'julio', 'leandro', 'leonardo', 'lucas', 'luciano', 'marcelo', 'mateus',
  'matheus', 'mauricio', 'nelson', 'nilton', 'rafael', 'renan', 'renato', 'rodrigo', 'rogerio', 'sergio',
  'thiago', 'tiago', 'vinicius', 'vitor', 'wagner', 'wellington', 'william', 'wilson', 'alex', 'alexandre',
  'raissa', 'maria', 'ana', 'juliana', 'fernanda', 'patricia', 'camila', 'amanda', 'bruna', 'carla',
  'carolina', 'claudia', 'cristina', 'daniela', 'debora', 'eliane', 'fabiana', 'flavia', 'gabriela', 'jessica',
  'joana', 'julia', 'karen', 'larissa', 'leticia', 'luana', 'luciana', 'marcia', 'mariana', 'marina',
  'natalia', 'paula', 'priscila', 'renata', 'roberta', 'sandra', 'simone', 'talita', 'tatiana', 'vanessa',
  'viviane', 'adriana', 'aline', 'beatriz', 'bianca', 'cintia', 'daiane', 'elaine', 'gisele', 'helena',
];

function extractPersonName(text: string): string | null {
  if (!text) return null;
  
  const cleaned = text.toLowerCase().trim();
  
  // Check if it looks like a company name (skip these)
  const companyKeywords = [
    'ltda', 'eireli', 'me ', 's.a', 's/a', 'industria', 'indústria', 'comercio', 'comércio',
    'distribuidora', 'atacado', 'loja', 'empresa', 'representações', 'representacoes',
    'group', 'grupo', 'cia', 'corporation', 'corp', 'inc', 'solutions', 'services',
    'comercial', 'agencia', 'agência', 'consultoria', 'assessoria'
  ];
  
  for (const keyword of companyKeywords) {
    if (cleaned.includes(keyword)) {
      return null;
    }
  }
  
  // Check if contains a common Brazilian name
  const words = text.split(/[\s,.-]+/).filter(w => w.length >= 3);
  
  for (const word of words) {
    const wordLower = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (commonNames.includes(wordLower)) {
      // Found a real name - try to get first + last name
      const idx = words.findIndex(w => 
        w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === wordLower
      );
      
      if (idx >= 0 && idx < words.length - 1) {
        // Capitalize properly
        const firstName = words[idx].charAt(0).toUpperCase() + words[idx].slice(1).toLowerCase();
        const lastName = words[idx + 1].charAt(0).toUpperCase() + words[idx + 1].slice(1).toLowerCase();
        return `${firstName} ${lastName}`;
      } else if (idx >= 0) {
        return words[idx].charAt(0).toUpperCase() + words[idx].slice(1).toLowerCase();
      }
    }
  }
  
  return null;
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
// FIRECRAWL API - Search for people
// ============================================

interface PersonResult {
  name: string;
  phone?: string;
  email?: string;
  region?: string;
  description?: string;
  website?: string;
  sourceUrl: string;
}

async function searchPeople(
  query: string,
  apiKey: string
): Promise<PersonResult[]> {
  const results: PersonResult[] = [];
  
  try {
    console.log(`🔥 Searching: "${query}"`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        limit: 15,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        }
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ Error: ${response.status} - ${error}`);
      return results;
    }
    
    const data = await response.json();
    const items = data.data || data.results || [];
    console.log(`✅ Found ${items.length} results`);
    
    for (const item of items) {
      const url = item.url || item.link || '';
      const title = item.title || item.name || '';
      const description = item.description || item.snippet || '';
      const markdown = item.markdown || '';
      
      // Skip social media main pages
      if (url.includes('facebook.com/groups') ||
          url.includes('youtube.com') ||
          url.includes('wikipedia.org')) {
        continue;
      }
      
      const allContent = `${title} ${description} ${markdown}`;
      
      // Try to extract person names from content
      const namePatterns = [
        // "Meu nome é João Silva"
        /(?:meu nome (?:é|e)|me chamo|sou o|sou a)\s+([A-Z][a-záéíóúãõç]+(?:\s+[A-Z][a-záéíóúãõç]+)+)/gi,
        // "João Silva - Representante"
        /([A-Z][a-záéíóúãõç]+\s+[A-Z][a-záéíóúãõç]+)\s*[-–]\s*(?:representante|vendedor|consultor)/gi,
        // "Contato: João Silva"
        /(?:contato|responsável|proprietário|dono):\s*([A-Z][a-záéíóúãõç]+\s+[A-Z][a-záéíóúãõç]+)/gi,
        // LinkedIn style
        /([A-Z][a-záéíóúãõç]+\s+[A-Z][a-záéíóúãõç]+)\s*\|\s*(?:representante|vendedor|consultor|linkedin)/gi,
      ];
      
      let personName: string | null = null;
      
      // First try extracting from title
      personName = extractPersonName(title);
      
      // If not found in title, try patterns in content
      if (!personName) {
        for (const pattern of namePatterns) {
          const match = allContent.match(pattern);
          if (match) {
            const extracted = match[1] || match[0];
            personName = extractPersonName(extracted);
            if (personName) break;
          }
        }
      }
      
      // Skip if no person name found
      if (!personName) {
        continue;
      }
      
      // Find phone
      let phone: string | undefined;
      const phonePatterns = [
        /(?:tel|telefone|whatsapp|fone|celular|zap)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
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
        name: personName,
        description: cleanText(description || markdown.slice(0, 200)).slice(0, 150),
        phone,
        email,
        website: url,
        sourceUrl: url
      });
    }
    
  } catch (error) {
    console.error('❌ Search error:', error);
  }
  
  return results;
}

async function scrapeForContact(
  url: string,
  apiKey: string
): Promise<{ phone?: string; email?: string; name?: string }> {
  const result: { phone?: string; email?: string; name?: string } = {};
  
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
        onlyMainContent: false,
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
    
    // Try to find person name
    const namePatterns = [
      /(?:meu nome (?:é|e)|me chamo|sou o|sou a)\s+([A-Z][a-záéíóúãõç]+(?:\s+[A-Z][a-záéíóúãõç]+)+)/gi,
      /([A-Z][a-záéíóúãõç]+\s+[A-Z][a-záéíóúãõç]+)\s*[-–]\s*(?:representante|vendedor|consultor)/gi,
      /(?:contato|responsável):\s*([A-Z][a-záéíóúãõç]+\s+[A-Z][a-záéíóúãõç]+)/gi,
    ];
    
    for (const pattern of namePatterns) {
      const match = content.match(pattern);
      if (match) {
        const extracted = match[1] || match[0];
        result.name = extractPersonName(extracted) || undefined;
        if (result.name) break;
      }
    }
    
    // Find phone
    const phonePatterns = [
      /(?:tel|telefone|whatsapp|fone|celular|contato)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/gi,
      /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,
      /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/g,
      /\+55\s*\d{2}\s*\d{4,5}[-.\s]?\d{4}/g,
    ];
    
    for (const pattern of phonePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
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
          !email.toLowerCase().includes('wordpress')) {
        result.email = email;
        break;
      }
    }
    
    console.log(`✅ Found: name=${result.name || 'none'}, phone=${result.phone || 'none'}`);
    
  } catch (error) {
    console.error(`❌ Scrape error:`, error);
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
    // SEARCH FOR REAL PEOPLE - Not companies
    // ============================================
    
    const allResults: PersonResult[] = [];
    
    // Build segment terms
    const segmentTerms = segments && segments.length > 0 
      ? segments.slice(0, 2).join(' ')
      : 'vendas';
    
    // Search queries focused on finding PEOPLE with names
    const searchQueries = [
      `"representante comercial" "${location}" contato telefone nome`,
      `"vendedor externo" "${stateName}" whatsapp telefone`,
      `"consultor de vendas" "${location}" contato celular`,
      `representante ${segmentTerms} "${location}" telefone nome`,
      `"agente comercial" "${stateName}" contato whatsapp`,
      `"profissional de vendas" "${location}" telefone`,
    ];
    
    console.log("\n📋 Phase 1: Search for people (parallel)");
    
    // Run 4 searches in parallel
    const searchPromises = searchQueries.slice(0, 4).map(query => 
      searchPeople(query, FIRECRAWL_API_KEY)
    );
    
    const searchResults = await Promise.all(searchPromises);
    for (const results of searchResults) {
      allResults.push(...results.map(r => ({ ...r, region: `${location}, ${state}` })));
    }
    
    console.log(`\n📊 Total people found: ${allResults.length}`);
    
    // If few results, do more searches
    if (allResults.length < 10) {
      console.log("\n📋 Phase 1b: Additional searches");
      const additionalQueries = searchQueries.slice(4);
      const additionalPromises = additionalQueries.map(query => 
        searchPeople(query, FIRECRAWL_API_KEY)
      );
      const additionalResults = await Promise.all(additionalPromises);
      for (const results of additionalResults) {
        allResults.push(...results.map(r => ({ ...r, region: `${location}, ${state}` })));
      }
    }
    
    // Deduplicate by name
    const seenNames = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      const nameKey = r.name.toLowerCase().trim();
      if (seenNames.has(nameKey)) return false;
      seenNames.add(nameKey);
      return true;
    });
    
    console.log(`📊 Unique people: ${uniqueResults.length}`);
    
    // Phase 2: Scrape for more details if needed
    console.log("\n📋 Phase 2: Enriching contacts (parallel)");
    const toEnrich = uniqueResults.filter(r => !r.phone && r.website).slice(0, 10);
    const alreadyComplete = uniqueResults.filter(r => r.phone || !r.website);
    
    const enrichedResults: PersonResult[] = [...alreadyComplete];
    
    if (toEnrich.length > 0) {
      const batchPromises = toEnrich.map(async (result) => {
        const details = await scrapeForContact(result.website!, FIRECRAWL_API_KEY);
        return {
          ...result,
          name: details.name || result.name,
          phone: details.phone || result.phone,
          email: details.email || result.email,
        };
      });
      const batchResults = await Promise.all(batchPromises);
      enrichedResults.push(...batchResults);
    }
    
    console.log(`📊 After enrichment: ${enrichedResults.length}`);

    // ============================================
    // FORMAT RESULTS - Only real people with names
    // ============================================
    
    // Sort: results with phone first
    enrichedResults.sort((a, b) => {
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return 0;
    });
    
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();
    const finalNames = new Set<string>();
    
    for (const result of enrichedResults) {
      // Validate it's a person name (not a company)
      const personName = extractPersonName(result.name);
      if (!personName) continue;
      
      // Skip duplicate names
      const nameKey = personName.toLowerCase();
      if (finalNames.has(nameKey)) continue;
      finalNames.add(nameKey);
      
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
        name: personName,
        phone: validPhone,
        whatsapp: isWhatsApp ? validPhone : undefined,
        email: result.email,
        region: result.region || `${location}, ${state}`,
        segments: segments || [],
        description: result.description,
        sourceUrl: result.sourceUrl,
        website: result.website,
        address: result.region
      });
      
      if (representatives.length >= 50) break;
    }
    
    // Log stats
    const withPhone = representatives.filter(r => r.phone).length;
    const withWhatsapp = representatives.filter(r => r.whatsapp).length;
    const withEmail = representatives.filter(r => r.email).length;
    console.log(`\n✅ Final: ${representatives.length} people (${withPhone} with phone, ${withWhatsapp} with WhatsApp, ${withEmail} with email)`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location: `${location}, ${state}`,
          segments: segments,
          totalFound: representatives.length,
          withPhone,
          withWhatsapp,
          withEmail,
          method: 'firecrawl-people'
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

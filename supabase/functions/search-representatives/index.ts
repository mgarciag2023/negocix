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
  sourceUrl?: string;
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

// Check if looks like a company (to exclude)
function isCompanyName(name: string): boolean {
  const lower = name.toLowerCase();
  const companyKeywords = [
    'ltda', 'eireli', 's.a', 's/a', 'me ', ' me', 'epp', 'cnpj',
    'industria', 'indústria', 'comercio', 'comércio', 'distribuidora',
    'atacado', 'loja', 'representações', 'representacoes', 'group', 'grupo',
    'cia', 'corporation', 'corp', 'inc', 'solutions', 'services', 'comercial',
    'empreendimentos', 'matriz', 'filial', 'brasil', 'international', 'global',
    'company', 'home page', 'contato', 'sobre nós', 'quem somos', 'produtos',
    'serviços', 'blog', 'notícias', 'linkedin', 'facebook', 'instagram'
  ];
  
  for (const keyword of companyKeywords) {
    if (lower.includes(keyword)) return true;
  }
  return false;
}

// Extract usable name from text
function extractName(text: string): string | null {
  if (!text || text.length < 3) return null;
  
  // Clean up
  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[|•\-–—:]/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .slice(0, 60);
  
  if (isCompanyName(cleaned)) return null;
  
  // Try to extract "First Last" pattern
  const nameMatch = cleaned.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛ][a-záéíóúãõâêîôû]+(?:\s+(?:da|de|dos|das|e)?\s*[A-ZÁÉÍÓÚÃÕÂÊÎÔÛ]?[a-záéíóúãõâêîôû]+)+)/);
  if (nameMatch && nameMatch[1].length >= 5 && !isCompanyName(nameMatch[1])) {
    return nameMatch[1].slice(0, 40);
  }
  
  // If cleaned looks usable
  if (cleaned.length >= 5 && cleaned.length <= 40 && cleaned.includes(' ')) {
    return cleaned;
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
// SEARCH FUNCTION
// ============================================

interface RawResult {
  name: string;
  phone?: string;
  email?: string;
  description?: string;
  url: string;
}

async function quickSearch(query: string, apiKey: string): Promise<RawResult[]> {
  const results: RawResult[] = [];
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        limit: 25,
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return results;
    
    const data = await response.json();
    const items = data.data || data.results || [];
    
    for (const item of items) {
      const url = item.url || '';
      const title = item.title || '';
      const description = item.description || item.snippet || '';
      const markdown = item.markdown || '';
      const allContent = `${title} ${description} ${markdown}`;
      
      // Skip social media
      if (url.includes('facebook.com') || url.includes('youtube.com') || 
          url.includes('wikipedia.org') || url.includes('twitter.com') ||
          url.includes('tiktok.com')) {
        continue;
      }
      
      // Try to find a name
      let personName = extractName(title);
      
      if (!personName) {
        // Try finding name in content with patterns
        const patterns = [
          /(?:contato|responsável|proprietário|sou o|sou a|me chamo)[:\s]+([A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ]+(?:\s+[A-Za-záéíóúãõ]+)+)/i,
          /([A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ]+\s+[A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ]+)\s*[-–|]\s*(?:representante|vendedor|consultor|profissional)/i,
          /representante[:\s]+([A-ZÁÉÍÓÚÃÕ][a-záéíóúãõ]+\s+[A-Za-záéíóúãõ]+)/i,
        ];
        
        for (const pattern of patterns) {
          const match = allContent.match(pattern);
          if (match && match[1]) {
            personName = extractName(match[1]);
            if (personName) break;
          }
        }
      }
      
      // Find phone
      let phone: string | undefined;
      const phonePatterns = [
        /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/,
        /\(?\d{2}\)?\s*[2-5]\d{3}[-.\s]?\d{4}/,
        /\d{2}[-.\s]?\d{4,5}[-.\s]?\d{4}/,
      ];
      for (const p of phonePatterns) {
        const match = allContent.match(p);
        if (match) { phone = match[0]; break; }
      }
      
      // Find email
      const emailMatch = allContent.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : undefined;
      
      // Include if has name OR has phone (for fallback)
      if (personName || phone) {
        results.push({
          name: personName || `Representante - ${new URL(url).hostname.replace('www.', '')}`,
          phone,
          email,
          description: description.slice(0, 120),
          url
        });
      }
    }
    
  } catch (error) {
    console.error('Search error:', error);
  }
  
  return results;
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
    console.log("🚀 Config:", JSON.stringify(config));

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
    const segmentTerms = segments?.slice(0, 2).join(' ') || '';
    
    // More search queries to guarantee 8+ results
    const queries = [
      `representante comercial ${location} telefone`,
      `vendedor externo ${segmentTerms} ${stateName} contato`,
      `consultor vendas ${location} whatsapp celular`,
      `representante ${segmentTerms} ${location} telefone`,
      `agente comercial ${stateName} contato`,
      `profissional vendas ${location}`,
      `representante autônomo ${stateName} telefone`,
      `vendedor ${location} whatsapp`,
    ];

    console.log(`📍 ${location}, ${state} - ${queries.length} searches`);

    // Run ALL in parallel
    const searchPromises = queries.map(q => quickSearch(q, FIRECRAWL_API_KEY));
    const allResults = await Promise.all(searchPromises);
    
    // Flatten and deduplicate by name
    const flatResults: RawResult[] = [];
    const seenNames = new Set<string>();
    
    for (const results of allResults) {
      for (const r of results) {
        const nameKey = r.name.toLowerCase().slice(0, 25);
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          flatResults.push(r);
        }
      }
    }
    
    console.log(`📊 Found ${flatResults.length} unique results`);

    // Sort: phone first, then real names
    flatResults.sort((a, b) => {
      // Priority 1: Has phone
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      // Priority 2: Real name (not "Representante -")
      const aHasRealName = !a.name.startsWith('Representante -');
      const bHasRealName = !b.name.startsWith('Representante -');
      if (aHasRealName && !bHasRealName) return -1;
      if (!aHasRealName && bHasRealName) return 1;
      return 0;
    });

    // Build final list - minimum 8
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();
    
    for (const r of flatResults) {
      let validPhone: string | undefined;
      let isWhatsApp = false;
      
      if (r.phone) {
        const validation = validatePhone(r.phone);
        if (validation.valid) {
          if (seenPhones.has(validation.normalized)) continue;
          seenPhones.add(validation.normalized);
          validPhone = validation.normalized;
          isWhatsApp = validation.isWhatsApp;
        }
      }
      
      representatives.push({
        id: generateId(),
        name: r.name,
        phone: validPhone,
        whatsapp: isWhatsApp ? validPhone : undefined,
        email: r.email,
        region: `${location}, ${state}`,
        segments: segments || [],
        description: r.description,
        sourceUrl: r.url
      });
      
      if (representatives.length >= 50) break;
    }
    
    const withPhone = representatives.filter(r => r.phone).length;
    const withWhatsapp = representatives.filter(r => r.whatsapp).length;
    console.log(`✅ Final: ${representatives.length} (${withPhone} phone, ${withWhatsapp} WhatsApp)`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location: `${location}, ${state}`,
          segments,
          totalFound: representatives.length,
          withPhone,
          withWhatsapp
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro ao buscar",
        representatives: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

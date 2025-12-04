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
  rating?: number;
  reviewCount?: number;
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

async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000)
    });
    
    if (!response.ok) return null;
    const html = await response.text();
    
    // Try mailto first
    const mailtoMatch = html.match(/href=["']mailto:([^"'?]+)/i);
    if (mailtoMatch && isValidEmail(mailtoMatch[1])) return mailtoMatch[1];
    
    // Then search for emails
    const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = html.match(emailPattern) || [];
    
    for (const email of emails) {
      const lower = email.toLowerCase();
      if (isValidEmail(email) && !lower.includes('example') && !lower.includes('wix') && !lower.includes('sentry')) {
        return email;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// ============================================
// LOCATION DATA
// ============================================

const stateCapitals: { [key: string]: string } = {
  'AC': 'Rio Branco', 'AL': 'Maceió', 'AP': 'Macapá', 'AM': 'Manaus',
  'BA': 'Salvador', 'CE': 'Fortaleza', 'DF': 'Brasília', 'ES': 'Vitória',
  'GO': 'Goiânia', 'MA': 'São Luís', 'MT': 'Cuiabá', 'MS': 'Campo Grande',
  'MG': 'Belo Horizonte', 'PA': 'Belém', 'PB': 'João Pessoa', 'PR': 'Curitiba',
  'PE': 'Recife', 'PI': 'Teresina', 'RJ': 'Rio de Janeiro', 'RN': 'Natal',
  'RS': 'Porto Alegre', 'RO': 'Porto Velho', 'RR': 'Boa Vista', 'SC': 'Florianópolis',
  'SP': 'São Paulo', 'SE': 'Aracaju', 'TO': 'Palmas'
};

const coordinates: { [key: string]: { lat: number; lng: number } } = {
  'Rio Branco': { lat: -9.9754, lng: -67.8249 },
  'Maceió': { lat: -9.6658, lng: -35.7350 },
  'Macapá': { lat: 0.0349, lng: -51.0694 },
  'Manaus': { lat: -3.1190, lng: -60.0217 },
  'Salvador': { lat: -12.9714, lng: -38.5014 },
  'Fortaleza': { lat: -3.7172, lng: -38.5433 },
  'Brasília': { lat: -15.7942, lng: -47.8822 },
  'Vitória': { lat: -20.3155, lng: -40.3128 },
  'Goiânia': { lat: -16.6869, lng: -49.2648 },
  'São Luís': { lat: -2.5387, lng: -44.2826 },
  'Cuiabá': { lat: -15.6014, lng: -56.0979 },
  'Campo Grande': { lat: -20.4697, lng: -54.6201 },
  'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
  'Belém': { lat: -1.4558, lng: -48.4902 },
  'João Pessoa': { lat: -7.1195, lng: -34.8450 },
  'Curitiba': { lat: -25.4284, lng: -49.2733 },
  'Recife': { lat: -8.0476, lng: -34.8770 },
  'Teresina': { lat: -5.0892, lng: -42.8019 },
  'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
  'Natal': { lat: -5.7793, lng: -35.2009 },
  'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
  'Porto Velho': { lat: -8.7612, lng: -63.9039 },
  'Boa Vista': { lat: 2.8235, lng: -60.6758 },
  'Florianópolis': { lat: -27.5954, lng: -48.5480 },
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Aracaju': { lat: -10.9472, lng: -37.0731 },
  'Palmas': { lat: -10.2128, lng: -48.3603 },
  'Blumenau': { lat: -26.9194, lng: -49.0661 },
  'Joinville': { lat: -26.3045, lng: -48.8487 },
  'Campinas': { lat: -22.9099, lng: -47.0626 },
  'Ribeirão Preto': { lat: -21.1775, lng: -47.8103 },
  'Uberlândia': { lat: -18.9186, lng: -48.2772 },
  'Londrina': { lat: -23.3045, lng: -51.1696 },
  'Maringá': { lat: -23.4205, lng: -51.9333 },
};

// ============================================
// SEARCH TERMS - Multiple variations per segment
// ============================================

const professionalSearchTerms: { [key: string]: string[] } = {
  'Engenheiros': ['engenheiro civil', 'escritório engenharia', 'engenheiro estrutural'],
  'Arquitetos': ['arquiteto', 'escritório arquitetura', 'arquiteto interiores'],
  'Contadores': ['contador', 'escritório contabilidade', 'contabilidade empresarial'],
  'Eletricistas': ['eletricista', 'instalador elétrico', 'empresa elétrica'],
  'Advogados': ['advogado', 'escritório advocacia', 'advogado empresarial'],
  'Médicos': ['médico', 'consultório médico', 'clínica médica'],
  'Dentistas': ['dentista', 'consultório odontológico', 'clínica odontologia'],
  'Nutricionistas': ['nutricionista', 'consultório nutrição', 'nutricionista clínico'],
  'Psicólogos': ['psicólogo', 'consultório psicologia', 'psicólogo clínico'],
  'Fisioterapeutas': ['fisioterapeuta', 'clínica fisioterapia', 'fisioterapia'],
  'Veterinários': ['veterinário', 'clínica veterinária', 'hospital veterinário'],
  'Fonoaudiólogos': ['fonoaudiólogo', 'clínica fonoaudiologia'],
  'Terapeutas Ocupacionais': ['terapeuta ocupacional', 'terapia ocupacional'],
  'Enfermeiros': ['enfermeiro', 'home care enfermagem', 'cuidador idosos'],
  'Farmacêuticos': ['farmacêutico', 'consultoria farmacêutica'],
  'Biomédicos': ['biomédico', 'laboratório análises'],
  'Corretores de Imóveis': ['corretor imóveis', 'imobiliária', 'consultor imobiliário'],
  'Corretores de Seguros': ['corretor seguros', 'corretora seguros'],
  'Despachantes': ['despachante', 'despachante documentalista'],
  'Personal Trainers': ['personal trainer', 'treinador pessoal'],
  'Tradutores': ['tradutor juramentado', 'tradutor'],
  'Designers': ['designer gráfico', 'estúdio design', 'designer freelancer'],
  'Programadores': ['programador', 'desenvolvedor software', 'consultoria TI'],
  'Consultores': ['consultor empresarial', 'consultoria empresarial'],
  'Economistas': ['economista', 'consultoria econômica'],
  'Administradores': ['administrador empresas', 'consultoria administrativa'],
  'Publicitários': ['agência publicidade', 'marketing digital', 'agência marketing'],
  'Jornalistas': ['jornalista', 'assessoria imprensa'],
  'Fotógrafos': ['fotógrafo profissional', 'estúdio fotografia', 'fotógrafo eventos'],
  'Videomakers': ['videomaker', 'produtora vídeo', 'editor vídeo'],
};

const representativeSearchTerms: { [key: string]: string[] } = {
  'Alimentos': ['representante comercial alimentos', 'distribuidor alimentos', 'atacado alimentos'],
  'Bebidas': ['representante comercial bebidas', 'distribuidor bebidas', 'atacado bebidas'],
  'Cosméticos': ['representante comercial cosméticos', 'distribuidor cosméticos', 'atacado cosméticos'],
  'Vestuário': ['representante comercial confecção', 'atacado roupas', 'representante moda'],
  'Automotivo': ['representante comercial autopeças', 'distribuidor autopeças', 'atacado autopeças'],
  'Construção Civil': ['representante materiais construção', 'distribuidor construção', 'atacado construção'],
  'Farmacêutico': ['representante comercial farmacêutico', 'distribuidor medicamentos'],
  'Energia Solar': ['representante energia solar', 'distribuidor painéis solares', 'energia fotovoltaica'],
  'Tecnologia': ['representante comercial tecnologia', 'distribuidor informática', 'atacado tecnologia'],
  'Saúde': ['representante equipamentos médicos', 'distribuidor hospitalar'],
  'Ferramentas': ['representante comercial ferramentas', 'distribuidor ferramentas', 'atacado ferramentas'],
  'Material de Escritório': ['representante material escritório', 'distribuidor papelaria', 'atacado escritório'],
  'Segurança': ['representante equipamentos segurança', 'distribuidor CFTV', 'atacado segurança'],
  'Descartáveis': ['representante comercial descartáveis', 'distribuidor descartáveis', 'atacado embalagens'],
  'Plásticos': ['representante comercial plásticos', 'distribuidor plásticos'],
  'EPIs': ['representante comercial EPIs', 'distribuidor EPIs', 'atacado segurança trabalho'],
  'Utilidades Domésticas': ['representante utilidades domésticas', 'distribuidor bazar', 'atacado utilidades'],
  'Eletrônicos': ['representante comercial eletrônicos', 'distribuidor eletrônicos', 'atacado eletrônicos'],
  'Materiais Elétricos': ['representante materiais elétricos', 'distribuidor material elétrico', 'atacado elétrico'],
  'Agropecuária': ['representante comercial agropecuária', 'distribuidor insumos agrícolas', 'atacado agro'],
  'Têxtil': ['representante comercial têxtil', 'distribuidor tecidos', 'atacado tecidos'],
  'Químico': ['representante produtos químicos', 'distribuidor químicos'],
  'Embalagens': ['representante comercial embalagens', 'distribuidor embalagens'],
  'Máquinas e Equipamentos': ['representante máquinas industriais', 'distribuidor equipamentos'],
  'Móveis': ['representante comercial móveis', 'atacado móveis', 'distribuidor móveis'],
  'Papelaria': ['representante comercial papelaria', 'distribuidor papelaria', 'atacado papelaria'],
  'Brinquedos': ['representante comercial brinquedos', 'distribuidor brinquedos', 'atacado brinquedos'],
  'Pet': ['representante comercial pet', 'distribuidor pet shop', 'atacado pet'],
  'Higiene e Limpeza': ['representante produtos limpeza', 'distribuidor limpeza', 'atacado higiene'],
  'Suplementos': ['representante comercial suplementos', 'distribuidor suplementos'],
  'Joias e Bijuterias': ['representante comercial joias', 'atacado bijuterias', 'distribuidor joias'],
  'Calçados': ['representante comercial calçados', 'atacado calçados', 'distribuidor calçados'],
  'Bolsas e Acessórios': ['representante bolsas acessórios', 'atacado bolsas'],
  'Perfumaria': ['representante comercial perfumes', 'distribuidor perfumaria', 'atacado perfumes'],
  'Cama, Mesa e Banho': ['representante cama mesa banho', 'atacado cama mesa banho'],
  'Informática': ['representante comercial informática', 'distribuidor informática', 'atacado computadores'],
  'Celulares e Acessórios': ['representante celulares', 'distribuidor celulares', 'atacado celulares'],
  'Ar Condicionado': ['representante ar condicionado', 'distribuidor climatização'],
  'Refrigeração': ['representante comercial refrigeração', 'distribuidor refrigeração'],
  'Iluminação': ['representante comercial iluminação', 'distribuidor iluminação', 'atacado lâmpadas'],
  'Tintas e Pintura': ['representante comercial tintas', 'distribuidor tintas'],
  'Hidráulica': ['representante materiais hidráulicos', 'distribuidor hidráulica'],
  'Jardinagem': ['representante comercial jardinagem', 'distribuidor jardinagem'],
  'Piscinas': ['representante equipamentos piscina', 'distribuidor piscinas'],
  'Fitness': ['representante equipamentos fitness', 'distribuidor fitness', 'atacado academia'],
  'Instrumentos Musicais': ['representante instrumentos musicais', 'distribuidor instrumentos'],
  'Artigos Religiosos': ['representante artigos religiosos', 'distribuidor religiosos'],
  'Artesanato': ['representante comercial artesanato', 'atacado artesanato'],
  'Decoração': ['representante comercial decoração', 'atacado decoração'],
  'Vidros': ['representante comercial vidros', 'distribuidor vidros'],
  'Madeira': ['representante comercial madeira', 'distribuidor madeira'],
  'Aço e Metalurgia': ['representante comercial aço', 'distribuidor aço', 'metalurgia'],
  'Borrachas': ['representante comercial borrachas', 'distribuidor borrachas'],
  'Lubrificantes': ['representante comercial lubrificantes', 'distribuidor lubrificantes'],
  'Alimentos Congelados': ['representante alimentos congelados', 'distribuidor congelados'],
  'Doces e Chocolates': ['representante doces chocolates', 'distribuidor doces', 'atacado chocolates'],
  'Café': ['representante comercial café', 'distribuidor café'],
  'Cereais e Grãos': ['representante comercial cereais', 'distribuidor cereais grãos'],
  'Laticínios': ['representante comercial laticínios', 'distribuidor laticínios'],
  'Carnes': ['representante comercial carnes', 'distribuidor carnes', 'atacado carnes'],
  'Pescados': ['representante comercial pescados', 'distribuidor pescados'],
  'Orgânicos': ['representante produtos orgânicos', 'distribuidor orgânicos'],
  'Sucos e Polpas': ['representante comercial sucos', 'distribuidor sucos polpas'],
  'Água Mineral': ['representante água mineral', 'distribuidor água'],
  'Sorvetes': ['representante comercial sorvetes', 'distribuidor sorvetes'],
  'Padaria': ['representante comercial panificação', 'distribuidor padaria'],
  'Rotisseria': ['representante alimentos prontos', 'distribuidor rotisseria'],
};

// ============================================
// APIFY SEARCH FUNCTION
// ============================================

async function searchApify(
  query: string, 
  location: string, 
  state: string, 
  coords: { lat: number; lng: number },
  apiKey: string,
  maxResults: number = 40
): Promise<any[]> {
  console.log(`🔎 Apify search: "${query}" in ${location}`);
  
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [query],
          locationQuery: `${location}, ${state}, Brazil`,
          lat: coords.lat.toString(),
          lng: coords.lng.toString(),
          maxCrawledPlacesPerSearch: maxResults,
          maxAutomaticZoomOut: 5,
          skipClosedPlaces: true,
          scrapeReviewsNumber: 0,
          language: 'pt-BR',
          searchMatching: 'all',
        }),
      }
    );

    if (response.ok) {
      const results = await response.json();
      console.log(`✅ Got ${results.length} results`);
      return results;
    } else {
      const status = response.status;
      console.error(`❌ Apify error: ${status}`);
      if (status === 402) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      return [];
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
      throw error;
    }
    console.error(`❌ Search error:`, error);
    return [];
  }
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

    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY not configured");
    }

    const location = city || stateCapitals[state] || state;
    const professionalSegments = Object.keys(professionalSearchTerms);
    const isProfessional = segments.some(s => professionalSegments.includes(s));
    
    // Get coordinates
    let coords = coordinates[location];
    if (!coords) {
      const capital = stateCapitals[state];
      coords = coordinates[capital] || { lat: -23.5505, lng: -46.6333 };
    }
    console.log(`📍 Location: ${location}, ${state} (${coords.lat}, ${coords.lng})`);

    // ============================================
    // STRATEGY: Multiple searches with variations
    // ============================================
    
    const allResults: any[] = [];
    const searchedQueries = new Set<string>();
    
    // Phase 1: Primary searches (one per segment, first term)
    console.log("\n📋 Phase 1: Primary searches");
    for (const segment of segments.slice(0, 3)) { // Max 3 segments
      const terms = isProfessional 
        ? professionalSearchTerms[segment] 
        : representativeSearchTerms[segment];
      
      if (terms && terms[0]) {
        const query = `${terms[0]} ${location}`;
        if (!searchedQueries.has(query)) {
          searchedQueries.add(query);
          const results = await searchApify(query, location, state, coords, APIFY_API_KEY, 40);
          allResults.push(...results);
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }
    
    // Phase 2: Fallback searches if we have < 20 results
    if (allResults.length < 20) {
      console.log("\n📋 Phase 2: Fallback searches (need more results)");
      
      for (const segment of segments.slice(0, 2)) {
        const terms = isProfessional 
          ? professionalSearchTerms[segment] 
          : representativeSearchTerms[segment];
        
        // Try second variation
        if (terms && terms[1]) {
          const query = `${terms[1]} ${location}`;
          if (!searchedQueries.has(query)) {
            searchedQueries.add(query);
            const results = await searchApify(query, location, state, coords, APIFY_API_KEY, 30);
            allResults.push(...results);
            await new Promise(r => setTimeout(r, 200));
          }
        }
        
        if (allResults.length >= 40) break;
      }
    }
    
    // Phase 3: Generic fallback if still < 15 results
    if (allResults.length < 15) {
      console.log("\n📋 Phase 3: Generic fallback");
      const genericQuery = isProfessional 
        ? `profissional autônomo ${segments[0]} ${location}`
        : `representante comercial ${location}`;
      
      if (!searchedQueries.has(genericQuery)) {
        const results = await searchApify(genericQuery, location, state, coords, APIFY_API_KEY, 50);
        allResults.push(...results);
      }
    }

    console.log(`\n📊 Total raw results: ${allResults.length}`);

    // ============================================
    // PROCESS RESULTS
    // ============================================
    
    // Deduplicate
    const seenIds = new Set<string>();
    const seenPhones = new Set<string>();
    const uniqueResults = allResults.filter(place => {
      const id = place.placeId || place.title;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    console.log(`📊 Unique results: ${uniqueResults.length}`);

    const representatives: Representative[] = [];
    
    for (const place of uniqueResults) {
      // Validate phone
      const phoneRaw = place.phone || place.phoneUnformatted;
      const phoneValidation = validatePhone(phoneRaw);
      
      if (!phoneValidation.valid) continue;
      
      // Skip duplicate phones
      if (seenPhones.has(phoneValidation.normalized)) continue;
      seenPhones.add(phoneValidation.normalized);

      // Try to get email (non-blocking, with timeout)
      let email: string | undefined;
      if (place.website) {
        try {
          email = await scrapeEmailFromWebsite(place.website) || undefined;
        } catch {
          // Ignore
        }
      }

      const representative: Representative = {
        id: place.placeId || `rep-${Date.now()}-${representatives.length}`,
        name: place.title || 'Sem nome',
        phone: phoneValidation.normalized,
        whatsapp: phoneValidation.isWhatsApp ? phoneValidation.normalized : undefined,
        email,
        region: place.city ? `${place.city}, ${place.state || state}` : `${location}, ${state}`,
        segments: segments.slice(0, 2),
        description: place.description || place.categoryName || place.category,
        website: place.website,
        address: place.address || place.street,
        rating: place.totalScore || place.rating,
        reviewCount: place.reviewsCount,
        source: 'Google Maps',
        sourceUrl: place.url,
      };

      representatives.push(representative);
      
      if (representatives.length >= 50) break;
    }

    console.log(`\n✅ Final representatives: ${representatives.length}`);
    console.log(`📞 Total API calls: ${searchedQueries.size}`);

    return new Response(
      JSON.stringify({ 
        representatives,
        meta: {
          total: representatives.length,
          location: `${location}, ${state}`,
          segments: segments.join(", "),
          searchType: isProfessional ? "professionals" : "representatives",
          apiCalls: searchedQueries.size
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const status = errorMessage === 'INSUFFICIENT_CREDITS' ? 402 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage === 'INSUFFICIENT_CREDITS' ? 'Créditos Apify insuficientes' : errorMessage,
        representatives: []
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

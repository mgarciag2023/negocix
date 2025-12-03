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
  rating?: number;
  reviewCount?: number;
}

// Phone validation
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

// Extract email from website
async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return null;
    const html = await response.text();
    
    const mailtoMatch = html.match(/href=["']mailto:([^"']+)["']/i);
    if (mailtoMatch && mailtoMatch[1]) {
      const email = mailtoMatch[1].split('?')[0].trim();
      if (isValidEmail(email)) return email;
    }
    
    const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = html.match(emailPattern);
    
    if (emails && emails.length > 0) {
      const validEmails = emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return isValidEmail(email) && !lowerEmail.includes('example.com') && !lowerEmail.includes('wixpress.com');
      });
      if (validEmails.length > 0) return validEmails[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && !email.includes('..') && email.length <= 254;
}

const coordinates: { [key: string]: { lat: number; lng: number } } = {
  'Florianópolis': { lat: -27.5954, lng: -48.5480 },
  'Blumenau': { lat: -26.9194, lng: -49.0661 },
  'Joinville': { lat: -26.3045, lng: -48.8487 },
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Campinas': { lat: -22.9099, lng: -47.0626 },
  'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
  'Curitiba': { lat: -25.4284, lng: -49.2733 },
  'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
  'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
  'Salvador': { lat: -12.9714, lng: -38.5014 },
  'Recife': { lat: -8.0476, lng: -34.8770 },
  'Fortaleza': { lat: -3.7172, lng: -38.5433 },
  'Goiânia': { lat: -16.6869, lng: -49.2648 },
  'Brasília': { lat: -15.7942, lng: -47.8822 },
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

// Keywords to filter OUT non-representative results
const excludeKeywords = [
  'loja', 'store', 'shopping', 'mercado', 'supermercado', 'restaurante', 
  'bar', 'padaria', 'farmácia', 'posto de gasolina', 'hotel', 'pousada',
  'academia', 'salão', 'barbearia', 'escola', 'curso', 'igreja'
];

// Keywords that indicate real representatives/agencies
const includeKeywords = [
  'representante', 'representação', 'representações', 'agência', 'agencia',
  'comercial', 'vendas externas', 'atacado', 'distribuidor', 'distribuidora',
  'escritório', 'consultório', 'clínica', 'assessoria', 'consultoria'
];

const professionalSearchTerms: { [key: string]: string[] } = {
  'Engenheiros': ['escritório de engenharia civil', 'empresa de engenharia', 'engenheiro autônomo'],
  'Arquitetos': ['escritório de arquitetura', 'arquiteto autônomo', 'estúdio de arquitetura'],
  'Contadores': ['escritório de contabilidade', 'contador autônomo', 'contabilidade empresarial'],
  'Eletricistas': ['eletricista autônomo', 'empresa de instalações elétricas', 'eletricista industrial'],
  'Advogados': ['escritório de advocacia', 'advogado autônomo', 'banca de advogados'],
  'Médicos': ['consultório médico', 'médico autônomo', 'clínica médica particular'],
  'Dentistas': ['consultório odontológico', 'dentista autônomo', 'clínica odontológica'],
  'Nutricionistas': ['nutricionista clínico', 'consultório de nutrição', 'nutricionista esportivo'],
  'Psicólogos': ['psicólogo clínico', 'consultório de psicologia', 'psicólogo autônomo'],
  'Fisioterapeutas': ['fisioterapeuta autônomo', 'clínica de fisioterapia', 'estúdio de fisioterapia'],
  'Veterinários': ['clínica veterinária', 'veterinário autônomo', 'hospital veterinário'],
  'Fonoaudiólogos': ['fonoaudiólogo', 'clínica de fonoaudiologia', 'consultório fonoaudiologia'],
  'Terapeutas Ocupacionais': ['terapeuta ocupacional', 'clínica terapia ocupacional'],
  'Enfermeiros': ['enfermeiro autônomo', 'home care enfermagem', 'cuidador de idosos'],
  'Farmacêuticos': ['farmacêutico autônomo', 'consultoria farmacêutica'],
  'Biomédicos': ['biomédico', 'laboratório de análises clínicas'],
  'Corretores de Imóveis': ['corretor de imóveis', 'imobiliária', 'consultor imobiliário'],
  'Corretores de Seguros': ['corretor de seguros', 'corretora de seguros', 'consultor de seguros'],
  'Despachantes': ['despachante', 'despachante documentalista', 'despachante aduaneiro'],
  'Personal Trainers': ['personal trainer', 'treinador pessoal', 'preparador físico'],
  'Tradutores': ['tradutor juramentado', 'tradutor autônomo', 'serviço de tradução'],
  'Designers': ['designer gráfico', 'estúdio de design', 'designer freelancer'],
  'Programadores': ['programador freelancer', 'desenvolvedor autônomo', 'consultoria em TI'],
  'Consultores': ['consultor empresarial', 'consultoria empresarial', 'consultor de negócios'],
  'Economistas': ['economista', 'consultoria econômica', 'assessoria econômica'],
  'Administradores': ['administrador de empresas', 'consultoria administrativa'],
  'Publicitários': ['agência de publicidade', 'publicitário freelancer', 'marketing digital'],
  'Jornalistas': ['jornalista freelancer', 'assessoria de imprensa', 'redator'],
  'Fotógrafos': ['fotógrafo profissional', 'estúdio fotográfico', 'fotógrafo de eventos'],
  'Videomakers': ['videomaker', 'produtora de vídeo', 'editor de vídeo'],
};

const representativeSearchTerms: { [key: string]: string[] } = {
  'Alimentos': ['representante comercial alimentos', 'representação comercial alimentos', 'agência de representação alimentos'],
  'Bebidas': ['representante comercial bebidas', 'representação comercial bebidas', 'agência representação bebidas'],
  'Cosméticos': ['representante comercial cosméticos', 'representação cosméticos', 'vendedor externo cosméticos'],
  'Vestuário': ['representante comercial vestuário', 'representação moda', 'agência de moda atacado'],
  'Automotivo': ['representante comercial autopeças', 'representação automotiva', 'agência autopeças'],
  'Construção Civil': ['representante comercial construção', 'representação materiais construção', 'agência construção civil'],
  'Farmacêutico': ['representante comercial farmacêutico', 'representação farmacêutica', 'propagandista médico'],
  'Energia Solar': ['representante energia solar', 'representação energia solar', 'vendedor energia solar'],
  'Tecnologia': ['representante comercial tecnologia', 'representação tecnologia', 'agência de tecnologia'],
  'Saúde': ['representante comercial saúde', 'representação equipamentos médicos', 'vendedor equipamentos hospitalares'],
  'Ferramentas': ['representante comercial ferramentas', 'representação ferramentas', 'agência ferramentas'],
  'Material de Escritório': ['representante material escritório', 'representação papelaria', 'agência material escritório'],
  'Segurança': ['representante comercial segurança', 'representação equipamentos segurança', 'agência segurança eletrônica'],
  'Descartáveis': ['representante comercial descartáveis', 'representação descartáveis', 'agência embalagens'],
  'Plásticos': ['representante comercial plásticos', 'representação plásticos', 'agência plásticos'],
  'EPIs': ['representante comercial EPIs', 'representação equipamentos proteção', 'agência EPIs'],
  'Utilidades Domésticas': ['representante comercial utilidades', 'representação utilidades domésticas', 'agência bazar'],
  'Eletrônicos': ['representante comercial eletrônicos', 'representação eletrônicos'],
  'Materiais Elétricos': ['representante materiais elétricos', 'representação material elétrico'],
  'Agropecuária': ['representante comercial agropecuária', 'representação insumos agrícolas'],
  'Têxtil': ['representante comercial têxtil', 'representação tecidos'],
  'Químico': ['representante comercial químico', 'representação produtos químicos'],
  'Embalagens': ['representante comercial embalagens', 'representação embalagens'],
  'Máquinas e Equipamentos': ['representante comercial máquinas', 'representação equipamentos industriais'],
  'Móveis': ['representante comercial móveis', 'representação móveis'],
  'Papelaria': ['representante comercial papelaria', 'representação papelaria'],
  'Brinquedos': ['representante comercial brinquedos', 'representação brinquedos'],
  'Pet': ['representante comercial pet', 'representação pet shop'],
  'Higiene e Limpeza': ['representante comercial higiene', 'representação produtos limpeza'],
  'Suplementos': ['representante comercial suplementos', 'representação suplementos'],
  'Joias e Bijuterias': ['representante comercial joias', 'representação bijuterias'],
  'Calçados': ['representante comercial calçados', 'representação calçados'],
  'Bolsas e Acessórios': ['representante comercial bolsas', 'representação acessórios'],
  'Perfumaria': ['representante comercial perfumaria', 'representação perfumes'],
  'Cama, Mesa e Banho': ['representante comercial cama mesa banho', 'representação têxtil lar'],
  'Informática': ['representante comercial informática', 'representação informática'],
  'Celulares e Acessórios': ['representante comercial celulares', 'representação acessórios celular'],
  'Ar Condicionado': ['representante comercial ar condicionado', 'representação climatização'],
  'Refrigeração': ['representante comercial refrigeração', 'representação refrigeração'],
  'Iluminação': ['representante comercial iluminação', 'representação lâmpadas'],
  'Tintas e Pintura': ['representante comercial tintas', 'representação tintas'],
  'Hidráulica': ['representante comercial hidráulica', 'representação materiais hidráulicos'],
  'Jardinagem': ['representante comercial jardinagem', 'representação paisagismo'],
  'Piscinas': ['representante comercial piscinas', 'representação equipamentos piscina'],
  'Fitness': ['representante comercial fitness', 'representação equipamentos academia'],
  'Instrumentos Musicais': ['representante comercial instrumentos musicais', 'representação música'],
  'Artigos Religiosos': ['representante comercial artigos religiosos', 'representação religiosos'],
  'Artesanato': ['representante comercial artesanato', 'representação artesanato'],
  'Decoração': ['representante comercial decoração', 'representação decoração'],
  'Vidros': ['representante comercial vidros', 'representação vidraçaria'],
  'Madeira': ['representante comercial madeira', 'representação madeireira'],
  'Aço e Metalurgia': ['representante comercial aço', 'representação metalurgia'],
  'Borrachas': ['representante comercial borrachas', 'representação borrachas'],
  'Lubrificantes': ['representante comercial lubrificantes', 'representação óleos'],
  'Alimentos Congelados': ['representante comercial congelados', 'representação alimentos congelados'],
  'Doces e Chocolates': ['representante comercial doces', 'representação chocolates'],
  'Café': ['representante comercial café', 'representação café'],
  'Cereais e Grãos': ['representante comercial cereais', 'representação grãos'],
  'Laticínios': ['representante comercial laticínios', 'representação laticínios'],
  'Carnes': ['representante comercial carnes', 'representação frigorífico'],
  'Pescados': ['representante comercial pescados', 'representação pescados'],
  'Orgânicos': ['representante comercial orgânicos', 'representação produtos orgânicos'],
  'Sucos e Polpas': ['representante comercial sucos', 'representação polpas'],
  'Água Mineral': ['representante comercial água mineral', 'representação bebidas'],
  'Sorvetes': ['representante comercial sorvetes', 'representação sorvetes'],
  'Padaria': ['representante comercial padaria', 'representação panificação'],
  'Rotisseria': ['representante comercial rotisseria', 'representação alimentos prontos'],
};

// Normalize text for comparison (remove accents and lowercase)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Function to check if a place is likely a real representative/professional
function isLikelyRepresentative(place: any, isProfessional: boolean): boolean {
  const title = normalizeText(place.title || '');
  const category = normalizeText(place.categoryName || place.category || '');
  const description = normalizeText(place.description || '');
  const combined = `${title} ${category} ${description}`;
  
  // Check for exclude keywords (but be less aggressive)
  const strictExcludes = ['supermercado', 'restaurante', 'padaria', 'farmacia', 'hotel', 'pousada', 'academia', 'igreja'];
  for (const keyword of strictExcludes) {
    if (title.includes(keyword) && !title.includes('representante') && !title.includes('representacao')) {
      console.log(`⛔ Excluding "${place.title}" - contains strict exclude keyword: ${keyword}`);
      return false;
    }
  }
  
  // For professionals, be more permissive - accept if category matches or has professional terms
  if (isProfessional) {
    const professionalIndicators = [
      'escritorio', 'consultorio', 'clinica', 'estudio', 'autonomo', 
      'dr.', 'dra.', 'engenharia', 'arquitetura', 'contabilidade', 
      'advocacia', 'advogado', 'contador', 'engenheiro', 'arquiteto',
      'medico', 'dentista', 'psicologo', 'nutricionista', 'fisioterapeuta',
      'veterinario', 'corretor', 'designer', 'fotografo', 'consultor'
    ];
    const categoryIndicators = [
      'engineer', 'architect', 'lawyer', 'doctor', 'dentist', 'accountant', 
      'consultant', 'veterinarian', 'psychologist', 'nutritionist', 'physical therapist',
      'real estate agent', 'insurance agent', 'photographer', 'designer'
    ];
    
    const hasIndicator = professionalIndicators.some(ind => combined.includes(ind));
    const hasCategoryMatch = categoryIndicators.some(ind => category.includes(ind));
    
    // Accept if has any indicator or category match
    if (!hasIndicator && !hasCategoryMatch) {
      // Last chance: check if title contains profession-related words
      const professionWords = ['engenharia', 'arquitetura', 'contabil', 'advocacia', 'veterinar', 'odonto', 'fisio'];
      const hasProfessionWord = professionWords.some(w => title.includes(w));
      if (!hasProfessionWord) {
        console.log(`⛔ Excluding "${place.title}" - no professional indicator found`);
        return false;
      }
    }
  } else {
    // For representatives, check for representative-related keywords
    const repIndicators = [
      'representante', 'representacao', 'representacoes', 'agencia', 
      'comercial', 'distribuidor', 'distribuidora', 'atacado', 'vendas'
    ];
    const hasRepIndicator = repIndicators.some(ind => combined.includes(ind));
    if (!hasRepIndicator) {
      console.log(`⛔ Excluding "${place.title}" - no representative indicator found`);
      return false;
    }
  }
  
  return true;
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

    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      console.error("APIFY_API_KEY not configured");
      throw new Error("APIFY_API_KEY not configured");
    }

    const location = city || stateCapitals[state] || state;
    const professionalSegments = Object.keys(professionalSearchTerms);
    const isProfessionalSearch = segments.some(s => professionalSegments.includes(s));
    
    const searchQueries: string[] = [];
    
    // Use only the FIRST search term per segment to minimize API calls
    for (const segment of segments) {
      if (professionalSearchTerms[segment]) {
        searchQueries.push(`${professionalSearchTerms[segment][0]} ${location} ${state}`);
      } else if (representativeSearchTerms[segment]) {
        searchQueries.push(`${representativeSearchTerms[segment][0]} ${location} ${state}`);
      } else {
        searchQueries.push(`representante comercial ${segment} ${location} ${state}`);
      }
    }
    
    // LIMIT TO MAX 2 QUERIES to save Apify credits
    const uniqueQueries = [...new Set(searchQueries)].slice(0, 2);
    console.log(`🔍 Search queries (${uniqueQueries.length}):`, uniqueQueries);

    let coords = coordinates[location];
    if (!coords) {
      const capital = stateCapitals[state];
      coords = coordinates[capital] || { lat: -23.5505, lng: -46.6333 };
    }
    
    console.log(`📍 Using coordinates for ${location}:`, coords);

    const allResults: any[] = [];
    
    for (const query of uniqueQueries) {
      console.log(`🔎 Searching: "${query}"`);
      
      try {
        const apifyResponse = await fetch(
          `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchStringsArray: [query],
              locationQuery: `${location}, ${state}, Brazil`,
              lat: coords.lat.toString(),
              lng: coords.lng.toString(),
              maxCrawledPlacesPerSearch: 25,
              maxAutomaticZoomOut: 3,
              skipClosedPlaces: true,
              scrapeReviewsNumber: 0,
              language: 'pt-BR',
              searchMatching: 'all',
            }),
          }
        );

        if (apifyResponse.ok) {
          const results = await apifyResponse.json();
          console.log(`✅ Got ${results.length} results for "${query}"`);
          allResults.push(...results);
        } else {
          const errorText = await apifyResponse.text();
          console.error(`❌ Apify error for "${query}":`, apifyResponse.status, errorText);
          
          if (apifyResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: "Créditos Apify insuficientes", representatives: [] }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (error) {
        console.error(`Error searching "${query}":`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`📊 Total raw results: ${allResults.length}`);

    const seenIds = new Set<string>();
    const uniqueResults = allResults.filter(place => {
      const id = place.placeId || place.title;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    console.log(`📊 Unique results after dedup: ${uniqueResults.length}`);

    const representatives: Representative[] = [];
    
    for (const place of uniqueResults.slice(0, 100)) {
      // First check if it's likely a real representative/professional
      if (!isLikelyRepresentative(place, isProfessionalSearch)) {
        continue;
      }
      
      const phoneRaw = place.phone || place.phoneUnformatted;
      const phoneValidation = validatePhone(phoneRaw);
      
      if (!phoneValidation.valid) {
        console.log(`⏭️ Skipping "${place.title}" - no valid phone`);
        continue;
      }

      let email: string | undefined;
      if (place.website) {
        email = await scrapeEmailFromWebsite(place.website) || undefined;
      }

      const placeSegments: string[] = [];
      const categoryLower = (place.categoryName || place.category || '').toLowerCase();
      const titleLower = (place.title || '').toLowerCase();
      
      if (isProfessionalSearch) {
        for (const seg of segments) {
          const terms = professionalSearchTerms[seg] || [];
          if (terms.some(t => categoryLower.includes(t.toLowerCase()) || titleLower.includes(t.toLowerCase()))) {
            placeSegments.push(seg);
          }
        }
      } else {
        placeSegments.push(...segments.slice(0, 2));
      }

      if (placeSegments.length === 0) {
        placeSegments.push(segments[0]);
      }

      const representative: Representative = {
        id: place.placeId || `rep-${Date.now()}-${representatives.length}`,
        name: place.title || 'Sem nome',
        phone: phoneValidation.normalized,
        whatsapp: phoneValidation.isWhatsApp ? phoneValidation.normalized : undefined,
        email,
        region: place.city ? `${place.city}, ${place.state || state}` : `${location}, ${state}`,
        segments: placeSegments,
        description: place.description || place.categoryName || categoryLower,
        website: place.website,
        address: place.address || place.street,
        rating: place.totalScore || place.rating,
        reviewCount: place.reviewsCount,
        source: 'Google Maps',
        sourceUrl: place.url,
      };

      representatives.push(representative);
      
      // Limit to 50 verified representatives
      if (representatives.length >= 50) break;
    }

    console.log(`✅ Final representatives: ${representatives.length}`);

    return new Response(
      JSON.stringify({ 
        representatives,
        meta: {
          total: representatives.length,
          location: `${location}, ${state}`,
          segments: segments.join(", "),
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

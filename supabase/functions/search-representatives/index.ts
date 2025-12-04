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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && !email.includes('..') && email.length <= 254;
}

// Extract email from website using Apify
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
  'Manaus': { lat: -3.1190, lng: -60.0217 },
  'Belém': { lat: -1.4558, lng: -48.4902 },
  'Vitória': { lat: -20.3155, lng: -40.3128 },
  'Natal': { lat: -5.7793, lng: -35.2009 },
  'Maceió': { lat: -9.6658, lng: -35.7350 },
  'João Pessoa': { lat: -7.1195, lng: -34.8450 },
  'Teresina': { lat: -5.0892, lng: -42.8019 },
  'Campo Grande': { lat: -20.4697, lng: -54.6201 },
  'Cuiabá': { lat: -15.6014, lng: -56.0979 },
  'Aracaju': { lat: -10.9472, lng: -37.0731 },
};

// Professional search terms - searches for the professionals themselves
const professionalSearchTerms: { [key: string]: string } = {
  'Engenheiros': 'engenheiro civil estrutural',
  'Arquitetos': 'arquiteto designer interiores',
  'Contadores': 'contador escritório contabilidade',
  'Eletricistas': 'eletricista instalador elétrico',
  'Advogados': 'advogado escritório advocacia',
  'Médicos': 'médico clínico consultório',
  'Dentistas': 'dentista consultório odontológico',
  'Nutricionistas': 'nutricionista clínico',
  'Psicólogos': 'psicólogo clínico terapeuta',
  'Fisioterapeutas': 'fisioterapeuta clínica fisioterapia',
  'Veterinários': 'veterinário clínica veterinária',
  'Fonoaudiólogos': 'fonoaudiólogo clínica',
  'Terapeutas Ocupacionais': 'terapeuta ocupacional',
  'Enfermeiros': 'enfermeiro home care',
  'Farmacêuticos': 'farmacêutico consultor',
  'Biomédicos': 'biomédico laboratório',
  'Corretores de Imóveis': 'corretor imóveis imobiliária',
  'Corretores de Seguros': 'corretor seguros corretora',
  'Despachantes': 'despachante documentalista',
  'Personal Trainers': 'personal trainer treinador',
  'Tradutores': 'tradutor juramentado',
  'Designers': 'designer gráfico freelancer',
  'Programadores': 'programador desenvolvedor TI',
  'Consultores': 'consultor empresarial',
  'Economistas': 'economista consultoria',
  'Administradores': 'administrador empresas',
  'Publicitários': 'publicitário agência marketing',
  'Jornalistas': 'jornalista assessoria imprensa',
  'Fotógrafos': 'fotógrafo profissional estúdio',
  'Videomakers': 'videomaker produtora vídeo',
};

// Representative search terms
const representativeSearchTerms: { [key: string]: string } = {
  'Alimentos': 'representante comercial alimentos',
  'Bebidas': 'representante comercial bebidas',
  'Cosméticos': 'representante comercial cosméticos',
  'Vestuário': 'representante comercial vestuário moda',
  'Automotivo': 'representante comercial autopeças',
  'Construção Civil': 'representante materiais construção',
  'Farmacêutico': 'representante comercial farmacêutico',
  'Energia Solar': 'representante energia solar fotovoltaico',
  'Tecnologia': 'representante comercial tecnologia',
  'Saúde': 'representante equipamentos médicos',
  'Ferramentas': 'representante comercial ferramentas',
  'Material de Escritório': 'representante material escritório',
  'Segurança': 'representante equipamentos segurança',
  'Descartáveis': 'representante comercial descartáveis',
  'Plásticos': 'representante comercial plásticos',
  'EPIs': 'representante comercial EPIs segurança',
  'Utilidades Domésticas': 'representante utilidades domésticas',
  'Eletrônicos': 'representante comercial eletrônicos',
  'Materiais Elétricos': 'representante materiais elétricos',
  'Agropecuária': 'representante comercial agropecuária',
  'Têxtil': 'representante comercial têxtil tecidos',
  'Químico': 'representante produtos químicos',
  'Embalagens': 'representante comercial embalagens',
  'Máquinas e Equipamentos': 'representante máquinas industriais',
  'Móveis': 'representante comercial móveis',
  'Papelaria': 'representante comercial papelaria',
  'Brinquedos': 'representante comercial brinquedos',
  'Pet': 'representante comercial pet shop',
  'Higiene e Limpeza': 'representante produtos limpeza',
  'Suplementos': 'representante comercial suplementos',
  'Joias e Bijuterias': 'representante comercial joias',
  'Calçados': 'representante comercial calçados',
  'Bolsas e Acessórios': 'representante bolsas acessórios',
  'Perfumaria': 'representante comercial perfumes',
  'Cama, Mesa e Banho': 'representante cama mesa banho',
  'Informática': 'representante comercial informática',
  'Celulares e Acessórios': 'representante celulares acessórios',
  'Ar Condicionado': 'representante ar condicionado',
  'Refrigeração': 'representante comercial refrigeração',
  'Iluminação': 'representante comercial iluminação',
  'Tintas e Pintura': 'representante comercial tintas',
  'Hidráulica': 'representante materiais hidráulicos',
  'Jardinagem': 'representante comercial jardinagem',
  'Piscinas': 'representante equipamentos piscina',
  'Fitness': 'representante equipamentos fitness',
  'Instrumentos Musicais': 'representante instrumentos musicais',
  'Artigos Religiosos': 'representante artigos religiosos',
  'Artesanato': 'representante comercial artesanato',
  'Decoração': 'representante comercial decoração',
  'Vidros': 'representante comercial vidros',
  'Madeira': 'representante comercial madeira',
  'Aço e Metalurgia': 'representante comercial aço',
  'Borrachas': 'representante comercial borrachas',
  'Lubrificantes': 'representante comercial lubrificantes',
  'Alimentos Congelados': 'representante alimentos congelados',
  'Doces e Chocolates': 'representante doces chocolates',
  'Café': 'representante comercial café',
  'Cereais e Grãos': 'representante comercial cereais',
  'Laticínios': 'representante comercial laticínios',
  'Carnes': 'representante comercial carnes',
  'Pescados': 'representante comercial pescados',
  'Orgânicos': 'representante produtos orgânicos',
  'Sucos e Polpas': 'representante comercial sucos',
  'Água Mineral': 'representante água mineral',
  'Sorvetes': 'representante comercial sorvetes',
  'Padaria': 'representante comercial panificação',
  'Rotisseria': 'representante alimentos prontos',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: SearchConfig = await req.json();
    console.log("🔍 Search config:", JSON.stringify(config));

    const { segments, city, state } = config;

    if (!segments || segments.length === 0 || !state) {
      return new Response(
        JSON.stringify({ error: "Segmentos e estado são obrigatórios", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      console.error("❌ APIFY_API_KEY not configured");
      throw new Error("APIFY_API_KEY not configured");
    }

    const location = city || stateCapitals[state] || state;
    const professionalSegments = Object.keys(professionalSearchTerms);
    const isProfessional = segments.some(s => professionalSegments.includes(s));
    
    // Build search queries - ONE per segment, simple and direct
    const searchQueries: string[] = [];
    for (const segment of segments) {
      if (professionalSearchTerms[segment]) {
        searchQueries.push(`${professionalSearchTerms[segment]} ${location}`);
      } else if (representativeSearchTerms[segment]) {
        searchQueries.push(`${representativeSearchTerms[segment]} ${location}`);
      } else {
        searchQueries.push(`representante comercial ${segment} ${location}`);
      }
    }
    
    // Limit to 2 queries max to save API credits
    const uniqueQueries = [...new Set(searchQueries)].slice(0, 2);
    console.log(`📋 Search queries (${uniqueQueries.length}):`, uniqueQueries);

    // Get coordinates
    let coords = coordinates[location];
    if (!coords) {
      const capital = stateCapitals[state];
      coords = coordinates[capital] || { lat: -23.5505, lng: -46.6333 };
    }
    console.log(`📍 Coordinates for ${location}:`, coords);

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
              maxCrawledPlacesPerSearch: 50, // Increased for more results
              maxAutomaticZoomOut: 5,
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
          console.error(`❌ Apify error for "${query}":`, apifyResponse.status, errorText.slice(0, 200));
          
          if (apifyResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: "Créditos Apify insuficientes", representatives: [] }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (error) {
        console.error(`❌ Error searching "${query}":`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`📊 Total raw results: ${allResults.length}`);

    // Deduplicate by placeId
    const seenIds = new Set<string>();
    const uniqueResults = allResults.filter(place => {
      const id = place.placeId || place.title;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    console.log(`📊 Unique results: ${uniqueResults.length}`);

    const representatives: Representative[] = [];
    
    // Process ALL results - NO FILTERING except for valid phone
    for (const place of uniqueResults) {
      const phoneRaw = place.phone || place.phoneUnformatted;
      const phoneValidation = validatePhone(phoneRaw);
      
      // Only require valid phone - that's it!
      if (!phoneValidation.valid) {
        continue;
      }

      // Try to get email from website
      let email: string | undefined;
      if (place.website) {
        try {
          email = await scrapeEmailFromWebsite(place.website) || undefined;
        } catch {
          // Ignore email scraping errors
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
      console.log(`✅ Added: ${representative.name} - ${representative.phone}`);
      
      // Limit to 50 results
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
          searchType: isProfessional ? "professionals" : "representatives"
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in search-representatives:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        representatives: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

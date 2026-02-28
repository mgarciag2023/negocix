import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchConfig {
  city?: string;
  state: string;
  user_id?: string;
}

interface Representative {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  address: string;
  website?: string;
  rating?: number;
}

const stateNames: { [key: string]: string } = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
  'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

// Major cities per state for state-wide searches
const stateCities: { [key: string]: string[] } = {
  'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira'],
  'AL': ['Maceió', 'Arapiraca', 'Rio Largo', 'Palmeira dos Índios'],
  'AP': ['Macapá', 'Santana', 'Laranjal do Jari'],
  'AM': ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru'],
  'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Lauro de Freitas', 'Ilhéus'],
  'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato'],
  'DF': ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras'],
  'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim', 'Linhares', 'Colatina', 'Guarapari', 'São Mateus', 'Aracruz'],
  'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Catalão'],
  'MA': ['São Luís', 'Imperatriz', 'Timon', 'Caxias', 'Codó'],
  'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra'],
  'MS': ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã'],
  'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Uberaba', 'Governador Valadares'],
  'PA': ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal'],
  'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos'],
  'PR': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu'],
  'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista'],
  'PI': ['Teresina', 'Parnaíba', 'Picos', 'Piripiri'],
  'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Campos dos Goytacazes', 'Petrópolis'],
  'RN': ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante'],
  'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Novo Hamburgo'],
  'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena'],
  'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí'],
  'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma', 'Itajaí'],
  'SP': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Sorocaba'],
  'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana'],
  'TO': ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional'],
};

// ============================================
// PHONE VALIDATION
// ============================================

function validateBrazilianPhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    const ddd = digitsOnly.substring(2, 4);
    const dddNum = parseInt(ddd, 10);
    if (dddNum < 11 || dddNum > 99) return { valid: false, normalized: '', isWhatsApp: false };
    const isMobile = digitsOnly.length === 13 && digitsOnly.charAt(4) === '9';
    return { valid: true, normalized: digitsOnly, isWhatsApp: isMobile };
  }
  
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const ddd = digitsOnly.substring(0, 2);
    const dddNum = parseInt(ddd, 10);
    if (dddNum < 11 || dddNum > 99) return { valid: false, normalized: '', isWhatsApp: false };
    const isMobile = digitsOnly.length === 11 && digitsOnly.charAt(2) === '9';
    return { valid: true, normalized: `55${digitsOnly}`, isWhatsApp: isMobile };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const number = digits.substring(4);
    if (number.length === 9) {
      return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    } else if (number.length === 8) {
      return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
  }
  return phone;
}

// ============================================
// EXCLUSION FILTER
// ============================================

const EXCLUSION_TERMS = [
  'supermercado', 'mercado', 'mercearia',
  'restaurante', 'lanchonete', 'padaria', 'pizzaria',
  'oficina', 'mecânica', 'mecanica',
  'posto de combustível', 'posto de combustivel',
  'farmácia', 'farmacia', 'drogaria',
  'hotel', 'pousada', 'hostel',
  'escola', 'colégio', 'colegio', 'faculdade', 'universidade',
  'hospital', 'clínica', 'clinica', 'laboratório', 'laboratorio',
  'academia', 'gym', 'fitness',
  'banco', 'financeira',
  'despachante', 'cartório', 'cartorio',
  'igreja', 'templo', 'paróquia', 'paroquia',
  'salão de beleza', 'barbearia',
  'pet shop', 'veterinária', 'veterinario',
  'lavanderia', 'tinturaria',
  'gráfica', 'grafica'
];

function isRepresentationCompany(name: string): boolean {
  const lowerName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const term of EXCLUSION_TERMS) {
    const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerName.includes(normalizedTerm)) {
      return false;
    }
  }
  
  return true;
}

// ============================================
// GOOGLE PLACES API SEARCH
// ============================================

async function searchGooglePlaces(query: string, apiKey: string, limit: number = 20): Promise<any[]> {
  const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus';

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'pt',
        regionCode: 'BR',
        maxResultCount: Math.min(limit, 20),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google Places error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const places = data.places || [];
    
    return places.map((place: any) => ({
      business_id: place.id || '',
      place_id: place.id || '',
      name: place.displayName?.text || '',
      full_address: place.formattedAddress || '',
      phone_number: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      rating: place.rating || 0,
      review_count: place.userRatingCount || 0,
      business_status: place.businessStatus || 'OPERATIONAL',
    }));
  } catch (error) {
    console.error('❌ Google Places search error:', error);
    return [];
  }
}

// ============================================
// SEARCH QUERY BUILDER
// ============================================

function buildSearchQueries(location: string): string[] {
  return [
    `representação comercial ${location}`,
    `representações comerciais ${location}`,
    `empresa de representação ${location}`,
    `representante comercial ${location}`,
    `escritório de representação ${location}`,
    `agente comercial ${location}`,
    `assessoria comercial ${location}`,
    `representação comercial de alimentos ${location}`,
    `representação comercial vendas ${location}`,
    `rep comercial ${location}`,
    `representação comercial de bebidas ${location}`,
    `representação comercial de cosméticos ${location}`,
    `representação comercial de materiais ${location}`,
    `representação comercial de produtos ${location}`,
    `representação comercial atacado ${location}`,
    `representação comercial industrial ${location}`,
    `representação comercial autônomo ${location}`,
    `escritório de vendas ${location}`,
    `promotor de vendas ${location}`,
    `consultor comercial ${location}`,
    `intermediação comercial ${location}`,
    `agenciamento comercial ${location}`,
    `representação comercial de limpeza ${location}`,
    `representação comercial de embalagens ${location}`,
    `representação comercial de ferramentas ${location}`,
    `representação comercial de eletrônicos ${location}`,
    `representação comercial de construção ${location}`,
    `representação comercial de medicamentos ${location}`,
    `representação comercial de peças ${location}`,
    `representação comercial de equipamentos ${location}`,
    `representação comercial de máquinas ${location}`,
    `representação comercial de têxtil ${location}`,
    `representação comercial de papelaria ${location}`,
    `representação comercial de informática ${location}`,
    `representação comercial de plásticos ${location}`,
  ];
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
    console.log("🚀 Search Representatives Config:", JSON.stringify(config));

    const { city, state, user_id } = config;

    if (!state) {
      return new Response(
        JSON.stringify({ error: "Estado é obrigatório", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY not configured");
    }

    // Fetch user-specific limit
    let MAX_RESULTS = 150;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey && user_id) {
        const res = await fetch(`${supabaseUrl}/rest/v1/user_lead_limits?user_id=eq.${user_id}&select=representatives_per_search`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const limits = await res.json();
        if (limits?.[0]?.representatives_per_search) {
          MAX_RESULTS = limits[0].representatives_per_search;
        }
      }
    } catch (e) {
      console.error("Error fetching user limit:", e);
    }

    const stateName = stateNames[state] || state;
    const isStateSearch = !city;
    
    console.log(`📍 Searching representatives - State: ${state}, City: ${city || 'ALL'}, Limit: ${MAX_RESULTS}`);

    const allPlaces: any[] = [];
    const seenIds = new Set<string>();

    const addPlaces = (places: any[]) => {
      for (const place of places) {
        const id = place.business_id || place.place_id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allPlaces.push(place);
        }
      }
    };

    if (isStateSearch) {
      // STATE-WIDE SEARCH: search across major cities
      const cities = stateCities[state] || [stateName];
      console.log(`🏙️ State search: querying ${cities.length} cities for ${state}`);

      // For each city, use a subset of queries to avoid timeout
      const coreQueries = [
        'representação comercial',
        'representante comercial',
        'representações comerciais',
        'empresa de representação',
        'agente comercial',
        'assessoria comercial',
        'escritório de representação',
        'rep comercial',
        'representação comercial de alimentos',
        'representação comercial atacado',
        'representação comercial industrial',
        'representação comercial de bebidas',
        'representação comercial de produtos',
        'representação comercial vendas',
        'consultor comercial',
      ];

      const allSearchPromises: Promise<any[]>[] = [];
      
      for (const cityName of cities) {
        const location = `${cityName}, ${stateName}`;
        for (const q of coreQueries) {
          allSearchPromises.push(searchGooglePlaces(`${q} ${location}`, GOOGLE_PLACES_API_KEY, 20));
        }
      }

      // Also search with just the state name
      const stateQueries = buildSearchQueries(stateName);
      for (const q of stateQueries) {
        allSearchPromises.push(searchGooglePlaces(q, GOOGLE_PLACES_API_KEY, 20));
      }

      console.log(`🔍 Total search requests: ${allSearchPromises.length}`);
      
      const results = await Promise.all(allSearchPromises);
      for (const resultList of results) {
        addPlaces(resultList);
      }
    } else {
      // CITY SEARCH: use all query variations
      const location = `${city}, ${stateName}`;
      const searchQueries = buildSearchQueries(location);
      
      const searchPromises = searchQueries.map(query => searchGooglePlaces(query, GOOGLE_PLACES_API_KEY, 20));
      const results = await Promise.all(searchPromises);
      
      for (const resultList of results) {
        addPlaces(resultList);
      }
    }

    console.log(`📊 Found ${allPlaces.length} unique places from searches`);

    // Filter to only valid representation companies
    const validPlaces = allPlaces.filter(place => isRepresentationCompany(place.name || ''));

    console.log(`✅ After filtering: ${validPlaces.length} representation companies`);

    // Build final representatives list
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();

    for (const place of validPlaces) {
      const phone = place.phone_number || '';
      const phoneValidation = validateBrazilianPhone(phone);
      
      if (!phoneValidation.valid) {
        continue;
      }

      if (seenPhones.has(phoneValidation.normalized)) {
        continue;
      }
      
      seenPhones.add(phoneValidation.normalized);

      representatives.push({
        id: place.business_id || place.place_id || `rep-${Date.now()}`,
        name: place.name || 'Empresa de Representação',
        phone: formatPhoneDisplay(phoneValidation.normalized),
        whatsapp: phoneValidation.normalized,
        address: place.full_address || '',
        website: place.website || undefined,
        rating: place.rating || undefined
      });

      if (representatives.length >= MAX_RESULTS) break;
    }

    // Sort by rating
    representatives.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    const withPhone = representatives.filter(r => r.phone).length;
    const withWhatsapp = representatives.filter(r => r.whatsapp).length;
    
    console.log(`✅ Final: ${representatives.length} representatives (${withPhone} with phone, ${withWhatsapp} with WhatsApp)`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location: city ? `${city}, ${stateName}` : stateName,
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
        error: error instanceof Error ? error.message : "Erro ao buscar representantes",
        representatives: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

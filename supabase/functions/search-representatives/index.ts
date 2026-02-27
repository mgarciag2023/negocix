import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Using Google Places API (New)

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
// RELAXED FILTERING - REPRESENTATION COMPANIES
// ============================================

const ACCEPTED_TERMS = [
  'representaç', 'representac', 'representante', 'representacao', 'representação',
  'rep comercial', 'rep. comercial',
  'agente comercial', 'agenciamento', 'intermediação comercial',
  'vendas externas', 'promotor de vendas', 'consultor comercial',
  'assessoria comercial', 'escritório comercial'
];

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
  
  // Exclude obvious non-representation businesses
  for (const term of EXCLUSION_TERMS) {
    const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerName.includes(normalizedTerm)) {
      console.log(`❌ Excluded "${name}" - contains "${term}"`);
      return false;
    }
  }
  
  // RELAXED: Accept any result that wasn't excluded
  // Google already filters for relevance based on our search queries
  console.log(`✅ Accepted "${name}" - not excluded (relaxed mode)`);
  return true;
}

// ============================================
// GOOGLE PLACES API SEARCH
// ============================================

async function searchGooglePlaces(query: string, apiKey: string, limit: number = 20): Promise<any[]> {
  const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus';

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
    
    // Map to compatible format
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
    let MAX_RESULTS = 30;
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
    const location = city ? `${city}, ${stateName}` : stateName;
    
    console.log(`📍 Searching representatives in: ${location} (limit: ${MAX_RESULTS})`);

    const searchQueries = [
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
    ];

    const allPlaces: any[] = [];
    const seenIds = new Set<string>();

    // Execute searches in parallel
    const searchPromises = searchQueries.map(query => searchGooglePlaces(query, GOOGLE_PLACES_API_KEY, 20));
    const results = await Promise.all(searchPromises);
    
    for (const resultList of results) {
      for (const place of resultList) {
        const id = place.business_id || place.place_id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allPlaces.push(place);
        }
      }
    }

    console.log(`📊 Found ${allPlaces.length} places from searches`);

    // Filter strictly to only active representation companies
    const validPlaces = allPlaces.filter(place => {
      const name = place.name || '';
      return isRepresentationCompany(name);
    });

    console.log(`✅ After strict filtering: ${validPlaces.length} representation companies`);

    // Build final representatives list
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();

    for (const place of validPlaces) {
      const phone = place.phone_number || '';
      const phoneValidation = validateBrazilianPhone(phone);
      
      // Skip duplicates by phone
      if (phoneValidation.valid && seenPhones.has(phoneValidation.normalized)) {
        continue;
      }
      
      if (phoneValidation.valid) {
        seenPhones.add(phoneValidation.normalized);
      }

      // Only include representatives with confirmed WhatsApp numbers
      if (!phoneValidation.isWhatsApp) {
        console.log(`⏭️ Skipping "${place.name}" - no WhatsApp number`);
        continue;
      }

      representatives.push({
        id: place.business_id || place.place_id || `rep-${Date.now()}`,
        name: place.name || 'Empresa de Representação',
        phone: formatPhoneDisplay(phoneValidation.normalized),
        whatsapp: phoneValidation.normalized,
        address: place.full_address || location,
        website: place.website || undefined,
        rating: place.rating || undefined
      });

      if (representatives.length >= MAX_RESULTS) break;
    }

    // Sort: those with phones first, then by rating
    representatives.sort((a, b) => {
      if (a.phone && !b.phone) return -1;
      if (!a.phone && b.phone) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

    const withPhone = representatives.filter(r => r.phone).length;
    const withWhatsapp = representatives.filter(r => r.whatsapp).length;
    
    console.log(`✅ Final: ${representatives.length} representatives (${withPhone} with phone, ${withWhatsapp} with WhatsApp)`);

    return new Response(
      JSON.stringify({ 
        representatives,
        searchInfo: {
          location,
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

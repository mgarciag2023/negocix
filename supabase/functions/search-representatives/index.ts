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

// ============================================
// PHONE VALIDATION
// ============================================

function validateBrazilianPhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Format: 55 + DDD (2 digits) + number (8 or 9 digits)
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    const ddd = digitsOnly.substring(2, 4);
    const dddNum = parseInt(ddd, 10);
    if (dddNum < 11 || dddNum > 99) return { valid: false, normalized: '', isWhatsApp: false };
    
    // WhatsApp: 11 digits with '9' at position 3 (after DDD)
    const isMobile = digitsOnly.length === 13 && digitsOnly.charAt(4) === '9';
    return { valid: true, normalized: digitsOnly, isWhatsApp: isMobile };
  }
  
  // Format: DDD (2 digits) + number (8 or 9 digits)
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const ddd = digitsOnly.substring(0, 2);
    const dddNum = parseInt(ddd, 10);
    if (dddNum < 11 || dddNum > 99) return { valid: false, normalized: '', isWhatsApp: false };
    
    // WhatsApp: 11 digits with '9' at position 3
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
// STRICT FILTERING - ONLY REPRESENTATION COMPANIES
// ============================================

// Terms that MUST appear in the name to be considered a representation company
const REQUIRED_TERMS = [
  'representaç', 'representac', 'representante', 'representacao', 'representação',
  'rep comercial', 'rep. comercial'
];

// Terms that EXCLUDE the result (distributors, stores, etc.)
const EXCLUSION_TERMS = [
  'distribuidora', 'distribuidor', 'atacado', 'atacadista', 
  'loja', 'store', 'varejo', 'variedades',
  'supermercado', 'mercado', 'mercearia',
  'restaurante', 'bar', 'lanchonete', 'padaria', 'pizzaria',
  'oficina', 'mecânica', 'mecanica', 'auto peças', 'autopeças',
  'posto', 'combustível', 'combustivel',
  'farmácia', 'farmacia', 'drogaria',
  'hotel', 'pousada', 'hostel',
  'escola', 'colégio', 'colegio', 'faculdade', 'universidade',
  'hospital', 'clínica', 'clinica', 'laboratório', 'laboratorio',
  'academia', 'gym', 'fitness',
  'banco', 'financeira', 'crédito', 'credito',
  'imobiliária', 'imobiliaria', 'construtora',
  'despachante', 'cartório', 'cartorio',
  'igreja', 'templo', 'paróquia', 'paroquia',
  'salão', 'salao', 'barbearia', 'beleza',
  'pet shop', 'veterinária', 'veterinario',
  'lavanderia', 'lava', 'tinturaria',
  'eletrônica', 'eletronica', 'celular', 'assistência técnica',
  'serralheria', 'marcenaria', 'vidraçaria', 'vidracaria',
  'transportadora', 'transporte', 'frete', 'mudança', 'mudanca',
  'gráfica', 'grafica', 'impressão', 'impressao',
  'escritório contábil', 'contabilidade', 'contador'
];

function isRepresentationCompany(name: string, types: string[] = []): boolean {
  const lowerName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check for exclusion terms first
  for (const term of EXCLUSION_TERMS) {
    const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerName.includes(normalizedTerm)) {
      console.log(`❌ Excluded "${name}" - contains "${term}"`);
      return false;
    }
  }
  
  // Must contain at least one required term
  for (const term of REQUIRED_TERMS) {
    const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerName.includes(normalizedTerm)) {
      console.log(`✅ Accepted "${name}" - contains "${term}"`);
      return true;
    }
  }
  
  console.log(`❌ Rejected "${name}" - no required terms found`);
  return false;
}

// ============================================
// GOOGLE PLACES API
// ============================================

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  types?: string[];
}

async function searchPlaces(
  query: string, 
  location: string, 
  apiKey: string,
  pageToken?: string
): Promise<{ places: PlaceResult[]; nextPageToken?: string }> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  
  const body: any = {
    textQuery: query,
    locationBias: {
      rectangle: {
        low: { latitude: -33.75, longitude: -73.99 },
        high: { latitude: 5.27, longitude: -34.79 }
      }
    },
    languageCode: 'pt-BR',
    maxResultCount: 20
  };
  
  if (pageToken) {
    body.pageToken = pageToken;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.types,nextPageToken'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google Places API error: ${response.status} - ${errorText}`);
      return { places: [] };
    }
    
    const data = await response.json();
    return {
      places: data.places || [],
      nextPageToken: data.nextPageToken
    };
  } catch (error) {
    console.error('❌ Places search error:', error);
    return { places: [] };
  }
}

async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceResult | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,types'
      }
    });
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('❌ Place details error:', error);
    return null;
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

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY_1");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY_1 not configured");
    }

    // Fetch user-specific representatives limit from Supabase
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

    // Search queries - focused on representation companies
    const searchQueries = [
      `representação comercial ${location}`,
      `representações comerciais ${location}`,
      `empresa de representação ${location}`,
      `representante comercial ${location}`,
      `escritório de representação ${location}`,
    ];

    const allPlaces: PlaceResult[] = [];
    const seenIds = new Set<string>();

    // Execute searches in parallel
    const searchPromises = searchQueries.map(query => 
      searchPlaces(query, location, GOOGLE_API_KEY)
    );
    
    const results = await Promise.all(searchPromises);
    
    for (const result of results) {
      for (const place of result.places) {
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          allPlaces.push(place);
        }
      }
    }

    console.log(`📊 Found ${allPlaces.length} places from searches`);

    // Filter strictly to only representation companies
    const validPlaces = allPlaces.filter(place => {
      const name = place.displayName?.text || '';
      return isRepresentationCompany(name, place.types);
    });

    console.log(`✅ After strict filtering: ${validPlaces.length} representation companies`);

    // Get phone details for places that don't have them
    const placesNeedingDetails = validPlaces.filter(p => !p.nationalPhoneNumber && !p.internationalPhoneNumber);
    
    if (placesNeedingDetails.length > 0) {
      console.log(`📞 Fetching details for ${Math.min(placesNeedingDetails.length, 30)} places`);
      
      const detailPromises = placesNeedingDetails.slice(0, 30).map(place => 
        getPlaceDetails(place.id, GOOGLE_API_KEY)
      );
      
      const details = await Promise.all(detailPromises);
      
      for (let i = 0; i < details.length; i++) {
        if (details[i]) {
          const placeIndex = validPlaces.findIndex(p => p.id === placesNeedingDetails[i].id);
          if (placeIndex !== -1) {
            validPlaces[placeIndex] = { ...validPlaces[placeIndex], ...details[i] };
          }
        }
      }
    }

    // Build final representatives list
    const representatives: Representative[] = [];
    const seenPhones = new Set<string>();

    for (const place of validPlaces) {
      const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
      const phoneValidation = validateBrazilianPhone(phone);
      
      // Skip duplicates by phone
      if (phoneValidation.valid && seenPhones.has(phoneValidation.normalized)) {
        continue;
      }
      
      if (phoneValidation.valid) {
        seenPhones.add(phoneValidation.normalized);
      }

      representatives.push({
        id: place.id,
        name: place.displayName?.text || 'Empresa de Representação',
        phone: phoneValidation.valid ? formatPhoneDisplay(phoneValidation.normalized) : undefined,
        whatsapp: phoneValidation.isWhatsApp ? phoneValidation.normalized : undefined,
        address: place.formattedAddress || location,
        website: place.websiteUri,
        rating: place.rating
      });

      // Apply dynamic limit (20 for city, 30 for state)
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

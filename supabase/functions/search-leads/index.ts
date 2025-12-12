import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple phone validation
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian format with country code
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return { 
      valid: true, 
      normalized: `+${digitsOnly}`, 
      isWhatsApp: digitsOnly.length === 13 && digitsOnly.charAt(4) === '9'
    };
  }
  
  // Brazilian format without country code
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const normalized = `+55${digitsOnly}`;
    return { 
      valid: true, 
      normalized, 
      isWhatsApp: digitsOnly.length === 11 && digitsOnly.charAt(2) === '9'
    };
  }
  
  // US/International format
  if (digitsOnly.length >= 10) {
    return { valid: true, normalized: phone, isWhatsApp: false };
  }
  
  if (digitsOnly.length >= 8) {
    return { valid: true, normalized: phone, isWhatsApp: false };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

// Generate search terms
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': ['restaurante', 'lanchonete', 'buffet', 'pizzaria', 'hamburgueria'],
    'supermercados': ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti'],
    'hipermercados': ['hipermercado', 'atacadão', 'atacado', 'carrefour', 'big'],
    'padarias': ['padaria', 'panificadora', 'confeitaria', 'bakery'],
    'materiais de construção': ['material de construção', 'home center', 'depósito', 'ferragem'],
    'ferramentas': ['ferramentas', 'loja de ferramentas', 'ferragem', 'ferramentaria'],
    'agropecuária': ['agropecuária', 'loja agropecuária', 'produtos rurais', 'veterinária'],
    'farmácias': ['farmácia', 'drogaria', 'medicamentos'],
    'pet shop': ['pet shop', 'loja de animais', 'veterinária', 'banho e tosa'],
    'lojas de roupas': ['loja de roupas', 'vestuário', 'moda', 'boutique'],
    'autopeças': ['autopeças', 'peças automotivas', 'loja de peças'],
    'eletrônicos': ['eletrônicos', 'loja de eletrônicos', 'informática', 'celular'],
    'móveis': ['móveis', 'loja de móveis', 'móveis planejados', 'decoração'],
    'óticas': ['ótica', 'óculos', 'lentes'],
    'joalherias': ['joalheria', 'joias', 'ouro', 'relógios'],
    'academias': ['academia', 'fitness', 'musculação', 'crossfit'],
    'salões de beleza': ['salão de beleza', 'cabeleireiro', 'barbearia', 'estética'],
    'hotéis': ['hotel', 'pousada', 'hospedagem'],
    'clínicas': ['clínica', 'consultório', 'médico', 'dentista'],
    'transportadoras': ['transportadora', 'transporte', 'frete', 'logística'],
    'gráficas': ['gráfica', 'impressão', 'comunicação visual'],
    'construtoras': ['construtora', 'construção civil', 'empreiteira'],
    'cozinhas industriais': ['cozinha industrial', 'refeição coletiva', 'catering'],
    'indústrias de salgados': ['fábrica de salgados', 'salgados congelados', 'salgaderia'],
    'distribuidores de frios': ['distribuidor de frios', 'frios e embutidos', 'laticínios'],
    'cestas básicas': ['cestas básicas', 'cesta básica', 'cestas de alimentos']
  };
  
  let searchTerms = categoryTerms[term] || null;
  
  if (!searchTerms) {
    for (const [cat, terms] of Object.entries(categoryTerms)) {
      if (term.includes(cat) || cat.includes(term)) {
        searchTerms = terms;
        break;
      }
    }
  }
  
  if (!searchTerms) {
    searchTerms = [term, `${term}s`, `loja de ${term}`];
  }
  
  return searchTerms.slice(0, 3);
}

// Estimate revenue based on reviews and rating
function estimateRevenue(place: any, category: string): { 
  employeeCount: string; 
  companySize: string; 
  revenue: string;
} {
  const reviewCount = place.reviewsCount || place.totalScore || 0;
  const rating = place.stars || 0;
  const categoryLower = category?.toLowerCase() || '';
  
  const categoryMultipliers: { [key: string]: number } = {
    'supermercado': 2.5,
    'hipermercado': 4.0,
    'atacado': 3.0,
    'distribuidor': 2.5,
    'indústria': 3.5,
    'fábrica': 3.0,
    'construtora': 4.0,
    'hotel': 2.5,
    'restaurante': 1.2,
    'lanchonete': 0.8,
    'farmácia': 1.5,
    'posto': 3.0,
    'concessionária': 5.0,
  };
  
  let multiplier = 1.0;
  for (const [key, mult] of Object.entries(categoryMultipliers)) {
    if (categoryLower.includes(key)) {
      multiplier = mult;
      break;
    }
  }
  
  const baseScore = (reviewCount * 0.7) + (rating * 10);
  const adjustedScore = baseScore * multiplier;
  
  if (adjustedScore > 500) {
    return { employeeCount: '100+', companySize: 'Grande', revenue: 'R$ 10M - R$ 50M/ano' };
  } else if (adjustedScore > 200) {
    return { employeeCount: '50-100', companySize: 'Médio-Grande', revenue: 'R$ 4M - R$ 10M/ano' };
  } else if (adjustedScore > 100) {
    return { employeeCount: '20-50', companySize: 'Médio', revenue: 'R$ 1M - R$ 4M/ano' };
  } else if (adjustedScore > 50) {
    return { employeeCount: '10-20', companySize: 'Pequeno', revenue: 'R$ 360K - R$ 1M/ano' };
  } else if (adjustedScore > 20) {
    return { employeeCount: '5-10', companySize: 'Pequeno', revenue: 'R$ 150K - R$ 360K/ano' };
  } else {
    return { employeeCount: '1-5', companySize: 'Micro', revenue: 'R$ 50K - R$ 150K/ano' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters, ecommerceType, businessType } = await req.json();
    console.log('🔍 SEARCH v6 - Apify - Input:', { segment, products, region, country, ecommerceType, businessType });
    
    const countryCode = country || 'BR';
    
    // Check if this is an e-commerce search with specific type
    const isEcommerceSearch = segment.toLowerCase().includes('e-commerce') || segment.toLowerCase().includes('ecommerce');
    
    // Generate search terms
    let searchTerms: string[];
    
    if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
      const ecomType = ecommerceType.trim().toLowerCase();
      searchTerms = [`loja ${ecomType}`, ecomType, `loja de ${ecomType}`];
      console.log(`🛒 E-commerce específico: ${ecomType}`);
    } else {
      searchTerms = generateSearchTerms(segment);
    }
    
    // Build location query
    const cleanRegion = region.trim();
    const locationQuery = countryCode === 'BR' 
      ? `${cleanRegion}, Brazil`
      : `${cleanRegion}, ${countryCode}`;
    
    console.log('📋 Search terms:', searchTerms);
    console.log('📍 Location:', locationQuery);
    
    // Get Apify API key
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    const MAX_TOTAL_LEADS = 150;
    const language = countryCode === 'BR' ? 'pt' : 'en';
    
    // Build search strings array for Apify
    const searchStringsArray = searchTerms.map(term => term);
    
    // Number of places to fetch per search
    const placesPerSearch = Math.max(10, Math.ceil(MAX_TOTAL_LEADS / searchTerms.length));
    
    console.log(`🔎 Apify search: ${placesPerSearch} places per term`);
    
    // Start Apify actor run
    const apifyUrl = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
    
    const apifyPayload = {
      searchStringsArray,
      locationQuery,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language,
      skipClosedPlaces: true
    };
    
    console.log('📤 Apify payload:', JSON.stringify(apifyPayload));
    
    const response = await fetch(apifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apifyPayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apify error:', response.status, errorText);
      throw new Error(`Apify API error: ${response.status}`);
    }
    
    const apifyResults = await response.json();
    console.log(`📊 Apify returned: ${apifyResults.length} results`);
    
    // Filter: must have phone and valid data
    let results = apifyResults.filter((place: any) => {
      const phone = place.phone || place.phoneUnformatted;
      if (!phone || phone.trim() === '') {
        return false;
      }
      if (!place.title || place.title.trim() === '') {
        return false;
      }
      return true;
    });
    
    console.log(`✅ After phone filter: ${results.length} places`);
    
    // Remove duplicates by placeId or title+address
    const seen = new Set();
    results = results.filter((place: any) => {
      const key = place.placeId || `${place.title}-${place.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`✅ After dedup: ${results.length} unique places`);
    
    // Hard limit
    if (results.length > MAX_TOTAL_LEADS) {
      results = results.slice(0, MAX_TOTAL_LEADS);
      console.log(`⚠️ Truncated to ${MAX_TOTAL_LEADS} leads`);
    }
    
    // If no results, return error
    if (results.length === 0) {
      console.log('❌ No results found');
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${cleanRegion}. Tente outra região ou categoria.` 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Transform results to leads format
    const leads = results.map((place: any, index: number) => {
      const phone = place.phone || place.phoneUnformatted || '';
      const phoneValidation = validatePhone(phone);
      const category = place.categoryName || place.categories?.[0] || segment;
      const { employeeCount, companySize, revenue } = estimateRevenue(place, category);
      
      return {
        id: `apify-${place.placeId || Date.now()}-${index}`,
        name: place.title,
        address: place.address || 'Endereço não disponível',
        phone: phoneValidation.valid ? phoneValidation.normalized : phone,
        phoneValid: phoneValidation.valid,
        email: place.email || 'Não disponível',
        website: place.website || place.url || 'Não disponível',
        instagram: 'Não disponível',
        facebook: 'Não disponível',
        hasWhatsApp: phoneValidation.isWhatsApp,
        placeId: place.placeId,
        category,
        rating: place.stars || place.totalScore || 0,
        reviews: place.reviewsCount || 0,
        matchScore: 85,
        confidenceScore: 80,
        source: 'google_maps_apify',
        responsible: 'Gerente',
        employeeCount,
        companySize,
        revenue,
        openedDate: 'Estabelecido',
        reasons: [`Encontrado no Google Maps em ${cleanRegion}`],
        dataQuality: {
          hasValidPhone: phoneValidation.valid,
          hasSocialMedia: false,
          hasWhatsApp: phoneValidation.isWhatsApp,
          fromGoogleMaps: true
        },
        needsReview: false
      };
    });
    
    console.log(`✅ FINAL: ${leads.length} leads ready`);
    
    return new Response(JSON.stringify({ leads }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

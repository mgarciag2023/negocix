import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple phone validation
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return { 
      valid: true, 
      normalized: `+${digitsOnly}`, 
      isWhatsApp: digitsOnly.length === 13 && digitsOnly.charAt(4) === '9'
    };
  }
  
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const normalized = `+55${digitsOnly}`;
    return { 
      valid: true, 
      normalized, 
      isWhatsApp: digitsOnly.length === 11 && digitsOnly.charAt(2) === '9'
    };
  }
  
  if (digitsOnly.length >= 8) {
    return { valid: true, normalized: phone, isWhatsApp: false };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

// Generate search terms (WITHOUT location - location is separate parameter)
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  // Category-specific terms mapping
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': [
      'restaurante', 'restaurantes', 'lanchonete', 'buffet', 'self service',
      'comida', 'almoço', 'cantina', 'bistrô', 'churrascaria', 'pizzaria',
      'hamburgueria', 'comida caseira', 'comida por quilo', 'rodízio'
    ],
    'supermercados': [
      'supermercado', 'mercado', 'mercearia', 'minimercado', 'hipermercado',
      'atacado', 'atacarejo', 'armazém', 'empório', 'hortifruti', 'sacolão'
    ],
    'padarias': [
      'padaria', 'panificadora', 'confeitaria', 'bakery', 'pão', 'bolo', 'doces'
    ],
    'materiais de construção': [
      'material de construção', 'materiais de construção', 'home center',
      'depósito', 'loja de construção', 'ferragem', 'construção'
    ],
    'ferramentas': [
      'ferramentas', 'loja de ferramentas', 'ferragem', 'ferragens',
      'ferramentaria', 'máquinas', 'equipamentos'
    ],
    'agropecuária': [
      'agropecuária', 'agro', 'loja agropecuária', 'produtos rurais',
      'sementes', 'adubos', 'ração', 'veterinária'
    ],
    'farmácias': [
      'farmácia', 'drogaria', 'medicamentos', 'pharmacy'
    ],
    'pet shop': [
      'pet shop', 'pet', 'loja de animais', 'ração', 'veterinária', 'banho e tosa'
    ],
    'lojas de roupas': [
      'loja de roupas', 'roupas', 'vestuário', 'moda', 'confecção', 'boutique'
    ],
    'autopeças': [
      'autopeças', 'auto peças', 'peças automotivas', 'loja de peças', 'mecânica'
    ],
    'eletrônicos': [
      'eletrônicos', 'loja de eletrônicos', 'informática', 'celular', 'computador'
    ],
    'móveis': [
      'móveis', 'loja de móveis', 'móveis planejados', 'marcenaria', 'decoração'
    ],
    'óticas': [
      'ótica', 'óculos', 'lentes', 'armação'
    ],
    'joalherias': [
      'joalheria', 'joias', 'ouro', 'prata', 'relógios', 'bijuteria'
    ],
    'academias': [
      'academia', 'fitness', 'musculação', 'crossfit', 'pilates', 'gym'
    ],
    'salões de beleza': [
      'salão de beleza', 'cabeleireiro', 'barbearia', 'estética', 'manicure'
    ],
    'hotéis': [
      'hotel', 'pousada', 'hospedagem', 'hostel'
    ],
    'clínicas': [
      'clínica', 'consultório', 'médico', 'saúde', 'dentista'
    ],
    'transportadoras': [
      'transportadora', 'transporte', 'frete', 'logística', 'mudança'
    ],
    'gráficas': [
      'gráfica', 'impressão', 'comunicação visual', 'banner'
    ],
    'construtoras': [
      'construtora', 'construção civil', 'empreiteira', 'incorporadora'
    ]
  };
  
  // Get terms for this category or use generic
  let searchTerms = categoryTerms[term] || null;
  
  // Check if any category contains the term
  if (!searchTerms) {
    for (const [cat, terms] of Object.entries(categoryTerms)) {
      if (term.includes(cat) || cat.includes(term)) {
        searchTerms = terms;
        break;
      }
    }
  }
  
  // If still nothing, create variations from original term
  if (!searchTerms) {
    searchTerms = [
      term,
      `${term}s`,
      `loja de ${term}`,
      `lojas de ${term}`
    ];
  }
  
  // Limit to 20 terms max
  return searchTerms.slice(0, 20);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters } = await req.json();
    console.log('🔍 SEARCH v3 - Input:', { segment, products, region, country });
    
    const countryCode = country || 'BR';
    
    // Generate search terms (WITHOUT location)
    const searchTerms = generateSearchTerms(segment);
    
    // Build location query
    const locationQuery = countryCode === 'BR' 
      ? `${region}, Brazil`
      : `${region}, ${countryCode}`;
    
    console.log('📋 Search terms:', searchTerms);
    console.log('📍 Location:', locationQuery);
    
    // Get Apify API key
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    // LIMIT CONTROL: Distribute 150 leads across all queries
    const MAX_TOTAL_LEADS = 150;
    const numQueries = searchTerms.length;
    const placesPerSearch = Math.max(10, Math.ceil(MAX_TOTAL_LEADS / numQueries));
    
    console.log(`📊 Limit: ${placesPerSearch} places per query (${numQueries} queries, max ${MAX_TOTAL_LEADS} total)`);
    
    // CORRECT format: searchStringsArray WITHOUT location, locationQuery SEPARATE
    const apifyBody = {
      searchStringsArray: searchTerms,
      locationQuery: locationQuery,
      maxCrawledPlacesPerSearch: placesPerSearch,  // Distributed limit!
      language: countryCode === 'BR' ? 'pt-BR' : 'en',
      skipClosedPlaces: true
    };
    
    console.log('🚀 Calling Apify compass/crawler-google-places...');
    console.log('📦 Request:', JSON.stringify(apifyBody, null, 2));
    
    // Call compass/crawler-google-places (nwua9Gu5YrADL7ZDj)
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyBody),
      }
    );

    console.log('📡 Apify response status:', apifyResponse.status);

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('❌ Apify error:', errorText);
      
      // Try to parse error for specific messages
      let errorMessage = `Erro na API Apify: ${apifyResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {}
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: apifyResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results = await apifyResponse.json();
    console.log(`📊 Apify returned ${results.length} raw places`);
    
    // Log sample to see structure
    if (results.length > 0) {
      console.log('📋 Sample:', JSON.stringify({
        title: results[0].title,
        phone: results[0].phone,
        address: results[0].address,
        categoryName: results[0].categoryName
      }));
    }
    
    // Simple filter: just needs phone and not closed
    results = results.filter((place: any) => {
      if (!place.phone || place.phone.trim() === '') {
        return false;
      }
      if (place.permanentlyClosed || place.temporarilyClosed) {
        return false;
      }
      return true;
    });
    
    console.log(`✅ After filter: ${results.length} places with phone`);
    
    // Remove duplicates by placeId
    const seen = new Set();
    results = results.filter((place: any) => {
      const key = place.placeId || `${place.title}-${place.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`✅ After dedup: ${results.length} unique places`);
    
    // Limit to 150
    if (results.length > 150) {
      results = results.slice(0, 150);
    }
    
    // If no results, return error
    if (results.length === 0) {
      console.log('❌ No results found');
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${region}. Tente outra região ou categoria.` 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Transform results to leads format
    const leads = results.map((place: any, index: number) => {
      const phoneValidation = validatePhone(place.phone);
      const reviewCount = place.reviewsCount || place.reviews || 0;
      
      let employeeCount = '1-5';
      let companySize = 'Micro';
      let revenue = 'R$ 50K - R$ 100K/ano';
      
      if (reviewCount > 200) {
        employeeCount = '50-200';
        companySize = 'Grande';
        revenue = 'R$ 2M - R$ 10M/ano';
      } else if (reviewCount > 50) {
        employeeCount = '20-50';
        companySize = 'Médio';
        revenue = 'R$ 500K - R$ 2M/ano';
      } else if (reviewCount > 10) {
        employeeCount = '5-20';
        companySize = 'Pequeno';
        revenue = 'R$ 100K - R$ 500K/ano';
      }
      
      return {
        id: `gm-${place.placeId || Date.now()}-${index}`,
        name: place.title || place.name,
        address: place.address || 'Endereço não disponível',
        phone: phoneValidation.valid ? phoneValidation.normalized : place.phone,
        phoneValid: phoneValidation.valid,
        email: place.email || 'Não disponível',
        website: place.website || place.url || 'Não disponível',
        instagram: 'Não disponível',
        facebook: 'Não disponível',
        hasWhatsApp: phoneValidation.isWhatsApp,
        placeId: place.placeId,
        category: place.categoryName || place.category || segment,
        rating: place.totalScore || place.rating || 0,
        reviews: reviewCount,
        matchScore: 85,
        confidenceScore: 80,
        source: 'google_maps',
        responsible: 'Gerente',
        employeeCount,
        companySize,
        revenue,
        openedDate: 'Estabelecido',
        reasons: [`Encontrado no Google Maps em ${region}`],
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

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

// Generate 50 search query variations
function generateSearchQueries(segment: string, region: string, country: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  const location = country === 'BR' ? `${region}, SC, Brazil` : `${region}, ${country}`;
  const locationShort = region;
  
  // Category-specific terms mapping
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': [
      'restaurante', 'restaurantes', 'lanchonete', 'lanchonetes', 'buffet', 
      'self service', 'comida', 'almoço', 'jantar', 'refeição', 'cantina',
      'bistrô', 'churrascaria', 'pizzaria', 'hamburgueria', 'bar e restaurante',
      'comida caseira', 'comida por quilo', 'rodízio', 'food'
    ],
    'supermercados': [
      'supermercado', 'supermercados', 'mercado', 'mercados', 'mercearia',
      'minimercado', 'hipermercado', 'atacado', 'atacarejo', 'armazém',
      'empório', 'hortifruti', 'sacolão', 'feira', 'grocery'
    ],
    'padarias': [
      'padaria', 'padarias', 'panificadora', 'confeitaria', 'pão', 'bakery',
      'bolo', 'doces', 'salgados', 'café', 'cafeteria', 'lanchonete'
    ],
    'materiais de construção': [
      'material de construção', 'materiais de construção', 'construção',
      'home center', 'depósito', 'loja de construção', 'ferragem',
      'cimento', 'tijolo', 'telha', 'piso', 'azulejo', 'madeira'
    ],
    'ferramentas': [
      'ferramentas', 'loja de ferramentas', 'ferragem', 'ferragens',
      'casa das ferramentas', 'ferramentaria', 'máquinas', 'equipamentos'
    ],
    'agropecuária': [
      'agropecuária', 'agro', 'loja agropecuária', 'produtos rurais',
      'sementes', 'adubos', 'ração', 'veterinária', 'pet shop'
    ],
    'farmácias': [
      'farmácia', 'farmácias', 'drogaria', 'drogarias', 'medicamentos',
      'remédios', 'pharmacy'
    ],
    'pet shop': [
      'pet shop', 'pet', 'loja de animais', 'ração', 'veterinária',
      'banho e tosa', 'cachorro', 'gato', 'animal'
    ],
    'lojas de roupas': [
      'loja de roupas', 'roupas', 'vestuário', 'moda', 'confecção',
      'boutique', 'fashion', 'clothing'
    ],
    'autopeças': [
      'autopeças', 'auto peças', 'peças automotivas', 'loja de peças',
      'peças de carro', 'mecânica', 'oficina'
    ],
    'eletrônicos': [
      'eletrônicos', 'loja de eletrônicos', 'informática', 'celular',
      'computador', 'notebook', 'games', 'tech'
    ],
    'móveis': [
      'móveis', 'loja de móveis', 'móveis planejados', 'marcenaria',
      'decoração', 'colchões', 'estofados'
    ],
    'óticas': [
      'ótica', 'óticas', 'óculos', 'lentes', 'armação', 'optical'
    ],
    'joalherias': [
      'joalheria', 'joias', 'jóias', 'ouro', 'prata', 'relógios', 'bijuteria'
    ],
    'academias': [
      'academia', 'fitness', 'musculação', 'crossfit', 'pilates', 'yoga', 'gym'
    ],
    'salões de beleza': [
      'salão de beleza', 'cabeleireiro', 'barbearia', 'estética',
      'manicure', 'spa', 'beauty'
    ],
    'hotéis': [
      'hotel', 'hotéis', 'pousada', 'hospedagem', 'motel', 'hostel', 'inn'
    ],
    'escolas': [
      'escola', 'colégio', 'ensino', 'educação', 'curso', 'faculdade'
    ],
    'clínicas': [
      'clínica', 'consultório', 'médico', 'saúde', 'hospital', 'dentista'
    ],
    'escritórios de advocacia': [
      'advogado', 'advocacia', 'escritório de advocacia', 'lawyer', 'law office'
    ],
    'contabilidade': [
      'contabilidade', 'contador', 'escritório contábil', 'accounting'
    ],
    'imobiliárias': [
      'imobiliária', 'imóveis', 'corretor', 'real estate'
    ],
    'transportadoras': [
      'transportadora', 'transporte', 'frete', 'logística', 'mudança', 'cargas'
    ],
    'gráficas': [
      'gráfica', 'impressão', 'comunicação visual', 'banner', 'adesivo'
    ],
    'construtoras': [
      'construtora', 'construção civil', 'empreiteira', 'incorporadora', 'obras'
    ]
  };
  
  // Get terms for this category or use generic
  const termLower = term.toLowerCase();
  let searchTerms = categoryTerms[termLower] || [term];
  
  // Also check if any category contains the term
  for (const [cat, terms] of Object.entries(categoryTerms)) {
    if (termLower.includes(cat) || cat.includes(termLower)) {
      searchTerms = [...new Set([...searchTerms, ...terms])];
      break;
    }
  }
  
  // If still just the original term, create variations
  if (searchTerms.length === 1) {
    searchTerms = [
      term,
      `${term}s`,
      `loja de ${term}`,
      `lojas de ${term}`,
      `${term} shop`,
      `${term} store`
    ];
  }
  
  // Generate queries with different location formats
  const queries: string[] = [];
  
  // Format 1: term + full location
  searchTerms.slice(0, 15).forEach(t => {
    queries.push(`${t} ${location}`);
  });
  
  // Format 2: term + short location
  searchTerms.slice(0, 15).forEach(t => {
    queries.push(`${t} ${locationShort}`);
  });
  
  // Format 3: term + em + location
  searchTerms.slice(0, 10).forEach(t => {
    queries.push(`${t} em ${locationShort}`);
  });
  
  // Format 4: loja de + term + location
  searchTerms.slice(0, 5).forEach(t => {
    queries.push(`loja de ${t} ${locationShort}`);
  });
  
  // Format 5: term + near me style
  searchTerms.slice(0, 5).forEach(t => {
    queries.push(`${t} perto ${locationShort}`);
  });
  
  // Remove duplicates and limit to 50
  const uniqueQueries = [...new Set(queries)].slice(0, 50);
  
  console.log(`📋 Generated ${uniqueQueries.length} search queries for "${term}"`);
  
  return uniqueQueries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters } = await req.json();
    console.log('🔍 SEARCH v2 - Input:', { segment, products, region, country });
    
    const countryCode = country || 'BR';
    
    // Generate many search queries
    const searchQueries = generateSearchQueries(segment, region, countryCode);
    
    console.log('📋 First 10 queries:', searchQueries.slice(0, 10));
    
    // Get Apify API key
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    // Try with compass~crawler-google-places actor (different actor)
    const apifyBody = {
      searchStringsArray: searchQueries,
      maxCrawledPlacesPerSearch: 10,
      language: countryCode === 'BR' ? 'pt-BR' : 'en',
      countryCode: countryCode,
      maxImages: 0,
      scrapeReviewerName: false,
      scrapeReviewId: false,
      scrapeReviewUrl: false,
      scrapeResponseFromOwnerText: false
    };
    
    console.log('🚀 Calling Apify compass~crawler-google-places...');
    console.log('📦 Request body:', JSON.stringify({
      ...apifyBody,
      searchStringsArray: `[${searchQueries.length} queries]`
    }));
    
    // Try compass~crawler-google-places first
    let apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyBody),
      }
    );

    console.log('📡 compass~crawler-google-places status:', apifyResponse.status);

    // If compass fails, try the other actor
    if (!apifyResponse.ok) {
      console.log('⚠️ compass failed, trying nwua9Gu5YrADL7ZDj...');
      
      const altBody = {
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: 10,
        language: countryCode === 'BR' ? 'pt-BR' : 'en',
        skipClosedPlaces: true
      };
      
      apifyResponse = await fetch(
        `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(altBody),
        }
      );
      
      console.log('📡 nwua9Gu5YrADL7ZDj status:', apifyResponse.status);
    }

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('❌ Both actors failed:', errorText);
      return new Response(JSON.stringify({ 
        error: `Erro na API: ${apifyResponse.status}. Verifique sua chave Apify.` 
      }), {
        status: apifyResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results = await apifyResponse.json();
    console.log(`📊 Apify returned ${results.length} raw places`);
    
    // Log some sample data to understand structure
    if (results.length > 0) {
      console.log('📋 Sample result:', JSON.stringify(results[0], null, 2).slice(0, 500));
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
    
    // Remove duplicates by placeId or name+address
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
      console.log('❌ No results found after all attempts');
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

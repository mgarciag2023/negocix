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

// Estimate years in operation based on reviews and data
function estimateYearsInOperation(place: any): string {
  const reviewCount = place.reviewsCount || 0;
  const rating = place.stars || 0;
  
  // If we have opening date from Google, use it
  if (place.openingDate) {
    const openYear = parseInt(place.openingDate.split('-')[0]);
    if (!isNaN(openYear)) {
      const yearsOld = new Date().getFullYear() - openYear;
      return yearsOld <= 1 ? '1 ano' : `${yearsOld} anos`;
    }
  }
  
  // Estimate based on reviews - more reviews = older business typically
  if (reviewCount > 500) return '10+ anos';
  if (reviewCount > 200) return '5-10 anos';
  if (reviewCount > 100) return '3-5 anos';
  if (reviewCount > 50) return '2-3 anos';
  if (reviewCount > 20) return '1-2 anos';
  return '< 1 ano';
}

// Generate real reasons why this is a good lead
function generateReasons(place: any, category: string, companySize: string): string[] {
  const reasons: string[] = [];
  const reviewCount = place.reviewsCount || 0;
  const rating = place.stars || 0;
  
  // Rating-based reasons
  if (rating >= 4.5 && reviewCount > 20) {
    reasons.push(`Alta avaliação (${rating.toFixed(1)}★) com ${reviewCount}+ avaliações - negócio confiável`);
  } else if (rating >= 4.0 && reviewCount > 10) {
    reasons.push(`Boa reputação online (${rating.toFixed(1)}★) - cliente estabelecido`);
  }
  
  // Size-based reasons
  if (companySize === 'Grande' || companySize === 'Médio-Grande') {
    reasons.push('Porte empresarial indica alto potencial de compra');
  } else if (companySize === 'Médio') {
    reasons.push('Empresa em crescimento com capacidade de investimento');
  }
  
  // Review count reasons
  if (reviewCount > 100) {
    reasons.push('Alto volume de clientes indica negócio ativo e movimentado');
  } else if (reviewCount > 30) {
    reasons.push('Presença digital consolidada com clientela fiel');
  }
  
  // Category-specific reasons
  const catLower = category.toLowerCase();
  if (catLower.includes('supermercado') || catLower.includes('mercado')) {
    reasons.push('Setor varejista com demanda constante de fornecedores');
  } else if (catLower.includes('restaurante') || catLower.includes('lanchonete')) {
    reasons.push('Estabelecimento alimentício com necessidade recorrente de insumos');
  } else if (catLower.includes('construção') || catLower.includes('construtora')) {
    reasons.push('Setor de construção com alto volume de compras');
  } else if (catLower.includes('farmácia') || catLower.includes('drogaria')) {
    reasons.push('Setor farmacêutico com reposição frequente de estoque');
  } else if (catLower.includes('pet') || catLower.includes('veterinária')) {
    reasons.push('Mercado pet em expansão com demanda crescente');
  }
  
  // Website reason
  if (place.website) {
    reasons.push('Possui website - empresa profissionalizada');
  }
  
  // If no specific reasons, add generic but useful ones
  if (reasons.length === 0) {
    reasons.push('Negócio ativo com presença no Google Maps');
    if (reviewCount > 0) {
      reasons.push(`${reviewCount} avaliações indicam base de clientes ativa`);
    }
  }
  
  return reasons.slice(0, 3); // Max 3 reasons
}

// Niche relevance keywords for strict filtering
const nicheKeywords: { [key: string]: { include: string[], exclude: string[] } } = {
  'hipermercados': {
    include: ['hipermercado', 'supermercado', 'mercado', 'atacarejo', 'atacadão', 'carrefour', 'big', 'walmart', 'assaí', 'makro', 'sam\'s club', 'super', 'hiper', 'mart', 'market', 'alimentos', 'hortifruti', 'mercearia', 'minimercado'],
    exclude: ['cueca', 'roupa', 'móvel', 'móveis', 'colchão', 'vestuário', 'tecido', 'lingerie', 'moda', 'calçado', 'sapato', 'eletro', 'eletrônico', 'celular', 'informática', 'auto peça', 'autopeça', 'construção', 'material de construção', 'ferragem', 'ferramenta', 'brinquedo', 'papelaria', 'livro', 'pet', 'animal', 'veterinár', 'ótica', 'óculos', 'joalheria', 'relógio', 'perfume', 'cosmético', 'salão', 'beleza', 'cabeleireiro', 'barbearia', 'estética', 'academia', 'fitness', 'hotel', 'pousada', 'restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'bar', 'boteco', 'cerveja', 'bebida alcoólica']
  },
  'supermercados': {
    include: ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti', 'sacolão', 'feira', 'empório', 'armazém', 'alimentos', 'comida'],
    exclude: ['cueca', 'roupa', 'móvel', 'móveis', 'colchão', 'vestuário', 'tecido', 'lingerie', 'moda', 'calçado', 'eletro', 'eletrônico', 'celular', 'auto peça', 'autopeça', 'construção', 'ferragem', 'ferramenta', 'brinquedo', 'papelaria', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'beleza', 'academia', 'hotel', 'pousada']
  },
  'restaurantes': {
    include: ['restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'churrascaria', 'buffet', 'self-service', 'comida', 'cozinha', 'gastronomia', 'bar', 'boteco', 'bistrô', 'cantina', 'refeitório'],
    exclude: ['cueca', 'roupa', 'móvel', 'móveis', 'vestuário', 'moda', 'eletro', 'eletrônico', 'auto peça', 'construção', 'ferragem', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'materiais de construção': {
    include: ['material de construção', 'construção', 'home center', 'depósito', 'ferragem', 'cimento', 'tijolo', 'areia', 'telha', 'madeira', 'madeireira', 'hidráulico', 'elétrico', 'acabamento', 'piso', 'azulejo', 'porcelanato', 'tintas'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'comida', 'supermercado', 'mercado', 'restaurante', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'ferramentas': {
    include: ['ferramenta', 'ferramentaria', 'ferragem', 'parafuso', 'chave', 'furadeira', 'serra', 'martelo', 'alicate', 'máquina', 'equipamento', 'industrial'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'supermercado', 'restaurante', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'brinquedo']
  },
  'pet shop': {
    include: ['pet', 'animal', 'veterinár', 'cão', 'cachorro', 'gato', 'ração', 'banho e tosa', 'petshop'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento humano', 'supermercado', 'restaurante', 'construção', 'ferragem', 'ótica', 'joalheria', 'salão humano', 'academia', 'hotel']
  },
  'farmácias': {
    include: ['farmácia', 'drogaria', 'medicamento', 'remédio', 'saúde', 'manipulação'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'construção', 'pet', 'veterinár', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'agropecuária': {
    include: ['agropecuária', 'agrícola', 'rural', 'fazenda', 'semente', 'adubo', 'fertilizante', 'ração animal', 'veterinária rural', 'trator', 'implemento'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'autopeças': {
    include: ['autopeça', 'auto peça', 'peça automotiva', 'carro', 'moto', 'veículo', 'motor', 'pneu', 'oficina', 'mecânica'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'supermercado', 'restaurante', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  }
};

// Check if result is relevant to searched niche
function isRelevantToNiche(place: any, segment: string): boolean {
  const segmentLower = segment.toLowerCase();
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
  // Find matching niche keywords
  let nicheConfig = nicheKeywords[segmentLower];
  
  // Try partial matching if exact match not found
  if (!nicheConfig) {
    for (const [key, config] of Object.entries(nicheKeywords)) {
      if (segmentLower.includes(key) || key.includes(segmentLower)) {
        nicheConfig = config;
        break;
      }
    }
  }
  
  // If no specific niche config, be more permissive but still filter obvious mismatches
  if (!nicheConfig) {
    // Generic exclusions for any search
    const genericExclusions = ['cueca', 'lingerie', 'moda íntima', 'roupa íntima'];
    for (const exclude of genericExclusions) {
      if (combinedText.includes(exclude)) {
        return false;
      }
    }
    return true;
  }
  
  // Check exclusions first (strict)
  for (const exclude of nicheConfig.exclude) {
    if (combinedText.includes(exclude)) {
      return false;
    }
  }
  
  // Check if at least one inclusion keyword matches
  for (const include of nicheConfig.include) {
    if (combinedText.includes(include)) {
      return true;
    }
  }
  
  // If no inclusion matched but also no exclusion, check if category from Google is relevant
  // Google Maps categories are usually accurate
  if (category && category.length > 0) {
    // Allow if Google category seems related
    const genericRetailTerms = ['loja', 'store', 'shop', 'comércio', 'varejo', 'atacado'];
    for (const term of genericRetailTerms) {
      if (category.includes(term)) {
        return true;
      }
    }
  }
  
  // Default: exclude if we couldn't confirm relevance
  return false;
}

// Process and filter results
function processResults(apifyResults: any[], segment: string, cleanRegion: string, maxLeads: number): any[] {
  // Filter: must have phone, valid data, AND be relevant to niche
  let results = apifyResults.filter((place: any) => {
    const phone = place.phone || place.phoneUnformatted;
    if (!phone || phone.trim() === '') return false;
    if (!place.title || place.title.trim() === '') return false;
    
    // STRICT NICHE FILTERING
    if (!isRelevantToNiche(place, segment)) {
      return false;
    }
    
    return true;
  });
  
  // Remove duplicates by placeId or title+address
  const seen = new Set();
  results = results.filter((place: any) => {
    const key = place.placeId || `${place.title}-${place.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Hard limit
  if (results.length > maxLeads) {
    results = results.slice(0, maxLeads);
  }
  
  // Transform results to leads format
  return results.map((place: any, index: number) => {
    const phone = place.phone || place.phoneUnformatted || '';
    const phoneValidation = validatePhone(phone);
    const category = place.categoryName || place.categories?.[0] || segment;
    const { employeeCount, companySize, revenue } = estimateRevenue(place, category);
    const openedDate = estimateYearsInOperation(place);
    const reasons = generateReasons(place, category, companySize);
    
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
      openedDate,
      reasons,
      dataQuality: {
        hasValidPhone: phoneValidation.valid,
        hasSocialMedia: false,
        hasWhatsApp: phoneValidation.isWhatsApp,
        fromGoogleMaps: true
      },
      needsReview: false
    };
  });
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters, ecommerceType, businessType } = await req.json();
    console.log('🔍 SEARCH v7 - Async Polling - Input:', { segment, products, region, country, ecommerceType, businessType });
    
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
    const MIN_LEADS_EARLY_EXIT = 60;
    const MAX_WAIT_TIME = 80000; // 80 seconds
    const EARLY_EXIT_WAIT = 30000; // 30 seconds before checking early exit
    const POLL_INTERVAL = 5000; // 5 seconds
    
    const language = countryCode === 'BR' ? 'pt-BR' : 'en';
    const searchStringsArray = searchTerms.map(term => term);
    const placesPerSearch = Math.max(10, Math.ceil(MAX_TOTAL_LEADS / searchTerms.length));
    
    console.log(`🔎 Apify async search: ${placesPerSearch} places per term`);
    
    // START ASYNC RUN (not sync)
    const startRunUrl = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?token=${APIFY_API_KEY}`;
    
    const apifyPayload = {
      searchStringsArray,
      locationQuery,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language,
      skipClosedPlaces: true
    };
    
    console.log('📤 Starting async Apify run...');
    
    const startResponse = await fetch(startRunUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyPayload)
    });
    
    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error('❌ Apify start error:', startResponse.status, errorText);
      throw new Error(`Apify start error: ${startResponse.status}`);
    }
    
    const runData = await startResponse.json();
    const runId = runData.data?.id;
    const datasetId = runData.data?.defaultDatasetId;
    
    if (!runId || !datasetId) {
      console.error('❌ Missing runId or datasetId:', runData);
      throw new Error('Failed to start Apify run');
    }
    
    console.log(`✅ Run started: ${runId}, Dataset: ${datasetId}`);
    
    // POLLING LOOP
    const startTime = Date.now();
    let allResults: any[] = [];
    let lastResultCount = 0;
    
    while (Date.now() - startTime < MAX_WAIT_TIME) {
      await sleep(POLL_INTERVAL);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`⏱️ Polling... ${Math.round(elapsedTime / 1000)}s elapsed`);
      
      // Fetch current dataset items
      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`;
      
      try {
        const dataResponse = await fetch(datasetUrl);
        if (dataResponse.ok) {
          const items = await dataResponse.json();
          allResults = items;
          
          const leads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS);
          console.log(`📊 Current: ${allResults.length} raw, ${leads.length} valid leads`);
          
          // Early exit: if we have 60+ leads after 30 seconds, wait 5 more seconds then return
          if (elapsedTime >= EARLY_EXIT_WAIT && leads.length >= MIN_LEADS_EARLY_EXIT) {
            console.log(`🎯 Found ${leads.length} leads at ${Math.round(elapsedTime / 1000)}s - waiting 5 more seconds...`);
            
            // Wait 5 more seconds to collect additional leads
            await sleep(5000);
            
            // Fetch final results after the extra wait
            try {
              const finalDataResponse = await fetch(datasetUrl);
              if (finalDataResponse.ok) {
                const finalItems = await finalDataResponse.json();
                allResults = finalItems;
                const finalLeads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS);
                console.log(`🚀 Early exit after extra 5s: ${finalLeads.length} leads`);
                
                // Abort the run to save credits
                try {
                  await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                    method: 'POST'
                  });
                  console.log('🛑 Run aborted to save credits');
                } catch (e) {
                  console.log('⚠️ Could not abort run:', e);
                }
                
                return new Response(JSON.stringify({ leads: finalLeads }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            } catch (e) {
              console.log('⚠️ Final fetch error:', e);
            }
            
            // Fallback to current leads if final fetch fails
            try {
              await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                method: 'POST'
              });
            } catch (e) {}
            
            return new Response(JSON.stringify({ leads }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          // If we hit 150 leads, return immediately
          if (leads.length >= MAX_TOTAL_LEADS) {
            console.log(`✅ Max leads reached: ${leads.length}`);
            
            // Abort the run
            try {
              await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                method: 'POST'
              });
              console.log('🛑 Run aborted - max leads reached');
            } catch (e) {
              console.log('⚠️ Could not abort run:', e);
            }
            
            return new Response(JSON.stringify({ leads: leads.slice(0, MAX_TOTAL_LEADS) }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          lastResultCount = leads.length;
        }
      } catch (e) {
        console.log('⚠️ Polling error:', e);
      }
      
      // Check run status
      const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`;
      try {
        const statusResponse = await fetch(statusUrl);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const status = statusData.data?.status;
          
          if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
            console.log(`🏁 Run finished with status: ${status}`);
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Status check error:', e);
      }
    }
    
    // Timeout reached or run finished - return what we have
    console.log(`⏰ Polling complete. Total raw results: ${allResults.length}`);
    
    // Abort if still running
    try {
      await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
        method: 'POST'
      });
      console.log('🛑 Run aborted after timeout');
    } catch (e) {
      // Ignore - might already be finished
    }
    
    const leads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS);
    console.log(`✅ FINAL: ${leads.length} leads ready`);
    
    if (leads.length === 0) {
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${cleanRegion}. Tente outra região ou categoria.` 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
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

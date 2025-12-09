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
  
  // Limit to 4 terms max to control API costs
  return searchTerms.slice(0, 4);
}

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters, ecommerceType } = await req.json();
    console.log('🔍 SEARCH v4 - Input:', { segment, products, region, country, ecommerceType });
    
    const countryCode = country || 'BR';
    
    // Check if this is an e-commerce search with specific type
    const isEcommerceSearch = segment.toLowerCase().includes('e-commerce') || segment.toLowerCase().includes('ecommerce');
    
    // Generate search terms based on context
    let searchTerms: string[];
    
    if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
      const ecomType = ecommerceType.trim().toLowerCase();
      searchTerms = [
        `loja ${ecomType}`,
        `${ecomType}`,
        `loja de ${ecomType}`,
        `${ecomType} online`
      ];
      console.log(`🛒 E-commerce específico: ${ecomType}`);
    } else {
      searchTerms = generateSearchTerms(segment);
    }
    
    // Build location query - trim whitespace
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
    
    // LIMIT CONTROL: Max 150 leads total, distributed across queries
    const MAX_TOTAL_LEADS = 150;
    const numQueries = searchTerms.length;
    const placesPerSearch = Math.max(10, Math.floor(MAX_TOTAL_LEADS / numQueries));
    
    console.log(`📊 Limit: ${placesPerSearch} places per query (${numQueries} queries, max ${MAX_TOTAL_LEADS} total)`);
    
    // Request body for Apify
    const apifyBody = {
      searchStringsArray: searchTerms,
      locationQuery: locationQuery,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language: countryCode === 'BR' ? 'pt-BR' : 'en',
      skipClosedPlaces: true
    };
    
    console.log('🚀 Starting Apify run (async mode)...');
    console.log('📦 Request:', JSON.stringify(apifyBody, null, 2));
    
    // STEP 1: Start the run asynchronously
    const startResponse = await fetch(
      `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyBody),
      }
    );
    
    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error('❌ Failed to start run:', errorText);
      throw new Error(`Erro ao iniciar busca: ${startResponse.status}`);
    }
    
    const runData = await startResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    
    console.log(`✅ Run started: ${runId}, Dataset: ${datasetId}`);
    
    // STEP 2: Poll for results with 80s timeout
    const TIMEOUT_MS = 80000; // 1:20
    const POLL_INTERVAL = 5000; // Check every 5 seconds
    const startTime = Date.now();
    
    let results: any[] = [];
    let isComplete = false;
    
    while (Date.now() - startTime < TIMEOUT_MS) {
      // Check run status
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`
      );
      const statusData = await statusResponse.json();
      const status = statusData.data.status;
      
      console.log(`⏳ Status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      
      // Get current dataset items
      const itemsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}&clean=true`
      );
      
      if (itemsResponse.ok) {
        results = await itemsResponse.json();
        console.log(`📊 Current items: ${results.length}`);
        
        // If we have enough leads (60+), we can stop early
        const validResults = results.filter((p: any) => p.phone && p.phone.trim() !== '');
        if (validResults.length >= 60 && Date.now() - startTime >= 30000) {
          console.log(`✅ Got ${validResults.length} valid leads after 30s, stopping early`);
          break;
        }
      }
      
      // Check if run completed
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
        isComplete = true;
        console.log(`🏁 Run finished with status: ${status}`);
        break;
      }
      
      // Wait before next poll
      await sleep(POLL_INTERVAL);
    }
    
    // If timeout reached and run still going, abort it
    if (!isComplete) {
      console.log('⏱️ Timeout reached, aborting run...');
      await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`,
        { method: 'POST' }
      );
      
      // Get final items after abort
      const finalItemsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}&clean=true`
      );
      if (finalItemsResponse.ok) {
        results = await finalItemsResponse.json();
      }
    }
    
    console.log(`📊 Total raw results: ${results.length}`);
    
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
    
    // HARD LIMIT: Exactly 150 max, never more
    if (results.length > MAX_TOTAL_LEADS) {
      results = results.slice(0, MAX_TOTAL_LEADS);
      console.log(`⚠️ Truncated to ${MAX_TOTAL_LEADS} leads (hard limit)`);
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

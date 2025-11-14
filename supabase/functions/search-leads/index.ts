import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone validation with international format
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian phone format: +55 followed by 10 or 11 digits (DDD + number)
  const brazilRegex = /^55(\d{10,11})$/;
  const match = digitsOnly.match(brazilRegex);
  
  if (match) {
    const normalized = `+55${match[1]}`;
    // Check if it's a mobile number (11 digits with 9 as first digit after DDD)
    const isMobile = match[1].length === 11 && match[1].charAt(2) === '9';
    return { valid: true, normalized, isWhatsApp: isMobile };
  }
  
  // Also accept if starts with +55 and has correct length
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return { valid: true, normalized: `+${digitsOnly}`, isWhatsApp: digitsOnly.length === 13 };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

// Validate if Instagram profile exists
async function validateInstagramProfile(handle: string): Promise<boolean> {
  try {
    const username = handle.replace('@', '');
    console.log(`🔍 Validating Instagram profile: ${username}`);
    
    // Make a HEAD request to check if profile exists (faster than GET)
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow'
    });
    
    // Profile exists if we get 200 OK
    const exists = response.ok;
    console.log(`${exists ? '✅' : '❌'} Instagram @${username}: ${response.status}`);
    return exists;
  } catch (error) {
    console.error(`Error validating Instagram ${handle}:`, error);
    return false;
  }
}

// Scrape Instagram from website
async function scrapeInstagramFromWebsite(url: string): Promise<string | null> {
  try {
    console.log(`🔍 Scraping Instagram from: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Priority 1: <link rel="me"> tag
    const relMeMatch = html.match(/<link[^>]*rel=["']me["'][^>]*href=["']([^"']*instagram\.com[^"']*)["']/i) ||
                       html.match(/<link[^>]*href=["']([^"']*instagram\.com[^"']*)["'][^>]*rel=["']me["']/i);
    if (relMeMatch) {
      const instagram = extractInstagramHandle(relMeMatch[1]);
      if (instagram) {
        // VALIDATE before returning
        const isValid = await validateInstagramProfile(instagram);
        if (isValid) {
          console.log(`✅ Found Instagram via rel="me": ${instagram}`);
          return instagram;
        } else {
          console.log(`❌ Instagram ${instagram} does not exist (rel="me")`);
        }
      }
    }
    
    // Priority 2: <meta property="og:url"> with Instagram
    const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*instagram\.com[^"']*)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*instagram\.com[^"']*)["'][^>]*property=["']og:url["']/i);
    if (ogUrlMatch) {
      const instagram = extractInstagramHandle(ogUrlMatch[1]);
      if (instagram) {
        // VALIDATE before returning
        const isValid = await validateInstagramProfile(instagram);
        if (isValid) {
          console.log(`✅ Found Instagram via og:url: ${instagram}`);
          return instagram;
        } else {
          console.log(`❌ Instagram ${instagram} does not exist (og:url)`);
        }
      }
    }
    
    // Priority 3: Direct instagram.com links in HTML
    const instagramLinks = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi);
    if (instagramLinks && instagramLinks.length > 0) {
      const instagram = extractInstagramHandle(instagramLinks[0]);
      if (instagram) {
        // VALIDATE before returning
        const isValid = await validateInstagramProfile(instagram);
        if (isValid) {
          console.log(`✅ Found Instagram via direct link: ${instagram}`);
          return instagram;
        } else {
          console.log(`❌ Instagram ${instagram} does not exist (direct link)`);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error scraping website ${url}:`, error);
    return null;
  }
}

function extractInstagramHandle(url: string): string | null {
  const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (match && match[1] && !['explore', 'p', 'reel', 'tv', 'stories'].includes(match[1].toLowerCase())) {
    return `@${match[1]}`;
  }
  return null;
}

// Check if website or content has WhatsApp indicators
async function detectWhatsApp(phone: string, website?: string): Promise<boolean> {
  // First check if phone format indicates WhatsApp (mobile number)
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) return false;
  if (phoneValidation.isWhatsApp) return true;
  
  // If website exists, check for WhatsApp links
  if (website) {
    try {
      const response = await fetch(website, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const html = await response.text();
        const digitsOnly = phone.replace(/\D/g, '');
        
        // Check for WhatsApp links with this phone number
        const hasWhatsAppLink = html.includes('wa.me') || 
                               html.includes('api.whatsapp.com/send') ||
                               html.includes('whatsapp://send');
        
        if (hasWhatsAppLink && html.includes(digitsOnly.slice(-10))) {
          return true;
        }
      }
    } catch (error) {
      console.error('Error checking WhatsApp:', error);
    }
  }
  
  return false;
}

// Search for official social media profiles
async function searchSocialMediaProfiles(businessName: string, city: string, website?: string): Promise<{
  instagram?: string;
  facebook?: string;
  whatsappBusiness?: string;
}> {
  const profiles: {
    instagram?: string;
    facebook?: string;
    whatsappBusiness?: string;
  } = {};
  
  try {
    console.log(`🔍 Searching social media for: ${businessName}`);
    
    // 1. If website exists, try to scrape from there (most reliable)
    if (website && website !== 'Não disponível') {
      const instagramFromWebsite = await scrapeInstagramFromWebsite(website);
      if (instagramFromWebsite) {
        profiles.instagram = instagramFromWebsite;
        console.log(`✅ Instagram found from website: ${profiles.instagram}`);
      }
      
      try {
        const response = await fetch(website, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Search for Facebook page
          const fbMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9._-]+)/i);
          if (fbMatch && !['sharer', 'dialog', 'share'].includes(fbMatch[2])) {
            profiles.facebook = `https://facebook.com/${fbMatch[2]}`;
            console.log(`✅ Facebook found: ${profiles.facebook}`);
          }
          
          // Search for WhatsApp Business
          const waMatch = html.match(/wa\.me\/(\d+)/i) || html.match(/api\.whatsapp\.com\/send\?phone=(\d+)/i);
          if (waMatch) {
            profiles.whatsappBusiness = waMatch[1];
            console.log(`✅ WhatsApp Business found: ${profiles.whatsappBusiness}`);
          }
        }
      } catch (error) {
        console.error('Error scraping social media from website:', error);
      }
    }
    
  } catch (error) {
    console.error('Error searching social media:', error);
  }
  
  return profiles;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, location, state, filters } = await req.json();
    console.log('🔍 Searching leads for:', { segment, products, location, state, filters });
    
    const stateDisplay = state || 'SC';
    console.log('Using state code:', stateDisplay);

    // Use Apify Google Maps Scraper for real data - ONLY SOURCE OF TRUTH
    console.log('📡 Searching Google Maps via Apify API (ONLY real data)...');
    
    // Enhanced search terms for specific categories - MAXIMIZE RESULTS
    const categorySearchTerms: { [key: string]: string[] } = {
      'materiais elétricos': ['materiais elétricos', 'loja elétrica', 'material eletrico', 'distribuidora elétrica', 'eletrônica'],
      'agropecuária': ['agropecuária', 'loja agropecuaria', 'produtos agropecuários', 'insumos agrícolas', 'casa agropecuaria', 'loja fazenda'],
      'e-commerce': ['loja online', 'loja virtual', 'comércio eletrônico', 'e-commerce', 'vendas online'],
      'ferramentas': ['ferramentas', 'loja de ferramentas', 'ferragens e ferramentas', 'equipamentos', 'casa das ferramentas'],
      'chaveiro': ['chaveiro', 'chaveiro 24h', 'cópia de chaves', 'serviço de chaveiro', 'chaves'],
      'materiais de construção': ['materiais de construção', 'materiais construcao', 'loja construção', 'casa construção', 'depósito construção', 'construmateriais']
    };
    
    // Build search queries - use multiple terms for better coverage
    const segmentLowerNorm = segment.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let searchQueries: string[] = [];
    
    // Check if this is a high-priority category
    const matchedCategory = Object.keys(categorySearchTerms).find(key => 
      segmentLowerNorm.includes(key.toLowerCase())
    );
    
    if (matchedCategory) {
      // Use all search terms for this category
      searchQueries = categorySearchTerms[matchedCategory].map(term => 
        `${term} ${location} ${stateDisplay}`
      );
      console.log(`🎯 High-priority category detected: "${matchedCategory}"`);
      console.log(`📋 Using ${searchQueries.length} search terms:`, searchQueries);
    } else {
      // Standard single search query
      searchQueries = [`${segment} ${location} ${stateDisplay}`];
      console.log(`🔍 Standard search query: "${searchQueries[0]}"`);
    }
    
    // Define coordinates for major cities in Brazil
    const coordinates: { [key: string]: { lat: number; lng: number } } = {
      // Santa Catarina
      'Florianópolis': { lat: -27.5954, lng: -48.5480 },
      'Blumenau': { lat: -26.9194, lng: -49.0661 },
      'Joinville': { lat: -26.3045, lng: -48.8487 },
      'Chapecó': { lat: -27.1004, lng: -52.6156 },
      'Criciúma': { lat: -28.6773, lng: -49.3697 },
      'Itajaí': { lat: -26.9077, lng: -48.6619 },
      'São José': { lat: -27.5969, lng: -48.6335 },
      'Lages': { lat: -27.8167, lng: -50.3264 },
      'Balneário Camboriú': { lat: -26.9906, lng: -48.6350 },
      'Palhoça': { lat: -27.6453, lng: -48.6704 },
      'Brusque': { lat: -27.0979, lng: -48.9139 },
      'Tubarão': { lat: -28.4667, lng: -49.0069 },
      'Jaraguá do Sul': { lat: -26.4856, lng: -49.0676 },
      'Balneário Piçarras': { lat: -26.7686, lng: -48.6714 },
      'Penha': { lat: -26.7706, lng: -48.6444 },
      'Barra Velha': { lat: -26.6317, lng: -48.6856 },
      'Navegantes': { lat: -26.8979, lng: -48.6545 },
      'Camboriú': { lat: -27.0247, lng: -48.6544 },
      'Piçarras': { lat: -26.7686, lng: -48.6714 },
      // Rio Grande do Sul
      'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
      'Santa Maria': { lat: -29.6868, lng: -53.8149 },
      'Caxias do Sul': { lat: -29.1634, lng: -51.1797 },
      'Pelotas': { lat: -31.7654, lng: -52.3376 },
      'Canoas': { lat: -29.9177, lng: -51.1844 },
      // Paraná
      'Curitiba': { lat: -25.4284, lng: -49.2733 },
      'Londrina': { lat: -23.3045, lng: -51.1696 },
      'Maringá': { lat: -23.4273, lng: -51.9375 },
      // São Paulo
      'São Paulo': { lat: -23.5505, lng: -46.6333 },
      'Campinas': { lat: -22.9099, lng: -47.0626 },
      // Rio de Janeiro
      'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
    };
    
    const cityCoords = coordinates[location.trim()];
    
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    // Build Apify request body - ULTRA MAXIMIZED LEADS MODE
    // For high-priority categories: run multiple searches and combine results
    // MAXIMIZE LEADS: Request as many as possible from Apify
    const isSpecialRegion = location.toLowerCase().includes('penha') || location.toLowerCase().includes('barra velha');
    let placesPerSearch = searchQueries.length > 1 ? 5000 : 8000; // ULTRA MAXIMIZED: 5000-8000 places
    if (isSpecialRegion) {
      placesPerSearch = searchQueries.length > 1 ? 6000 : 10000; // ULTRA MAXIMIZE for Penha/Barra Velha: 6000-10000
      console.log(`🎯 SPECIAL REGION DETECTED: ${location} - ULTRA MAXIMIZING RESULTS to ${placesPerSearch} places per search`);
    }
    console.log(`📊 Requesting ${placesPerSearch} places per search query`);
    
    const apifyRequestBody: any = {
      searchStringsArray: searchQueries, // Can be multiple search terms
      maxCrawledPlacesPerSearch: placesPerSearch,
      language: 'pt-BR',
      deeperCityScrape: true,
      exactMatch: false,
      ...(segment.toLowerCase().includes('indústria') && {
        categoryFilters: ['manufacturer', 'factory', 'industrial_company']
      }),
      maxAutomaticZoomOut: isSpecialRegion ? 8 : 6, // Expand search area very aggressively
    };
    
    // Add coordinates if available, otherwise let Apify search by city name
    if (cityCoords) {
      apifyRequestBody.lat = cityCoords.lat;
      apifyRequestBody.lng = cityCoords.lng;
      apifyRequestBody.radius = 100000; // 100 km radius for better coverage
      console.log(`📍 Using coordinates: ${cityCoords.lat}, ${cityCoords.lng} with 100km radius`);
    } else {
      console.log(`📍 No coordinates found for ${location}, using city name search only`);
    }
    
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyRequestBody),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(`❌ Apify API error: ${apifyResponse.status}`, errorText);
      
      // Parse error for more specific messages
      let errorMessage = `Erro ao buscar no Google Maps: ${apifyResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.type === 'platform-feature-disabled') {
          errorMessage = 'Limite mensal da API do Apify excedido. Por favor, atualize sua chave da API ou aguarde o próximo ciclo de cobrança.';
        } else if (errorData.error?.message) {
          errorMessage = `Erro da API: ${errorData.error.message}`;
        }
      } catch (e) {
        // Keep default message if can't parse
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: 'Por favor, verifique sua conta Apify ou entre em contato com o suporte.'
      }), {
        status: apifyResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let apifyResults = await apifyResponse.json();
    console.log(`📊 Apify returned ${apifyResults.length} places`);
    
    // If we got few results (less than 30), try multiple strategies to get more
    if (apifyResults.length < 30 && cityCoords) {
      console.log(`⚠️ Only ${apifyResults.length} results. Trying broader search strategies...`);
      
      // Strategy 1: Broader search without coordinates
      const broadPlaces = isSpecialRegion ? 8000 : 6000; // ULTRA MAXIMIZED: 6000-8000 places
      const broadSearchResponse = await fetch(
        `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchStringsArray: searchQueries,
            maxCrawledPlacesPerSearch: broadPlaces,
            language: 'pt-BR',
            deeperCityScrape: true,
            exactMatch: false,
          }),
        }
      );
      
      if (broadSearchResponse.ok) {
        const broadResults = await broadSearchResponse.json();
        console.log(`📊 Broader search returned ${broadResults.length} places`);
        const existingIds = new Set(apifyResults.map((r: any) => r.placeId));
        const newResults = broadResults.filter((r: any) => !existingIds.has(r.placeId));
        apifyResults = [...apifyResults, ...newResults];
        console.log(`✅ After broader search: ${apifyResults.length} places`);
      }
      
      // Strategy 2: If still not enough, expand radius significantly
      if (apifyResults.length < 30) {
        const expandedPlaces = isSpecialRegion ? 8000 : 6000; // ULTRA MAXIMIZED: 6000-8000 places
        console.log(`⚠️ Still only ${apifyResults.length} results. Expanding radius to 200km...`);
        const expandedSearchResponse = await fetch(
          `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchStringsArray: searchQueries,
              maxCrawledPlacesPerSearch: expandedPlaces,
              language: 'pt-BR',
              deeperCityScrape: true,
              exactMatch: false,
              lat: cityCoords.lat,
              lng: cityCoords.lng,
              radius: 200000, // 200 km radius
            }),
          }
        );
        
        if (expandedSearchResponse.ok) {
          const expandedResults = await expandedSearchResponse.json();
          console.log(`📊 Expanded radius search returned ${expandedResults.length} places`);
          const existingIds = new Set(apifyResults.map((r: any) => r.placeId));
          const newResults = expandedResults.filter((r: any) => !existingIds.has(r.placeId));
          apifyResults = [...apifyResults, ...newResults];
          console.log(`✅ After expanded radius: ${apifyResults.length} places`);
        }
      }
    }
    
    // CRITICAL FILTERING: Only exact city, valid phone, relevant business
    if (apifyResults.length > 0) {
      const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const locationLower = normalizeString(location.toLowerCase());
      const stateDisplayLower = normalizeString(stateDisplay.toLowerCase());
      const segmentLower = normalizeString(segment.toLowerCase());
      
      // Extract product keywords
      let productKeywords: string[] = [];
      if (segmentLower.includes('pao de queijo') || segmentLower.includes('pão de queijo')) {
        productKeywords = ['pao de queijo', 'pão de queijo', 'paodequeijo'];
      }
      
      const isProductSearch = productKeywords.length > 0;
      console.log(`🎯 Product search: ${isProductSearch} - Keywords: ${productKeywords.join(', ')}`);
      
      // Generic categories to EXCLUDE
      const genericRestaurantCategories = [
        'buffet', 'churrascaria', 'pizzaria', 'hamburgueria', 'steakhouse',
        'sushi', 'japanese restaurant', 'italian restaurant', 'chinese restaurant',
        'bar e restaurante', 'pub', 'night club', 'bar'
      ];
      
      console.log(`📊 Raw results from Apify BEFORE filtering: ${apifyResults.length}`);
      
      apifyResults = apifyResults.filter((place: any) => {
        const address = normalizeString((place.address || '').toLowerCase());
        const title = normalizeString((place.title || '').toLowerCase());
        const categoryName = normalizeString((place.categoryName || '').toLowerCase());
        const categories = (place.categories || []).map((cat: string) => normalizeString(cat.toLowerCase()));
        
        // 0. MUST NOT be permanently closed
        if (place.closed === true || place.permanentlyClosed === true || place.isAdvertisement === true) {
          console.log(`🚫 Establishment closed: ${place.title}`);
          return false;
        }
        
        // Check if title indicates closure
        const closureIndicators = ['fechado', 'encerrado', 'closed', 'desativado', 'inativo'];
        if (closureIndicators.some(indicator => title.includes(indicator))) {
          console.log(`🚫 Title indicates closure: ${place.title}`);
          return false;
        }
        
        // 1. MUST have valid phone (QUALITY REQUIREMENT)
        if (!place.phone || place.phone.trim() === '') {
          console.log(`🚫 No phone: ${place.title}`);
          return false;
        }
        
        // 2. Location validation - MUST match city AND state (QUALITY REQUIREMENT)
        const hasCity = address.includes(locationLower);
        const hasState = address.includes(stateDisplayLower);
        
        if (!hasCity || !hasState) {
          console.log(`🚫 Wrong location: ${place.title} at ${place.address} (need: ${location}, ${stateDisplay})`);
          return false;
        }
        
        // 3. For product-specific searches - be more lenient
        if (isProductSearch) {
          const mentionsProduct = productKeywords.some(keyword =>
            title.includes(keyword) ||
            categoryName.includes(keyword) ||
            categories.some((cat: string) => cat.includes(keyword))
          );
          
          // Only exclude obvious non-matches (generic restaurants that don't mention product)
          const isGenericRestaurant = genericRestaurantCategories.some(generic =>
            categoryName.includes(generic) ||
            categories.some((cat: string) => cat.includes(generic))
          );
          
          if (isGenericRestaurant && !mentionsProduct) {
            console.log(`❌ Generic restaurant without product: ${place.title}`);
            return false;
          }
          
          console.log(`✅ Relevant: ${place.title} (${categoryName})`);
        }
        
        return true;
      });
      
      console.log(`✅ After filtering: ${apifyResults.length} valid places`);
    }
    
    // If no results, return error - NO AI FALLBACK
    if (apifyResults.length === 0) {
      console.error('❌ No results from Google Maps after filtering');
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${location}, ${stateDisplay}. Tente ajustar os filtros ou buscar em outra cidade.` 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`✅ Processing ${apifyResults.length} REAL leads from Google Maps (no AI)...`);
    
    // Process ALL results (not just 25) and enrich
    const enrichedLeads = await Promise.all(apifyResults.map(async (place: any, index: number) => {
      // Validate phone (all leads have phone due to filter)
      let validatedPhone = place.phone;
      const phoneValidation = validatePhone(validatedPhone);
      let phoneValid = phoneValidation.valid;
      
      if (phoneValid) {
        validatedPhone = phoneValidation.normalized;
      } else {
        console.warn(`⚠️ Invalid phone format for ${place.title}: ${validatedPhone}`);
      }
      
      // Get website
      const website = place.website || 'Não disponível';
      
      // Search social media only if website exists
      let instagram = 'Não disponível';
      let instagramSource = 'none';
      let facebook = 'Não disponível';
      let whatsappBusiness = undefined;
      
      if (website !== 'Não disponível') {
        try {
          const socialMedia = await searchSocialMediaProfiles(place.title, location, website);
          instagram = socialMedia.instagram || instagram;
          instagramSource = socialMedia.instagram ? 'website' : 'none';
          facebook = socialMedia.facebook || facebook;
          whatsappBusiness = socialMedia.whatsappBusiness;
        } catch (error) {
          console.error(`Error getting social media for ${place.title}:`, error);
        }
      }
      
      // WhatsApp detection
      let hasWhatsApp = false;
      try {
        hasWhatsApp = await detectWhatsApp(validatedPhone, website);
        if (hasWhatsApp && !whatsappBusiness) {
          whatsappBusiness = validatedPhone;
        }
      } catch (error) {
        console.error(`Error detecting WhatsApp for ${place.title}:`, error);
      }
      
      // Calculate confidence (Google Maps data is highly reliable)
      let confidenceScore = 70; // Base score for verified Google Maps with phone
      if (phoneValid) confidenceScore += 15;
      if (website !== 'Não disponível') confidenceScore += 10;
      if (instagram !== 'Não disponível') confidenceScore += 5;
      
      return {
        id: `gm-${place.placeId || Date.now()}-${index}`,
        name: place.title,
        address: place.address,
        phone: validatedPhone,
        phoneValid: phoneValid,
        website,
        instagram,
        instagramSource,
        facebook,
        hasWhatsApp,
        whatsappBusiness: whatsappBusiness ? `https://wa.me/${whatsappBusiness.replace(/\D/g, '')}` : undefined,
        placeId: place.placeId,
        category: place.categoryName,
        rating: place.totalScore,
        reviews: place.reviewsCount,
        matchScore: 85,
        confidenceScore,
        source: 'google_maps',
        responsible: 'Gerente de Compras',
        revenue: 'A estimar',
        openedDate: 'A verificar',
        reasons: [
          `Estabelecimento verificado no Google Maps em ${location}`,
          `Telefone validado: ${validatedPhone}`,
          `Localização confirmada: ${location} - ${stateDisplay}`
        ],
        dataQuality: {
          hasValidPhone: phoneValid,
          hasSocialMedia: instagram !== 'Não disponível' || facebook !== 'Não disponível',
          hasWhatsApp,
          fromGoogleMaps: true
        },
        needsReview: false
      };
    }));
    
    // Sort by confidence score
    enrichedLeads.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    console.log(`✅ FINAL: ${enrichedLeads.length} verified leads from Google Maps`);
    console.log(`📊 Top 5 confidence scores: ${enrichedLeads.slice(0, 5).map(l => `${l.name}: ${l.confidenceScore}`).join(', ')}`);
    console.log(`📱 WhatsApp: ${enrichedLeads.filter(l => l.hasWhatsApp).length} leads`);
    console.log(`📸 Instagram: ${enrichedLeads.filter(l => l.instagram !== 'Não disponível').length} leads`);
    console.log(`🌐 Website: ${enrichedLeads.filter(l => l.website !== 'Não disponível').length} leads`);
    
    return new Response(JSON.stringify({ leads: enrichedLeads }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("❌ Error in search-leads function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido ao buscar leads" 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

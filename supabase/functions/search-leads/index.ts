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
        console.log(`✅ Found Instagram via rel="me": ${instagram}`);
        return instagram;
      }
    }
    
    // Priority 2: <meta property="og:url"> with Instagram
    const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*instagram\.com[^"']*)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*instagram\.com[^"']*)["'][^>]*property=["']og:url["']/i);
    if (ogUrlMatch) {
      const instagram = extractInstagramHandle(ogUrlMatch[1]);
      if (instagram) {
        console.log(`✅ Found Instagram via og:url: ${instagram}`);
        return instagram;
      }
    }
    
    // Priority 3: Direct instagram.com links in HTML
    const instagramLinks = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi);
    if (instagramLinks && instagramLinks.length > 0) {
      const instagram = extractInstagramHandle(instagramLinks[0]);
      if (instagram) {
        console.log(`✅ Found Instagram via direct link: ${instagram}`);
        return instagram;
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
    
    // Build search query
    const segmentLower = segment.toLowerCase();
    let searchQuery = segment;
    
    if (segmentLower.includes('pão de queijo') || segmentLower.includes('pao de queijo')) {
      searchQuery = `fabricante pão de queijo ${location} ${stateDisplay}`;
      console.log(`🎯 Product-specific search for: pão de queijo`);
    } else {
      searchQuery = `${segment} ${location} ${stateDisplay}`;
    }
    
    console.log(`🔍 Search query: "${searchQuery}"`);
    
    // Define coordinates for the location
    const coordinates: { [key: string]: { lat: number; lng: number } } = {
      'Santa Maria': { lat: -29.6868, lng: -53.8149 },
      'Blumenau': { lat: -26.9194, lng: -49.0661 },
      'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
      'Florianópolis': { lat: -27.5954, lng: -48.5480 },
      'Curitiba': { lat: -25.4284, lng: -49.2733 },
      'São Paulo': { lat: -23.5505, lng: -46.6333 },
      'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
    };
    
    const cityCoords = coordinates[location] || { lat: -29.6868, lng: -53.8149 };
    
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          lat: cityCoords.lat,
          lng: cityCoords.lng,
          radius: 25000, // 25 km radius
          exactMatch: true,
          maxCrawledPlacesPerSearch: 100, // Get maximum results
          language: 'pt-BR',
          deeperCityScrape: true,
          ...(segment.toLowerCase().includes('indústria') && {
            categoryFilters: ['manufacturer', 'factory', 'industrial_company']
          })
        }),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(`❌ Apify API error: ${apifyResponse.status}`, errorText);
      throw new Error(`Erro ao buscar no Google Maps: ${apifyResponse.status}`);
    }

    let apifyResults = await apifyResponse.json();
    console.log(`📊 Apify returned ${apifyResults.length} places`);
    
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
        
        // 1. MUST have valid phone
        if (!place.phone || place.phone.trim() === '') {
          console.log(`🚫 No phone: ${place.title}`);
          return false;
        }
        
        // 2. MUST be in correct city
        const hasCity = address.includes(locationLower);
        const hasState = address.includes(stateDisplayLower);
        const hasCityStateFormat = new RegExp(`\\b${locationLower}\\s*[\\-,/]\\s*${stateDisplayLower}\\b`).test(address);
        
        if (!hasCity || !hasState || !hasCityStateFormat) {
          console.log(`🚫 Wrong location: ${place.title} at ${place.address}`);
          return false;
        }
        
        // 3. For product-specific searches
        if (isProductSearch) {
          const mentionsProduct = productKeywords.some(keyword =>
            title.includes(keyword) ||
            categoryName.includes(keyword) ||
            categories.some((cat: string) => cat.includes(keyword))
          );
          
          const isGenericRestaurant = genericRestaurantCategories.some(generic =>
            categoryName.includes(generic) ||
            categories.some((cat: string) => cat.includes(generic))
          );
          
          if (isGenericRestaurant && !mentionsProduct) {
            console.log(`❌ Generic restaurant: ${place.title}`);
            return false;
          }
          
          const isManufacturer = ['fabricante', 'manufacturer', 'factory', 'fabrica', 'producao', 'industrial']
            .some(word => categoryName.includes(word) || categories.some((cat: string) => cat.includes(word)));
          
          if (!mentionsProduct && !isManufacturer) {
            console.log(`❌ Not related to ${productKeywords[0]}: ${place.title}`);
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
      // Validate phone
      let validatedPhone = place.phone;
      const phoneValidation = validatePhone(validatedPhone);
      if (phoneValidation.valid) {
        validatedPhone = phoneValidation.normalized;
      } else {
        console.warn(`⚠️ Invalid phone for ${place.title}: ${validatedPhone}`);
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
      if (phoneValidation.valid) confidenceScore += 15;
      if (website !== 'Não disponível') confidenceScore += 10;
      if (instagram !== 'Não disponível') confidenceScore += 5;
      
      return {
        id: `gm-${place.placeId || Date.now()}-${index}`,
        name: place.title,
        address: place.address,
        phone: validatedPhone,
        phoneValid: phoneValidation.valid,
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
          hasValidPhone: phoneValidation.valid,
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

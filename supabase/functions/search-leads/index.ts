import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple phone validation
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian: starts with 55 and has 12-13 digits
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return { 
      valid: true, 
      normalized: `+${digitsOnly}`, 
      isWhatsApp: digitsOnly.length === 13 && digitsOnly.charAt(4) === '9'
    };
  }
  
  // Brazilian without country code: 10-11 digits
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const normalized = `+55${digitsOnly}`;
    return { 
      valid: true, 
      normalized, 
      isWhatsApp: digitsOnly.length === 11 && digitsOnly.charAt(2) === '9'
    };
  }
  
  // Accept any phone with 8+ digits as valid (international)
  if (digitsOnly.length >= 8) {
    return { valid: true, normalized: phone, isWhatsApp: false };
  }
  
  return { valid: false, normalized: '', isWhatsApp: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters } = await req.json();
    console.log('🔍 NEW SEARCH METHOD - Input:', { segment, products, region, country, filters });
    
    const countryCode = country || 'BR';
    const isInternational = countryCode !== 'BR';
    
    // Build search query - SIMPLE AND DIRECT
    const searchTerm = segment.split(',')[0].trim();
    const location = isInternational ? `${region}, ${countryCode}` : `${region}, Brasil`;
    
    // Create 3 simple search queries
    const searchQueries = [
      `${searchTerm} ${location}`,
      `${searchTerm} em ${location}`,
      `loja de ${searchTerm} ${location}`
    ];
    
    console.log('📋 Search queries:', searchQueries);
    
    // Get Apify API key
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    // Apify request - SIMPLE CONFIGURATION
    const apifyBody = {
      searchStringsArray: searchQueries,
      maxCrawledPlacesPerSearch: 50,
      language: countryCode === 'BR' ? 'pt-BR' : 'en',
      skipClosedPlaces: true
    };
    
    console.log('🚀 Calling Apify with:', JSON.stringify(apifyBody, null, 2));
    
    // Call Apify Google Maps Scraper
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
      return new Response(JSON.stringify({ 
        error: `Erro na API Apify: ${apifyResponse.status}` 
      }), {
        status: apifyResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results = await apifyResponse.json();
    console.log(`📊 Apify returned ${results.length} places`);
    
    // Simple filter: just needs phone and not closed
    results = results.filter((place: any) => {
      // Must have phone
      if (!place.phone || place.phone.trim() === '') {
        return false;
      }
      
      // Skip closed places
      if (place.permanentlyClosed || place.temporarilyClosed) {
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ After filter: ${results.length} places with phone`);
    
    // Limit to 150
    if (results.length > 150) {
      results = results.slice(0, 150);
    }
    
    // If no results, return error
    if (results.length === 0) {
      console.log('❌ No results found');
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${region}. Tente ajustar os filtros.` 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Transform results to leads format
    const leads = results.map((place: any, index: number) => {
      const phoneValidation = validatePhone(place.phone);
      const reviewCount = place.reviewsCount || 0;
      
      // Estimate size based on reviews
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
        name: place.title,
        address: place.address || 'Endereço não disponível',
        phone: phoneValidation.valid ? phoneValidation.normalized : place.phone,
        phoneValid: phoneValidation.valid,
        email: place.email || 'Não disponível',
        website: place.website || 'Não disponível',
        instagram: 'Não disponível',
        facebook: 'Não disponível',
        hasWhatsApp: phoneValidation.isWhatsApp,
        placeId: place.placeId,
        category: place.categoryName || searchTerm,
        rating: place.totalScore || 0,
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
    
    console.log(`✅ FINAL: ${leads.length} leads`);
    
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

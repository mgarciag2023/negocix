import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate Brazilian phone numbers
function validatePhone(phone: string): { isValid: boolean; normalized: string } {
  if (!phone) return { isValid: false, normalized: "" };
  
  const cleaned = phone.replace(/\D/g, "");
  
  // Brazilian phones: 10-11 digits (with area code) or 12-13 with country code
  if (cleaned.length >= 10 && cleaned.length <= 13) {
    let normalized = cleaned;
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      normalized = cleaned.substring(2);
    }
    return { isValid: true, normalized: `+55${normalized}` };
  }
  
  return { isValid: false, normalized: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products, location, state } = await req.json();
    console.log("🔍 Searching suppliers for:", { products, location, state });

    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }

    // Map product categories to search terms
    const productSearchTerms: { [key: string]: string[] } = {
      "Alimentos em Geral": ["distribuidora de alimentos", "atacado alimentos", "fornecedor alimentos"],
      "Bebidas": ["distribuidora de bebidas", "atacado bebidas", "fornecedor bebidas"],
      "Laticínios": ["distribuidora laticínios", "fornecedor laticínios", "atacado laticínios"],
      "Carnes e Frigoríficos": ["frigorífico", "distribuidora de carnes", "atacado carnes"],
      "Frutas e Verduras": ["distribuidora hortifruti", "atacado frutas", "fornecedor verduras"],
      "Cereais e Grãos": ["distribuidora de grãos", "atacado cereais", "fornecedor grãos"],
      "Congelados": ["distribuidora congelados", "atacado congelados", "fornecedor congelados"],
      "Embalagens para Alimentos": ["embalagens alimentos", "fornecedor embalagens", "distribuidora embalagens"],
      "Materiais de Construção": ["distribuidora materiais construção", "atacado construção", "fornecedor construção"],
      "Cimento e Argamassa": ["distribuidora cimento", "fornecedor argamassa", "atacado cimento"],
      "Tintas e Vernizes": ["distribuidora tintas", "fornecedor tintas", "atacado tintas"],
      "Ferragens": ["distribuidora ferragens", "fornecedor ferragens", "atacado ferragens"],
      "Madeiras": ["madeireira", "distribuidora madeiras", "fornecedor madeiras"],
      "Tubos e Conexões": ["distribuidora tubos", "fornecedor conexões", "atacado hidráulico"],
      "Pisos e Revestimentos": ["distribuidora pisos", "fornecedor revestimentos", "atacado cerâmica"],
      "Materiais Elétricos": ["distribuidora elétrica", "fornecedor material elétrico", "atacado elétrico"],
      "Materiais Hidráulicos": ["distribuidora hidráulica", "fornecedor hidráulico", "atacado hidráulico"],
      "Tecidos": ["distribuidora tecidos", "atacado tecidos", "fornecedor tecidos"],
      "Aviamentos": ["distribuidora aviamentos", "fornecedor aviamentos", "atacado aviamentos"],
      "Fios e Linhas": ["distribuidora fios", "fornecedor linhas", "atacado têxtil"],
      "Malhas": ["distribuidora malhas", "fornecedor malhas", "atacado malhas"],
      "Uniformes": ["fábrica uniformes", "fornecedor uniformes", "confecção uniformes"],
      "Roupas em Geral": ["atacado roupas", "distribuidora confecções", "fornecedor roupas"],
      "Máquinas e Equipamentos": ["distribuidora máquinas", "fornecedor equipamentos", "atacado industrial"],
      "Ferramentas Industriais": ["distribuidora ferramentas", "fornecedor ferramentas industriais"],
      "Peças e Componentes": ["distribuidora peças", "fornecedor componentes", "atacado peças"],
      "Produtos Químicos": ["distribuidora química", "fornecedor produtos químicos"],
      "Lubrificantes": ["distribuidora lubrificantes", "fornecedor lubrificantes", "atacado lubrificantes"],
      "EPIs": ["distribuidora EPIs", "fornecedor EPIs", "atacado EPIs", "equipamentos segurança"],
      "Insumos Agrícolas": ["distribuidora agrícola", "fornecedor insumos agrícolas", "atacado agrícola"],
      "Fertilizantes": ["distribuidora fertilizantes", "fornecedor fertilizantes"],
      "Sementes": ["distribuidora sementes", "fornecedor sementes", "atacado sementes"],
      "Rações Animais": ["distribuidora rações", "fornecedor ração animal", "atacado pet"],
      "Medicamentos Veterinários": ["distribuidora veterinária", "fornecedor veterinário"],
      "Embalagens Plásticas": ["fábrica embalagens plásticas", "distribuidora plásticos"],
      "Embalagens de Papelão": ["fábrica papelão", "distribuidora papelão", "fornecedor caixas"],
      "Sacolas e Sacos": ["fábrica sacolas", "distribuidora sacolas", "fornecedor embalagens"],
      "Fitas e Lacres": ["distribuidora fitas adesivas", "fornecedor lacres"],
      "Papelaria": ["distribuidora papelaria", "atacado papelaria", "fornecedor papelaria"],
      "Material de Escritório": ["distribuidora escritório", "fornecedor material escritório"],
      "Informática e Tecnologia": ["distribuidora informática", "atacado tecnologia", "fornecedor TI"],
      "Produtos de Limpeza": ["distribuidora limpeza", "atacado limpeza", "fornecedor produtos limpeza"],
      "Descartáveis": ["distribuidora descartáveis", "atacado descartáveis", "fornecedor descartáveis"],
      "Produtos de Higiene": ["distribuidora higiene", "atacado higiene", "fornecedor higiene"],
      "Peças Automotivas": ["distribuidora autopeças", "atacado peças automotivas", "fornecedor autopeças"],
      "Pneus": ["distribuidora pneus", "atacado pneus", "fornecedor pneus"],
      "Óleos e Lubrificantes": ["distribuidora óleos", "fornecedor lubrificantes automotivos"],
      "Acessórios Automotivos": ["distribuidora acessórios auto", "atacado automotivo"],
      "Móveis": ["fábrica móveis", "distribuidora móveis", "atacado móveis"],
      "Eletrodomésticos": ["distribuidora eletrodomésticos", "atacado eletro", "fornecedor eletro"],
      "Brinquedos": ["distribuidora brinquedos", "atacado brinquedos", "fornecedor brinquedos"],
      "Cosméticos": ["distribuidora cosméticos", "atacado beleza", "fornecedor cosméticos"],
      "Produtos Farmacêuticos": ["distribuidora farmacêutica", "fornecedor medicamentos"],
      "Bijuterias e Acessórios": ["distribuidora bijuterias", "atacado acessórios", "fornecedor bijuterias"],
      "Utilidades Domésticas": ["distribuidora utilidades", "atacado utilidades domésticas"],
    };

    // Build search queries from selected products
    const searchQueries: string[] = [];
    for (const product of products) {
      const terms = productSearchTerms[product];
      if (terms && terms.length > 0) {
        // Use first term for each product to avoid too many queries
        searchQueries.push(`${terms[0]} ${location} ${state}`);
      } else {
        // Fallback for unknown products
        searchQueries.push(`fornecedor ${product} ${location} ${state}`);
      }
    }

    // Limit search queries to control API costs
    const limitedQueries = searchQueries.slice(0, 5);
    console.log(`📋 Search queries (${limitedQueries.length}):`, limitedQueries);

    const MAX_TOTAL_SUPPLIERS = 100;
    const placesPerSearch = Math.max(10, Math.floor(MAX_TOTAL_SUPPLIERS / limitedQueries.length));

    const apifyRequestBody = {
      searchStringsArray: limitedQueries,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language: "pt-BR",
      deeperCityScrape: true,
      exactMatch: false,
      scrapeReviewsNumber: 0,
      skipClosedPlaces: true,
      maxAutomaticZoomOut: 5,
      includeSearchResultsNearby: true,
    };

    console.log("📡 Calling Apify API...");

    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyRequestBody),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error(`❌ Apify API error: ${apifyResponse.status}`, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar fornecedores. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apifyResults = await apifyResponse.json();
    console.log(`📊 Apify returned ${apifyResults.length} places`);

    // Filter results
    const normalizeString = (str: string) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const locationLower = normalizeString(location.toLowerCase());
    const stateLower = normalizeString(state.toLowerCase());

    apifyResults = apifyResults.filter((place: any) => {
      const address = normalizeString((place.address || "").toLowerCase());

      // Must have phone
      if (!place.phone || place.phone.trim() === "") {
        return false;
      }

      // Must match location
      const hasCity = address.includes(locationLower);
      const hasState = address.includes(stateLower);
      if (!hasCity || !hasState) {
        return false;
      }

      // Must not be closed
      if (place.permanentlyClosed || place.temporarilyClosed || place.closed) {
        return false;
      }

      return true;
    });

    console.log(`✅ After filtering: ${apifyResults.length} suppliers`);

    // Limit results
    if (apifyResults.length > MAX_TOTAL_SUPPLIERS) {
      apifyResults = apifyResults.slice(0, MAX_TOTAL_SUPPLIERS);
    }

    // Map to supplier format
    const suppliers = apifyResults.map((place: any, index: number) => {
      const phoneValidation = validatePhone(place.phone);
      const hasWhatsApp = phoneValidation.isValid && place.phone?.includes("9");

      return {
        id: `supplier-${index}-${Date.now()}`,
        name: place.title || "Fornecedor",
        address: place.address || "",
        phone: place.phone || "",
        website: place.website || null,
        category: place.categoryName || products[0] || "Fornecedor",
        hasWhatsApp,
      };
    });

    // Remove duplicates by phone
    const seenPhones = new Set<string>();
    const uniqueSuppliers = suppliers.filter((s: any) => {
      const phone = s.phone.replace(/\D/g, "");
      if (seenPhones.has(phone)) return false;
      seenPhones.add(phone);
      return true;
    });

    console.log(`📦 Returning ${uniqueSuppliers.length} unique suppliers`);

    return new Response(
      JSON.stringify({ suppliers: uniqueSuppliers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate Brazilian phone numbers
function validatePhone(phone: string): { isValid: boolean; normalized: string } {
  if (!phone) return { isValid: false, normalized: "" };
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 10 && cleaned.length <= 13) {
    let normalized = cleaned;
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      normalized = cleaned.substring(2);
    }
    return { isValid: true, normalized: `+55${normalized}` };
  }
  return { isValid: false, normalized: "" };
}

// Normalize string for comparison (remove accents)
function normalizeStr(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ====== SUPPLIER VALIDATION ======

// Terms that indicate a real supplier/distributor/wholesale business
const SUPPLIER_INDICATORS = [
  'distribuidora', 'distribuidor', 'atacado', 'atacadista', 'atacadão',
  'fornecedor', 'fornecedora', 'fabrica', 'fábrica', 'fabricante',
  'industria', 'indústria', 'industrial',
  'deposito', 'depósito', 'armazem', 'armazém',
  'importadora', 'importador', 'exportadora',
  'representante', 'representação', 'representacoes',
  'cooperativa', 'coop',
  'comercio atacadista', 'comércio atacadista',
  'central de distribuição', 'centro de distribuição',
  'supply', 'wholesale', 'trading',
  'ltda', 'eireli', 'me', 's/a', 's.a', 'epp', 'sa',
];

// Terms that strongly indicate NOT a supplier (retail/services/food service)
const NON_SUPPLIER_EXCLUDES = [
  'restaurante', 'lanchonete', 'bar ', 'barzinho', 'boteco',
  'padaria', 'confeitaria', 'pizzaria', 'hamburgueria', 'sorveteria',
  'cafeteria', 'café', 'bistrô', 'bistro', 'cantina',
  'churrascaria', 'rodízio', 'rodizio', 'food truck',
  'salão', 'salao', 'barbearia', 'estética', 'estetica',
  'academia', 'crossfit', 'pilates',
  'consultório', 'consultorio', 'clínica', 'clinica', 'dentista',
  'hospital', 'laboratório', 'laboratorio', 'farmácia', 'farmacia',
  'escola', 'colégio', 'colegio', 'universidade', 'faculdade',
  'igreja', 'templo', 'paróquia', 'paroquia',
  'posto de gasolina', 'posto de combustível',
  'oficina mecânica', 'oficina mecanica', 'borracharia',
  'pet shop', 'petshop', 'banho e tosa',
  'imobiliária', 'imobiliaria',
  'hotel', 'pousada', 'hostel', 'motel',
  'supermercado', 'minimercado', 'mercearia', 'mercadinho', 'mercado municipal',
  'açougue', 'acougue',
  'lavanderia', 'lavajato',
  'funerária', 'funeraria',
  'cartório', 'cartorio',
  'lotérica', 'loterica',
];

// Google Places categories that are NOT suppliers
const NON_SUPPLIER_CATEGORIES = [
  'restaurant', 'food', 'cafe', 'bar', 'bakery', 'pizza',
  'gym', 'fitness', 'beauty', 'hair', 'spa',
  'doctor', 'dentist', 'hospital', 'pharmacy', 'health',
  'school', 'university', 'church',
  'hotel', 'motel', 'lodging',
  'gas_station', 'car_repair', 'car_wash',
  'pet_store', 'veterinary',
  'real_estate', 'insurance',
  'laundry', 'funeral',
  'supermarket', 'grocery', 'convenience_store',
  'butcher',
];

function isLikelySupplier(place: any, searchedProducts: string[]): boolean {
  const title = normalizeStr(place.title || "");
  const category = normalizeStr(place.categoryName || "");
  const allCategories = (place.categories || []).map((c: string) => normalizeStr(c));
  const fullText = `${title} ${category} ${allCategories.join(" ")}`;

  // 1. Check for hard excludes in the title
  for (const exclude of NON_SUPPLIER_EXCLUDES) {
    if (title.includes(normalizeStr(exclude))) {
      // Exception: if title also has a supplier indicator, allow it
      // e.g. "Distribuidora e Restaurante" - still a distributor
      const hasSupplierWord = SUPPLIER_INDICATORS.some(ind => title.includes(normalizeStr(ind)));
      if (!hasSupplierWord) {
        console.log(`❌ Excluded (non-supplier name): "${place.title}"`);
        return false;
      }
    }
  }

  // 2. Check for non-supplier Google categories
  for (const cat of NON_SUPPLIER_CATEGORIES) {
    if (allCategories.some((c: string) => c.includes(cat)) || category.includes(cat)) {
      // Exception: if title clearly has supplier indicators
      const hasSupplierWord = SUPPLIER_INDICATORS.some(ind => title.includes(normalizeStr(ind)));
      if (!hasSupplierWord) {
        console.log(`❌ Excluded (non-supplier category "${category}"): "${place.title}"`);
        return false;
      }
    }
  }

  // 3. Positive check: does the title or category have supplier indicators?
  const hasSupplierIndicator = SUPPLIER_INDICATORS.some(ind => fullText.includes(normalizeStr(ind)));
  
  // 4. Check if the title/category matches the searched product context
  const productContext = searchedProducts.map(p => normalizeStr(p)).join(" ");
  const hasProductMatch = productContext.split(" ").some(word => 
    word.length > 3 && fullText.includes(word)
  );

  // 5. Scoring: supplier indicators are strong signals
  if (hasSupplierIndicator) {
    return true;
  }

  // 6. If no supplier indicator, check if category from Google suggests wholesale/distribution
  const wholesaleCategories = ['wholesale', 'distributor', 'warehouse', 'supplier', 'factory',
    'atacado', 'distribuidora', 'deposito', 'armazem', 'fabrica', 'industria'];
  const hasWholesaleCategory = allCategories.some((c: string) => 
    wholesaleCategories.some(wc => c.includes(wc))
  );
  if (hasWholesaleCategory) {
    return true;
  }

  // 7. If we have a product match but no supplier indicator, 
  //    only allow if it has a website (suggests a real business) AND reviews
  if (hasProductMatch && place.website && (place.totalScore || 0) > 0 && (place.reviewsCount || 0) >= 3) {
    console.log(`⚠️ Allowed with caution (product match + website + reviews): "${place.title}"`);
    return true;
  }

  console.log(`❌ Excluded (no supplier indicators): "${place.title}" | cat: "${category}"`);
  return false;
}

// ====== SEARCH TERM MAPPING ======
const productSearchTerms: { [key: string]: string[] } = {
  "Alimentos em Geral": ["distribuidora de alimentos", "atacado alimentos"],
  "Bebidas": ["distribuidora de bebidas", "atacado bebidas"],
  "Laticínios": ["distribuidora laticínios", "atacado laticínios"],
  "Carnes e Frigoríficos": ["frigorífico", "distribuidora de carnes", "atacado carnes"],
  "Frutas e Verduras": ["distribuidora hortifruti", "atacado frutas verduras"],
  "Cereais e Grãos": ["distribuidora de grãos", "atacado cereais"],
  "Congelados": ["distribuidora congelados", "atacado congelados"],
  "Embalagens para Alimentos": ["distribuidora embalagens alimentos", "fábrica embalagens alimentos"],
  "Materiais de Construção": ["distribuidora materiais construção", "atacado construção"],
  "Cimento e Argamassa": ["distribuidora cimento", "atacado cimento argamassa"],
  "Tintas e Vernizes": ["distribuidora tintas", "atacado tintas vernizes"],
  "Ferragens": ["distribuidora ferragens", "atacado ferragens"],
  "Madeiras": ["madeireira atacado", "distribuidora madeiras"],
  "Tubos e Conexões": ["distribuidora tubos conexões", "atacado hidráulico"],
  "Pisos e Revestimentos": ["distribuidora pisos revestimentos", "atacado cerâmica porcelanato"],
  "Materiais Elétricos": ["distribuidora material elétrico", "atacado elétrico"],
  "Materiais Hidráulicos": ["distribuidora material hidráulico", "atacado hidráulico"],
  "Tecidos": ["distribuidora tecidos", "atacado tecidos"],
  "Aviamentos": ["distribuidora aviamentos", "atacado aviamentos"],
  "Fios e Linhas": ["distribuidora fios linhas", "atacado têxtil"],
  "Malhas": ["distribuidora malhas", "atacado malhas"],
  "Uniformes": ["fábrica uniformes", "confecção uniformes atacado"],
  "Roupas em Geral": ["atacado roupas", "distribuidora confecções"],
  "Máquinas e Equipamentos": ["distribuidora máquinas", "fornecedor equipamentos industriais"],
  "Ferramentas Industriais": ["distribuidora ferramentas industriais", "atacado ferramentas"],
  "Peças e Componentes": ["distribuidora peças industriais", "fornecedor componentes"],
  "Produtos Químicos": ["distribuidora produtos químicos", "fornecedor químicos"],
  "Lubrificantes": ["distribuidora lubrificantes", "atacado lubrificantes"],
  "EPIs": ["distribuidora EPIs", "atacado equipamentos segurança"],
  "Insumos Agrícolas": ["distribuidora insumos agrícolas", "atacado agrícola"],
  "Fertilizantes": ["distribuidora fertilizantes", "atacado fertilizantes"],
  "Sementes": ["distribuidora sementes", "atacado sementes"],
  "Rações Animais": ["distribuidora rações", "atacado ração animal"],
  "Medicamentos Veterinários": ["distribuidora veterinária", "atacado veterinário"],
  "Embalagens Plásticas": ["fábrica embalagens plásticas", "distribuidora plásticos"],
  "Embalagens de Papelão": ["fábrica papelão", "distribuidora caixas papelão"],
  "Sacolas e Sacos": ["fábrica sacolas", "distribuidora sacolas embalagens"],
  "Fitas e Lacres": ["distribuidora fitas adesivas", "fornecedor lacres embalagens"],
  "Papelaria": ["distribuidora papelaria", "atacado papelaria"],
  "Material de Escritório": ["distribuidora material escritório", "atacado escritório"],
  "Informática e Tecnologia": ["distribuidora informática", "atacado tecnologia"],
  "Produtos de Limpeza": ["distribuidora produtos limpeza", "atacado limpeza"],
  "Descartáveis": ["distribuidora descartáveis", "atacado descartáveis"],
  "Produtos de Higiene": ["distribuidora higiene", "atacado higiene"],
  "Peças Automotivas": ["distribuidora autopeças", "atacado peças automotivas"],
  "Pneus": ["distribuidora pneus", "atacado pneus"],
  "Óleos e Lubrificantes": ["distribuidora óleos lubrificantes", "atacado lubrificantes automotivos"],
  "Acessórios Automotivos": ["distribuidora acessórios automotivos", "atacado automotivo"],
  "Móveis": ["fábrica móveis", "distribuidora móveis atacado"],
  "Eletrodomésticos": ["distribuidora eletrodomésticos", "atacado eletro"],
  "Brinquedos": ["distribuidora brinquedos", "atacado brinquedos"],
  "Cosméticos": ["distribuidora cosméticos", "atacado beleza cosméticos"],
  "Produtos Farmacêuticos": ["distribuidora farmacêutica", "atacado medicamentos"],
  "Bijuterias e Acessórios": ["distribuidora bijuterias", "atacado acessórios bijuterias"],
  "Utilidades Domésticas": ["distribuidora utilidades domésticas", "atacado utilidades"],
};

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

    // Build search queries - always prefix with "distribuidora" or "atacado" for quality
    const searchQueries: string[] = [];
    for (const product of products) {
      const terms = productSearchTerms[product];
      if (terms && terms.length > 0) {
        // Use first term (always a distribuidora/atacado term)
        searchQueries.push(`${terms[0]} ${location} ${state}`);
      } else {
        searchQueries.push(`distribuidora ${product} ${location} ${state}`);
      }
    }

    const limitedQueries = searchQueries.slice(0, 5);
    console.log(`📋 Search queries (${limitedQueries.length}):`, limitedQueries);

    const MAX_TOTAL_SUPPLIERS = 30;
    const placesPerSearch = Math.max(15, Math.floor(50 / limitedQueries.length));

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
    console.log(`📊 Apify returned ${apifyResults.length} raw places`);

    const locationLower = normalizeStr(location);
    const stateLower = normalizeStr(state);

    // STEP 1: Basic filters (phone, location, not closed)
    let filtered = apifyResults.filter((place: any) => {
      const address = normalizeStr(place.address || "");

      if (!place.phone || place.phone.trim() === "") return false;
      if (!address.includes(locationLower) || !address.includes(stateLower)) return false;
      if (place.permanentlyClosed || place.temporarilyClosed || place.closed) return false;

      return true;
    });

    console.log(`📍 After location/phone filter: ${filtered.length} places`);

    // STEP 2: Supplier quality filter - THE KEY IMPROVEMENT
    filtered = filtered.filter((place: any) => isLikelySupplier(place, products));

    console.log(`✅ After supplier quality filter: ${filtered.length} suppliers`);

    // Limit results
    if (filtered.length > MAX_TOTAL_SUPPLIERS) {
      filtered = filtered.slice(0, MAX_TOTAL_SUPPLIERS);
    }

    // Map to supplier format
    const suppliers = filtered.map((place: any, index: number) => {
      const phoneValidation = validatePhone(place.phone);
      const normalizedPhone = place.phone.replace(/\D/g, "");
      const hasWhatsApp = phoneValidation.isValid && normalizedPhone.length === 11 && normalizedPhone.charAt(2) === '9';

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

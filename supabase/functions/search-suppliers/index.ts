import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPIDAPI_HOST = "local-business-data.p.rapidapi.com";

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

function normalizeStr(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ====== SUPPLIER VALIDATION ======

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

function isLikelySupplier(place: any, searchedProducts: string[]): boolean {
  const title = normalizeStr(place.name || "");
  const category = normalizeStr(place.type || "");
  const allCategories = (place.subtypes || []).map((c: string) => normalizeStr(c));
  const fullText = `${title} ${category} ${allCategories.join(" ")}`;

  for (const exclude of NON_SUPPLIER_EXCLUDES) {
    if (title.includes(normalizeStr(exclude))) {
      const hasSupplierWord = SUPPLIER_INDICATORS.some(ind => title.includes(normalizeStr(ind)));
      if (!hasSupplierWord) {
        console.log(`❌ Excluded (non-supplier name): "${place.name}"`);
        return false;
      }
    }
  }

  const hasSupplierIndicator = SUPPLIER_INDICATORS.some(ind => fullText.includes(normalizeStr(ind)));
  if (hasSupplierIndicator) return true;

  const wholesaleCategories = ['wholesale', 'distributor', 'warehouse', 'supplier', 'factory',
    'atacado', 'distribuidora', 'deposito', 'armazem', 'fabrica', 'industria'];
  const hasWholesaleCategory = allCategories.some((c: string) => 
    wholesaleCategories.some(wc => c.includes(wc))
  );
  if (hasWholesaleCategory) return true;

  const productContext = searchedProducts.map(p => normalizeStr(p)).join(" ");
  const hasProductMatch = productContext.split(" ").some(word => 
    word.length > 3 && fullText.includes(word)
  );
  if (hasProductMatch && place.website && (place.review_count || 0) >= 3) {
    console.log(`⚠️ Allowed with caution (product match + website + reviews): "${place.name}"`);
    return true;
  }

  console.log(`❌ Excluded (no supplier indicators): "${place.name}" | cat: "${category}"`);
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

// ====== RAPIDAPI SEARCH ======

async function searchRapidAPI(query: string, apiKey: string, limit: number = 20): Promise<any[]> {
  const url = new URL('https://local-business-data.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ RapidAPI error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    if (data.status === 'OK' && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error('❌ RapidAPI search error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products, location, state } = await req.json();
    console.log("🔍 Searching suppliers for:", { products, location, state });

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    // Build search queries
    const searchQueries: string[] = [];
    for (const product of products) {
      const terms = productSearchTerms[product];
      if (terms && terms.length > 0) {
        searchQueries.push(`${terms[0]} ${location} ${state}`);
      } else {
        searchQueries.push(`distribuidora ${product} ${location} ${state}`);
      }
    }

    const limitedQueries = searchQueries.slice(0, 5);
    console.log(`📋 Search queries (${limitedQueries.length}):`, limitedQueries);

    const MAX_TOTAL_SUPPLIERS = 30;
    const placesPerSearch = Math.max(15, Math.floor(50 / limitedQueries.length));

    // Execute searches in parallel via RapidAPI
    const searchPromises = limitedQueries.map(query => searchRapidAPI(query, RAPIDAPI_KEY, placesPerSearch));
    const results = await Promise.all(searchPromises);

    let allPlaces: any[] = [];
    const seenIds = new Set<string>();
    for (const resultList of results) {
      for (const place of resultList) {
        const id = place.business_id || place.place_id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allPlaces.push(place);
        }
      }
    }

    console.log(`📊 RapidAPI returned ${allPlaces.length} unique places`);

    const locationLower = normalizeStr(location);
    const stateLower = normalizeStr(state);

    // STEP 1: Basic filters (phone, location)
    let filtered = allPlaces.filter((place: any) => {
      const address = normalizeStr(place.full_address || "");
      if (!place.phone_number || place.phone_number.trim() === "") return false;
      if (!address.includes(locationLower) || !address.includes(stateLower)) return false;
      return true;
    });

    console.log(`📍 After location/phone filter: ${filtered.length} places`);

    // STEP 2: Supplier quality filter
    filtered = filtered.filter((place: any) => isLikelySupplier(place, products));

    console.log(`✅ After supplier quality filter: ${filtered.length} suppliers`);

    if (filtered.length > MAX_TOTAL_SUPPLIERS) {
      filtered = filtered.slice(0, MAX_TOTAL_SUPPLIERS);
    }

    // Map to supplier format
    const suppliers = filtered.map((place: any, index: number) => {
      const phoneValidation = validatePhone(place.phone_number || "");
      const normalizedPhone = (place.phone_number || "").replace(/\D/g, "");
      const hasWhatsApp = phoneValidation.isValid && normalizedPhone.length === 11 && normalizedPhone.charAt(2) === '9';

      return {
        id: `supplier-${index}-${Date.now()}`,
        name: place.name || "Fornecedor",
        address: place.full_address || "",
        phone: place.phone_number || "",
        website: place.website || null,
        category: place.type || products[0] || "Fornecedor",
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

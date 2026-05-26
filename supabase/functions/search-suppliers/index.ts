import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizeStr(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/[^\s]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function isPhoneValid(phone: string | null): boolean {
  if (!phone || phone.trim() === '' || phone === '()-' || phone === '(0)0-' || phone === '(0000)0000-0000') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8;
}

function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    const isMobile = digitsOnly.length === 13 && digitsOnly.charAt(4) === '9';
    return { valid: true, normalized: `+${digitsOnly}`, isWhatsApp: isMobile };
  }
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const isMobile = digitsOnly.length === 11 && digitsOnly.charAt(2) === '9';
    return { valid: true, normalized: `+55${digitsOnly}`, isWhatsApp: isMobile };
  }
  if (digitsOnly.length >= 8) return { valid: true, normalized: phone, isWhatsApp: false };
  return { valid: false, normalized: '', isWhatsApp: false };
}

// ====== SUPPLIER SEARCH TERMS ======
// Maps product categories to search terms for nome_fantasia and descricao_cnae
const productSearchTerms: { [key: string]: string[] } = {
  "Alimentos em Geral": ["distribuidora de alimentos", "atacado alimentos", "distribuidora alimenticia"],
  "Bebidas": ["distribuidora de bebidas", "atacado bebidas", "bebidas"],
  "Laticínios": ["distribuidora laticinios", "laticinios", "leite", "queijo"],
  "Carnes e Frigoríficos": ["frigorifico", "distribuidora de carnes", "carnes", "abatedouro"],
  "Frutas e Verduras": ["hortifruti", "frutas", "verduras", "hortifrutigranjeiro"],
  "Cereais e Grãos": ["distribuidora de graos", "cereais", "graos"],
  "Congelados": ["congelados", "distribuidora congelados", "frios"],
  "Embalagens para Alimentos": ["embalagens", "embalagem", "descartaveis"],
  "Materiais de Construção": ["materiais de construcao", "material de construcao", "construcao"],
  "Cimento e Argamassa": ["cimento", "argamassa", "concreto"],
  "Tintas e Vernizes": ["tintas", "vernizes", "tinta", "distribuidora tintas"],
  "Ferragens": ["ferragens", "ferragem", "parafusos", "fixadores"],
  "Madeiras": ["madeireira", "madeiras", "madeira"],
  "Tubos e Conexões": ["tubos", "conexoes", "hidraulico", "pvc"],
  "Pisos e Revestimentos": ["pisos", "revestimentos", "ceramica", "porcelanato"],
  "Materiais Elétricos": ["material eletrico", "eletrico", "eletrica", "fios", "cabos"],
  "Materiais Hidráulicos": ["hidraulico", "hidraulica", "tubos", "conexoes"],
  "Tecidos": ["tecidos", "tecido", "textil"],
  "Aviamentos": ["aviamentos", "aviamento", "armarinho"],
  "Fios e Linhas": ["fios", "linhas", "textil"],
  "Malhas": ["malhas", "malha", "malharia"],
  "Uniformes": ["uniformes", "uniforme", "confeccao"],
  "Roupas em Geral": ["roupas", "confeccao", "confeccoes", "vestuario"],
  "Máquinas e Equipamentos": ["maquinas", "equipamentos", "industrial"],
  "Ferramentas Industriais": ["ferramentas", "ferramenta", "industrial"],
  "Peças e Componentes": ["pecas", "componentes", "industrial"],
  "Produtos Químicos": ["quimicos", "quimica", "produtos quimicos"],
  "Lubrificantes": ["lubrificantes", "lubrificante", "oleo"],
  "EPIs": ["epi", "equipamento de protecao", "seguranca do trabalho"],
  "Insumos Agrícolas": ["insumos agricolas", "agropecuaria", "agricola", "defensivos"],
  "Fertilizantes": ["fertilizantes", "fertilizante", "adubo"],
  "Sementes": ["sementes", "semente"],
  "Rações Animais": ["racao", "racoes", "ração animal", "pet"],
  "Medicamentos Veterinários": ["veterinario", "veterinaria", "medicamentos animais"],
  "Embalagens Plásticas": ["embalagens plasticas", "plasticos", "plastico"],
  "Embalagens de Papelão": ["papelao", "caixas", "embalagens"],
  "Sacolas e Sacos": ["sacolas", "sacos", "embalagens"],
  "Fitas e Lacres": ["fitas", "lacres", "adesivos"],
  "Papelaria": ["papelaria", "papel", "cadernos"],
  "Material de Escritório": ["escritorio", "papelaria", "material de escritorio"],
  "Informática e Tecnologia": ["informatica", "tecnologia", "computadores", "ti"],
  "Produtos de Limpeza": ["produtos de limpeza", "limpeza", "higiene"],
  "Descartáveis": ["descartaveis", "descartavel", "copos", "pratos"],
  "Produtos de Higiene": ["higiene", "higiene pessoal", "limpeza"],
  "Peças Automotivas": ["autopecas", "auto pecas", "pecas automotivas", "automotivo"],
  "Pneus": ["pneus", "pneu", "borracharia"],
  "Óleos e Lubrificantes": ["oleo", "lubrificante", "lubrificantes"],
  "Acessórios Automotivos": ["acessorios automotivos", "automotivo", "acessorios"],
  "Móveis": ["moveis", "movel", "mobiliario"],
  "Eletrodomésticos": ["eletrodomesticos", "eletro", "eletrodomestico"],
  "Brinquedos": ["brinquedos", "brinquedo"],
  "Cosméticos": ["cosmeticos", "cosmetico", "beleza"],
  "Produtos Farmacêuticos": ["farmaceutica", "medicamentos", "farmacia"],
  "Bijuterias e Acessórios": ["bijuterias", "bijuteria", "acessorios"],
  "Utilidades Domésticas": ["utilidades domesticas", "utilidades", "domesticas"],
  "Produtos para Pet Shop": ["pet", "ração", "racao", "animais", "veterinario"],
  "Produtos pet": ["pet", "ração", "racao", "animais", "veterinario"],
  "Tintas e Materiais para Pintura": ["tintas", "pintura", "verniz", "tinta"],
  "Pré-Moldados": ["pre-moldados", "pre moldados", "artefatos concreto", "concreto", "lajes"],
  "Steel Frame": ["steel frame", "estrutura metalica", "perfil aco", "construcao seco"],
  "Esquadrias de Alumínio": ["esquadrias aluminio", "esquadria aluminio", "esquadrias", "aluminio", "janelas aluminio", "portas aluminio"],
  "Esquadrias de PVC": ["esquadrias pvc", "esquadria pvc", "esquadrias", "pvc", "janelas pvc", "portas pvc"],
  "Esquadrias de Madeira": ["esquadrias madeira", "esquadria madeira", "esquadrias", "marcenaria", "portas madeira", "janelas madeira"],
  "Esquadrias de Ferro": ["esquadrias ferro", "esquadria ferro", "esquadrias", "serralheria", "portoes", "grades"],
  "Vidros e Vidraçaria": ["vidracaria", "vidros", "vidro", "box", "espelhos", "temperado"],
  "Portas e Janelas": ["portas e janelas", "portas", "janelas", "esquadrias"],
  "Artigos para Festas": ["festas", "artigos festas", "baloes", "descartaveis"],
  "Balões e Decoração": ["baloes", "decoracao", "festas"],
  "Materiais para Artesanato": ["artesanato", "aviamentos", "armarinho"],
  "Produtos Naturais e Suplementos": ["produtos naturais", "suplementos", "natural"],
  "Produtos de Beleza e Cabelo": ["beleza", "cabelo", "cosmeticos", "profissional"],
  "Material Fotográfico": ["fotografico", "fotografia", "cameras"],
  "Instrumentos Musicais": ["instrumentos musicais", "musica", "audio"],
  "Equipamentos para Restaurantes": ["equipamentos restaurante", "cozinha industrial", "inox"],
  "Produtos para Confeitaria e Panificação": ["confeitaria", "panificacao", "padaria", "ingredientes"],
  "Materiais para Serigrafia e Estamparia": ["serigrafia", "estamparia", "sublimacao"],
  "Produtos de Jardinagem e Paisagismo": ["jardinagem", "paisagismo", "plantas", "vasos"],
  "Equipamentos para Academia": ["academia", "fitness", "musculacao", "esportivos"],
  "Materiais Odontológicos": ["odontologico", "dentario", "odontologia"],
  "Suprimentos para Impressão": ["impressao", "toner", "cartucho", "papel"],
  "Equipamentos de Segurança Eletrônica": ["seguranca", "cameras", "cftv", "alarmes"],
  "Produtos para Piscinas": ["piscina", "piscinas", "cloro", "tratamento agua"],
  "Moda Infantil": ["moda infantil", "roupas infantis", "roupa infantil", "confeccao infantil", "enxoval infantil", "enxoval bebe", "vestuario infantil", "atacado infantil"],
};

// Supplier indicators for filtering
const SUPPLIER_INDICATORS = [
  'distribuidora', 'distribuidor', 'atacado', 'atacadista', 'atacadao',
  'fornecedor', 'fornecedora', 'fabrica', 'fabricante',
  'industria', 'industrial', 'deposito', 'armazem',
  'importadora', 'importador', 'exportadora',
  'representante', 'representacao', 'representacoes',
  'cooperativa', 'coop', 'comercio atacadista',
  'central de distribuicao', 'centro de distribuicao',
  'supply', 'wholesale', 'trading',
];

const NON_SUPPLIER_EXCLUDES = [
  'restaurante', 'lanchonete', 'bar ', 'barzinho', 'boteco',
  'padaria', 'confeitaria', 'pizzaria', 'hamburgueria', 'sorveteria',
  'cafeteria', 'cafe', 'bistro', 'cantina',
  'churrascaria', 'rodizio', 'food truck',
  'salao', 'barbearia', 'estetica',
  'academia', 'crossfit', 'pilates',
  'consultorio', 'clinica', 'dentista',
  'hospital', 'laboratorio', 'farmacia',
  'escola', 'colegio', 'universidade', 'faculdade',
  'igreja', 'templo', 'paroquia',
  'posto de gasolina', 'posto de combustivel',
  'oficina mecanica', 'borracharia',
  'pet shop', 'petshop', 'banho e tosa',
  'imobiliaria', 'hotel', 'pousada', 'hostel', 'motel',
  'supermercado', 'minimercado', 'mercearia', 'mercadinho',
  'acougue', 'lavanderia', 'lavajato',
  'funeraria', 'cartorio', 'loterica',
];

function isLikelySupplier(nome: string, descricaoCnae: string, searchedProducts: string[]): boolean {
  const fullText = normalizeStr(`${nome} ${descricaoCnae}`);
  const normalizedProducts = searchedProducts.map(p => normalizeStr(p));

  // Check non-supplier excludes
  for (const exclude of NON_SUPPLIER_EXCLUDES) {
    if (fullText.includes(normalizeStr(exclude))) {
      const hasSupplierWord = SUPPLIER_INDICATORS.some(ind => fullText.includes(normalizeStr(ind)));
      if (!hasSupplierWord) return false;
    }
  }

  // Has supplier indicator?
  if (SUPPLIER_INDICATORS.some(ind => fullText.includes(normalizeStr(ind)))) return true;

  // Has product-related term in CNAE description?
  for (const prod of normalizedProducts) {
    const words = prod.split(/\s+/).filter(w => w.length > 3);
    if (words.some(w => fullText.includes(w))) return true;
  }

  return false;
}

function generateSupplierSearchTerms(product: string): string[] {
  const key = product.trim();
  const mapped = productSearchTerms[key];
  if (mapped) return mapped;

  // Fallback: generate terms from product name
  const norm = normalizeStr(product);
  const cleaned = norm
    .replace(/^(distribuidoras?\s+de\s+|atacado\s+de\s+|fornecedores?\s+de\s+)/i, '')
    .trim();
  
  return [cleaned, `distribuidora ${cleaned}`, `atacado ${cleaned}`];
}

function isNearDeadline(startTime: number, maxMs = 45000): boolean {
  return Date.now() - startTime > maxMs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { products, location, state, neighborhood } = await req.json();
    console.log("🔍 Searching suppliers in local DB for:", { products, location, state, neighborhood });

    if (!Array.isArray(products) || products.length === 0 || !state) {
      return new Response(
        JSON.stringify({ error: "Produtos e estado são obrigatórios", suppliers: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const nfNorm = (neighborhood && typeof neighborhood === 'string' && neighborhood.trim())
      ? normalizeStr(neighborhood) : null;
    const matchesNeighborhood = (c: any): boolean => {
      if (!nfNorm) return true;
      const b = (c?.bairro || '').toString();
      if (!b) return false;
      const bn = normalizeStr(b);
      return bn === nfNorm || bn.includes(nfNorm) || nfNorm.includes(bn);
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isStateOnlySearch = !location || location.trim() === '';
    const MAX_TOTAL_SUPPLIERS = 500;

    // Build search terms - use up to 4 terms per product for better coverage
    const allSearchTerms: string[] = [];
    for (const product of products) {
      const terms = generateSupplierSearchTerms(product);
      allSearchTerms.push(...terms.slice(0, 4));
    }
    
    // Deduplicate and limit to 10 terms max
    const uniqueTerms = [...new Set(allSearchTerms)].slice(0, 10);
    console.log(`📋 Search terms (${uniqueTerms.length}):`, uniqueTerms);

    const cityParam = isStateOnlySearch ? null : normalizeStr(location).toUpperCase();
    const stateParam = state ? state.toUpperCase() : null;

    // Do multiple smaller queries instead of one big one
    const allCompanies: any[] = [];
    const seenIds = new Set<string>();

    // Query 2 terms at a time to avoid timeout
    for (let i = 0; i < uniqueTerms.length; i += 3) {
      if (isNearDeadline(startTime)) {
        console.warn("⏱️ Supplier search stopped early to avoid timeout");
        break;
      }

      const batch = uniqueTerms.slice(i, i + 3);
      console.log(`🔎 Batch ${Math.floor(i/3)+1}: searching for`, batch);
      
      const { data, error } = await supabase.rpc('search_companies', {
        p_city: cityParam,
        p_state: stateParam,
        p_search_terms: batch,
        p_biz_type: 'all',
        p_limit_val: 500,
        p_offset_val: 0,
      });

      if (error) {
        console.error(`❌ DB batch error:`, error.message);
        continue; // Skip this batch, try next
      }

      for (const c of (data || [])) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allCompanies.push(c);
        }
      }
      console.log(`📊 Batch result: ${(data || []).length} companies, total: ${allCompanies.length}`);
    }

    const companies = allCompanies;

    console.log(`📊 Total companies found: ${companies.length}`);

    // Filter: must have phone, filter by supplier indicators
    let filtered = (companies || []).filter((c: any) => {
      if (!isPhoneValid(c.telefone_1) && !isPhoneValid(c.telefone_2)) return false;
      
      // Filter out names that are just asterisks
      const nome = (c.nome_fantasia || c.razao_social || '').trim();
      if (!nome || /^\*+$/.test(nome)) return false;

      if (!matchesNeighborhood(c)) return false;

      return isLikelySupplier(
        nome,
        c.descricao_cnae || '',
        products
      );
    });

    console.log(`✅ After supplier filter: ${filtered.length} suppliers`);

    // Deduplicate by phone
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    const deduped = filtered.filter((c: any) => {
      const phone = (c.telefone_1 || c.telefone_2 || '').replace(/\D/g, '');
      const nome = normalizeStr(c.nome_fantasia || c.razao_social || '');
      if (seenPhones.has(phone)) return false;
      if (seenNames.has(nome)) return false;
      seenPhones.add(phone);
      seenNames.add(nome);
      return true;
    });

    // Limit results
    const limited = deduped.slice(0, MAX_TOTAL_SUPPLIERS);

    // Map to supplier format
    const suppliers = limited.map((c: any, index: number) => {
      const rawName = c.nome_fantasia || c.razao_social || 'Fornecedor';
      const name = /^\*+$/.test(rawName.trim()) ? (c.razao_social || 'Fornecedor') : rawName;
      const displayName = toTitleCase(name);

      const phone = c.telefone_1 || c.telefone_2 || '';
      const phoneValidation = validatePhone(phone);

      // Build address
      const addressParts = [
        c.endereco, c.bairro, c.cidade, c.estado, c.cep
      ].filter(Boolean);
      const address = toTitleCase(addressParts.join(', '));

      return {
        id: `supplier-${c.cnpj || index}-${Date.now()}`,
        name: displayName,
        address,
        phone: phoneValidation.normalized || phone,
        email: c.email ? c.email.toLowerCase() : null,
        cnpj: c.cnpj || null,
        website: null,
        category: c.descricao_cnae ? toTitleCase(c.descricao_cnae) : products[0] || 'Fornecedor',
        hasWhatsApp: phoneValidation.isWhatsApp,
        porte: c.porte ? toTitleCase(c.porte) : null,
      };
    });

    console.log(`📦 Returning ${suppliers.length} unique suppliers`);

    return new Response(
      JSON.stringify({ suppliers }),
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

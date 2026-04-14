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
    return { valid: true, normalized: digitsOnly, isWhatsApp: isMobile };
  }
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const isMobile = digitsOnly.length === 11 && digitsOnly.charAt(2) === '9';
    return { valid: true, normalized: `55${digitsOnly}`, isWhatsApp: isMobile };
  }
  if (digitsOnly.length >= 8) return { valid: true, normalized: digitsOnly, isWhatsApp: false };
  return { valid: false, normalized: '', isWhatsApp: false };
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const number = digits.substring(4);
    if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  return phone;
}

// Search terms for finding representatives in the local DB
const REPRESENTATIVE_SEARCH_TERMS = [
  'representacao comercial',
  'representante comercial',
  'representacoes comerciais',
  'agente comercial',
  'assessoria comercial',
  'escritorio de representacao',
  'representacao',
  'representacoes',
];

// CNAE codes/descriptions that indicate a representative company
const REPRESENTATIVE_CNAE_TERMS = [
  'representacao comercial',
  'representante comercial',
  'agenciamento',
  'intermediacao comercial',
  'intermediarios do comercio',
];

// Exclusions - not representative companies
const EXCLUSION_TERMS = [
  'supermercado', 'mercado', 'mercearia', 'restaurante', 'lanchonete',
  'padaria', 'pizzaria', 'oficina', 'posto de combustivel',
  'farmacia', 'drogaria', 'hotel', 'pousada', 'escola', 'colegio',
  'hospital', 'clinica', 'laboratorio', 'academia', 'banco',
  'igreja', 'templo', 'salao de beleza', 'barbearia', 'pet shop',
  'lavanderia', 'grafica', 'cartorio', 'funeraria',
];

function isRepresentationCompany(nome: string, descricaoCnae: string): boolean {
  const fullText = normalizeStr(`${nome} ${descricaoCnae}`);

  // Check exclusions
  for (const term of EXCLUSION_TERMS) {
    if (fullText.includes(normalizeStr(term))) return false;
  }

  // Check if name or CNAE matches representative terms
  for (const term of REPRESENTATIVE_CNAE_TERMS) {
    if (fullText.includes(normalizeStr(term))) return true;
  }

  // Check name specifically for "representacao" or "representante"
  const normalizedName = normalizeStr(nome);
  if (normalizedName.includes('representac') || normalizedName.includes('representante')) return true;

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state, user_id } = await req.json();
    console.log("🔍 Searching representatives in local DB:", { city, state });

    if (!state) {
      return new Response(
        JSON.stringify({ error: "Estado é obrigatório", representatives: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // No per-user limits - search all available representatives
    const MAX_RESULTS = 999999;

    const isStateSearch = !city || city.trim() === '';
    const cityParam = isStateSearch ? null : normalizeStr(city).toUpperCase();
    const stateParam = state.toUpperCase();

    console.log(`📍 Search: city=${cityParam || 'ALL'}, state=${stateParam}, limit=${MAX_RESULTS}`);

    // Query local database using search_companies RPC
    const allCompanies: any[] = [];
    const seenIds = new Set<string>();

    // Search in batches of 3 terms to avoid timeouts
    for (let i = 0; i < REPRESENTATIVE_SEARCH_TERMS.length; i += 3) {
      const batch = REPRESENTATIVE_SEARCH_TERMS.slice(i, i + 3);
      console.log(`🔎 Batch ${Math.floor(i/3)+1}: searching for`, batch);

      const { data, error } = await supabase.rpc('search_companies', {
        p_city: cityParam,
        p_state: stateParam,
        p_search_terms: batch,
        p_biz_type: 'all',
        p_limit_val: 1000,
        p_offset_val: 0,
      });

      if (error) {
        console.error(`❌ DB batch error:`, error.message);
        continue;
      }

      for (const c of (data || [])) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allCompanies.push(c);
        }
      }
      console.log(`📊 Batch result: ${(data || []).length} companies, total unique: ${allCompanies.length}`);
    }

    console.log(`📊 Total companies found: ${allCompanies.length}`);

    // Filter: must have phone, must be a representation company
    let filtered = allCompanies.filter((c: any) => {
      if (!isPhoneValid(c.telefone_1) && !isPhoneValid(c.telefone_2)) return false;
      const nome = (c.nome_fantasia || c.razao_social || '').trim();
      if (!nome || /^\*+$/.test(nome)) return false;
      return isRepresentationCompany(nome, c.descricao_cnae || '');
    });

    console.log(`✅ After representative filter: ${filtered.length}`);

    // Deduplicate by phone and name
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    const deduped = filtered.filter((c: any) => {
      const phone = (c.telefone_1 || c.telefone_2 || '').replace(/\D/g, '');
      const nome = normalizeStr(c.nome_fantasia || c.razao_social || '');
      if (phone && seenPhones.has(phone)) return false;
      if (nome && seenNames.has(nome)) return false;
      if (phone) seenPhones.add(phone);
      if (nome) seenNames.add(nome);
      return true;
    });

    // Limit and map
    const limited = deduped.slice(0, MAX_RESULTS);

    const representatives = limited.map((c: any) => {
      const rawName = c.nome_fantasia || c.razao_social || 'Empresa de Representação';
      const name = /^\*+$/.test(rawName.trim()) ? (c.razao_social || 'Empresa de Representação') : rawName;
      const displayName = toTitleCase(name);

      const phone = c.telefone_1 || c.telefone_2 || '';
      const phoneValidation = validatePhone(phone);

      const addressParts = [c.endereco, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean);
      const address = toTitleCase(addressParts.join(', '));

      return {
        id: `rep-${c.cnpj || c.id}-${Date.now()}`,
        name: displayName,
        phone: formatPhoneDisplay(phoneValidation.normalized || phone),
        whatsapp: phoneValidation.isWhatsApp ? phoneValidation.normalized : undefined,
        address,
        website: undefined,
        rating: undefined,
        cnpj: c.cnpj || null,
        email: c.email ? c.email.toLowerCase() : null,
        category: c.descricao_cnae ? toTitleCase(c.descricao_cnae) : 'Representação Comercial',
        porte: c.porte ? toTitleCase(c.porte) : null,
      };
    });

    const withPhone = representatives.filter((r: any) => r.phone).length;
    const withWhatsapp = representatives.filter((r: any) => r.whatsapp).length;

    console.log(`📦 Returning ${representatives.length} representatives (${withPhone} phone, ${withWhatsapp} WhatsApp)`);

    return new Response(
      JSON.stringify({
        representatives,
        searchInfo: {
          location: city ? `${city}, ${state}` : state,
          totalFound: representatives.length,
          withPhone,
          withWhatsapp,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao buscar representantes", representatives: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

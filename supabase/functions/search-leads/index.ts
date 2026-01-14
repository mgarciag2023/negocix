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

// Validate if name is valid (not just dots, symbols, or too short)
function isValidName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  
  // Remove dots, dashes, spaces
  const cleaned = name.replace(/[\.\-\s\*\#\@\!\?\,\;\/\\]/g, '').trim();
  if (cleaned.length < 3) return false;
  
  // Check if it's mostly special characters
  const alphaNumeric = name.replace(/[^a-zA-Z0-9áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, '');
  if (alphaNumeric.length < 3) return false;
  
  // Reject if name is just dots like "...", "....", etc.
  if (/^[\.\s\-\_\*]+$/.test(name)) return false;
  
  // Reject generic placeholder names
  const invalidNames = [
    'local', 'place', 'estabelecimento', 'loja', 'empresa', 'negócio',
    'teste', 'test', 'undefined', 'null', 'n/a', 'na', '-', '--'
  ];
  if (invalidNames.includes(name.toLowerCase().trim())) return false;
  
  return true;
}

// Extract Instagram from website field
function extractInstagram(place: any): string {
  const website = place.website || place.url || '';
  
  // Check if website IS an Instagram link
  if (website.includes('instagram.com/')) {
    const match = website.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/);
    if (match) return `@${match[1]}`;
  }
  
  // Check other social media fields from Google
  if (place.instagram) return place.instagram.startsWith('@') ? place.instagram : `@${place.instagram}`;
  if (place.socialMedia?.instagram) {
    const ig = place.socialMedia.instagram;
    return ig.startsWith('@') ? ig : `@${ig}`;
  }
  
  return '';
}

// Get clean website (not Instagram)
function getCleanWebsite(place: any): string | null {
  const website = place.website || place.url || '';
  
  // If website is Instagram, return null (no real website)
  if (website.includes('instagram.com/') || website.includes('facebook.com/')) {
    return null;
  }
  
  if (website && website.trim().length > 5) {
    // Ensure it starts with http
    if (!website.startsWith('http')) {
      return `https://${website}`;
    }
    return website;
  }
  
  return null;
}

// Generate search terms - OPTIMIZED for best results with fewer API calls
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  // Optimized category terms - prioritize most specific terms first
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': ['restaurante', 'churrascaria'],
    'supermercados': ['supermercado', 'mercado'],
    'hipermercados': ['hipermercado', 'atacadão'],
    'padarias': ['padaria', 'panificadora'],
    'materiais de construção': ['material de construção', 'home center'],
    'ferramentas': ['ferramentas', 'ferragem'],
    'agropecuária': ['agropecuária', 'produtos rurais'],
    'farmácias': ['farmácia', 'drogaria'],
    'pet shop': ['pet shop', 'veterinária'],
    'lojas de roupas': ['loja de roupas', 'vestuário'],
    'autopeças': ['autopeças', 'peças automotivas'],
    'eletrônicos': ['eletrônicos', 'informática'],
    'móveis': ['móveis', 'móveis planejados'],
    'óticas': ['ótica', 'óculos'],
    'joalherias': ['joalheria', 'joias'],
    'academias': ['academia', 'fitness'],
    'salões de beleza': ['salão de beleza', 'cabeleireiro'],
    'hotéis': ['hotel', 'pousada'],
    'clínicas': ['clínica', 'consultório'],
    'transportadoras': ['transportadora', 'logística'],
    'gráficas': ['gráfica', 'comunicação visual'],
    'construtoras': ['construtora', 'construção civil'],
    'cozinhas industriais': ['cozinha industrial', 'refeição coletiva'],
    'indústrias de salgados': ['fábrica de salgados', 'salgaderia'],
    'distribuidores de frios': ['distribuidor de frios', 'laticínios'],
    'cestas básicas': ['cestas básicas', 'cesta básica'],
    'lanchonetes': ['lanchonete', 'hamburgueria'],
    'pizzarias': ['pizzaria', 'pizza'],
    'oficinas mecânicas': ['oficina mecânica', 'auto center'],
    'postos de combustível': ['posto de combustível', 'posto de gasolina'],
    'escolas': ['escola', 'colégio'],
    'papelarias': ['papelaria', 'livraria'],
    'atacadistas': ['atacadista', 'atacado'],
    'distribuidoras': ['distribuidora', 'distribuidor'],
    'distribuidores de food service': ['distribuidor food service', 'distribuidor restaurantes'],
    'atacadistas de food service': ['atacadista food service', 'atacado restaurantes']
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
    // Fallback: just use the term as-is
    searchTerms = [term];
  }
  
  // Return only the 2 best terms (cost optimization)
  return searchTerms.slice(0, 2);
}

// Estimate revenue based on reviews, rating, and category - MORE PRECISE
function estimateRevenue(place: any, category: string): { 
  employeeCount: string; 
  companySize: string; 
  revenue: string;
} {
  const reviewCount = place.reviewsCount || place.totalScore || 0;
  const rating = place.stars || 0;
  const categoryLower = category?.toLowerCase() || '';
  const titleLower = (place.title || '').toLowerCase();
  
  // Category-based multipliers for size estimation
  const categoryMultipliers: { [key: string]: number } = {
    'hipermercado': 5.0,
    'carrefour': 5.0,
    'walmart': 5.0,
    'big': 4.5,
    'assaí': 4.5,
    'makro': 4.5,
    'atacadão': 4.0,
    'atacado': 3.5,
    'supermercado': 2.5,
    'distribuidor': 3.0,
    'indústria': 4.0,
    'fábrica': 3.5,
    'construtora': 4.5,
    'hotel': 3.0,
    'restaurante': 1.5,
    'lanchonete': 1.0,
    'farmácia': 2.0,
    'posto': 3.5,
    'concessionária': 5.0,
    'home center': 3.5,
    'mercado': 1.8,
    'mercearia': 0.8,
    'minimercado': 0.7,
    'padaria': 1.0,
  };
  
  let multiplier = 1.0;
  const combinedText = `${categoryLower} ${titleLower}`;
  
  for (const [key, mult] of Object.entries(categoryMultipliers)) {
    if (combinedText.includes(key)) {
      multiplier = Math.max(multiplier, mult);
    }
  }
  
  // Calculate base score
  const baseScore = (reviewCount * 0.8) + (rating * 15);
  const adjustedScore = baseScore * multiplier;
  
  // More precise ranges
  if (adjustedScore > 800) {
    return { employeeCount: '200+', companySize: 'Grande', revenue: 'R$ 50M - R$ 200M/ano' };
  } else if (adjustedScore > 500) {
    return { employeeCount: '100-200', companySize: 'Grande', revenue: 'R$ 20M - R$ 50M/ano' };
  } else if (adjustedScore > 300) {
    return { employeeCount: '50-100', companySize: 'Médio-Grande', revenue: 'R$ 8M - R$ 20M/ano' };
  } else if (adjustedScore > 150) {
    return { employeeCount: '30-50', companySize: 'Médio', revenue: 'R$ 3M - R$ 8M/ano' };
  } else if (adjustedScore > 80) {
    return { employeeCount: '15-30', companySize: 'Pequeno-Médio', revenue: 'R$ 1M - R$ 3M/ano' };
  } else if (adjustedScore > 40) {
    return { employeeCount: '8-15', companySize: 'Pequeno', revenue: 'R$ 400K - R$ 1M/ano' };
  } else if (adjustedScore > 15) {
    return { employeeCount: '3-8', companySize: 'Micro', revenue: 'R$ 150K - R$ 400K/ano' };
  } else {
    return { employeeCount: '1-3', companySize: 'Micro', revenue: 'R$ 50K - R$ 150K/ano' };
  }
}

// ===== LOCATION VALIDATION FUNCTIONS =====
// Critical: Ensure leads are from the requested location

// Normalize location string for comparison
function normalizeLocationString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract city and state from an address
function extractLocationParts(address: string): { city: string | null; state: string | null; neighborhood: string | null } {
  const normalized = normalizeLocationString(address);
  
  // Brazilian state abbreviations
  const brazilianStates: { [key: string]: string } = {
    'ac': 'acre', 'al': 'alagoas', 'ap': 'amapa', 'am': 'amazonas',
    'ba': 'bahia', 'ce': 'ceara', 'df': 'distrito federal', 'es': 'espirito santo',
    'go': 'goias', 'ma': 'maranhao', 'mt': 'mato grosso', 'ms': 'mato grosso do sul',
    'mg': 'minas gerais', 'pa': 'para', 'pb': 'paraiba', 'pr': 'parana',
    'pe': 'pernambuco', 'pi': 'piaui', 'rj': 'rio de janeiro', 'rn': 'rio grande do norte',
    'rs': 'rio grande do sul', 'ro': 'rondonia', 'rr': 'roraima', 'sc': 'santa catarina',
    'sp': 'sao paulo', 'se': 'sergipe', 'to': 'tocantins'
  };
  
  // Try to extract state from address (format: "City - ST" or "City, ST")
  let state: string | null = null;
  let city: string | null = null;
  
  // Look for state abbreviation at the end (e.g., "- SC", ", SP")
  const stateMatch = normalized.match(/[\s,\-]+([a-z]{2})[\s,\-]*(?:brasil|brazil)?[\s,\-]*$/);
  if (stateMatch && brazilianStates[stateMatch[1]]) {
    state = stateMatch[1];
  }
  
  // Try to extract city from common patterns
  // Pattern: "..., City - ST" or "..., City, ST"
  const cityMatch = normalized.match(/,\s*([^,\-]+)\s*[\-,]\s*[a-z]{2}[\s,\-]*(?:brasil|brazil)?[\s,\-]*$/);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }
  
  // Alternative: try "City - ST, Brazil"
  if (!city) {
    const altMatch = normalized.match(/[\-,]\s*([^,\-]+)\s*[\-,]\s*[a-z]{2}\s*[\-,]/);
    if (altMatch) {
      city = altMatch[1].trim();
    }
  }
  
  return { city, state, neighborhood: null };
}

// Check if an address matches the requested location
function isAddressInLocation(address: string, requestedRegion: string, countryCode: string): boolean {
  if (!address || !requestedRegion) return false;
  
  const normalizedAddress = normalizeLocationString(address);
  const normalizedRegion = normalizeLocationString(requestedRegion);
  
  // Split region into parts (could be "City, State" or "City - State" or just "City")
  const regionParts = normalizedRegion.split(/[\s,\-]+/).filter(p => p.length > 1);
  
  // For Brazilian addresses, be VERY strict
  if (countryCode === 'BR') {
    // Extract location from address
    const addressParts = extractLocationParts(address);
    
    // If region contains a city name, check if it appears in the address
    // The city MUST appear before the state abbreviation
    let cityMatch = false;
    let regionCityWords = regionParts.filter(p => p.length > 2 && !['brasil', 'brazil', 'br'].includes(p));
    
    for (const word of regionCityWords) {
      // Check if this word appears in the address
      if (normalizedAddress.includes(word)) {
        cityMatch = true;
        break;
      }
    }
    
    if (!cityMatch) {
      // City not found in address - reject
      console.log(`❌ Location mismatch: "${address}" does not contain city from "${requestedRegion}"`);
      return false;
    }
    
    // Additional check: the matched word should appear in the city position, not just anywhere
    // (avoid false positives like street names matching city names)
    // Check that the region word appears after a comma or dash (indicating city/state section)
    let foundInCityPosition = false;
    for (const word of regionCityWords) {
      // Check if word appears after a comma or dash (city position in Brazilian addresses)
      const cityPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${word}[^,\\-]*\\s*[,\\-]`);
      const endPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${word}[^,\\-]*$`);
      
      if (cityPositionPattern.test(normalizedAddress) || endPositionPattern.test(normalizedAddress)) {
        foundInCityPosition = true;
        break;
      }
    }
    
    if (!foundInCityPosition) {
      // Check if the word appears standalone (not as part of a street name)
      // Allow if the word is clearly separated
      const addressWords = normalizedAddress.split(/[\s,\-]+/);
      for (const word of regionCityWords) {
        if (addressWords.includes(word)) {
          foundInCityPosition = true;
          break;
        }
      }
    }
    
    return foundInCityPosition;
  }
  
  // For international addresses, be more flexible but still check
  for (const part of regionParts) {
    if (part.length > 2 && normalizedAddress.includes(part)) {
      return true;
    }
  }
  
  return false;
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
  
  // More precise estimation based on reviews
  if (reviewCount > 1000) return '15+ anos';
  if (reviewCount > 500) return '10-15 anos';
  if (reviewCount > 200) return '6-10 anos';
  if (reviewCount > 100) return '4-6 anos';
  if (reviewCount > 50) return '2-4 anos';
  if (reviewCount > 20) return '1-2 anos';
  return '< 1 ano';
}

// Calculate dynamic match score based on multiple factors
function calculateMatchScore(place: any, category: string, companySize: string): number {
  let score = 50; // Base score
  
  const reviewCount = place.reviewsCount || 0;
  const rating = place.stars || 0;
  const hasWebsite = !!getCleanWebsite(place);
  const hasPhone = !!(place.phone || place.phoneUnformatted);
  
  // Rating contribution (max +15)
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.0) score += 12;
  else if (rating >= 3.5) score += 8;
  else if (rating >= 3.0) score += 5;
  
  // Review count contribution (max +15)
  if (reviewCount > 500) score += 15;
  else if (reviewCount > 200) score += 12;
  else if (reviewCount > 100) score += 10;
  else if (reviewCount > 50) score += 7;
  else if (reviewCount > 20) score += 4;
  
  // Company size contribution (max +10)
  if (companySize === 'Grande') score += 10;
  else if (companySize === 'Médio-Grande') score += 8;
  else if (companySize === 'Médio') score += 6;
  else if (companySize === 'Pequeno-Médio') score += 4;
  else if (companySize === 'Pequeno') score += 2;
  
  // Website presence (+5)
  if (hasWebsite) score += 5;
  
  // Phone presence (+5)
  if (hasPhone) score += 5;
  
  // Cap at 98 (never 100)
  return Math.min(98, Math.max(45, score));
}

// Generate real reasons why this is a good lead - SPECIFIC TO EACH LEAD
function generateReasons(place: any, category: string, companySize: string, matchScore: number): string[] {
  const reasons: string[] = [];
  const reviewCount = place.reviewsCount || 0;
  const rating = place.stars || 0;
  const hasWebsite = !!getCleanWebsite(place);
  
  // Rating-based reasons (specific numbers)
  if (rating >= 4.5 && reviewCount > 50) {
    reasons.push(`Excelente reputação: ${rating.toFixed(1)}★ com ${reviewCount} avaliações verificadas`);
  } else if (rating >= 4.0 && reviewCount > 20) {
    reasons.push(`Boa avaliação de ${rating.toFixed(1)}★ baseada em ${reviewCount} clientes`);
  } else if (rating >= 3.5) {
    reasons.push(`Avaliação ${rating.toFixed(1)}★ indica operação estável`);
  }
  
  // Size-based reasons
  if (companySize === 'Grande' || companySize === 'Médio-Grande') {
    reasons.push('Empresa de grande porte com alta capacidade de compra');
  } else if (companySize === 'Médio' || companySize === 'Pequeno-Médio') {
    reasons.push('Negócio em crescimento com potencial de expansão');
  }
  
  // Volume-based reasons
  if (reviewCount > 200) {
    reasons.push(`Alto fluxo de clientes: ${reviewCount}+ avaliações indica volume consistente`);
  } else if (reviewCount > 50) {
    reasons.push('Base de clientes ativa e engajada');
  }
  
  // Category-specific reasons
  const catLower = category.toLowerCase();
  const titleLower = (place.title || '').toLowerCase();
  
  if (catLower.includes('hipermercado') || titleLower.includes('hipermercado')) {
    reasons.push('Hipermercado com alta demanda de fornecedores diversos');
  } else if (catLower.includes('supermercado') || titleLower.includes('supermercado')) {
    reasons.push('Supermercado com reposição frequente de estoque');
  } else if (catLower.includes('atacado') || titleLower.includes('atacado')) {
    reasons.push('Atacado com compras em grande volume');
  } else if (catLower.includes('construção') || catLower.includes('construtora')) {
    reasons.push('Setor de construção com alto volume de compras');
  } else if (catLower.includes('farmácia') || catLower.includes('drogaria')) {
    reasons.push('Setor farmacêutico com reposição constante');
  } else if (catLower.includes('restaurante') || catLower.includes('lanchonete')) {
    reasons.push('Estabelecimento alimentício com demanda recorrente');
  }
  
  // Website reason
  if (hasWebsite) {
    reasons.push('Possui website próprio - empresa profissionalizada');
  }
  
  // If no specific reasons, add based on match score
  if (reasons.length === 0) {
    if (matchScore >= 80) {
      reasons.push('Lead com alto potencial de conversão');
    } else if (matchScore >= 65) {
      reasons.push('Negócio ativo com bom potencial');
    } else {
      reasons.push('Lead identificado na região buscada');
    }
  }
  
  return reasons.slice(0, 3);
}

// Detect if segment is an industry search
function isIndustrySearch(segment: string): boolean {
  const lower = segment.toLowerCase();
  const industryTerms = [
    'indústria', 'industria', 'fábrica', 'fabrica', 'indústrias', 'industrias',
    'fábricas', 'fabricas', 'industrial', 'industriais'
  ];
  return industryTerms.some(term => lower.includes(term));
}

// Strict exclusions for industry searches - these are NEVER real industries
const industryExclusions = [
  // Food service establishments
  'bar', 'bares', 'boteco', 'botequim', 'pub', 'cervejaria artesanal',
  'restaurante', 'restaurantes', 'self-service', 'self service', 'buffet', 'bistrô', 'bistro',
  'lanchonete', 'lanchonetes', 'lanches', 'fast food', 'fast-food',
  'pizzaria', 'pizzarias', 'pizza', 'rodízio',
  'padaria', 'padarias', 'panificadora', 'confeitaria', 'confeitarias', 'bakery',
  'cafeteria', 'cafeterias', 'café', 'coffee', 'expresso',
  'hamburgueria', 'hamburguerias', 'burger', 'hot dog', 'cachorro quente',
  'churrascaria', 'churrascarias', 'rodízio de carnes',
  'sushi', 'sushis', 'japonês', 'japones', 'temaki',
  'pastelaria', 'pastel', 'pastéis',
  'sorveteria', 'sorvete', 'açaí', 'acai', 'gelato',
  'food truck', 'food-truck', 'trailer de comida',
  'cantina', 'refeitório', 'refeição coletiva',
  'doceria', 'doces', 'brigadeiro', 'chocolate artesanal',
  
  // Retail and commerce
  'loja', 'lojas', 'comércio', 'comercio', 'varejo', 'varejista',
  'atacado', 'atacadista', 'atacadão', 'distribuidora', 'distribuidor',
  'supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti',
  'magazine', 'americanas', 'casas bahia', 'ponto frio',
  
  // Food-related services that use "industrial" but aren't industries
  'cozinha industrial', 'cozinhas industriais', 'catering',
  'fornecedor', 'fornecimento', 'fornecedora',
  'linha industrial', 'produtos industriais',
  'equipamentos para cozinha', 'equipamento industrial',
  
  // Other services
  'açougue', 'casa de carnes', 'frigorífico', 'frios e embutidos',
  'empório', 'armazém', 'conveniência'
];

// Keywords that indicate REAL industries
const industryMustHaveTerms = [
  'indústria', 'industria', 'fábrica', 'fabrica', 'fabricante', 'fabricação',
  'manufacturing', 'manufacturer', 'ind.', 'ind ', 'ltda', 'eireli',
  'produção', 'producao', 'processamento', 'transformação',
  'metalúrgica', 'metalurgica', 'siderúrgica', 'siderurgica',
  'têxtil', 'textil', 'confecção', 'confeccao',
  'química', 'quimica', 'petroquímica', 'petroquimica',
  'alimentícia', 'alimenticia', 'alimentos',
  'plástico', 'plastico', 'embalagem', 'embalagens',
  'papel', 'celulose', 'papeleira',
  'cimento', 'cerâmica', 'ceramica', 'vidro', 'vidros',
  'farmacêutica', 'farmaceutica', 'cosméticos', 'cosmeticos',
  'automotiva', 'autopeças', 'autopecas', 'componentes',
  'eletrônica', 'eletronica', 'eletroeletrônica', 'eletroeletronica',
  'mecânica', 'mecanica', 'usinagem', 'fundição', 'fundicao',
  'borracha', 'pneu', 'pneus',
  'madeira', 'madeireira', 'móveis', 'moveis', 'mobiliário',
  'calçados', 'calcados', 'couro', 'curtume',
  'bebidas', 'cervejaria industrial', 'refrigerante',
  'laticínio', 'laticinio', 'lácteos', 'lacteos',
  'frigorífica', 'frigorifica', 'abatedouro', 'matadouro',
  'ração', 'racao', 'pet food',
  'fertilizante', 'adubo', 'agroquímico', 'agroquimico',
  'implementos', 'máquinas', 'maquinas', 'equipamentos industriais'
];

// Check if a place is a REAL industry (not a food service or retail)
function isRealIndustry(place: any): boolean {
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
  // First check: EXCLUDE if matches any food service / retail exclusion
  for (const exclusion of industryExclusions) {
    if (combinedText.includes(exclusion)) {
      // Exception: if it explicitly says "indústria" or "fábrica" AND the exclusion word, might still be valid
      // e.g., "Indústria de Pães" is an industry, but "Padaria Industrial" is not
      const hasExplicitIndustry = title.includes('indústria') || title.includes('fábrica') || title.includes('ind.');
      if (!hasExplicitIndustry) {
        console.log(`❌ Industry filter: Excluded "${place.title}" - matches service/retail: ${exclusion}`);
        return false;
      }
    }
  }
  
  // Second check: MUST have at least one industry indicator in the title/category
  let hasIndustryIndicator = false;
  for (const term of industryMustHaveTerms) {
    if (combinedText.includes(term)) {
      hasIndustryIndicator = true;
      break;
    }
  }
  
  if (!hasIndustryIndicator) {
    console.log(`❌ Industry filter: Excluded "${place.title}" - no industry indicator found`);
    return false;
  }
  
  return true;
}

// STRICT niche relevance keywords - VERY STRICT FOR SPECIFIC CATEGORIES
const nicheKeywords: { [key: string]: { include: string[], exclude: string[], mustMatch: string[] } } = {
  'hipermercados': {
    include: ['hipermercado', 'hiper', 'carrefour', 'big', 'walmart', 'assaí', 'makro', 'sam\'s club', 'atacarejo', 'extra hiper'],
    mustMatch: ['hipermercado', 'hiper', 'carrefour', 'big', 'walmart', 'assaí', 'makro', 'atacarejo'],
    exclude: ['cueca', 'roupa', 'móvel', 'móveis', 'colchão', 'vestuário', 'tecido', 'lingerie', 'moda', 'calçado', 'sapato', 'eletro', 'eletrônico', 'celular', 'informática', 'auto peça', 'autopeça', 'ferragem', 'ferramenta', 'brinquedo', 'papelaria', 'livro', 'pet', 'animal', 'veterinár', 'ótica', 'óculos', 'joalheria', 'relógio', 'perfume', 'cosmético', 'salão', 'beleza', 'cabeleireiro', 'barbearia', 'estética', 'academia', 'fitness', 'hotel', 'pousada', 'restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'bar', 'boteco', 'açougue', 'padaria', 'confeitaria', 'farmácia', 'drogaria', 'atacadista', 'distribuid', 'magazine', 'americanas', 'casas bahia', 'ponto frio']
  },
  'supermercados': {
    include: ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti', 'sacolão', 'feira', 'empório', 'armazém'],
    mustMatch: ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti'],
    exclude: ['cueca', 'roupa', 'móvel', 'móveis', 'vestuário', 'tecido', 'moda', 'calçado', 'eletro', 'eletrônico', 'auto peça', 'construção', 'ferragem', 'brinquedo', 'papelaria', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'beleza', 'academia', 'hotel', 'magazine', 'americanas', 'casas bahia']
  },
  'restaurantes': {
    include: ['restaurante', 'churrascaria', 'buffet', 'self-service', 'gastronomia', 'bistrô', 'cantina', 'refeitório'],
    mustMatch: ['restaurante', 'churrascaria', 'buffet', 'self-service'],
    exclude: ['cueca', 'roupa', 'móvel', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado']
  },
  'lanchonetes': {
    include: ['lanchonete', 'lanche', 'snack', 'fast food', 'hamburgueria', 'burger', 'hot dog', 'sanduíche', 'salgado', 'pastel', 'açaí', 'crepe', 'tapioca', 'espetinho', 'porção', 'petisco'],
    mustMatch: [], // Removed strict matching - let include keywords work more broadly
    exclude: ['cueca', 'roupa', 'móvel', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado', 'farmácia', 'drogaria', 'pet shop', 'veterinár']
  },
  'pizzarias': {
    include: ['pizzaria', 'pizza', 'rodízio de pizza', 'pizzas'],
    mustMatch: ['pizzaria', 'pizza'],
    exclude: ['lanchonete', 'hamburgueria', 'cueca', 'roupa', 'móvel', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado']
  },
  'materiais de construção': {
    include: ['material de construção', 'construção', 'home center', 'depósito', 'ferragem', 'cimento', 'tijolo', 'telha', 'madeira', 'madeireira', 'hidráulico', 'acabamento', 'piso', 'azulejo', 'tintas', 'leroy', 'tumelero'],
    mustMatch: ['material de construção', 'construção', 'home center', 'depósito', 'ferragem', 'madeireira', 'tintas'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'supermercado', 'mercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'ferramentas': {
    include: ['ferramenta', 'ferramentaria', 'ferragem', 'parafuso', 'chave', 'furadeira', 'serra', 'martelo', 'alicate', 'máquina', 'equipamento'],
    mustMatch: ['ferramenta', 'ferramentaria', 'ferragem'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'brinquedo']
  },
  'pet shop': {
    include: ['pet', 'animal', 'veterinár', 'cão', 'cachorro', 'gato', 'ração', 'banho e tosa', 'petshop'],
    mustMatch: ['pet', 'veterinár', 'ração', 'banho e tosa'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'construção', 'ótica', 'joalheria', 'salão humano', 'academia', 'hotel']
  },
  'farmácias': {
    include: ['farmácia', 'drogaria', 'medicamento', 'remédio', 'manipulação'],
    mustMatch: ['farmácia', 'drogaria', 'manipulação'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'construção', 'pet', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'agropecuária': {
    include: ['agropecuária', 'agrícola', 'rural', 'fazenda', 'semente', 'adubo', 'fertilizante', 'ração animal', 'trator', 'implemento'],
    mustMatch: ['agropecuária', 'agrícola', 'rural', 'semente'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'autopeças': {
    include: ['autopeça', 'auto peça', 'peça automotiva', 'carro', 'moto', 'veículo', 'motor', 'pneu', 'oficina', 'mecânica'],
    mustMatch: ['autopeça', 'auto peça', 'peça', 'pneu', 'mecânica'],
    exclude: ['cueca', 'roupa', 'móvel', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'academias': {
    include: ['academia', 'fitness', 'musculação', 'crossfit', 'pilates', 'ginástica', 'treino', 'gym'],
    mustMatch: ['academia', 'fitness', 'musculação', 'crossfit', 'gym'],
    exclude: ['cueca', 'roupa', 'móvel', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'hotel', 'construção']
  }
};

// Check if result is relevant to searched niche - STRICT VERSION
function isRelevantToNiche(place: any, segment: string): boolean {
  const segmentLower = segment.toLowerCase();
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
  // ===== SPECIAL HANDLING FOR INDUSTRY SEARCHES =====
  // If this is an industry search, apply STRICT industry filtering
  if (isIndustrySearch(segmentLower)) {
    if (!isRealIndustry(place)) {
      return false;
    }
    // Industry passed the strict filter, continue with normal checks
  }
  
  // ===== SPECIAL HANDLING FOR SOCCER SCHOOL SEARCHES =====
  // Exclude franchises and professional club academies
  if (isSoccerSchoolSearch(segmentLower)) {
    if (!isIndependentSoccerSchool(place)) {
      return false;
    }
    // Independent soccer school, continue with normal checks
  }
  
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
    const genericExclusions = ['cueca', 'lingerie', 'moda íntima', 'roupa íntima', 'magazine luiza', 'americanas', 'casas bahia'];
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
      console.log(`❌ Excluded "${place.title}" - matches exclusion: ${exclude}`);
      return false;
    }
  }
  
  // For categories with mustMatch requirements, enforce them
  if (nicheConfig.mustMatch && nicheConfig.mustMatch.length > 0) {
    let hasRequiredMatch = false;
    for (const must of nicheConfig.mustMatch) {
      if (combinedText.includes(must)) {
        hasRequiredMatch = true;
        break;
      }
    }
    if (!hasRequiredMatch) {
      console.log(`❌ Excluded "${place.title}" - no required keyword match for ${segmentLower}`);
      return false;
    }
  }
  
  // If mustMatch is empty, just check if ANY include keyword is present
  // This is more permissive for categories like lanchonetes
  if (!nicheConfig.mustMatch || nicheConfig.mustMatch.length === 0) {
    // Accept any result that wasn't excluded - Google already filtered by category
    return true;
  }
  
  return true;
}

// Check if business is a Matriz (headquarters) vs Filial (branch)
function isMatriz(place: any): boolean {
  const title = (place.title || '').toLowerCase();
  const address = (place.address || '').toLowerCase();
  
  // Keywords that indicate FILIAL (branch)
  const filialIndicators = [
    'filial', 'loja', 'unidade', 'sucursal', 'franquia',
    'ii', 'iii', 'iv', 'v', ' 2', ' 3', ' 4', ' 5', ' 6', ' 7', ' 8', ' 9', ' 10',
    'centro', 'shopping', 'mall', 'outlet'
  ];
  
  // Keywords that indicate MATRIZ (headquarters)
  const matrizIndicators = [
    'matriz', 'sede', 'principal', 'central', 'headquarter', 'escritório central'
  ];
  
  // If explicitly marked as matriz, it's matriz
  for (const indicator of matrizIndicators) {
    if (title.includes(indicator) || address.includes(indicator)) {
      return true;
    }
  }
  
  // If has filial indicators, it's likely NOT matriz
  for (const indicator of filialIndicators) {
    if (title.includes(indicator)) {
      return false;
    }
  }
  
  // Check for numbered stores (e.g., "Carrefour 01", "Big 12")
  if (/\s\d{1,2}$/.test(place.title || '')) {
    return false;
  }
  
  // Default: treat as potential matriz if no clear indicators
  return true;
}

// Normalize company name for deduplication
function normalizeCompanyName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\s+(ltda|me|eireli|s\.a\.|sa|epp|mei|s\/a)\.?$/gi, '')
    .replace(/[^a-záàâãéèêíìîóòôõúùûç0-9]/gi, '')
    .trim();
}

// Professional football clubs to exclude from soccer school searches
const professionalClubs = [
  // Brazilian clubs
  'flamengo', 'fluminense', 'vasco', 'botafogo', 'palmeiras', 'corinthians',
  'são paulo', 'sao paulo', 'santos', 'grêmio', 'gremio', 'internacional', 'inter',
  'cruzeiro', 'atlético mineiro', 'atletico mineiro', 'galo', 'athletico', 'coritiba',
  'bahia', 'vitória', 'sport', 'náutico', 'nautico', 'santa cruz', 'fortaleza',
  'ceará', 'ceara', 'américa', 'america', 'goiás', 'goias', 'cuiabá', 'cuiaba',
  'juventude', 'chapecoense', 'avaí', 'avai', 'figueirense', 'criciúma', 'criciuma',
  'joinville', 'brusque', 'marcílio dias', 'marcilio dias', 'ponte preta',
  'guarani', 'red bull bragantino', 'bragantino', 'botafogo sp', 'mirassol',
  'novorizontino', 'ituano', 'são bento', 'sao bento', 'ferroviária', 'ferroviaria',
  'são caetano', 'sao caetano', 'portuguesa', 'santo andré', 'santo andre',
  'atlético goianiense', 'atletico goianiense', 'vila nova', 'crac', 'anápolis',
  'londrina', 'paraná', 'parana', 'operário', 'operario', 'maringá', 'maringa',
  'crb', 'csa', 'sergipe', 'confiança', 'confianca', 'sampaio corrêa', 'sampaio correa',
  'remo', 'paysandu', 'abc', 'américa rn', 'america rn', 'campinense', 'treze',
  
  // Argentine clubs
  'boca juniors', 'boca', 'river plate', 'river', 'racing', 'independiente',
  'san lorenzo', 'huracán', 'huracan', 'vélez', 'velez', 'estudiantes',
  'newell\'s', 'newells', 'rosario central',
  
  // European clubs
  'paris saint-germain', 'paris saint germain', 'psg',
  'barcelona', 'barça', 'barca', 'real madrid', 'atlético madrid', 'atletico madrid',
  'manchester united', 'manchester city', 'liverpool', 'chelsea', 'arsenal', 'tottenham',
  'bayern', 'munique', 'munich', 'borussia dortmund', 'dortmund',
  'juventus', 'juve', 'milan', 'ac milan', 'inter de milão', 'inter milan', 'internazionale',
  'napoli', 'roma', 'lazio', 'fiorentina',
  'benfica', 'porto', 'sporting',
  'ajax', 'psv', 'feyenoord',
  
  // Other indicators of franchises/academies
  'franquia', 'licenciada', 'licenciado', 'oficial', 'academy', 'base oficial',
  'ct ', 'centro de treinamento', 'núcleo', 'nucleo', 'polo ', 'sede '
];

// Check if a soccer school is an independent school (not a franchise/professional club)
function isIndependentSoccerSchool(place: any): boolean {
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
  // Check if name contains any professional club reference
  for (const club of professionalClubs) {
    if (combinedText.includes(club)) {
      console.log(`⚽ Soccer school filter: Excluded "${place.title}" - franchise/club detected: ${club}`);
      return false;
    }
  }
  
  return true;
}

// Check if segment is a soccer school search
function isSoccerSchoolSearch(segment: string): boolean {
  const lower = segment.toLowerCase();
  const soccerTerms = [
    'escolinha de futebol', 'escolinhas de futebol', 'escola de futebol', 'escolas de futebol',
    'escolinha futebol', 'escola futebol', 'futebol infantil', 'aula de futebol',
    'categoria de base', 'base de futebol'
  ];
  return soccerTerms.some(term => lower.includes(term));
}

// Process and filter results with Matriz filter and deduplication
function processResults(apifyResults: any[], segment: string, cleanRegion: string, maxLeads: number, businessType: string = 'all'): any[] {
  console.log(`📊 Processing ${apifyResults.length} raw results for segment: ${segment}, businessType: ${businessType}`);
  
  // Step 1: Filter by basic requirements AND niche relevance
  let results = apifyResults.filter((place: any) => {
    const phone = place.phone || place.phoneUnformatted;
    if (!phone || phone.trim() === '') return false;
    if (!isValidName(place.title)) {
      console.log(`❌ Invalid name: "${place.title}"`);
      return false;
    }
    
    // STRICT NICHE FILTERING
    if (!isRelevantToNiche(place, segment)) {
      return false;
    }
    
    return true;
  });
  
  console.log(`📊 After basic filter: ${results.length} results`);
  
  // Step 2: Apply Matriz filter if requested (BEFORE deduplication)
  if (businessType === 'matriz') {
    const beforeMatriz = results.length;
    results = results.filter(place => isMatriz(place));
    console.log(`📊 After Matriz filter: ${results.length} results (removed ${beforeMatriz - results.length})`);
  } else if (businessType === 'filial') {
    const beforeFilial = results.length;
    results = results.filter(place => !isMatriz(place));
    console.log(`📊 After Filial filter: ${results.length} results (removed ${beforeFilial - results.length})`);
  }
  
  // Step 3: Deduplicate by placeId first
  const seenPlaceIds = new Set<string>();
  results = results.filter((place: any) => {
    if (place.placeId && seenPlaceIds.has(place.placeId)) return false;
    if (place.placeId) seenPlaceIds.add(place.placeId);
    return true;
  });
  
  // Step 4: Deduplicate by normalized company name (for Matriz, only one per brand)
  if (businessType === 'matriz') {
    const seenCompanies = new Map<string, any>();
    
    for (const place of results) {
      const normalizedName = normalizeCompanyName(place.title);
      
      // Extract brand name (first word or two)
      const words = normalizedName.split(/\s+/).filter(w => w.length > 2);
      const brandKey = words.slice(0, 2).join('');
      
      if (!seenCompanies.has(brandKey)) {
        seenCompanies.set(brandKey, place);
      } else {
        // Keep the one with more reviews (likely the main location)
        const existing = seenCompanies.get(brandKey);
        if ((place.reviewsCount || 0) > (existing.reviewsCount || 0)) {
          seenCompanies.set(brandKey, place);
        }
      }
    }
    
    results = Array.from(seenCompanies.values());
    console.log(`📊 After brand deduplication: ${results.length} unique companies`);
  } else {
    // Regular deduplication by title+address
    const seen = new Set<string>();
    results = results.filter((place: any) => {
      const key = `${normalizeCompanyName(place.title)}-${(place.address || '').slice(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  // Hard limit
  if (results.length > maxLeads) {
    results = results.slice(0, maxLeads);
  }
  
  console.log(`📊 Final: ${results.length} leads`);
  
  // Translate Google category types to Portuguese
  const categoryTranslation: { [key: string]: string } = {
    'restaurant': 'Restaurante',
    'cafe': 'Cafeteria',
    'bakery': 'Padaria',
    'bar': 'Bar',
    'meal_delivery': 'Delivery',
    'meal_takeaway': 'Comida para Viagem',
    'food': 'Alimentação',
    'store': 'Loja',
    'supermarket': 'Supermercado',
    'grocery_or_supermarket': 'Supermercado',
    'convenience_store': 'Conveniência',
    'shopping_mall': 'Shopping',
    'pharmacy': 'Farmácia',
    'drugstore': 'Drogaria',
    'hardware_store': 'Ferragem',
    'home_goods_store': 'Casa e Decoração',
    'furniture_store': 'Móveis',
    'electronics_store': 'Eletrônicos',
    'clothing_store': 'Vestuário',
    'shoe_store': 'Calçados',
    'jewelry_store': 'Joalheria',
    'beauty_salon': 'Salão de Beleza',
    'hair_care': 'Cabeleireiro',
    'gym': 'Academia',
    'health': 'Saúde',
    'hospital': 'Hospital',
    'dentist': 'Dentista',
    'doctor': 'Médico',
    'veterinary_care': 'Veterinária',
    'pet_store': 'Pet Shop',
    'car_dealer': 'Concessionária',
    'car_repair': 'Oficina Mecânica',
    'car_wash': 'Lava Jato',
    'gas_station': 'Posto de Combustível',
    'lodging': 'Hospedagem',
    'hotel': 'Hotel',
    'bank': 'Banco',
    'atm': 'Caixa Eletrônico',
    'school': 'Escola',
    'university': 'Universidade',
    'point_of_interest': segment,
    'establishment': segment
  };
  
  // Transform results to leads format
  return results.map((place: any, index: number) => {
    const phone = place.phone || place.phoneUnformatted || '';
    const phoneValidation = validatePhone(phone);
    
    // Use segment as primary category, translate Google type as fallback
    const googleCategory = (place.categoryName || place.categories?.[0] || '').toLowerCase().replace(/_/g, ' ');
    const translatedCategory = categoryTranslation[place.categories?.[0]] || categoryTranslation[googleCategory] || null;
    const category = segment || translatedCategory || 'Estabelecimento';
    
    const { employeeCount, companySize, revenue } = estimateRevenue(place, category);
    const openedDate = estimateYearsInOperation(place);
    const matchScore = calculateMatchScore(place, category, companySize);
    const reasons = generateReasons(place, category, companySize, matchScore);
    const instagram = extractInstagram(place);
    const website = getCleanWebsite(place);
    
    return {
      id: `apify-${place.placeId || Date.now()}-${index}`,
      name: place.title,
      address: place.address || 'Endereço não disponível',
      phone: phoneValidation.valid ? phoneValidation.normalized : phone,
      phoneValid: phoneValidation.valid,
      email: place.email || '',
      website: website, // null if no website
      instagram: instagram, // empty string if no instagram
      facebook: '',
      hasWhatsApp: phoneValidation.isWhatsApp,
      placeId: place.placeId,
      category,
      rating: place.stars || place.totalScore || 0,
      reviews: place.reviewsCount || 0,
      matchScore, // Dynamic score
      confidenceScore: matchScore,
      source: 'google_maps_apify',
      responsible: 'Gerente',
      employeeCount,
      companySize,
      revenue,
      openedDate,
      reasons,
      isMatriz: isMatriz(place),
      dataQuality: {
        hasValidPhone: phoneValidation.valid,
        hasSocialMedia: !!instagram,
        hasWhatsApp: phoneValidation.isWhatsApp,
        hasWebsite: !!website,
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
    const { segment, products, region, country, filters, ecommerceType, businessType, digitalPresence, digitalActivity } = await req.json();
    console.log('🔍 SEARCH v10 - Digital Presence Filters - Input:', { segment, products, region, country, ecommerceType, businessType, digitalPresence, digitalActivity });
    
    const countryCode = country || 'BR';
    const bizType = businessType || 'all';
    const digPresence = digitalPresence || 'all';
    const digActivity = digitalActivity || 'all';
    
    // Check if this is an e-commerce search with specific type
    const isEcommerceSearch = segment.toLowerCase().includes('e-commerce') || segment.toLowerCase().includes('ecommerce');
    
    // Build location query
    const cleanRegion = region.trim();
    const locationQuery = countryCode === 'BR' 
      ? `${cleanRegion}, Brazil`
      : `${cleanRegion}, ${countryCode}`;
    
    console.log('📍 Location:', locationQuery);
    console.log('🏢 Business type:', bizType);
    
    // Get Google API key
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }
    
    const MAX_TOTAL_LEADS = 150;
    const MIN_LEADS_TARGET = 50; // Minimum 50 leads required
    const MIN_LEADS_EARLY_EXIT = 100; // Only exit early if we have at least 100
    
    console.log(`🔎 Google Places API search: targeting ${MIN_LEADS_TARGET}-${MAX_TOTAL_LEADS} leads (cost-optimized)`);
    
    // OPTIMIZATION: Cache to avoid duplicate API calls
    const searchCache = new Map<string, any[]>();
    
    // Function to search places using Google Places API - OPTIMIZED
    async function searchPlaces(query: string, location: string, maxPages: number = 3): Promise<any[]> {
      // Check cache first to save API credits
      const cacheKey = `${query}|${location}`;
      if (searchCache.has(cacheKey)) {
        console.log(`💾 Cache hit for: ${query}`);
        return searchCache.get(cacheKey) || [];
      }
      
      const results: any[] = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;
      
      while (pageCount < maxPages) {
        const searchUrl: string = nextPageToken 
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
          : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' em ' + location)}&language=pt-BR&key=${GOOGLE_API_KEY}`;
        
        console.log(`📍 Google Places search page ${pageCount + 1}: ${query}`);
        
        const searchResponse: Response = await fetch(searchUrl);
        if (!searchResponse.ok) {
          console.error(`❌ Google Places error: ${searchResponse.status}`);
          break;
        }
        
        const searchData: any = await searchResponse.json();
        
        if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
          console.error(`❌ Google API status: ${searchData.status}`, searchData.error_message);
          break;
        }
        
        if (searchData.results) {
          results.push(...searchData.results);
          console.log(`📊 Page ${pageCount + 1}: ${searchData.results.length} results (total: ${results.length})`);
          
          // REMOVED early exit - always fetch all available pages to maximize leads
          // Location filtering removes many results, so we need maximum raw data
        }
        
        nextPageToken = searchData.next_page_token || null;
        pageCount++;
        
        // Always fetch more pages if token exists - maximize results
        if (nextPageToken && pageCount < maxPages) {
          await sleep(2000);
        } else {
          break;
        }
      }
      
      // Cache results
      searchCache.set(cacheKey, results);
      return results;
    }
    
    // Function to get place details (phone, website, etc.)
    async function getPlaceDetails(placeId: string): Promise<any> {
      const fields = 'formatted_phone_number,international_phone_number,website,opening_hours,reviews,url';
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=pt-BR&key=${GOOGLE_API_KEY}`;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'OK') {
            return data.result;
          }
        }
      } catch (e) {
        console.log(`⚠️ Details fetch error for ${placeId}:`, e);
      }
      return null;
    }
    
    // Parse segments - split by comma and clean each one
    const segments = segment.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    console.log(`📋 Segments to search: ${segments.join(', ')}`);
    
    // Create segment display names map (singular form for display)
    const segmentDisplayNames: { [key: string]: string } = {};
    segments.forEach((seg: string) => {
      const lower = seg.toLowerCase();
      // Convert plural to singular for display
      if (lower.endsWith('rias')) {
        segmentDisplayNames[lower] = seg.slice(0, -1); // pizzarias -> pizzaria
      } else if (lower.endsWith('as')) {
        segmentDisplayNames[lower] = seg.slice(0, -1); // lanchonetes doesn't match, but padarias -> padaria
      } else if (lower.endsWith('tes')) {
        segmentDisplayNames[lower] = seg.slice(0, -2); // lanchonetes -> lanchonete
      } else {
        segmentDisplayNames[lower] = seg;
      }
      // Capitalize first letter
      const displayName = segmentDisplayNames[lower];
      segmentDisplayNames[lower] = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    });
    console.log('📋 Segment display names:', segmentDisplayNames);
    
    // Search each segment separately and tag results with their segment
    // MAXIMIZED page limits for more leads - increased to get better location coverage
    let allPlacesWithSegment: any[] = [];
    const pagesPerSegment = Math.max(8, Math.min(12, Math.floor(40 / segments.length)));
    console.log(`⚡ Optimization: ${pagesPerSegment} pages per segment (${segments.length} segments)`);
    
    for (const seg of segments) {
      let searchTerms: string[];
      
      if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
        const ecomType = ecommerceType.trim().toLowerCase();
        // OPTIMIZATION: 3 terms for e-commerce for better coverage
        searchTerms = [`loja ${ecomType}`, `${ecomType}`, `loja de ${ecomType}`];
        console.log(`🛒 E-commerce específico: ${ecomType}`);
      } else {
        searchTerms = generateSearchTerms(seg);
        // OPTIMIZATION: Use 4 best terms per segment for maximum coverage
        searchTerms = searchTerms.slice(0, 4);
      }
      
      console.log(`📤 Searching segment "${seg}" with terms:`, searchTerms);
      
      // OPTIMIZATION: Search terms in parallel with dynamic page limit
      const searchPromises = searchTerms.map(term => searchPlaces(term, locationQuery, pagesPerSegment));
      const searchResults = await Promise.all(searchPromises);
      
      // Tag each place with its segment
      const placesFromSegment = searchResults.flat().map(place => ({
        ...place,
        _searchSegment: seg.toLowerCase(),
        _displayCategory: segmentDisplayNames[seg.toLowerCase()] || seg
      }));
      
      allPlacesWithSegment.push(...placesFromSegment);
      console.log(`📊 Segment "${seg}": ${placesFromSegment.length} raw places`);
      
      // OPTIMIZATION: Early exit if we already have plenty of results
      // Increased multiplier due to location filtering
      if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 6) {
        console.log(`⚡ Enough raw places (${allPlacesWithSegment.length}), skipping remaining segments`);
        break;
      }
    }
    
    console.log(`📊 Total raw places from all segments: ${allPlacesWithSegment.length}`);
    
    // Deduplicate by place_id (keep the first occurrence, which preserves the segment)
    const seenIds = new Set<string>();
    allPlacesWithSegment = allPlacesWithSegment.filter(place => {
      if (seenIds.has(place.place_id)) return false;
      seenIds.add(place.place_id);
      return true;
    });
    console.log(`📊 After deduplication: ${allPlacesWithSegment.length} unique places`);
    
    // Transform Google Places format to our expected format
    const transformedPlaces = allPlacesWithSegment.map(place => ({
      placeId: place.place_id,
      title: place.name,
      address: place.formatted_address || place.vicinity,
      categoryName: place.types?.[0]?.replace(/_/g, ' ') || '',
      categories: place.types || [],
      stars: place.rating || 0,
      reviewsCount: place.user_ratings_total || 0,
      phone: '',
      website: '',
      permanentlyClosed: place.permanently_closed || place.business_status === 'CLOSED_PERMANENTLY',
      location: place.geometry?.location,
      _searchSegment: place._searchSegment,
      _displayCategory: place._displayCategory
    }));
    
    // Filter out closed businesses
    const activePlaces = transformedPlaces.filter(p => !p.permanentlyClosed);
    console.log(`📊 Active businesses: ${activePlaces.length}`);
    
    // OPTIMIZATION: Smart batching for details - prioritize high-value leads first
    const BATCH_SIZE = 50; // Large batch size for more leads
    const DETAILS_DELAY = 15; // Reduced delay for faster processing
    
    // OPTIMIZATION: Sort by rating/reviews first to get best leads initially
    activePlaces.sort((a, b) => {
      const scoreA = (a.stars || 0) * 10 + Math.min(a.reviewsCount || 0, 100);
      const scoreB = (b.stars || 0) * 10 + Math.min(b.reviewsCount || 0, 100);
      return scoreB - scoreA;
    });
    
    console.log('📞 Fetching contact details (optimized batches)...');
    
    // OPTIMIZATION: Track valid leads and stop early when we have enough
    let validLeadsCount = 0;
    const MAX_DETAILS_FETCH = Math.min(activePlaces.length, 800); // Increased to 800 for more leads after location filtering
    
    for (let i = 0; i < MAX_DETAILS_FETCH; i += BATCH_SIZE) {
      const batch = activePlaces.slice(i, i + BATCH_SIZE);
      
      const detailsPromises = batch.map(async (place, idx) => {
        await sleep(idx * DETAILS_DELAY);
        const details = await getPlaceDetails(place.placeId);
        if (details) {
          place.phone = details.international_phone_number || details.formatted_phone_number || '';
          place.website = details.website || '';
        }
      });
      
      await Promise.all(detailsPromises);
      
      // Count valid leads so far
      const placesWithPhone = activePlaces.slice(0, i + BATCH_SIZE).filter(p => p.phone && p.phone.trim() !== '');
      validLeadsCount = placesWithPhone.length;
      console.log(`📞 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${validLeadsCount} leads with phone`);
      
      // Stop if we have enough leads with buffer for filtering
      if (validLeadsCount >= MAX_TOTAL_LEADS + 100) {
        console.log(`🎯 Reached buffer (${validLeadsCount}), stopping details fetch`);
        break;
      }
      
      // Stop early if we have good amount after many batches
      if (validLeadsCount >= MAX_TOTAL_LEADS && i >= 500) {
        console.log(`⚡ Have ${validLeadsCount} leads after ${i} details, stopping`);
        break;
      }
    }
    
    // Process results with our existing filtering logic
    const leads = processResultsWithCategories(activePlaces, segment, cleanRegion, MAX_TOTAL_LEADS, bizType, digPresence, digActivity);
    console.log(`✅ FINAL: ${leads.length} leads ready (target: ${MIN_LEADS_TARGET}-${MAX_TOTAL_LEADS})`);
    
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

// Classify digital presence level of a place - OPTIMIZED
function classifyDigitalPresence(place: any): 'no-site' | 'basic-site' | 'structured-site' {
  const website = getCleanWebsite(place);
  
  // No website at all = no-site
  if (!website) {
    return 'no-site';
  }
  
  const websiteLower = website.toLowerCase();
  
  // Link aggregators and social profiles = no real website (treat as no-site for marketing purposes)
  const notRealWebsite = [
    'linktr.ee', 'linktree', 'bio.link', 'taplink', 'beacons.ai',
    'instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com',
    'youtube.com', 'wa.me', 'whatsapp.com', 'api.whatsapp',
    'bit.ly', 'goo.gl', 'rebrand.ly', 't.me', 'telegram'
  ];
  
  for (const indicator of notRealWebsite) {
    if (websiteLower.includes(indicator)) {
      return 'no-site'; // Link aggregators don't count as websites
    }
  }
  
  // Free/low-cost site builders = basic site
  const basicSiteBuilders = [
    'wix.com', 'wixsite.com', 'blogspot', 'blogger.com',
    'wordpress.com', 'sites.google.com', 'google.com/site',
    'weebly.com', 'jimdo.com', 'webnode', 'squarespace.com',
    'carrd.co', 'notion.site', 'notion.so', 'canva.com',
    'godaddysites', 'strikingly.com', 'page.link', 'webflow.io',
    'my.id', 'neocities', 'geocities', 'tripod.com',
    'yelp.com', 'tripadvisor', 'ifood.com.br', 'rappi.com'
  ];
  
  for (const builder of basicSiteBuilders) {
    if (websiteLower.includes(builder)) {
      return 'basic-site';
    }
  }
  
  // Check for own domain indicators (structured site)
  // Own domain = has a proper domain that's not a builder
  const hasOwnDomain = /^https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]*\.[a-z]{2,}(?:\.[a-z]{2,})?(?:\/|$)/i.test(website);
  
  if (hasOwnDomain) {
    // Additional check: e-commerce/professional indicators
    const professionalIndicators = [
      '/loja', '/shop', '/store', '/produtos', '/catalogo', '/servicos',
      '/orcamento', '/contato', '/sobre', '/empresa', '/quem-somos',
      'ecommerce', 'checkout', 'carrinho', 'pedido'
    ];
    
    for (const indicator of professionalIndicators) {
      if (websiteLower.includes(indicator)) {
        return 'structured-site';
      }
    }
    
    // Check domain extension quality
    const premiumExtensions = ['.com.br', '.com', '.net', '.org', '.io', '.co', '.app'];
    for (const ext of premiumExtensions) {
      if (websiteLower.includes(ext)) {
        return 'structured-site';
      }
    }
    
    // Has own domain but not premium extension = still structured
    return 'structured-site';
  }
  
  // Default fallback: if has URL but couldn't classify, assume basic
  return 'basic-site';
}

// Classify digital activity level of a place - OPTIMIZED
// Focus: Find companies with LOW digital activity = best targets for marketing agencies
function classifyDigitalActivity(place: any): 'low' | 'basic' | 'active' {
  const website = getCleanWebsite(place);
  const instagram = extractInstagram(place);
  const reviewCount = place.reviewsCount || place.reviews || 0;
  const rating = place.stars || place.totalScore || 0;
  const digitalPresence = classifyDigitalPresence(place);
  
  // ===== CALCULATE DIGITAL ACTIVITY SCORE (0-100) =====
  let activityScore = 0;
  
  // ----- Website Presence (0-35 points) -----
  if (digitalPresence === 'structured-site') {
    activityScore += 35; // Has professional website
  } else if (digitalPresence === 'basic-site') {
    activityScore += 15; // Has basic website
  }
  // no-site = 0 points
  
  // ----- Social Media Presence (0-25 points) -----
  if (instagram) {
    activityScore += 25; // Has Instagram presence
  }
  // Note: Could expand to check Facebook, but Instagram is primary indicator
  
  // ----- Customer Engagement via Reviews (0-25 points) -----
  // High review count = customers are engaging = business has digital footprint
  if (reviewCount >= 200) {
    activityScore += 25;
  } else if (reviewCount >= 100) {
    activityScore += 20;
  } else if (reviewCount >= 50) {
    activityScore += 15;
  } else if (reviewCount >= 20) {
    activityScore += 10;
  } else if (reviewCount >= 10) {
    activityScore += 5;
  } else if (reviewCount >= 5) {
    activityScore += 2;
  }
  // < 5 reviews = 0 points (low engagement)
  
  // ----- Business Reputation Quality (0-15 points) -----
  // High rating + reviews = actively managing reputation
  if (rating >= 4.5 && reviewCount >= 30) {
    activityScore += 15; // Excellent reputation management
  } else if (rating >= 4.0 && reviewCount >= 15) {
    activityScore += 10; // Good reputation
  } else if (rating >= 3.5 && reviewCount >= 5) {
    activityScore += 5; // Basic presence
  }
  
  // ===== CLASSIFY BASED ON SCORE =====
  // 
  // LOW (0-24): No/minimal digital presence
  //   - No website or just link aggregator
  //   - No social media
  //   - Few/no reviews
  //   = IDEAL TARGET for marketing agencies
  //
  // BASIC (25-54): Minimal effort digital presence
  //   - Basic website OR social media (not both well-developed)
  //   - Some reviews but not actively managed
  //   = GOOD TARGET for marketing agencies
  //
  // ACTIVE (55-100): Established digital presence
  //   - Professional website + social media
  //   - High engagement/reviews
  //   - Actively managing online reputation
  //   = May not need marketing help
  //
  
  if (activityScore >= 55) {
    return 'active';
  } else if (activityScore >= 25) {
    return 'basic';
  } else {
    return 'low';
  }
}

// New version of processResults that uses the tagged category from search
function processResultsWithCategories(apifyResults: any[], segment: string, cleanRegion: string, maxLeads: number, businessType: string = 'all', digitalPresence: string = 'all', digitalActivity: string = 'all'): any[] {
  console.log(`📊 Processing ${apifyResults.length} raw results for segment: ${segment}, businessType: ${businessType}, digitalPresence: ${digitalPresence}, digitalActivity: ${digitalActivity}`);
  
  // Extract country code from segment context (passed via cleanRegion context)
  const countryCode = 'BR'; // Default to Brazil, could be passed as parameter
  
  // Step 1: Filter by basic requirements, LOCATION VALIDATION, AND niche relevance
  let results = apifyResults.filter((place: any) => {
    const phone = place.phone || place.phoneUnformatted;
    if (!phone || phone.trim() === '') return false;
    if (!isValidName(place.title)) {
      console.log(`❌ Invalid name: "${place.title}"`);
      return false;
    }
    
    // CRITICAL: LOCATION VALIDATION - Ensure lead is in the requested region
    const address = place.address || '';
    if (!isAddressInLocation(address, cleanRegion, countryCode)) {
      console.log(`❌ Location mismatch: "${place.title}" at "${address}" not in "${cleanRegion}"`);
      return false;
    }
    
    // Use the place's search segment for relevance check
    const placeSegment = place._searchSegment || segment;
    if (!isRelevantToNiche(place, placeSegment)) {
      return false;
    }
    
    return true;
  });
  
  console.log(`📊 After basic filter: ${results.length} results`);
  
  // Step 2: Apply Matriz filter if requested
  if (businessType === 'matriz') {
    const beforeMatriz = results.length;
    results = results.filter(place => isMatriz(place));
    console.log(`📊 After Matriz filter: ${results.length} results (removed ${beforeMatriz - results.length})`);
  } else if (businessType === 'filial') {
    const beforeFilial = results.length;
    results = results.filter(place => !isMatriz(place));
    console.log(`📊 After Filial filter: ${results.length} results (removed ${beforeFilial - results.length})`);
  }
  
  // Step 3: Apply Digital Presence filter (STRICT - eliminatory)
  if (digitalPresence !== 'all') {
    const beforeDigitalPresence = results.length;
    results = results.filter(place => {
      const presence = classifyDigitalPresence(place);
      return presence === digitalPresence;
    });
    console.log(`📊 After Digital Presence (${digitalPresence}) filter: ${results.length} results (removed ${beforeDigitalPresence - results.length})`);
  }
  
  // Step 4: Apply Digital Activity filter (STRICT - eliminatory)
  if (digitalActivity !== 'all') {
    const beforeDigitalActivity = results.length;
    results = results.filter(place => {
      const activity = classifyDigitalActivity(place);
      return activity === digitalActivity;
    });
    console.log(`📊 After Digital Activity (${digitalActivity}) filter: ${results.length} results (removed ${beforeDigitalActivity - results.length})`);
  }
  
  // Step 5: Deduplicate by placeId
  const seenPlaceIds = new Set<string>();
  results = results.filter((place: any) => {
    if (place.placeId && seenPlaceIds.has(place.placeId)) return false;
    if (place.placeId) seenPlaceIds.add(place.placeId);
    return true;
  });
  
  // Step 6: Deduplicate by normalized company name
  if (businessType === 'matriz') {
    const seenCompanies = new Map<string, any>();
    
    for (const place of results) {
      const normalizedName = normalizeCompanyName(place.title);
      const words = normalizedName.split(/\s+/).filter(w => w.length > 2);
      const brandKey = words.slice(0, 2).join('');
      
      if (!seenCompanies.has(brandKey)) {
        seenCompanies.set(brandKey, place);
      } else {
        const existing = seenCompanies.get(brandKey);
        if ((place.reviewsCount || 0) > (existing.reviewsCount || 0)) {
          seenCompanies.set(brandKey, place);
        }
      }
    }
    
    results = Array.from(seenCompanies.values());
    console.log(`📊 After brand deduplication: ${results.length} unique companies`);
  } else {
    const seen = new Set<string>();
    results = results.filter((place: any) => {
      const key = `${normalizeCompanyName(place.title)}-${(place.address || '').slice(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  // Hard limit
  if (results.length > maxLeads) {
    results = results.slice(0, maxLeads);
  }
  
  console.log(`📊 Final: ${results.length} leads`);
  
  // Transform results to leads format
  return results.map((place: any, index: number) => {
    const phone = place.phone || place.phoneUnformatted || '';
    const phoneValidation = validatePhone(phone);
    
    // USE THE DISPLAY CATEGORY FROM THE SEARCH - this is the key fix!
    const category = place._displayCategory || segment;
    
    const { employeeCount, companySize, revenue } = estimateRevenue(place, category);
    const openedDate = estimateYearsInOperation(place);
    const matchScore = calculateMatchScore(place, category, companySize);
    const reasons = generateReasons(place, category, companySize, matchScore);
    const instagram = extractInstagram(place);
    const website = getCleanWebsite(place);
    const digitalPresenceLevel = classifyDigitalPresence(place);
    const digitalActivityLevel = classifyDigitalActivity(place);
    
    return {
      id: `apify-${place.placeId || Date.now()}-${index}`,
      name: place.title,
      address: place.address || 'Endereço não disponível',
      phone: phoneValidation.valid ? phoneValidation.normalized : phone,
      phoneValid: phoneValidation.valid,
      email: place.email || '',
      website: website,
      instagram: instagram,
      facebook: '',
      hasWhatsApp: phoneValidation.isWhatsApp,
      placeId: place.placeId,
      category,
      rating: place.stars || place.totalScore || 0,
      reviews: place.reviewsCount || 0,
      matchScore,
      confidenceScore: matchScore,
      source: 'google_maps_apify',
      responsible: 'Gerente',
      employeeCount,
      companySize,
      revenue,
      openedDate,
      reasons,
      isMatriz: isMatriz(place),
      digitalPresence: digitalPresenceLevel,
      digitalActivity: digitalActivityLevel,
      dataQuality: {
        hasValidPhone: phoneValidation.valid,
        hasSocialMedia: !!instagram,
        hasWhatsApp: phoneValidation.isWhatsApp,
        hasWebsite: !!website,
        fromGoogleMaps: true
      },
      needsReview: false
    };
  });
}

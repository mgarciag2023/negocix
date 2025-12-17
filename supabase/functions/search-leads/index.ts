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

// Generate search terms
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': ['restaurante', 'lanchonete', 'buffet', 'pizzaria', 'hamburgueria'],
    'supermercados': ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti'],
    'hipermercados': ['hipermercado', 'carrefour', 'big', 'walmart', 'assaí', 'makro'],
    'padarias': ['padaria', 'panificadora', 'confeitaria', 'bakery'],
    'materiais de construção': ['material de construção', 'home center', 'depósito', 'ferragem'],
    'ferramentas': ['ferramentas', 'loja de ferramentas', 'ferragem', 'ferramentaria'],
    'agropecuária': ['agropecuária', 'loja agropecuária', 'produtos rurais', 'veterinária'],
    'farmácias': ['farmácia', 'drogaria', 'medicamentos'],
    'pet shop': ['pet shop', 'loja de animais', 'veterinária', 'banho e tosa'],
    'lojas de roupas': ['loja de roupas', 'vestuário', 'moda', 'boutique'],
    'autopeças': ['autopeças', 'peças automotivas', 'loja de peças'],
    'eletrônicos': ['eletrônicos', 'loja de eletrônicos', 'informática', 'celular'],
    'móveis': ['móveis', 'loja de móveis', 'móveis planejados', 'decoração'],
    'óticas': ['ótica', 'óculos', 'lentes'],
    'joalherias': ['joalheria', 'joias', 'ouro', 'relógios'],
    'academias': ['academia', 'fitness', 'musculação', 'crossfit'],
    'salões de beleza': ['salão de beleza', 'cabeleireiro', 'barbearia', 'estética'],
    'hotéis': ['hotel', 'pousada', 'hospedagem'],
    'clínicas': ['clínica', 'consultório', 'médico', 'dentista'],
    'transportadoras': ['transportadora', 'transporte', 'frete', 'logística'],
    'gráficas': ['gráfica', 'impressão', 'comunicação visual'],
    'construtoras': ['construtora', 'construção civil', 'empreiteira'],
    'cozinhas industriais': ['cozinha industrial', 'refeição coletiva', 'catering'],
    'indústrias de salgados': ['fábrica de salgados', 'salgados congelados', 'salgaderia'],
    'distribuidores de frios': ['distribuidor de frios', 'frios e embutidos', 'laticínios'],
    'cestas básicas': ['cestas básicas', 'cesta básica', 'cestas de alimentos']
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
    searchTerms = [term, `${term}s`, `loja de ${term}`];
  }
  
  return searchTerms.slice(0, 3);
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

// STRICT niche relevance keywords - VERY STRICT FOR HIPERMERCADOS
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
    include: ['restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'churrascaria', 'buffet', 'self-service', 'gastronomia', 'bistrô', 'cantina', 'refeitório'],
    mustMatch: ['restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'churrascaria', 'buffet'],
    exclude: ['cueca', 'roupa', 'móvel', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado']
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
  }
};

// Check if result is relevant to searched niche - STRICT VERSION
function isRelevantToNiche(place: any, segment: string): boolean {
  const segmentLower = segment.toLowerCase();
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
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
  
  // For strict categories like hipermercados, MUST match one of the mustMatch keywords
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
  
  // Transform results to leads format
  return results.map((place: any, index: number) => {
    const phone = place.phone || place.phoneUnformatted || '';
    const phoneValidation = validatePhone(phone);
    const category = place.categoryName || place.categories?.[0] || segment;
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
    const { segment, products, region, country, filters, ecommerceType, businessType } = await req.json();
    console.log('🔍 SEARCH v8 - Strict Filtering - Input:', { segment, products, region, country, ecommerceType, businessType });
    
    const countryCode = country || 'BR';
    const bizType = businessType || 'all';
    
    // Check if this is an e-commerce search with specific type
    const isEcommerceSearch = segment.toLowerCase().includes('e-commerce') || segment.toLowerCase().includes('ecommerce');
    
    // Generate search terms
    let searchTerms: string[];
    
    if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
      const ecomType = ecommerceType.trim().toLowerCase();
      searchTerms = [`loja ${ecomType}`, ecomType, `loja de ${ecomType}`];
      console.log(`🛒 E-commerce específico: ${ecomType}`);
    } else {
      searchTerms = generateSearchTerms(segment);
    }
    
    // Build location query
    const cleanRegion = region.trim();
    const locationQuery = countryCode === 'BR' 
      ? `${cleanRegion}, Brazil`
      : `${cleanRegion}, ${countryCode}`;
    
    console.log('📋 Search terms:', searchTerms);
    console.log('📍 Location:', locationQuery);
    console.log('🏢 Business type:', bizType);
    
    // Get Apify API key
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    const MAX_TOTAL_LEADS = 150;
    const MIN_LEADS_EARLY_EXIT = 60;
    const MAX_WAIT_TIME = 80000; // 80 seconds
    const EARLY_EXIT_WAIT = 30000; // 30 seconds before checking early exit
    const POLL_INTERVAL = 5000; // 5 seconds
    
    const language = countryCode === 'BR' ? 'pt-BR' : 'en';
    const searchStringsArray = searchTerms.map(term => term);
    const placesPerSearch = Math.max(10, Math.ceil(MAX_TOTAL_LEADS / searchTerms.length));
    
    console.log(`🔎 Apify async search: ${placesPerSearch} places per term`);
    
    // START ASYNC RUN (not sync)
    const startRunUrl = `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?token=${APIFY_API_KEY}`;
    
    const apifyPayload = {
      searchStringsArray,
      locationQuery,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language,
      skipClosedPlaces: true
    };
    
    console.log('📤 Starting async Apify run...');
    
    const startResponse = await fetch(startRunUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyPayload)
    });
    
    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error('❌ Apify start error:', startResponse.status, errorText);
      throw new Error(`Apify start error: ${startResponse.status}`);
    }
    
    const runData = await startResponse.json();
    const runId = runData.data?.id;
    const datasetId = runData.data?.defaultDatasetId;
    
    if (!runId || !datasetId) {
      console.error('❌ Missing runId or datasetId:', runData);
      throw new Error('Failed to start Apify run');
    }
    
    console.log(`✅ Run started: ${runId}, Dataset: ${datasetId}`);
    
    // POLLING LOOP
    const startTime = Date.now();
    let allResults: any[] = [];
    let lastResultCount = 0;
    
    while (Date.now() - startTime < MAX_WAIT_TIME) {
      await sleep(POLL_INTERVAL);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`⏱️ Polling... ${Math.round(elapsedTime / 1000)}s elapsed`);
      
      // Fetch current dataset items
      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`;
      
      try {
        const dataResponse = await fetch(datasetUrl);
        if (dataResponse.ok) {
          const items = await dataResponse.json();
          allResults = items;
          
          const leads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS, bizType);
          console.log(`📊 Current: ${allResults.length} raw, ${leads.length} valid leads`);
          
          // Early exit: if we have 60+ leads after 30 seconds, wait 5 more seconds then return
          if (elapsedTime >= EARLY_EXIT_WAIT && leads.length >= MIN_LEADS_EARLY_EXIT) {
            console.log(`🎯 Found ${leads.length} leads at ${Math.round(elapsedTime / 1000)}s - waiting 5 more seconds...`);
            
            // Wait 5 more seconds to collect additional leads
            await sleep(5000);
            
            // Fetch final results after the extra wait
            try {
              const finalDataResponse = await fetch(datasetUrl);
              if (finalDataResponse.ok) {
                const finalItems = await finalDataResponse.json();
                allResults = finalItems;
                const finalLeads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS, bizType);
                console.log(`🚀 Early exit after extra 5s: ${finalLeads.length} leads`);
                
                // Abort the run to save credits
                try {
                  await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                    method: 'POST'
                  });
                  console.log('🛑 Run aborted to save credits');
                } catch (e) {
                  console.log('⚠️ Could not abort run:', e);
                }
                
                return new Response(JSON.stringify({ leads: finalLeads }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            } catch (e) {
              console.log('⚠️ Final fetch error:', e);
            }
            
            // Fallback to current leads if final fetch fails
            try {
              await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                method: 'POST'
              });
            } catch (e) {}
            
            return new Response(JSON.stringify({ leads }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          // If we hit 150 leads, return immediately
          if (leads.length >= MAX_TOTAL_LEADS) {
            console.log(`✅ Max leads reached: ${leads.length}`);
            
            // Abort the run
            try {
              await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
                method: 'POST'
              });
              console.log('🛑 Run aborted - max leads reached');
            } catch (e) {
              console.log('⚠️ Could not abort run:', e);
            }
            
            return new Response(JSON.stringify({ leads: leads.slice(0, MAX_TOTAL_LEADS) }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          lastResultCount = leads.length;
        }
      } catch (e) {
        console.log('⚠️ Polling error:', e);
      }
      
      // Check run status
      const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`;
      try {
        const statusResponse = await fetch(statusUrl);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const status = statusData.data?.status;
          
          if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
            console.log(`🏁 Run finished with status: ${status}`);
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Status check error:', e);
      }
    }
    
    // Timeout reached or run finished - return what we have
    console.log(`⏰ Polling complete. Total raw results: ${allResults.length}`);
    
    // Abort if still running
    try {
      await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${APIFY_API_KEY}`, {
        method: 'POST'
      });
      console.log('🛑 Run aborted after timeout');
    } catch (e) {
      // Ignore - might already be finished
    }
    
    const leads = processResults(allResults, segment, cleanRegion, MAX_TOTAL_LEADS, bizType);
    console.log(`✅ FINAL: ${leads.length} leads ready`);
    
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

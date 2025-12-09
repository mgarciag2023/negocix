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

// Extract emails from website
async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  try {
    console.log(`📧 Scraping email from: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Priority 1: <a href="mailto:"> links
    const mailtoMatch = html.match(/href=["']mailto:([^"']+)["']/i);
    if (mailtoMatch && mailtoMatch[1]) {
      const email = mailtoMatch[1].split('?')[0].trim(); // Remove query params
      if (isValidEmail(email)) {
        console.log(`✅ Found email via mailto: ${email}`);
        return email;
      }
    }
    
    // Priority 2: Email in meta tags
    const metaEmailMatch = html.match(/<meta[^>]*content=["']([^"']*@[^"']+)["']/i);
    if (metaEmailMatch && metaEmailMatch[1]) {
      const email = metaEmailMatch[1].trim();
      if (isValidEmail(email)) {
        console.log(`✅ Found email in meta: ${email}`);
        return email;
      }
    }
    
    // Priority 3: Common email patterns in visible text
    const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = html.match(emailPattern);
    
    if (emails && emails.length > 0) {
      // Filter out common noise patterns
      const validEmails = emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return isValidEmail(email) &&
               !lowerEmail.includes('example.com') &&
               !lowerEmail.includes('test.com') &&
               !lowerEmail.includes('domain.com') &&
               !lowerEmail.includes('wixpress.com') &&
               !lowerEmail.includes('sentry.io');
      });
      
      // Prioritize business emails (contato, vendas, comercial, etc)
      const businessEmails = validEmails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return lowerEmail.includes('contato') ||
               lowerEmail.includes('vendas') ||
               lowerEmail.includes('comercial') ||
               lowerEmail.includes('atendimento') ||
               lowerEmail.includes('info') ||
               lowerEmail.includes('contact');
      });
      
      if (businessEmails.length > 0) {
        console.log(`✅ Found business email: ${businessEmails[0]}`);
        return businessEmails[0];
      }
      
      if (validEmails.length > 0) {
        console.log(`✅ Found email: ${validEmails[0]}`);
        return validEmails[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error scraping email from ${url}:`, error);
    return null;
  }
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && !email.includes('..') && email.length <= 254;
}

// Search for official social media profiles and email
async function searchSocialMediaProfiles(businessName: string, city: string, website?: string): Promise<{
  instagram?: string;
  facebook?: string;
  whatsappBusiness?: string;
  email?: string;
}> {
  const profiles: {
    instagram?: string;
    facebook?: string;
    whatsappBusiness?: string;
    email?: string;
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
      
      // Extract email from website
      const emailFromWebsite = await scrapeEmailFromWebsite(website);
      if (emailFromWebsite) {
        profiles.email = emailFromWebsite;
        console.log(`✅ Email found from website: ${profiles.email}`);
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
    const { segment, products, region, country, filters } = await req.json();
    console.log('🔍 Searching leads for:', { segment, products, region, country, filters });
    
    const countryCode = country || 'BR';
    const isInternational = countryCode !== 'BR';
    console.log('Using region:', region, '| Country:', countryCode, '| International:', isInternational);

    // Use Apify Google Maps Scraper for real data - ONLY SOURCE OF TRUTH
    console.log('📡 Searching Google Maps via Apify API (ONLY real data)...');
    
    // Enhanced search terms for specific categories - MAXIMIZE RESULTS WITH BETTER COVERAGE
    const categorySearchTerms: { [key: string]: string[] } = {
      // Materiais e Construção - EXPANDED
      'materiais elétricos': ['materiais elétricos', 'loja elétrica', 'material eletrico', 'distribuidora elétrica', 'casa de elétrica', 'componentes elétricos', 'elétrica', 'instalações elétricas', 'fios e cabos', 'iluminação elétrica'],
      'materiais de construção': ['materiais de construção', 'materiais construcao', 'loja construção', 'casa construção', 'depósito construção', 'construmateriais', 'home center', 'depósito', 'loja de construção', 'casa de materiais'],
      'ferramentas': ['ferramentas', 'loja de ferramentas', 'ferragens e ferramentas', 'equipamentos', 'casa das ferramentas', 'ferramentaria', 'ferragens', 'ferramentas elétricas', 'ferramentas manuais'],
      'chaveiro': ['chaveiro', 'chaveiro 24h', 'cópia de chaves', 'serviço de chaveiro', 'chaveiro automotivo', 'fechaduras', 'cadeados', 'chaveiro residencial'],
      'ferragens': ['ferragens', 'loja de ferragens', 'casa de ferragens', 'parafusos', 'ferragens em geral', 'ferragem', 'dobradiças', 'puxadores'],
      
      // Construtoras - NEW
      'construtoras': ['construtora', 'construtoras', 'empreiteira', 'incorporadora', 'engenharia civil', 'construção civil', 'empresa de construção', 'obras', 'construções'],
      'construtora': ['construtora', 'construtoras', 'empreiteira', 'incorporadora', 'engenharia civil', 'construção civil', 'empresa de construção', 'obras', 'construções'],
      'empreiteiras': ['empreiteira', 'empreiteiro', 'construção', 'reformas', 'obras'],
      'incorporadoras': ['incorporadora', 'incorporação', 'imobiliária', 'empreendimento'],
      
      // Agropecuária - EXPANDED  
      'agropecuária': ['agropecuária', 'loja agropecuaria', 'produtos agropecuários', 'insumos agrícolas', 'casa agropecuaria', 'loja rural', 'veterinária agro', 'agro', 'pet shop agro', 'produtos rurais', 'sementes', 'adubos'],
      
      // E-commerce - EXPANDED
      'e-commerce': ['loja online', 'loja virtual', 'comércio eletrônico', 'e-commerce', 'vendas online', 'marketplace', 'loja internet', 'vendas pela internet'],
      
      // Transporte e Veículos - EXPANDED
      'transportadoras': ['transportadora', 'transporte de cargas', 'empresa de transporte', 'frete', 'logística', 'transportes', 'cargas', 'mudanças', 'transporte rodoviário', 'transportes e logística'],
      'frotistas': ['frota', 'gestão de frota', 'empresa de veículos', 'locadora', 'transportadora', 'frota própria', 'administração de frotas'],
      'empresas com frota própria': ['distribuidora', 'atacadista', 'indústria', 'fábrica', 'empresa grande', 'distribuidor', 'atacado'],
      'vans escolares': ['transporte escolar', 'van escolar', 'escolar', 'transporte de alunos', 'transporte estudantil'],
      'táxis': ['táxi', 'taxi', 'cooperativa de táxi', 'ponto de táxi', 'radiotáxi', 'central de táxi'],
      'cooperativas de táxi': ['cooperativa táxi', 'táxi', 'taxi', 'radiotáxi', 'táxi cooperativa'],
      'motoristas de aplicativo': ['uber', '99', 'motorista particular', 'transporte particular', 'motorista app'],
      'empresas de logística': ['logística', 'distribuição', 'armazém', 'centro de distribuição', 'operador logístico', 'logística integrada', 'supply chain'],
      'empresas de entrega': ['entregas', 'delivery', 'motoboy', 'courier', 'serviço de entrega', 'entregas rápidas', 'entrega expressa', 'transportadora entregas'],
      'locadoras de veículos': ['locadora', 'aluguel de carros', 'rent a car', 'locadora de veículos', 'rental', 'locação veículos'],
      'empresas de turismo': ['turismo', 'agência de turismo', 'excursões', 'fretamento', 'viagens', 'receptivo', 'agência de viagens', 'tur'],
      'protecao-veicular': ['transportadora', 'logística', 'transporte escolar', 'táxi', 'locadora de veículos', 'turismo', 'entregas', 'frota', 'veículos'],
      
      // INDÚSTRIAS - EXPANDED
      'indústrias que utilizam eletrônica': ['indústria eletrônica', 'fábrica eletrônicos', 'montagem eletrônica', 'componentes eletrônicos', 'placas eletrônicas', 'manufatura eletrônica', 'eletrônicos industriais'],
      'indústrias automotivas': ['indústria automotiva', 'autopeças', 'fábrica automotiva', 'peças automotivas', 'montadora', 'indústria de autopeças', 'fabricante automotivo', 'peças de carro'],
      'indústrias de equipamentos hospitalares': ['equipamentos hospitalares', 'equipamentos médicos', 'indústria hospitalar', 'dispositivos médicos', 'fabricante hospitalar', 'material hospitalar'],
      'indústrias de equipamentos de segurança': ['equipamentos de segurança', 'EPI', 'fabricante segurança', 'indústria segurança', 'equipamentos proteção', 'segurança do trabalho'],
      'indústrias de automação': ['automação industrial', 'indústria automação', 'sistemas automação', 'robótica industrial', 'fábrica automação', 'automação'],
      'indústrias de tecnologia': ['indústria tecnologia', 'fábrica software', 'empresa tecnologia', 'TI industrial', 'fabricante tecnologia', 'tech', 'software'],
      'indústrias de iluminação': ['indústria iluminação', 'fábrica iluminação', 'fabricante LED', 'lâmpadas LED', 'iluminação industrial', 'luminárias LED', 'LED'],
      
      // Têxtil - EXPANDED
      'tecidos': ['loja de tecidos', 'tecidos', 'armarinho', 'aviamentos', 'tecidos em geral', 'malhas', 'loja de malhas'],
      'confecções': ['confecção', 'fábrica de roupas', 'indústria têxtil', 'malharia', 'vestuário', 'fabricação de roupas', 'indústria de confecção'],
      'ateliês de costura': ['ateliê', 'costura', 'alfaiataria', 'modista', 'ateliê de costura', 'costureira'],
      'malharias': ['malharia', 'malhas', 'tricô', 'fabricação de malhas'],
      'bordados': ['bordado', 'bordados', 'bordadeira', 'estamparia'],
      'lojas de aviamentos': ['aviamentos', 'armarinho', 'botões', 'zíperes', 'linha', 'agulhas'],
      
      // Supermercados - EXPANDED
      'supermercados': ['supermercado', 'mercado', 'hipermercado', 'atacadão', 'atacarejo', 'minimercado', 'mercearia', 'empório', 'armazém'],
      'hipermercados': ['hipermercado', 'supermercado grande', 'atacadão', 'big', 'extra'],
      'cestas básicas': ['cesta básica', 'cestas básicas', 'distribuidora cestas'],
      'cestas natalinas': ['cesta natalina', 'cestas de natal', 'kits natalinos'],
      
      // Gráficas - EXPANDED
      'gráfica': ['gráfica', 'gráfica rápida', 'impressão digital', 'comunicação visual', 'serigrafia', 'gráfica offset', 'impressora', 'copiadora', 'banner', 'adesivos'],
      'gráficas rápidas': ['gráfica rápida', 'copy', 'impressão rápida', 'copiadora'],
      'comunicação visual': ['comunicação visual', 'letreiros', 'placas', 'banner', 'fachada', 'outdoor'],
      
      // Saúde - EXPANDED
      'telemedicina': ['telemedicina', 'clínica', 'consultório médico', 'laboratório', 'clínica popular', 'médico online', 'consulta online'],
      'clínicas': ['clínica', 'clínica médica', 'consultório', 'centro médico', 'policlínica'],
      'laboratórios': ['laboratório', 'análises clínicas', 'exames', 'diagnóstico'],
      'farmácias': ['farmácia', 'drogaria', 'farmácia de manipulação', 'farmácia popular'],
      
      // Arenas Esportivas - EXPANDED
      'arenas de beach tennis': ['beach tennis', 'quadra beach tennis', 'arena beach tennis', 'esporte areia', 'arena esportiva'],
      'quadras de tênis': ['tênis', 'quadra de tênis', 'clube de tênis', 'escola de tênis', 'quadra esportiva'],
      'clubes esportivos': ['clube esportivo', 'academia', 'centro esportivo', 'clube recreativo', 'clube', 'esportes'],
      'academias': ['academia', 'fitness', 'musculação', 'crossfit', 'pilates'],
      
      // Atacadistas - EXPANDED
      'atacadistas de alimentos': ['atacadista', 'atacado alimentos', 'distribuidora alimentos', 'atacarejo', 'atacado', 'distribuidor atacado'],
      'distribuidores de alimentos': ['distribuidor alimentos', 'distribuidora', 'atacado', 'food service', 'distribuição alimentos'],
      
      // Oficinas e Autopeças - NEW
      'oficinas mecânicas': ['oficina mecânica', 'oficina', 'mecânico', 'auto center', 'centro automotivo', 'reparos automotivos'],
      'autopeças': ['autopeças', 'peças automotivas', 'loja de autopeças', 'auto peças', 'peças de carro'],
      
      // Restaurantes e Alimentação - NEW
      'restaurantes': ['restaurante', 'restaurantes', 'lanchonete', 'buffet', 'self service'],
      'padarias': ['padaria', 'panificadora', 'confeitaria', 'pães', 'bolos'],
      'bares': ['bar', 'bares', 'pub', 'boteco'],
      
      // Pet - NEW
      'pet shop': ['pet shop', 'petshop', 'loja de animais', 'veterinária', 'banho e tosa', 'ração'],
      
      // Papelaria e Escritório - NEW
      'papelaria': ['papelaria', 'material escolar', 'escritório', 'bazar', 'livraria'],
      'material de escritório': ['material de escritório', 'suprimentos', 'informática', 'escritório'],
      
      // Óticas - NEW
      'óticas': ['ótica', 'óculos', 'lentes', 'oftalmologia'],
      
      // Joalherias - NEW
      'joalherias': ['joalheria', 'jóias', 'relojoaria', 'semi-jóias', 'bijuteria'],
      
      // Móveis e Decoração - NEW
      'móveis': ['móveis', 'loja de móveis', 'móveis planejados', 'marcenaria', 'mobília'],
      'decoração': ['decoração', 'home decor', 'design de interiores', 'artigos decoração'],
      
      // Eletrônicos - NEW
      'eletrônicos': ['eletrônicos', 'loja de eletrônicos', 'celulares', 'informática', 'assistência técnica'],
      'celulares': ['celulares', 'loja de celular', 'smartphone', 'assistência celular', 'conserto celular'],
    };
    
    // Build search queries - use multiple terms for better coverage
    const segmentLowerNorm = segment.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let searchQueries: string[] = [];
    
    // Check if this is proteção veicular category (from filters)
    const isProtecaoVeicular = filters?.category === 'protecao-veicular';
    
    // Build location string based on region - TRIM to avoid extra spaces
    const trimmedRegion = region.trim();
    const locationString = `${trimmedRegion}, ${countryCode}`;
    
    // If proteção veicular, use comprehensive vehicle search terms
    if (isProtecaoVeicular) {
      searchQueries = categorySearchTerms['protecao-veicular'].map(term => 
        `${term} ${locationString}`
      );
      console.log(`🎯 Proteção Veicular detected - using comprehensive vehicle search`);
      console.log(`📋 Using ${searchQueries.length} search terms:`, searchQueries);
    } else {
      // Collect ALL matching categories from the segment (supports multiple selected)
      const allMatchedTerms: string[] = [];
      Object.keys(categorySearchTerms).forEach(key => {
        const keyNorm = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (segmentLowerNorm.includes(keyNorm) || 
            segmentLowerNorm.includes(keyNorm.replace(/ /g, ''))) {
          allMatchedTerms.push(...categorySearchTerms[key]);
          console.log(`🎯 Matched category: "${key}"`);
        }
      });
      
      if (allMatchedTerms.length > 0) {
        // Remove duplicates and use up to 10 terms for better coverage (was 8)
        const uniqueTerms = [...new Set(allMatchedTerms)].slice(0, 10);
        searchQueries = uniqueTerms.map(term => 
          `${term} ${locationString}`
        );
        console.log(`📋 Using ${searchQueries.length} unique search terms from ${allMatchedTerms.length} total`);
      } else {
        // Standard search - use segment directly with multiple variations
        const firstCustomer = segment.split(',')[0].trim();
        const baseQuery = `${firstCustomer} ${locationString}`;
        
        // Create multiple search variations for better coverage
        searchQueries = [
          baseQuery,
          `loja de ${firstCustomer} ${locationString}`,
          `${firstCustomer.split(' ')[0]} ${locationString}` // First word only
        ];
        
        // Add industry-specific searches if segment mentions indústria
        if (segmentLowerNorm.includes('industria') || segmentLowerNorm.includes('fábrica')) {
          searchQueries.push(`fábrica ${firstCustomer} ${locationString}`);
          searchQueries.push(`fabricante ${firstCustomer} ${locationString}`);
          searchQueries.push(`indústria ${locationString}`);
        }
        
        // Remove duplicates
        searchQueries = [...new Set(searchQueries)];
        
        console.log(`🔍 Standard search queries: ${searchQueries.join(' | ')}`);
      }
    }
    console.log(`📋 Final search queries:`, searchQueries);
    
    // Define coordinates for major cities in Brazil - EXPANDED COVERAGE
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
      'São Bento do Sul': { lat: -26.2507, lng: -49.3787 },
      'Concórdia': { lat: -27.2343, lng: -52.0278 },
      'Rio do Sul': { lat: -27.2142, lng: -49.6432 },
      'Caçador': { lat: -26.7755, lng: -51.0090 },
      'Gaspar': { lat: -26.9314, lng: -48.9596 },
      'Indaial': { lat: -26.8978, lng: -49.2316 },
      'Pomerode': { lat: -26.7409, lng: -49.1764 },
      // Rio Grande do Sul
      'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
      'Santa Maria': { lat: -29.6868, lng: -53.8149 },
      'Caxias do Sul': { lat: -29.1634, lng: -51.1797 },
      'Pelotas': { lat: -31.7654, lng: -52.3376 },
      'Canoas': { lat: -29.9177, lng: -51.1844 },
      'Novo Hamburgo': { lat: -29.6873, lng: -51.1326 },
      'São Leopoldo': { lat: -29.7545, lng: -51.1496 },
      'Gravataí': { lat: -29.9389, lng: -50.9920 },
      'Passo Fundo': { lat: -28.2624, lng: -52.4067 },
      'Bento Gonçalves': { lat: -29.1699, lng: -51.5188 },
      // Paraná
      'Curitiba': { lat: -25.4284, lng: -49.2733 },
      'Londrina': { lat: -23.3045, lng: -51.1696 },
      'Maringá': { lat: -23.4273, lng: -51.9375 },
      'Ponta Grossa': { lat: -25.0945, lng: -50.1633 },
      'Cascavel': { lat: -24.9554, lng: -53.4560 },
      'Foz do Iguaçu': { lat: -25.5478, lng: -54.5882 },
      'São José dos Pinhais': { lat: -25.5304, lng: -49.2089 },
      'Colombo': { lat: -25.2927, lng: -49.2237 },
      // São Paulo
      'São Paulo': { lat: -23.5505, lng: -46.6333 },
      'Campinas': { lat: -22.9099, lng: -47.0626 },
      'Santos': { lat: -23.9608, lng: -46.3336 },
      'São Bernardo do Campo': { lat: -23.6914, lng: -46.5646 },
      'Santo André': { lat: -23.6737, lng: -46.5432 },
      'Ribeirão Preto': { lat: -21.1767, lng: -47.8208 },
      'Sorocaba': { lat: -23.5015, lng: -47.4526 },
      'São José dos Campos': { lat: -23.2237, lng: -45.9009 },
      'Osasco': { lat: -23.5324, lng: -46.7917 },
      'Guarulhos': { lat: -23.4543, lng: -46.5337 },
      'Jundiaí': { lat: -23.1857, lng: -46.8978 },
      'Piracicaba': { lat: -22.7255, lng: -47.6492 },
      // Rio de Janeiro
      'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
      'Niterói': { lat: -22.8832, lng: -43.1034 },
      'Duque de Caxias': { lat: -22.7858, lng: -43.3116 },
      'Nova Iguaçu': { lat: -22.7592, lng: -43.4511 },
      'Petrópolis': { lat: -22.5112, lng: -43.1779 },
      // Minas Gerais
      'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
      'Uberlândia': { lat: -18.9146, lng: -48.2754 },
      'Contagem': { lat: -19.9317, lng: -44.0539 },
      'Juiz de Fora': { lat: -21.7642, lng: -43.3503 },
      'Betim': { lat: -19.9679, lng: -44.1983 },
      // Bahia
      'Salvador': { lat: -12.9714, lng: -38.5014 },
      'Feira de Santana': { lat: -12.2669, lng: -38.9667 },
      // Nordeste
      'Recife': { lat: -8.0476, lng: -34.8770 },
      'Fortaleza': { lat: -3.7172, lng: -38.5433 },
      'Natal': { lat: -5.7793, lng: -35.2009 },
      'João Pessoa': { lat: -7.1195, lng: -34.8450 },
      'Maceió': { lat: -9.6658, lng: -35.7350 },
      'Aracaju': { lat: -10.9472, lng: -37.0731 },
      // Centro-Oeste
      'Brasília': { lat: -15.7942, lng: -47.8825 },
      'Goiânia': { lat: -16.6869, lng: -49.2648 },
      'Campo Grande': { lat: -20.4697, lng: -54.6201 },
      'Cuiabá': { lat: -15.5989, lng: -56.0949 },
      // Norte
      'Manaus': { lat: -3.1190, lng: -60.0217 },
      'Belém': { lat: -1.4558, lng: -48.4902 },
    };
    
    const cityCoords = coordinates[region.trim()];
    
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      throw new Error("APIFY_API_KEY is not configured");
    }
    
    // Build Apify request body - SINGLE CALL MODE (max 150 leads TOTAL)
    const MAX_TOTAL_LEADS = 150;
    // CRITICAL FIX: Divide max by number of search queries to ensure total never exceeds 150
    const numQueries = searchQueries.length;
    // Increase places per search for better coverage, minimum 15
    const placesPerSearch = Math.max(15, Math.ceil(MAX_TOTAL_LEADS / numQueries));
    
    console.log(`📊 ${numQueries} search queries, requesting ${placesPerSearch} places each (max ${MAX_TOTAL_LEADS} total leads)`);
    
    // Map country codes to language for Apify
    const countryLanguages: { [key: string]: string } = {
      'BR': 'pt-BR',
      'PT': 'pt-PT',
      'ES': 'es',
      'AR': 'es',
      'CL': 'es',
      'CO': 'es',
      'MX': 'es',
      'PE': 'es',
      'UY': 'es',
      'PY': 'es',
      'BO': 'es',
      'EC': 'es',
      'VE': 'es',
      'US': 'en',
      'UK': 'en',
      'CA': 'en',
      'IT': 'it',
      'FR': 'fr',
      'DE': 'de',
      'JP': 'ja',
      'CN': 'zh',
      'OTHER': 'en',
    };
    
    const searchLanguage = countryLanguages[countryCode] || 'en';
    
    const apifyRequestBody: any = {
      searchStringsArray: searchQueries,
      maxCrawledPlacesPerSearch: placesPerSearch,
      language: searchLanguage,
      skipClosedPlaces: true,
    };
    
    // Add coordinates only for Brazil (we have Brazilian city coords)
    if (!isInternational && cityCoords) {
      apifyRequestBody.lat = cityCoords.lat;
      apifyRequestBody.lng = cityCoords.lng;
      console.log(`📍 Using coordinates: ${cityCoords.lat}, ${cityCoords.lng}`);
    } else {
      console.log(`📍 ${isInternational ? 'International search' : 'No coordinates found'} for ${region}, using region name search only`);
    }
    
    console.log(`🚀 Calling Apify with request body:`, JSON.stringify(apifyRequestBody, null, 2));
    
    // Use the official Google Maps Scraper actor (nwua9Gu5YrADL7ZDj) - more stable
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items?token=${APIFY_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyRequestBody),
      }
    );

    console.log(`📡 Apify response status: ${apifyResponse.status}`);

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
    console.log(`📊 Apify returned ${apifyResults.length} places (single API call)`);
    console.log(`📞 Total API calls: 1`);
    
    // CRITICAL FILTERING: Only exact region, valid phone, relevant business
    if (apifyResults.length > 0) {
      const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const regionLower = normalizeString(region.toLowerCase());
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
      
      // Large retail chains and e-commerce platforms to ALWAYS EXCLUDE (these are not real leads for salespeople)
      const alwaysExcludedChains = [
        'magazine luiza', 'magazineluiza', 'magalu', 'magazine luíza',
        'lojas americanas', 'americanas',
        'casas bahia',
        'ponto frio', 'pontofrio',
        'carrefour',
        'walmart',
        'extra hipermercado',
        'big bompreco',
        'amazon', 'amazon.com',
        'mercado livre', 'mercadolivre',
        'shopee',
        'aliexpress',
        'havan',
        'ri happy',
        'fast shop',
        'pernambucanas',
        'renner',
        'riachuelo',
        'c&a',
        'marisa',
        'centauro',
        'netshoes',
        'dafiti',
        'kabum',
        'submarino',
        'shoptime',
        'leroy merlin',
        'telhanorte',
        'sodimac',
        'tok stok', 'tok&stok',
        'etna',
        'mobly',
        'madeiramadeira',
      ];
      
      // NICHE CATEGORY KEYWORDS - Map each niche to its relevant keywords
      // If a lead doesn't match ANY keyword for the searched niche, it's irrelevant
      const nicheKeywords: { [key: string]: string[] } = {
        // Construção e Ferramentas
        'construtoras': ['construtora', 'construcao', 'construção', 'empreiteira', 'incorporadora', 'engenharia', 'obras', 'edificacao', 'edificação', 'contractor', 'builder', 'civil', 'construções'],
        'construtora': ['construtora', 'construcao', 'construção', 'empreiteira', 'incorporadora', 'engenharia', 'obras', 'edificacao', 'edificação', 'contractor', 'builder', 'civil', 'construções'],
        'materiais de construção': ['construcao', 'construção', 'material', 'cimento', 'tijolo', 'areia', 'ferro', 'madeira', 'piso', 'azulejo', 'tintas', 'hidraulica', 'deposito', 'home center', 'telha', 'argamassa', 'gesso', 'drywall', 'impermeabilizante'],
        'ferramentas': ['ferramenta', 'ferragem', 'parafuso', 'porca', 'chave', 'martelo', 'furadeira', 'serra', 'alicate', 'equipamento', 'maquina', 'máquina', 'tool', 'hardware'],
        'ferragens': ['ferragem', 'parafuso', 'porca', 'dobradica', 'dobradiça', 'puxador', 'fechadura', 'cadeado', 'gancho', 'suporte', 'hardware'],
        'materiais elétricos': ['eletric', 'elétric', 'fio', 'cabo', 'disjuntor', 'tomada', 'interruptor', 'luminaria', 'luminária', 'lampada', 'lâmpada', 'quadro eletrico', 'led', 'iluminacao', 'iluminação', 'eletrica', 'elétrica'],
        'chaveiro': ['chaveiro', 'chave', 'fechadura', 'cadeado', 'cofre', 'seguranca', 'segurança', 'copia', 'cópia', 'key'],
        
        // Agro
        'agropecuária': ['agro', 'rural', 'fazenda', 'semente', 'adubo', 'fertilizante', 'racao', 'ração', 'veterinar', 'animal', 'pecuaria', 'pecuária', 'agricola', 'agrícola', 'trator', 'implemento'],
        
        // Alimentação
        'supermercados': ['supermercado', 'mercado', 'mercearia', 'emporio', 'empório', 'minimercado', 'armazem', 'armazém', 'grocery', 'market'],
        'atacadistas de alimentos': ['atacado', 'atacadista', 'distribuidor', 'distribuidora', 'food service', 'alimento', 'bebida'],
        'padarias': ['padaria', 'panificadora', 'pao', 'pães', 'confeitaria', 'bolo', 'doce', 'bakery'],
        'restaurantes': ['restaurante', 'lanchonete', 'buffet', 'self service', 'comida', 'refeicao', 'refeição', 'almoco', 'almoço', 'jantar'],
        
        // Saúde
        'farmácias': ['farmacia', 'farmácia', 'drogaria', 'medicamento', 'remedio', 'remédio', 'manipulacao', 'manipulação', 'pharmacy', 'drug'],
        'clínicas': ['clinica', 'clínica', 'consultorio', 'consultório', 'medic', 'médic', 'saude', 'saúde', 'health', 'doutor', 'dr.'],
        'laboratórios': ['laboratorio', 'laboratório', 'analise', 'análise', 'exame', 'diagnostico', 'diagnóstico', 'lab'],
        
        // Automotivo
        'autopeças': ['autopeca', 'autopeça', 'peca', 'peça', 'carro', 'veiculo', 'veículo', 'automotiv', 'motor', 'freio', 'suspensao', 'suspensão', 'oleo', 'óleo', 'filtro'],
        'oficinas mecânicas': ['oficina', 'mecanica', 'mecânica', 'reparo', 'conserto', 'manutencao', 'manutenção', 'auto center', 'autocenter', 'garage'],
        
        // Têxtil
        'tecidos': ['tecido', 'malha', 'pano', 'fabric', 'algodao', 'algodão', 'poliester', 'poliéster', 'seda', 'linho'],
        'confecções': ['confeccao', 'confecção', 'roupa', 'vestuario', 'vestuário', 'moda', 'fashion', 'textil', 'têxtil'],
        'aviamentos': ['aviamento', 'armarinho', 'botao', 'botão', 'ziper', 'zíper', 'linha', 'agulha', 'fita', 'elastico', 'elástico'],
        
        // Pet
        'pet shop': ['pet', 'animal', 'cao', 'cão', 'cachorro', 'gato', 'racao', 'ração', 'banho', 'tosa', 'veterinar'],
        
        // Gráfica
        'gráfica': ['grafica', 'gráfica', 'impressao', 'impressão', 'print', 'banner', 'adesivo', 'placa', 'letreiro', 'comunicacao visual', 'comunicação visual', 'serigrafia', 'offset'],
        
        // Eletrônicos
        'eletrônicos': ['eletronico', 'eletrônico', 'celular', 'smartphone', 'computador', 'notebook', 'tablet', 'informatica', 'informática', 'tech', 'assistencia tecnica', 'assistência técnica'],
        
        // Móveis
        'móveis': ['movel', 'móvel', 'moveis', 'móveis', 'marcenaria', 'planejado', 'sofa', 'sofá', 'cama', 'armario', 'armário', 'mesa', 'cadeira', 'estante', 'furniture'],
        
        // Ótica
        'óticas': ['otica', 'ótica', 'oculos', 'óculos', 'lente', 'armacao', 'armação', 'oftalmolog', 'visao', 'visão', 'optical'],
        
        // Papelaria
        'papelaria': ['papelaria', 'papel', 'caderno', 'caneta', 'escolar', 'escritorio', 'escritório', 'office', 'material escolar'],
        
        // Joalheria
        'joalherias': ['joalheria', 'joia', 'jóia', 'ouro', 'prata', 'relogio', 'relógio', 'bijuteria', 'semi-joia', 'semijoia', 'jewelry', 'watch'],
        
        // Esporte
        'academias': ['academia', 'fitness', 'musculacao', 'musculação', 'crossfit', 'pilates', 'gym', 'treino', 'esporte', 'sport'],
        'clubes esportivos': ['clube', 'esporte', 'sport', 'quadra', 'piscina', 'tenis', 'tênis', 'futebol', 'natacao', 'natação'],
        'arenas de beach tennis': ['beach tennis', 'areia', 'quadra', 'arena', 'esporte'],
        
        // Transporte
        'transportadoras': ['transportadora', 'transporte', 'frete', 'carga', 'logistica', 'logística', 'entrega', 'mudanca', 'mudança'],
        
        // Indústrias
        'indústrias': ['industria', 'indústria', 'fabrica', 'fábrica', 'manufacturer', 'manufacturing', 'producao', 'produção', 'industrial'],
      };
      
      // Function to check if a lead is relevant to the searched niche
      function isRelevantToNiche(title: string, categoryName: string, categories: string[], searchedSegment: string): boolean {
        const allText = normalizeString(`${title} ${categoryName} ${categories.join(' ')}`.toLowerCase());
        const segmentNorm = normalizeString(searchedSegment.toLowerCase());
        
        // Find which niche keywords apply to this search
        let relevantKeywords: string[] = [];
        for (const [niche, keywords] of Object.entries(nicheKeywords)) {
          const nicheNorm = normalizeString(niche.toLowerCase());
          if (segmentNorm.includes(nicheNorm) || nicheNorm.includes(segmentNorm.split(',')[0].trim())) {
            relevantKeywords = [...relevantKeywords, ...keywords];
          }
        }
        
        console.log(`🔍 Niche check for "${title}": segment="${searchedSegment}", keywords found: ${relevantKeywords.length}`);
        
        // If we have specific keywords for this niche, the lead must match at least one
        if (relevantKeywords.length > 0) {
          const matches = relevantKeywords.some(keyword => allText.includes(keyword));
          if (!matches) {
            console.log(`   ❌ No keyword match in: ${allText.slice(0, 100)}...`);
          }
          return matches;
        }
        
        // If no specific keywords found, allow the lead (generic search)
        console.log(`   ✅ No niche filter - allowing lead`);
        return true;
      }
      
      console.log(`📊 Raw results from Apify BEFORE filtering: ${apifyResults.length}`);
      
      apifyResults = apifyResults.filter((place: any) => {
        const address = normalizeString((place.address || '').toLowerCase());
        const title = normalizeString((place.title || '').toLowerCase());
        const categoryName = normalizeString((place.categoryName || '').toLowerCase());
        const categories = (place.categories || []).map((cat: string) => normalizeString(cat.toLowerCase()));
        
        // 0. COMPREHENSIVE CLOSURE CHECK - MUST NOT be closed in any way
        // Check all possible closed indicators from Apify
        if (place.closed === true || 
            place.permanentlyClosed === true || 
            place.temporarilyClosed === true ||
            place.isAdvertisement === true ||
            place.businessStatus === 'CLOSED_PERMANENTLY' ||
            place.businessStatus === 'CLOSED_TEMPORARILY' ||
            place.status === 'CLOSED' ||
            place.operationalStatus === 'CLOSED_PERMANENTLY' ||
            place.operationalStatus === 'CLOSED_TEMPORARILY') {
          console.log(`🚫 Establishment closed (status flag): ${place.title}`);
          return false;
        }
        
        // Check opening hours for closure indicators
        const openingHours = place.openingHours || place.workingHours || '';
        const openingHoursLower = (typeof openingHours === 'string' ? openingHours : JSON.stringify(openingHours)).toLowerCase();
        if (openingHoursLower.includes('permanently closed') || 
            openingHoursLower.includes('fechado permanentemente') ||
            openingHoursLower.includes('encerrado')) {
          console.log(`🚫 Opening hours indicate closure: ${place.title}`);
          return false;
        }
        
        // Check if title or description indicates closure
        const closureIndicators = [
          'fechado', 'encerrado', 'closed', 'desativado', 'inativo', 
          'permanentemente fechado', 'temporarily closed', 'fechou', 
          'nao funciona mais', 'não funciona mais', 'extinto', 'desativada',
          'encerrou atividades', 'fechado definitivamente', 'out of business'
        ];
        if (closureIndicators.some(indicator => title.includes(indicator))) {
          console.log(`🚫 Title indicates closure: ${place.title}`);
          return false;
        }
        
        // Check description for closure indicators (safely handle objects)
        const descriptionRaw = place.description || place.additionalInfo || '';
        const descriptionStr = typeof descriptionRaw === 'string' ? descriptionRaw : JSON.stringify(descriptionRaw);
        const description = normalizeString(descriptionStr.toLowerCase());
        if (closureIndicators.some(indicator => description.includes(indicator))) {
          console.log(`🚫 Description indicates closure: ${place.title}`);
          return false;
        }
        
        // ALWAYS EXCLUDE large retail chains and e-commerce platforms
        if (alwaysExcludedChains.some(chain => title.includes(chain))) {
          console.log(`🚫 Large retail chain excluded: ${place.title}`);
          return false;
        }
        
        // NEW: SMART NICHE FILTERING - Check if lead is relevant to the searched niche
        if (!isRelevantToNiche(title, categoryName, categories, segmentLower)) {
          console.log(`🚫 Not relevant to niche "${segment}": ${place.title} (${categoryName})`);
          return false;
        }
        
        // 1. MUST have valid phone (QUALITY REQUIREMENT)
        if (!place.phone || place.phone.trim() === '') {
          console.log(`🚫 No phone: ${place.title}`);
          return false;
        }
        
        // 2. Location validation - Check if address contains region (more flexible for regions like "Vale do Itajaí")
        // Extract potential city names from region (can contain multiple cities)
        const regionParts = regionLower.split(/[,\s]+/).filter(part => part.length > 2);
        const hasMatchingLocation = regionParts.some(part => address.includes(part));
        
        // Be more flexible - only filter if address is completely unrelated to region
        if (!hasMatchingLocation && !address.includes(regionLower)) {
          console.log(`🚫 Location mismatch: ${place.title} at ${place.address} (region: ${region})`);
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
      
      // HARD LIMIT: Maximum 150 leads to control Apify costs
      if (apifyResults.length > MAX_TOTAL_LEADS) {
        console.log(`⚠️ Limiting from ${apifyResults.length} to ${MAX_TOTAL_LEADS} leads`);
        apifyResults = apifyResults.slice(0, MAX_TOTAL_LEADS);
      }
    }
    
    // If no results, return error - NO AI FALLBACK
    if (apifyResults.length === 0) {
      console.error('❌ No results from Google Maps after filtering');
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento encontrado em ${region}. Tente ajustar os filtros ou buscar em outra região.` 
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
      let emailFromWebsite = undefined;
      
      if (website !== 'Não disponível') {
        try {
          const socialMedia = await searchSocialMediaProfiles(place.title, region, website);
          instagram = socialMedia.instagram || instagram;
          instagramSource = socialMedia.instagram ? 'website' : 'none';
          facebook = socialMedia.facebook || facebook;
          whatsappBusiness = socialMedia.whatsappBusiness;
          emailFromWebsite = socialMedia.email;
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
      
      // Determine final email (prioritize Google Maps, fallback to website)
      const finalEmail = place.email || emailFromWebsite || 'Não disponível';
      
      // Calculate confidence (Google Maps data is highly reliable)
      let confidenceScore = 70; // Base score for verified Google Maps with phone
      if (phoneValid) confidenceScore += 15;
      if (website !== 'Não disponível') confidenceScore += 10;
      if (instagram !== 'Não disponível') confidenceScore += 5;
      if (finalEmail !== 'Não disponível') confidenceScore += 5;
      
      // Estimate company size based on reviews and rating (speculation)
      const reviewCount = place.reviewsCount || 0;
      const rating = place.totalScore || 0;
      
      let employeeCount: string;
      let companySize: string;
      let revenue: string;
      
      if (reviewCount > 500 || (reviewCount > 200 && rating >= 4.5)) {
        employeeCount = '50-200';
        companySize = 'Grande';
        revenue = 'R$ 2M - R$ 10M/ano';
      } else if (reviewCount > 100 || (reviewCount > 50 && rating >= 4.0)) {
        employeeCount = '20-50';
        companySize = 'Médio';
        revenue = 'R$ 500K - R$ 2M/ano';
      } else if (reviewCount > 20) {
        employeeCount = '5-20';
        companySize = 'Pequeno';
        revenue = 'R$ 100K - R$ 500K/ano';
      } else {
        employeeCount = '1-5';
        companySize = 'Micro';
        revenue = 'R$ 50K - R$ 100K/ano';
      }
      
      return {
        id: `gm-${place.placeId || Date.now()}-${index}`,
        name: place.title,
        address: place.address,
        phone: validatedPhone,
        phoneValid: phoneValid,
        email: finalEmail,
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
        employeeCount,
        companySize,
        revenue,
        openedDate: 'Estabelecido',
        reasons: [
          `Estabelecimento verificado no Google Maps em ${region}`,
          `Telefone validado: ${validatedPhone}`,
          `Região: ${region}`
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple phone validation
function validatePhone(phone: string): { valid: boolean; normalized: string; isWhatsApp: boolean } {
  if (!phone) return { valid: false, normalized: '', isWhatsApp: false };
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian format with country code (+55 XX 9XXXX-XXXX)
  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    // 13 digits with 9 after DDD = mobile = likely WhatsApp
    const isMobile = digitsOnly.length === 13 && digitsOnly.charAt(4) === '9';
    return { 
      valid: true, 
      normalized: `+${digitsOnly}`, 
      isWhatsApp: isMobile
    };
  }
  
  // Brazilian format without country code (XX 9XXXX-XXXX)
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    const normalized = `+55${digitsOnly}`;
    // 11 digits starting with 9 after DDD = mobile = likely WhatsApp
    const isMobile = digitsOnly.length === 11 && digitsOnly.charAt(2) === '9';
    return { 
      valid: true, 
      normalized, 
      isWhatsApp: isMobile
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

// Shared segment helpers for global search scaling
function normalizeSegmentText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBoostSegment(segment: string): boolean {
  const normalized = normalizeSegmentText(segment);
  const boostKeywords = [
    'industrias mecanicas',
    'distribuidores de material',
    'distribuidores de pessegos',
    'distribuidores de autopecas',
    'distribuidores de food service',
    'food service',
    'autopecas',
    'floriculturas',
    'garden center',
    'casa de utilidades',
    'metalurg',
    'usinag',
    'atacad',
    'distribuidor',
    'fornecedor',
    'fabrica',
    'industria',
  ];

  return boostKeywords.some((keyword) => normalized.includes(keyword));
}

// Generate search terms - OPTIMIZED for best results with fewer API calls
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  // Optimized category terms - prioritize most specific terms first
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': ['restaurante', 'churrascaria', 'restaurante self service', 'restaurante à la carte', 'restaurante almoço', 'bistrô'],
    'supermercados': ['supermercado', 'mercado', 'minimercado', 'mercearia', 'supermercado atacado', 'mercadinho'],
    'hipermercados': ['hipermercado', 'atacadão', 'atacarejo', 'makro', 'assaí'],
    'padarias': ['padaria', 'panificadora', 'padaria artesanal', 'padaria e confeitaria', 'casa de pães', 'panificação'],
    'panificadoras': ['panificadora', 'padaria', 'panificação', 'fábrica de pães'],
    'confeitarias': ['confeitaria', 'doceria', 'bolos', 'bolos decorados', 'cake designer', 'confeitaria artesanal'],
    'docerias': ['doceria', 'confeitaria', 'doces', 'brigadeiro', 'doces finos', 'casa de doces'],
    'indústrias de alimentos': ['indústria de alimentos', 'fábrica de alimentos', 'indústria alimentícia', 'alimentos industrializados', 'processamento de alimentos', 'indústria alimentar', 'fábrica de produtos alimentícios', 'indústria de alimentos e bebidas'],
    'lojas de pneus': ['loja de pneus', 'pneus', 'borracharia', 'centro automotivo pneus', 'pneu', 'recapagem', 'recauchutagem', 'pneus novos e usados', 'pneus para caminhão', 'pneus para carro', 'pneus para moto', 'comercial de pneus', 'casa de pneus', 'distribuidora de pneus', 'revenda de pneus'],
    'lojas de rodas esportivas': ['rodas esportivas', 'loja de rodas', 'rodas e pneus', 'rodas automotivas', 'rodas liga leve', 'rodas aro', 'rodas personalizadas', 'rodas importadas', 'rodas tsw', 'rodas krmai', 'roda esportiva', 'loja de rodas e acessórios', 'customização automotiva rodas', 'revenda de rodas'],
    'granjas': ['granja', 'granja avícola', 'avicultura', 'granja de ovos', 'granja de frangos', 'produção de ovos', 'avícola', 'granja de postura', 'granja de corte', 'avicultura de postura', 'avicultura de corte', 'granja de galinhas'],
    'indústrias de salgados': ['fábrica de salgados', 'salgaderia'],
    'salgadeiros': ['salgaderia', 'fábrica de salgados', 'salgados'],
    'empresas de gulla': ['gulla', 'guloseimas', 'doces industriais'],
    'pastelarias': ['pastelaria', 'pastel', 'pastelaria e lanchonete', 'casa de pastéis', 'pastel frito', 'pastelão'],
    'hamburguerias': ['hamburgueria', 'burger', 'hamburguer', 'hamburgueria artesanal', 'smash burger', 'burger house'],
    'esfiharias': ['esfiharia', 'esfiha', 'esfirra', 'comida árabe'],
    'hot dogs': ['hot dog', 'cachorro quente', 'lanchonete', 'dogão', 'hot dog gourmet'],
    'food trucks': ['food truck', 'comida de rua', 'food park', 'food trailer'],
    'churrascarias': ['churrascaria', 'churrasco', 'rodízio', 'rodízio de carnes', 'espetaria', 'casa de carnes'],
    'catering': ['catering', 'buffet', 'eventos', 'buffet de eventos', 'serviço de catering'],
    'casas de massas': ['casa de massas', 'massa fresca', 'restaurante italiano', 'cantina italiana', 'massas artesanais'],
    'materiais de construção': ['material de construção', 'home center', 'depósito de construção', 'loja de material de construção', 'casa de material', 'madeireira'],
    'ferramentas': ['ferramentas', 'ferragem'],
    'agropecuária': ['agropecuária', 'produtos rurais'],
    'farmácias': ['farmácia', 'drogaria'],
    'farmácias e drogarias': ['farmácia', 'drogaria', 'farmácia popular'],
    'pet shop': ['pet shop', 'petshop', 'pet center', 'loja de animais'],
    'pet shops': ['pet shop', 'petshop', 'pet center', 'loja de animais'],
    'loja de ração pet': ['loja de ração', 'ração pet', 'ração animal', 'ração para cães', 'ração para gatos', 'pet shop ração', 'agropet', 'casa de ração'],
    'lojas de cama, mesa e banho': ['cama mesa banho', 'enxoval', 'loja de enxovais', 'casa de enxovais', 'toalhas', 'lençóis', 'edredom', 'colchas', 'tapetes', 'cortinas', 'roupa de cama', 'artigos de cama', 'jogos de cama'],
    'lojas de utilidades domésticas': ['utilidades domésticas', 'artigos para casa', 'casa e cozinha', 'loja de panelas', 'artigos domésticos', 'loja de plásticos', 'utensílios domésticos', 'loja de casa', 'artigos para cozinha', 'bazar doméstico', 'artigos importados', 'utilidades importadas', 'produtos importados para casa', 'loja de importados', 'bazar importados', 'loja de presentes', 'artigos para o lar', 'loja de artigos para casa', 'casa e decoração', 'loja de organização', 'loja de banheiro e cozinha'],
    'lojas de utilidades': ['loja de utilidades', 'bazar', 'loja 1,99', 'loja de variedades', 'tudo a 10', 'loja de presentes', 'armarinho', 'loja de R$', 'loja de 1 real', 'loja de desconto', 'loja popular', 'loja de importados', 'utilidades importadas', 'bazar importados', 'loja chinesa', 'produtos importados', 'tudo a 1 real', 'loja a partir de', 'loja multi', 'loja de brinde', 'brindes e presentes'],
    'utilidades domésticas': ['utilidades domésticas', 'artigos para casa', 'casa e cozinha', 'loja de panelas', 'artigos domésticos', 'utensílios domésticos', 'bazar doméstico', 'artigos importados', 'utilidades importadas', 'bazar importados', 'loja de importados'],
    'cama mesa e banho': ['cama mesa banho', 'enxoval', 'loja de enxovais', 'casa de enxovais', 'toalhas', 'lençóis', 'edredom'],
    // Têxtil e Uniformes - OTIMIZADO
    'fábricas de uniformes': ['fábrica de uniformes', 'confecção de uniformes', 'indústria de uniformes', 'uniformes profissionais', 'uniformes escolares', 'uniformes corporativos', 'uniformes industriais', 'uniformes esportivos', 'malharia uniformes', 'confecção profissional'],
    'confecção de roupas profissionais': ['confecção roupas profissionais', 'uniformes profissionais', 'roupas de trabalho', 'epi vestuário', 'jalecos', 'aventais profissionais', 'macacões', 'roupas industriais', 'vestimenta profissional', 'fardamento', 'jaleco hospitalar', 'scrubs médicos'],
    'lojas de tecidos': ['loja de tecidos', 'casa de tecidos', 'tecidos metro', 'armarinho de tecidos', 'comércio de tecidos', 'tecidos decoração', 'tecidos para cortinas', 'tecidos para estofados', 'tecidos para móveis', 'malhas', 'tecidos finos', 'loja de malha', 'atacado de tecidos'],
    'lojas de tapeçaria, cortinas e persianas': ['tapeçaria', 'cortinas', 'persianas', 'loja de cortinas', 'loja de persianas', 'persianista', 'cortineiro', 'decoração de janelas', 'blackout', 'cortinas sob medida', 'persianas horizontais', 'persianas verticais', 'cortinas e persianas', 'rolô', 'persiana romana', 'loja de tapetes', 'tapetaria'],
    // Embalagens - OTIMIZADO  
    'distribuidoras de embalagens': ['distribuidora de embalagens', 'embalagens plásticas', 'embalagens descartáveis', 'embalagens para alimentos', 'atacado embalagens', 'fábrica de embalagens', 'embalagens industriais', 'caixas de papelão', 'embalagens delivery', 'sacolas plásticas', 'bobinas plásticas', 'filme stretch', 'embalagens flexíveis', 'descartáveis plásticos'],
    // Metal e Siderurgia - OTIMIZADO PARA VOLUME
    'metalúrgicas': ['metalúrgica', 'metalurgica', 'indústria metalúrgica', 'fundição', 'usinagem', 'caldeiraria', 'serralheria industrial', 'metalurgia', 'tornearia', 'ferramentaria', 'estamparia', 'corte e dobra', 'indústria de metal', 'trabalho em metal', 'forjaria', 'tratamento de metais', 'zincagem', 'galvanização', 'cromação', 'pintura industrial', 'repuxo', 'conformação de metais', 'eletroerosão', 'puncionadeira', 'laser metal'],
    'siderúrgicas': ['siderúrgica', 'siderurgica', 'siderurgia', 'aço', 'ferro gusa', 'laminação', 'aciaria', 'beneficiamento de aço', 'trefilação', 'perfilados de aço', 'chapas de aço', 'distribuidor de aço', 'corte de aço', 'usina siderúrgica', 'arames de aço', 'vergalhão', 'bobinas de aço', 'ferro e aço', 'metalon', 'tubo de aço'],
    'empresas de solda': ['solda', 'soldagem', 'caldeiraria', 'soldador', 'empresa de solda', 'soldas industriais', 'solda mig', 'solda tig', 'montagem industrial', 'estruturas metálicas', 'serralheria', 'solda elétrica', 'solda oxiacetilênica', 'serviços de soldagem', 'manutenção industrial solda', 'soldas especiais', 'soldagem industrial', 'recuperação de peças', 'soldas em geral'],
    'caldeirarias': ['caldeiraria', 'caldeireiro', 'caldeiras', 'vasos de pressão', 'tubulação industrial', 'montagem industrial', 'estruturas metálicas', 'fabricação de tanques', 'reservatórios metálicos', 'silos metálicos', 'dutos industriais', 'caldeiraria pesada', 'caldeiraria leve', 'fabricação de equipamentos', 'montagem mecânica', 'tubulações', 'tanques de aço'],
    'usinagens': ['usinagem', 'tornearia', 'fresadora', 'torno cnc', 'usinagem cnc', 'retífica', 'ferramentaria', 'peças usinadas', 'centro de usinagem', 'torno mecânico', 'fresagem', 'usinagem de precisão', 'peças sob encomenda', 'usinagem em geral', 'serviços de usinagem', 'tornearia mecânica', 'mandrilhamento', 'brunimento', 'balanceamento', 'torno automático', 'torno convencional'],
    'estruturas metálicas': ['estruturas metálicas', 'estrutura metálica', 'galpão metálico', 'cobertura metálica', 'montagem estrutural', 'serralheria industrial', 'steel frame', 'mezanino metálico', 'escadas metálicas', 'passarelas metálicas', 'portões industriais', 'grades metálicas', 'gradis', 'estrutura de aço', 'construção metálica', 'montagem de galpão', 'barracão metálico', 'serralheria de obras'],
    'empresas de steel frame': ['steel frame', 'construtora steel frame', 'construção steel frame', 'montagem steel frame', 'casa steel frame', 'estrutura steel frame', 'construção a seco', 'light steel frame', 'steel framing', 'casa em steel frame', 'obra steel frame', 'empresa steel frame', 'fabricante steel frame', 'perfil steel frame', 'construção industrializada', 'construção modular'],
    'construtoras de pré-moldado': ['pré-moldado', 'pré moldado', 'construtora pré-moldado', 'empresa pré-moldado', 'galpão pré-moldado', 'estrutura pré-moldada', 'construção pré-moldada', 'fábrica pré-moldado', 'artefatos de concreto', 'lajes pré-moldadas', 'pilares pré-moldados', 'vigas pré-moldadas', 'concreto pré-moldado', 'pré-fabricado', 'construção pré-fabricada', 'galpão pré-fabricado', 'barracão pré-moldado', 'muros pré-moldados', 'postes pré-moldados', 'blocos de concreto'],
    'fabricantes de máquinas e equipamentos': ['fábrica de máquinas', 'fabricante de equipamentos', 'máquinas industriais', 'equipamentos industriais', 'indústria de máquinas', 'máquinas e equipamentos', 'fabricante de máquinas', 'equipamentos sob medida', 'máquinas especiais', 'automação industrial', 'linha de produção', 'equipamentos para indústria', 'máquinas para alimentos', 'máquinas para embalagem', 'equipamentos metalúrgicos', 'máquinas agrícolas', 'implementos', 'fabricação de equipamentos'],
    'lojas de roupas': ['loja de roupas', 'vestuário', 'boutique', 'moda'],
    'autopeças': ['autopeças', 'auto peças', 'loja de autopeças', 'casa de autopeças', 'peças automotivas', 'peças para carros', 'peças para veículos', 'auto center', 'retífica de motores', 'peças de reposição', 'rolamentos', 'auto elétrica', 'peças para caminhão', 'peças para moto', 'acessórios automotivos', 'peças e acessórios', 'peças para carro', 'freios', 'suspensão automotiva', 'amortecedores', 'filtros automotivos', 'escapamentos', 'radiadores', 'embreagem', 'correias', 'velas de ignição', 'baterias automotivas', 'pneus e rodas', 'motor de arranque', 'alternador'],
    'distribuidores de autopeças': ['distribuidora de autopeças', 'distribuidor de autopeças', 'atacado de autopeças', 'distribuidora de peças automotivas', 'atacado peças automotivas', 'distribuidor peças para veículos', 'atacadista de autopeças', 'distribuidora de peças para carros', 'distribuidora de peças para caminhões', 'importadora de autopeças', 'fornecedor de autopeças', 'distribuidora de peças', 'peças importadas', 'autopeças importadas', 'peças genuínas', 'peças originais', 'atacado de peças'],
    'eletrônicos': ['eletrônicos', 'informática', 'loja de eletrônicos', 'assistência técnica eletrônica'],
    'móveis': ['móveis', 'móveis planejados', 'loja de móveis', 'marcenaria'],
    'óticas': ['ótica', 'óculos', 'loja de óculos', 'óptica'],
    'joalherias': ['joalheria', 'joias', 'relojoaria', 'bijuteria'],
    'academias': ['academia', 'fitness', 'musculação', 'crossfit'],
    'salões de beleza': ['salão de beleza', 'cabeleireiro', 'barbearia', 'estética'],
    'hotéis': ['hotel', 'pousada', 'hospedagem', 'resort'],
    'hotéis e pousadas': ['hotel', 'pousada', 'hospedagem', 'resort'],
    'clínicas': ['clínica', 'consultório', 'clínica médica', 'consultório médico'],
    'clínicas médicas e odontológicas': ['clínica médica', 'clínica odontológica', 'consultório médico', 'consultório odontológico'],
    'hospitais e pronto-atendimentos': ['hospital', 'pronto atendimento', 'upa', 'pronto-socorro'],
    'laboratórios e centros de diagnóstico': ['laboratório', 'análises clínicas', 'centro de diagnóstico', 'diagnóstico por imagem'],
    'clínicas de fisioterapia e reabilitação': ['fisioterapia', 'clínica de reabilitação', 'reabilitação', 'fisioterapeuta'],
    'ortopedias e lojas de produtos ortopédicos': ['ortopedia', 'produtos ortopédicos', 'órteses e próteses', 'loja ortopédica'],
    'distribuidoras de produtos hospitalares': ['distribuidora hospitalar', 'produtos hospitalares', 'materiais hospitalares', 'distribuidor hospitalar', 'material médico', 'produtos médicos'],
    'transportadoras': ['transportadora', 'empresa de transporte', 'logística', 'transportes', 'frete', 'mudanças', 'encomendas', 'cargas', 'courier', 'entrega rápida'],
    'frotistas': ['frotista', 'gestão de frota', 'frota'],
    'empresas com frota própria': ['frota própria', 'empresa frota', 'veículos próprios'],
    'empresas de logística': ['logística', 'operador logístico', 'armazenagem', 'centro de distribuição'],
    'locadoras de veículos': ['locadora de veículos', 'aluguel de carros', 'rent a car', 'locação de veículos'],
    'gráficas': ['gráfica', 'comunicação visual'],
    'construtoras': ['construtora', 'construção civil', 'empreiteira', 'incorporadora', 'engenharia civil', 'obras', 'edificações'],
    'montadores de painel elétrico': ['montador de painel elétrico', 'painel elétrico', 'quadro elétrico', 'montagem de painéis', 'painéis elétricos', 'quadros de comando', 'quadro de distribuição'],
    'empresas de automação industrial': ['automação industrial', 'empresa de automação', 'automação', 'clp', 'instrumentação industrial', 'controle industrial', 'integração de sistemas'],
    'instaladores elétricos': ['instalador elétrico', 'instalação elétrica', 'eletricista', 'empresa de instalação elétrica', 'serviços elétricos', 'manutenção elétrica', 'projetos elétricos'],
    'empresas de manutenção elétrica': ['manutenção elétrica', 'manutenção industrial elétrica', 'reparo elétrico', 'serviços elétricos', 'elétrica industrial', 'manutenção preventiva elétrica'],
    'empresas de energia solar': ['energia solar', 'solar fotovoltaica', 'painel solar', 'placa solar', 'sistema fotovoltaico', 'usina solar', 'instalação solar', 'geração distribuída'],
    'indústrias que montam ou reformam painéis': ['montagem de painéis', 'reforma de painéis', 'painel elétrico industrial', 'quadro de comando', 'ccm', 'centro de controle de motores', 'painéis de força', 'montagem elétrica industrial'],
    'escritórios de arquitetura': ['escritório de arquitetura', 'arquiteto', 'estúdio de arquitetura', 'arquitetura e urbanismo'],
    'fabricantes de esquadrias de alumínio': ['esquadrias de alumínio', 'fábrica de esquadrias alumínio', 'esquadria alumínio', 'janelas de alumínio', 'portas de alumínio'],
    'fabricantes de esquadrias de madeira': ['esquadrias de madeira', 'fábrica de esquadrias madeira', 'marcenaria esquadrias', 'janelas de madeira', 'portas de madeira'],
    'lojas de revestimentos': ['loja de revestimentos', 'revestimentos cerâmicos', 'porcelanato', 'pisos e revestimentos', 'loja de pisos', 'cerâmica revestimento'],
    'lojas de portas': ['loja de portas', 'portas e janelas', 'portas de madeira', 'portas de aço', 'portas e fechaduras', 'comércio de portas'],
    'cozinhas industriais': ['cozinha industrial', 'refeição coletiva'],
    'indústrias de biscoitos': ['fábrica de biscoitos', 'indústria de biscoitos', 'biscoitaria'],
    'distribuidoras de doces': ['distribuidora de doces', 'atacado de doces', 'distribuidor de doces', 'doces atacado'],
    'indústrias de produtos pet': ['fábrica de ração', 'indústria pet', 'fábrica de produtos pet', 'indústria de ração animal', 'fábrica de petiscos para animais'],
    'fabricantes de ração pet': ['fábrica de ração', 'fábrica de ração pet', 'fábrica de ração animal', 'indústria de ração', 'fabricante de ração', 'ração animal fábrica', 'indústria pet food', 'fábrica de petiscos pet', 'fábrica de snacks pet'],
    'banho e tosa': ['banho e tosa', 'pet grooming', 'tosador', 'banho pet', 'estética animal', 'estética pet', 'grooming pet'],
    'hotéis pet': ['hotel pet', 'hotel para cães', 'hotel para animais', 'hospedagem pet', 'hospedagem animal', 'hotel canino', 'day care pet', 'hotelzinho pet'],
    'creches pet': ['creche pet', 'creche para cães', 'day care pet', 'creche canina', 'creche animal', 'day care canino'],
    'adestramento de animais': ['adestramento', 'adestrador', 'adestramento de cães', 'treinamento canino', 'escola de adestramento', 'adestramento pet', 'comportamento animal'],
    'abatedouros de aves': [
      'abatedouro de aves', 'abatedouro de frango', 'frigorífico de aves', 'abate de aves', 'matadouro de aves', 'frigorífico avícola', 'processamento de aves', 'abatedouro avícola',
      'avícola', 'granja de abate', 'granja avícola', 'abatedouro de frangos', 'frigorífico de frangos', 'indústria avícola', 'abatedouro de peru', 'abatedouro de codorna',
      'processamento de frango', 'abate de frango', 'cortes de frango', 'frango abatido', 'abatedouro de galinha', 'frigorífico de galinha',
      'avicultura de corte', 'avicultura', 'abatedouro de peito de frango', 'processamento avícola', 'industrialização de aves',
      'frigorífico de carne de frango', 'sala de abate de aves', 'planta de abate de aves', 'unidade de abate avícola',
      'abatedouro de patos', 'abatedouro de chester', 'abatedouro de aves caipiras', 'frango caipira abate'
    ],
    'abatedouros de bovinos': [
      'abatedouro de bovinos', 'abatedouro de boi', 'frigorífico de bovinos', 'abate de bovinos', 'matadouro de boi', 'frigorífico bovino', 'abatedouro de gado',
      'frigorífico de carne bovina', 'matadouro bovino', 'abatedouro de novilho', 'abate de gado', 'processamento de carne bovina',
      'abatedouro de búfalo', 'frigorífico de boi', 'sala de abate bovino', 'planta frigorífica bovina', 'desossa bovina',
      'indústria de carne bovina', 'abatedouro municipal bovino', 'unidade de abate bovino', 'charqueada', 'jerked beef'
    ],
    'abatedouros de suínos': [
      'abatedouro de suínos', 'abatedouro de porco', 'frigorífico de suínos', 'abate de suínos', 'matadouro de suínos', 'frigorífico suíno',
      'frigorífico de carne suína', 'matadouro de porco', 'processamento de suínos', 'indústria de suínos', 'suinocultura abate',
      'sala de abate suíno', 'planta frigorífica suína', 'desossa suína', 'abatedouro de leitão', 'embutidos e abate'
    ],
    'abatedouros e frigoríficos': [
      'abatedouro', 'frigorífico', 'matadouro', 'abate', 'abatedouro municipal', 'frigorífico industrial', 'sala de abate', 'processamento de carnes',
      'frigorífico de carnes', 'indústria frigorífica', 'planta de abate', 'unidade frigorífica', 'câmara fria abate',
      'abatedouro de animais', 'matadouro municipal', 'frigorífico regional', 'abatedouro industrial', 'abate e processamento',
      'SIF abatedouro', 'SIE abatedouro', 'inspeção federal abate', 'abatedouro com SIF', 'abatedouro certificado'
    ],
    'agência de eventos': ['agência de eventos', 'organizadora de eventos', 'empresa de eventos', 'produtora de eventos', 'buffet e eventos', 'cerimonial'],
    'distribuidores de frios': ['distribuidora de frios', 'distribuidor de frios', 'laticínios atacado', 'frios e laticínios', 'frigorífico distribuidor'],
    'cestas básicas': ['cestas básicas', 'cesta básica'],
    'lanchonetes': ['lanchonete', 'hamburgueria'],
    'pizzarias': ['pizzaria', 'pizza', 'pizzaria delivery', 'rodízio de pizza', 'pizza artesanal', 'pizzaria tradicional'],
    'oficinas mecânicas': ['oficina mecânica', 'auto center', 'funilaria', 'mecânica automotiva'],
    'postos de combustível': ['posto de combustível', 'posto de gasolina', 'posto de abastecimento', 'combustíveis'],
    'escolas': ['escola', 'colégio', 'instituto de ensino', 'centro educacional'],
    'papelarias': ['papelaria', 'livraria', 'material escolar', 'loja de papelaria'],
    'atacadistas': ['atacadista', 'atacado', 'atacadão', 'distribuidor atacado'],
    'distribuidoras': ['distribuidora', 'distribuidor', 'distribuição', 'distribuidora de produtos'],
    'distribuidores de food service': [
      'distribuidor food service', 'distribuidora food service', 'distribuidor de food service',
      'atacado food service', 'atacadista food service', 'food service distribuidor',
      'distribuidor para restaurantes', 'distribuidora para restaurantes', 'atacado para restaurantes',
      'distribuidor para bares e restaurantes', 'distribuidora horeca', 'distribuidor horeca',
      'fornecedor food service', 'fornecedor para restaurantes', 'fornecedor para bares',
      'distribuidor de alimentos food service', 'atacado alimentos food service',
      'distribuidor de insumos para restaurantes', 'distribuidor de produtos para gastronomia',
      'distribuidora de alimentos para restaurantes', 'atacado para food service',
      'distribuidor de descartáveis food service', 'distribuidor de embalagens food service',
      'distribuidor de produtos para cozinha profissional', 'distribuidor de equipamentos food service',
      'distribuidor de congelados food service', 'distribuidor de porcionados',
      'distribuidor de alimentos congelados para restaurantes', 'atacado para pizzarias',
      'atacado para lanchonetes', 'atacado para padarias', 'distribuidor de molhos',
      'distribuidor de temperos', 'fornecedor de ingredientes', 'atacado de ingredientes',
      'distribuidor de frios food service', 'distribuidor de laticínios food service',
      'cash and carry food service', 'atacarejo food service'
    ],
    'atacadistas de food service': ['atacadista food service', 'atacado food service', 'atacado restaurantes', 'atacado para bares', 'atacado gastronomia', 'cash and carry', 'atacarejo food service'],
    'distribuidores de alimentos': ['distribuidora de alimentos', 'distribuidor de alimentos', 'atacado alimentos', 'alimentos atacado'],
    'distribuidores de bebidas': ['distribuidora de bebidas', 'distribuidor de bebidas', 'atacado bebidas', 'bebidas atacado', 'depósito de bebidas'],
    'distribuidores de água': ['distribuidora de água', 'distribuidor de água', 'água mineral distribuidora', 'depósito de água', 'distribuidora de água mineral'],
    'distribuidores de refrigerantes': ['distribuidora de refrigerantes', 'distribuidor de refrigerantes', 'depósito de refrigerantes', 'distribuidora de bebidas refrigerantes', 'atacado de refrigerantes'],
    'distribuidores de cervejas': ['distribuidora de cervejas', 'distribuidor de cervejas', 'depósito de cerveja', 'distribuidora de cerveja artesanal', 'atacado de cervejas'],
    'artigos de caça, pesca e camping': ['loja de pesca', 'artigos de pesca', 'caça e pesca', 'camping', 'loja de camping', 'artigos de camping', 'pesca esportiva', 'loja de caça'],
    'lojas de materiais elétricos': ['loja de materiais elétricos', 'material elétrico', 'casa de elétrica', 'distribuidora elétrica', 'componentes elétricos'],
    'empresas de energia solar': ['energia solar', 'solar fotovoltaica', 'instalação solar', 'empresa de energia solar', 'painel solar'],
    'distribuidores de aço e ferro': ['distribuidora de aço', 'distribuidor de ferro', 'ferro e aço', 'depósito de ferro', 'comércio de aço', 'distribuidora de ferro', 'aço e ferro', 'distribuidora de metais', 'ferro para construção', 'vergalhão', 'chapas de aço', 'metalon', 'tubo de aço', 'perfilados', 'cantoneira', 'viga de aço', 'barra de ferro'],
    'distribuidores de material médico hospitalar': ['distribuidora de material hospitalar', 'distribuidor de material hospitalar', 'distribuidora de material médico', 'distribuidor de material médico', 'distribuidora hospitalar', 'material médico hospitalar', 'produtos médicos hospitalares', 'distribuidora de equipamentos hospitalares', 'distribuidora de insumos hospitalares', 'distribuidora de descartáveis hospitalares', 'distribuidora de medicamentos', 'atacado hospitalar', 'distribuidora de produtos cirúrgicos', 'material cirúrgico', 'distribuidora de ortopédicos', 'equipamentos médicos', 'distribuidora de EPIs hospitalares', 'distribuidora de luvas', 'distribuidora de seringas', 'distribuidora de curativos', 'distribuidora de sondas', 'distribuidora de cateteres', 'distribuidora de próteses', 'distribuidora de órteses', 'distribuidora de materiais de laboratório', 'distribuidora de reagentes', 'distribuidora de produtos para saúde', 'fornecedor hospitalar', 'suprimentos hospitalares', 'insumos médicos', 'materiais de enfermagem', 'distribuidora de oxigênio medicinal', 'gases medicinais', 'distribuidora de produtos odontológicos médicos', 'distribuidora OPME'],
    'distribuidores de pêssegos': ['distribuidora de pêssegos', 'distribuidor de pêssegos', 'atacado de pêssegos', 'pêssego atacado', 'distribuidora de pêssego', 'packing house pêssego', 'beneficiadora de pêssegos', 'exportadora de pêssegos', 'produtor de pêssegos', 'pêssego in natura', 'pêssego para indústria', 'polpa de pêssego', 'processadora de pêssego', 'conserva de pêssego', 'fábrica de conserva de pêssego', 'indústria de pêssego', 'pêssego em calda', 'cultivo de pêssego', 'pomar de pêssego', 'fruticultura pêssego', 'cooperativa de pêssegos', 'pêssego distribuidor', 'venda de pêssego', 'comércio de pêssego'],
    'serralherias': ['serralheria', 'serralheiro', 'portões', 'grades', 'esquadrias metálicas', 'estruturas metálicas', 'portão de ferro', 'grade de ferro', 'corrimão', 'escada de ferro', 'serralheria artística', 'serralheria industrial', 'portão automático', 'gradil', 'portão basculante'],
    // Cartonagem
    'cartonagem': ['cartonagem', 'caixas de papelão', 'embalagens de papelão', 'fábrica de caixas', 'indústria de caixas', 'caixas cartonadas', 'papelão ondulado', 'cartonaria', 'embalagem cartonada', 'caixa de papelão', 'embalagem de papel cartão', 'papel cartão'],
    // Comida Japonesa / Oriental / Sushi / Chinesa
    'restaurantes japoneses': ['restaurante japonês', 'comida japonesa', 'culinária japonesa', 'sushi', 'sashimi', 'temaki', 'yakisoba', 'teppanyaki', 'izakaya', 'ramen', 'udon', 'japanese restaurant', 'japa'],
    'sushi bars': ['sushi bar', 'sushi', 'sushiman', 'sushi delivery', 'sushi express', 'sushi house', 'sushi place', 'rodízio de sushi', 'sushi rotativo', 'japa'],
    'restaurantes orientais': ['restaurante oriental', 'comida oriental', 'culinária oriental', 'comida chinesa', 'restaurante chinês', 'comida tailandesa', 'comida coreana', 'restaurante asiático', 'wok', 'dim sum', 'yakisoba'],
    'restaurantes chineses': ['restaurante chinês', 'comida chinesa', 'culinária chinesa', 'chinese restaurant', 'china in box', 'china box', 'wok', 'dim sum', 'chop suey', 'chow mein', 'yakisoba chinês', 'rolinho primavera', 'comida asiática'],
    'temakerias': ['temakeria', 'temaki', 'temaki delivery', 'hand roll', 'sushi temaki', 'temaki bar'],
    // Presentes de alto padrão
    'lojas de presentes de alto padrão': ['loja de presentes', 'presentes finos', 'presentes de luxo', 'gift shop', 'loja de presentes importados', 'presentes corporativos', 'artigos de luxo', 'loja de decoração', 'cristais', 'porcelana fina', 'presentes sofisticados', 'loja de presentes premium'],
    // Perfumarias
    'perfumarias': ['perfumaria', 'perfume', 'loja de perfumes', 'fragrâncias', 'cosméticos e perfumes', 'importados perfumes', 'perfumaria importada', 'loja de cosméticos', 'beleza e perfumaria', 'casa de perfumes', 'essências', 'aromatizadores'],
    // Restaurantes Premium
    'restaurantes premium': ['restaurante premium', 'restaurante fino', 'restaurante de luxo', 'gastronomia', 'haute cuisine', 'fine dining', 'bistrô', 'chef', 'restaurante gourmet', 'restaurante sofisticado', 'alta gastronomia', 'restaurante executivo'],
    // Buffets de Festas
    'buffets de festas': ['buffet de festas', 'buffet infantil', 'espaço para eventos', 'salão de festas', 'casa de festas', 'buffet', 'eventos e festas', 'cerimonial', 'festa infantil', 'decoração de festas', 'buffet casamento'],
    // Locação de materiais para eventos
    'empresas de locação de materiais para eventos': ['locação de materiais para eventos', 'aluguel de mesas e cadeiras', 'locação de toalhas', 'aluguel de louças', 'locação para festas', 'aluguel de tendas', 'locação de equipamentos para eventos', 'aluguel de mobiliário', 'locação de som e iluminação', 'aluguel de decoração'],
    // Indústrias de Mineração
    'indústrias de mineração': ['mineração', 'mineradora', 'mina', 'extração mineral', 'indústria de mineração', 'minério', 'beneficiamento mineral', 'lavra', 'garimpo', 'pedreira', 'britagem', 'extração de areia', 'cascalho', 'minerais', 'jazida'],
    // Indústrias Sucroalcooleiras
    'indústrias sucroalcooleiras': ['usina de açúcar', 'usina de etanol', 'sucroalcooleira', 'usina sucroalcooleira', 'destilaria', 'cana-de-açúcar', 'indústria sucroalcooleira', 'usina de álcool', 'usina de cana', 'bioenergia', 'cogeração', 'bagaço de cana', 'açúcar e álcool'],
    // Autopeças de Vans e Utilitários
    'autopeças de vans e utilitários': ['autopeças van', 'peças para van', 'peças para utilitários', 'peças fiat ducato', 'peças sprinter', 'peças master', 'peças iveco', 'peças para furgão', 'peças para veículos utilitários', 'autopeças importadas', 'peças para veículos importados', 'peças land rover', 'peças bmw', 'peças mercedes', 'autopeças para vans', 'peças para hr', 'peças para bongo'],
    // E-commerces de Peças Automotivas
    'e-commerces de peças automotivas': ['loja online autopeças', 'e-commerce autopeças', 'autopeças online', 'peças automotivas online', 'loja virtual autopeças', 'autopeças delivery', 'autopeças internet', 'peças para carro online', 'comprar autopeças'],
    // E-commerces de UD
    'e-commerces de utilidades domésticas': ['loja online utilidades domésticas', 'e-commerce casa e cozinha', 'utilidades domésticas online', 'artigos para casa online', 'loja virtual utilidades', 'panelas online', 'utensílios online', 'casa e decoração online'],
    // E-commerces de Perfumaria e Casa
    'e-commerces de perfumaria e casa': ['loja online perfumaria', 'e-commerce aromatizadores', 'perfumaria online', 'aromatizadores online', 'velas aromáticas online', 'home spray', 'difusor de ambiente', 'perfumaria de casa online', 'loja virtual perfumaria'],
    // E-commerces de Sabonetes
    'e-commerces de sabonetes': ['loja online sabonetes', 'e-commerce sabonetes artesanais', 'sabonetes online', 'sabonetes artesanais', 'cosméticos naturais online', 'sabonetes veganos', 'saboaria', 'saboaria artesanal', 'loja virtual sabonetes'],
    // E-commerces de Presentes Finos
    'e-commerces de presentes finos': ['loja online presentes', 'e-commerce presentes finos', 'presentes online', 'presentes de luxo online', 'gift shop online', 'presentes corporativos online', 'loja virtual presentes', 'presentes importados online'],
    // Novos segmentos
    'lojas de moda infantil': ['loja de moda infantil', 'roupa infantil', 'moda bebê', 'moda kids', 'loja infantil', 'roupa de criança', 'enxoval bebê', 'moda gestante e infantil'],
    'lojas de móveis': ['loja de móveis', 'móveis planejados', 'móveis sob medida', 'marcenaria', 'loja de móveis planejados', 'móveis para escritório', 'móveis para casa', 'loja de colchões e móveis'],
    'lojas de variedades': ['loja de variedades', 'bazar', 'loja 1,99', 'loja de R$', 'loja popular', 'loja de desconto', 'armarinho', 'loja de tudo', 'loja de utilidades'],
    'lojas de material esportivo': ['loja de esportes', 'material esportivo', 'artigos esportivos', 'loja de tênis', 'loja de fitness', 'equipamentos esportivos', 'loja de futebol', 'suplementos esportivos'],
    'lojas de celular': ['loja de celular', 'assistência técnica celular', 'loja de smartphone', 'acessórios para celular', 'capinhas de celular', 'conserto de celular', 'loja de telefonia'],
    'lojas de bicicleta': ['loja de bicicleta', 'bike shop', 'bicicletaria', 'ciclismo', 'loja de bikes', 'peças para bicicleta', 'oficina de bicicleta', 'loja de ciclismo'],
    'lojas de veículos elétricos': ['loja de veículos elétricos', 'patinete elétrico', 'bicicleta elétrica', 'scooter elétrica', 'moto elétrica', 'veículo elétrico', 'mobilidade elétrica', 'carro elétrico'],
    'lojas de autopropelidos': ['loja de autopropelidos', 'empilhadeira', 'máquinas autopropelidas', 'equipamentos de movimentação', 'transpaleteira', 'plataforma elevatória', 'empilhadeiras e paleteiras'],
    'lojas de moto': ['loja de moto', 'concessionária de motos', 'revenda de motos', 'moto peças', 'oficina de motos', 'acessórios para moto', 'capacetes', 'concessionária honda', 'concessionária yamaha'],
    'lojas de carro': ['loja de carros', 'concessionária', 'revenda de veículos', 'loja de veículos', 'seminovos', 'multimarcas', 'agência de automóveis', 'stand de carros'],
    'concessionárias': ['concessionária', 'concessionária de veículos', 'revenda autorizada', 'concessionária de carros', 'concessionária de motos', 'concessionária de caminhões'],
    'lojas de informática': ['loja de informática', 'computadores', 'notebook', 'periféricos', 'loja de tecnologia', 'assistência técnica', 'loja de games'],
    'lojas de calçados': ['loja de calçados', 'sapataria', 'loja de sapatos', 'loja de tênis', 'calçados femininos', 'calçados masculinos', 'calçados infantis'],
    'lojas de bolsas e acessórios': ['loja de bolsas', 'acessórios femininos', 'bolsas e malas', 'loja de malas', 'bolsas de couro', 'acessórios de moda'],
    'lojas de brinquedos': ['loja de brinquedos', 'brinquedos educativos', 'toy store', 'loja de brinquedos infantis', 'brinquedos e jogos'],
    'lojas de colchões': ['loja de colchões', 'colchões e estofados', 'colchoaria', 'loja de camas e colchões', 'colchões ortopédicos', 'casa de colchões', 'colchões magnéticos', 'colchões terapêuticos', 'colchões sob medida', 'colchões king size'],
    'revendedores de colchões': ['revendedor de colchões', 'revenda de colchões', 'representante de colchões', 'distribuidor de colchões', 'atacado de colchões', 'colchões atacado', 'colchões revenda', 'colchões no atacado'],
    'colchoarias': ['colchoaria', 'casa de colchões', 'colchões e travesseiros', 'colchões e camas', 'mundo dos colchões', 'rei dos colchões', 'center colchões', 'outlet de colchões', 'mega colchões'],
    'lojas de colchões terapêuticos': ['colchão terapêutico', 'colchão magnético', 'colchão ortopédico', 'colchão hospitalar', 'colchão pneumático', 'colchão anti-escaras', 'produtos ortopédicos colchão'],
    'distribuidores de colchões': ['distribuidora de colchões', 'distribuidor de colchões', 'atacadista de colchões', 'colchões atacado e varejo', 'colchões por atacado'],
    'lojas de eletrodomésticos': ['loja de eletrodomésticos', 'eletrodomésticos', 'loja de eletrônicos', 'magazine', 'loja de eletro', 'casa de eletro'],
    'lojas de cosméticos': ['loja de cosméticos', 'perfumaria', 'beleza', 'maquiagem', 'produtos de beleza', 'loja de maquiagem', 'cosméticos e perfumaria'],
    'sistemas de incêndio': ['sistema de incêndio', 'combate a incêndio', 'prevenção de incêndio', 'proteção contra incêndio', 'extintor', 'hidrante', 'sprinkler', 'alarme de incêndio', 'detector de fumaça', 'empresa de incêndio', 'projeto de incêndio', 'AVCB', 'CLCB', 'brigada de incêndio', 'mangueira de incêndio', 'central de alarme de incêndio', 'porta corta fogo'],
    'engenharias': ['escritório de engenharia', 'engenharia civil', 'engenharia elétrica', 'engenharia mecânica', 'empresa de engenharia', 'consultoria de engenharia', 'projetos de engenharia', 'engenharia ambiental', 'engenharia de produção', 'engenharia estrutural', 'cálculo estrutural', 'laudo técnico', 'perícia de engenharia', 'engenheiro', 'ART', 'engenharia e construção'],
    // 80 novos segmentos
    'clínicas de dermatologia': ['dermatologista', 'clínica de dermatologia', 'dermatologia', 'clínica dermatológica', 'médico dermatologista', 'dermatologia estética', 'consultório de dermatologia'],
    'clínicas de oftalmologia': ['oftalmologista', 'clínica de oftalmologia', 'oftalmologia', 'clínica oftalmológica', 'oculista', 'cirurgia ocular', 'exame de vista', 'óptica e oftalmologia'],
    'clínicas de cardiologia': ['cardiologista', 'clínica de cardiologia', 'cardiologia', 'consultório cardiológico', 'ecocardiograma', 'eletrocardiograma', 'teste ergométrico'],
    'clínicas de pediatria': ['pediatra', 'clínica de pediatria', 'pediatria', 'consultório pediátrico', 'médico infantil', 'clínica infantil'],
    'clínicas de ginecologia': ['ginecologista', 'clínica de ginecologia', 'ginecologia', 'obstetra', 'obstetrícia', 'consultório ginecológico', 'saúde da mulher'],
    'clínicas de urologia': ['urologista', 'clínica de urologia', 'urologia', 'consultório urológico', 'cirurgia urológica'],
    'clínicas de ortopedia': ['ortopedista', 'clínica de ortopedia', 'ortopedia', 'traumatologia', 'consultório ortopédico', 'fisioterapia ortopédica'],
    'clínicas de neurologia': ['neurologista', 'clínica de neurologia', 'neurologia', 'consultório neurológico', 'neurocirurgia', 'eletroencefalograma'],
    'clínicas de radiologia': ['clínica de radiologia', 'radiologia', 'centro de imagem', 'diagnóstico por imagem', 'raio-x', 'raio x', 'tomografia', 'ressonância magnética', 'ultrassonografia', 'mamografia', 'densitometria', 'clínica de imagem', 'radiologista', 'exames de imagem', 'ecografia', 'angiotomografia', 'clínica radiológica'],
    'laboratórios de análises clínicas': ['laboratório de análises clínicas', 'laboratório clínico', 'análises clínicas', 'exames laboratoriais', 'exames de sangue', 'hemograma', 'laboratório de patologia', 'laboratório de exames', 'coleta de exames', 'exames clínicos', 'laboratório médico', 'diagnóstico laboratorial', 'bioquímica clínica', 'microbiologia clínica', 'laboratório de análises'],
    'dentistas e consultórios odontológicos': ['dentista', 'consultório odontológico', 'clínica odontológica', 'odontologia', 'cirurgião dentista', 'implante dentário', 'ortodontia'],
    'próteses dentárias': ['prótese dentária', 'laboratório de prótese', 'prótese dental', 'dentadura', 'prótese fixa', 'prótese removível', 'implante dental'],
    'laboratórios de prótese dentária': ['laboratório de prótese dentária', 'protético', 'protético dental', 'laboratório dental', 'prótese dentária laboratório'],
    'distribuidoras de produtos odontológicos': ['distribuidora odontológica', 'produtos odontológicos', 'material odontológico', 'dental distribuidora', 'equipamentos odontológicos', 'insumos odontológicos'],
    'depósitos de materiais de construção': ['depósito de construção', 'depósito de materiais', 'material de construção atacado', 'armazém de construção', 'depósito de cimento', 'depósito de areia'],
    'lojas de tintas': ['loja de tintas', 'tintas e vernizes', 'casa de tintas', 'tintas imobiliárias', 'tintas automotivas', 'loja de tintas e acessórios', 'pinturas e tintas'],
    'lojas de pisos e azulejos': ['loja de pisos', 'loja de azulejos', 'pisos e revestimentos', 'cerâmica', 'porcelanato', 'loja de cerâmica', 'piso laminado', 'piso vinílico'],
    'lojas de iluminação': ['loja de iluminação', 'iluminação', 'loja de luminárias', 'iluminação residencial', 'iluminação comercial', 'LED', 'loja de luz'],
    'lojas de lustres e luminárias': ['loja de lustres', 'luminárias', 'lustres', 'pendentes', 'arandelas', 'plafons', 'lustres e luminárias'],
    'lojas de decoração': ['loja de decoração', 'decoração', 'casa e decoração', 'artigos de decoração', 'objetos de decoração', 'loja de design', 'home decor'],
    'design de interiores': ['design de interiores', 'designer de interiores', 'decoração de interiores', 'projeto de interiores', 'arquitetura de interiores', 'interiores'],
    'paisagismo e jardinagem': ['paisagismo', 'jardinagem', 'empresa de paisagismo', 'paisagista', 'jardineiro', 'manutenção de jardins', 'projetos de paisagismo'],
    'viveiros de plantas': ['viveiro de plantas', 'viveiro de mudas', 'horto', 'produção de mudas', 'plantas ornamentais', 'viveiro florestal'],
    'garden centers': ['garden center', 'centro de jardinagem', 'loja de plantas', 'loja de jardinagem', 'casa de plantas', 'floricultura e jardinagem', 'garden center plantas', 'garden center paisagismo', 'garden center flores', 'viveiro e garden', 'espaço verde', 'loja de jardim', 'garden shop', 'centro garden', 'casa de jardinagem', 'garden center mudas'],
    'garden center': ['garden center', 'centro de jardinagem', 'loja de plantas', 'loja de jardinagem', 'casa de plantas', 'floricultura e jardinagem', 'garden center plantas', 'garden center paisagismo', 'garden center flores', 'viveiro e garden', 'espaço verde', 'loja de jardim', 'garden shop', 'centro garden', 'casa de jardinagem', 'garden center mudas'],
    'floriculturas': ['floricultura', 'flores', 'loja de flores', 'casa de flores', 'arranjos florais', 'buquê', 'buquê de flores', 'florista', 'floricultura online', 'flores e plantas', 'flores naturais', 'arranjo de flores', 'coroa de flores', 'cestas de flores', 'decoração com flores', 'flores para eventos', 'flores para casamento', 'flower shop', 'garden floricultura', 'loja de plantas e flores', 'flores tropicais', 'rosas', 'orquídeas', 'flores e presentes', 'floricultura e presentes', 'floricultura e cestas'],
    'floricultura': ['floricultura', 'flores', 'loja de flores', 'casa de flores', 'arranjos florais', 'buquê', 'buquê de flores', 'florista', 'floricultura online', 'flores e plantas', 'flores naturais', 'arranjo de flores', 'coroa de flores', 'cestas de flores', 'decoração com flores', 'flores para eventos', 'flores para casamento', 'flower shop', 'garden floricultura', 'loja de plantas e flores', 'flores tropicais', 'rosas', 'orquídeas', 'flores e presentes', 'floricultura e presentes', 'floricultura e cestas'],
    'casas de utilidades': ['casa de utilidades', 'loja de utilidades', 'utilidades domésticas', 'artigos para casa', 'bazar', 'loja de variedades', 'loja 1,99', 'loja de R$', 'loja popular', 'armarinho', 'loja de presentes', 'bazar doméstico', 'loja de importados', 'utilidades importadas', 'loja chinesa', 'produtos importados', 'loja de tudo', 'loja multi', 'artigos domésticos', 'utensílios domésticos', 'casa e cozinha', 'loja de panelas', 'artigos para cozinha', 'loja de plásticos', 'loja de organização'],
    'casa de utilidades': ['casa de utilidades', 'loja de utilidades', 'utilidades domésticas', 'artigos para casa', 'bazar', 'loja de variedades', 'loja 1,99', 'loja de R$', 'loja popular', 'armarinho', 'loja de presentes', 'bazar doméstico', 'loja de importados', 'utilidades importadas', 'loja chinesa', 'produtos importados', 'loja de tudo', 'loja multi', 'artigos domésticos', 'utensílios domésticos', 'casa e cozinha', 'loja de panelas', 'artigos para cozinha', 'loja de plásticos', 'loja de organização'],
    'casas agropecuárias': ['casa agropecuária', 'agropecuária', 'loja agropecuária', 'produtos agropecuários', 'insumos agrícolas', 'agro pecuária'],
    'cooperativas agrícolas': ['cooperativa agrícola', 'cooperativa agropecuária', 'cooperativa rural', 'cooperativa de produtores', 'cooperativa de leite', 'cooperativa de grãos'],
    'revendas de insumos agrícolas': ['revenda de insumos', 'insumos agrícolas', 'defensivos agrícolas', 'fertilizantes', 'sementes', 'agroquímicos', 'adubo'],
    'revendas de máquinas agrícolas': ['revenda de máquinas agrícolas', 'tratores', 'implementos agrícolas', 'máquinas agrícolas', 'concessionária de tratores', 'john deere', 'massey ferguson'],
    'tratores e implementos agrícolas': ['trator', 'implementos agrícolas', 'máquinas agrícolas', 'equipamentos agrícolas', 'arado', 'plantadeira', 'colheitadeira'],
    'irrigação': ['irrigação', 'sistema de irrigação', 'empresa de irrigação', 'irrigação por gotejo', 'irrigação por pivô', 'equipamentos de irrigação', 'aspersores'],
    'silos e armazéns': ['silo', 'armazém', 'armazenagem de grãos', 'silo de grãos', 'armazém graneleiro', 'secador de grãos', 'unidade de armazenagem'],
    'frigoríficos': ['frigorífico', 'frigorífico industrial', 'câmara fria', 'câmara frigorífica', 'armazenagem frigorificada', 'frio industrial'],
    'laticínios': ['laticínio', 'indústria de laticínios', 'fábrica de laticínios', 'cooperativa de leite', 'processamento de leite', 'queijaria', 'iogurteria'],
    'queijarias': ['queijaria', 'fábrica de queijos', 'queijos artesanais', 'queijaria artesanal', 'indústria de queijos', 'produção de queijo'],
    'cervejarias': ['cervejaria', 'cervejaria artesanal', 'fábrica de cerveja', 'brewpub', 'microcervejaria', 'cerveja artesanal', 'produção de cerveja'],
    'vinícolas': ['vinícola', 'vinho', 'adega', 'produção de vinho', 'viticultura', 'enologia', 'vinhedos'],
    'destilarias': ['destilaria', 'fábrica de cachaça', 'alambique', 'produção de destilados', 'destilaria de cachaça', 'destilados artesanais'],
    'torrefadoras de café': ['torrefadora de café', 'torrefação', 'café torrado', 'indústria de café', 'torrefação de café', 'café artesanal', 'roaster'],
    'empresas de climatização': ['climatização', 'ar condicionado', 'empresa de ar condicionado', 'instalação de ar condicionado', 'manutenção de ar condicionado', 'HVAC', 'split'],
    'empresas de refrigeração industrial': ['refrigeração industrial', 'câmara fria', 'frio industrial', 'refrigeração comercial', 'empresa de refrigeração', 'equipamentos de refrigeração'],
    'empresas de ventilação industrial': ['ventilação industrial', 'exaustores', 'ventiladores industriais', 'sistema de exaustão', 'dutos de ventilação', 'climatização industrial'],
    'empresas de caldeiras e vapor': ['caldeira', 'caldeiras industriais', 'geração de vapor', 'caldeira a vapor', 'manutenção de caldeiras', 'vasos de pressão'],
    'empresas de compressores': ['compressor', 'compressores industriais', 'ar comprimido', 'compressor de ar', 'loja de compressores', 'empresa de compressores'],
    'empresas de bombas hidráulicas': ['bombas hidráulicas', 'bomba de água', 'bombeamento', 'empresa de bombas', 'bombas industriais', 'motobomba', 'bomba centrífuga'],
    'empresas de tratamento de água': ['tratamento de água', 'estação de tratamento', 'ETA', 'empresa de tratamento de água', 'água tratada', 'purificação de água', 'tratamento de efluentes'],
    'empresas de saneamento': ['saneamento', 'empresa de saneamento', 'esgoto', 'rede de esgoto', 'saneamento básico', 'fossa séptica', 'biodigestor'],
    'empresas de gestão de resíduos': ['gestão de resíduos', 'resíduos sólidos', 'coleta seletiva', 'aterro sanitário', 'tratamento de resíduos', 'gerenciamento de resíduos'],
    'empresas de coleta de lixo': ['coleta de lixo', 'empresa de limpeza urbana', 'coleta de resíduos', 'caçamba de lixo', 'container de lixo', 'remoção de entulho'],
    'empresas de terraplanagem': ['terraplanagem', 'terraplenagem', 'movimentação de terra', 'escavação', 'aterro', 'retroescavadeira', 'empresa de terraplanagem'],
    'empresas de pavimentação': ['pavimentação', 'asfaltamento', 'empresa de pavimentação', 'pavimentação asfáltica', 'pavimentação em concreto', 'piso industrial'],
    'concreteiras': ['concreteira', 'usina de concreto', 'concreto usinado', 'central de concreto', 'fábrica de concreto', 'argamassa', 'concreto bombeado'],
    'usinas de asfalto': ['usina de asfalto', 'asfalto', 'massa asfáltica', 'cbuq', 'asfalto usinado', 'emulsão asfáltica'],
    'pedras e mármores': ['marmoraria', 'pedras naturais', 'mármores e granitos', 'beneficiamento de pedras', 'pedras ornamentais', 'loja de mármores'],
    'granitos': ['granito', 'loja de granito', 'beneficiamento de granito', 'granitos e mármores', 'bancadas de granito', 'pias de granito'],
    'lojas de artigos de pesca': ['loja de pesca', 'artigos de pesca', 'pesca esportiva', 'equipamentos de pesca', 'vara de pescar', 'isca', 'pesca e camping'],
    'casas de armas e munições': ['loja de armas', 'casa de armas', 'armaria', 'munições', 'tiro esportivo', 'armas e munições'],
    'estandes de tiro': ['estande de tiro', 'clube de tiro', 'tiro esportivo', 'stand de tiro', 'campo de tiro', 'escola de tiro'],
    'casas de câmbio e remessas': ['casa de câmbio', 'câmbio', 'remessa internacional', 'dólar', 'euro', 'moeda estrangeira', 'exchange'],
    'seguros de vida e previdência': ['seguro de vida', 'previdência privada', 'plano de previdência', 'seguro pessoal', 'previdência complementar'],
    'corretoras de imóveis': ['corretora de imóveis', 'imobiliária', 'corretor de imóveis', 'venda de imóveis', 'aluguel de imóveis', 'compra e venda de imóveis'],
    'administradoras de condomínios': ['administradora de condomínios', 'gestão condominial', 'administração de condomínios', 'síndico profissional', 'gestão de condomínios'],
    'empresas de portaria e zeladoria': ['portaria', 'zeladoria', 'empresa de portaria', 'portaria remota', 'portaria virtual', 'serviços de zeladoria'],
    'academias de dança': ['academia de dança', 'escola de dança', 'estúdio de dança', 'aulas de dança', 'dança de salão', 'ballet', 'dança contemporânea'],
    'escolas de teatro': ['escola de teatro', 'teatro', 'aulas de teatro', 'curso de teatro', 'artes cênicas', 'grupo de teatro'],
    'estúdios de pilates': ['estúdio de pilates', 'pilates', 'aulas de pilates', 'pilates reformer', 'pilates clínico', 'pilates solo'],
    'estúdios de yoga': ['estúdio de yoga', 'yoga', 'aulas de yoga', 'ioga', 'centro de yoga', 'meditação', 'mindfulness'],
    'estúdios de fotografia': ['estúdio de fotografia', 'fotógrafo', 'fotografia', 'estúdio fotográfico', 'ensaio fotográfico', 'fotografia profissional'],
    'produtoras de vídeo': ['produtora de vídeo', 'produção audiovisual', 'filmagem', 'edição de vídeo', 'produtora audiovisual', 'vídeo institucional'],
    'estúdios de gravação': ['estúdio de gravação', 'estúdio musical', 'gravação de áudio', 'estúdio de som', 'produção musical', 'mixagem'],
    'gráficas rápidas': ['gráfica rápida', 'impressão rápida', 'cópias e impressões', 'gráfica express', 'impressão digital rápida'],
    'copiadora e impressão': ['copiadora', 'copiadoras', 'impressão', 'xerox', 'cópias', 'digitalização', 'plotagem'],
    'lojas de artesanato': ['loja de artesanato', 'artesanato', 'artigos para artesanato', 'biscuit', 'crochê', 'artes manuais', 'ateliê de artesanato'],
    'lojas de aviamentos e armarinhos': ['armarinho', 'aviamentos', 'loja de aviamentos', 'botões', 'zíperes', 'linhas e agulhas', 'materiais de costura'],
    'antiquários': ['antiquário', 'antiguidades', 'loja de antiguidades', 'móveis antigos', 'objetos antigos', 'relíquias'],
    'brechós': ['brechó', 'loja de roupas usadas', 'segunda mão', 'bazar beneficente', 'vintage', 'loja vintage'],
    'lojas de instrumentos musicais': ['loja de instrumentos musicais', 'instrumentos musicais', 'loja de música', 'guitarra', 'violão', 'teclado', 'bateria', 'áudio e instrumentos'],
    'lojas de som e acessórios automotivos': ['loja de som automotivo', 'som automotivo', 'acessórios automotivos', 'insulfilm', 'película automotiva', 'alarme automotivo', 'central multimídia'],
    'empresas de rastreamento veicular': ['rastreamento veicular', 'rastreador', 'monitoramento de veículos', 'rastreamento GPS', 'telemetria', 'empresa de rastreamento'],
    'empresas de blindagem': ['blindagem', 'blindagem automotiva', 'blindadora', 'empresa de blindagem', 'veículo blindado', 'blindagem de veículos'],
    'retíficas de motores': ['retífica de motores', 'retífica', 'recondicionamento de motores', 'retífica de cabeçotes', 'retífica automotiva', 'motor retificado'],
    'autovidros': ['autovidros', 'vidro automotivo', 'para-brisa', 'troca de vidro', 'instalação de vidros', 'vidraceiro automotivo'],
    // ===== NOVOS SEGMENTOS INDUSTRIAIS =====
    'indústrias mecânicas': [
      'indústria mecânica', 'metalúrgica mecânica', 'usinagem mecânica', 'tornearia mecânica', 'ferramentaria',
      'peças mecânicas', 'fábrica de peças', 'indústria de precisão', 'usinagem de precisão', 'usinagem cnc',
      'torno cnc', 'centro de usinagem', 'fresadora cnc', 'retífica cnc', 'peças sob encomenda',
      'componentes mecânicos', 'engrenagens', 'rolamentos industriais', 'mancais', 'eixos',
      'acoplamentos', 'redutores', 'transmissão mecânica', 'bombas industriais', 'válvulas industriais',
      'cilindros hidráulicos', 'cilindros pneumáticos', 'pistões', 'buchas', 'polias',
      'correntes industriais', 'molas industriais', 'parafusos industriais', 'fixadores industriais',
      'estamparia de metais', 'conformação mecânica', 'repuxo de metais', 'forjaria',
      'tratamento térmico', 'têmpera', 'cementação', 'nitretação'
    ],
    'indústrias de plásticos': [
      'indústria de plásticos', 'fábrica de plásticos', 'injeção de plásticos', 'injetora de plástico',
      'extrusão de plásticos', 'sopro de plásticos', 'termoformagem', 'rotomoldagem',
      'fábrica de embalagens plásticas', 'plásticos industriais', 'produtos plásticos', 'moldes para injeção',
      'fábrica de sacolas', 'fábrica de garrafas pet', 'fábrica de tubos plásticos', 'fábrica de baldes',
      'plástico reciclado', 'reciclagem de plástico', 'polímeros', 'resinas plásticas'
    ],
    'indústrias químicas': [
      'indústria química', 'fábrica de produtos químicos', 'química industrial', 'produtos químicos',
      'reagentes químicos', 'solventes', 'ácidos industriais', 'indústria petroquímica',
      'adesivos industriais', 'resinas químicas', 'tintas industriais', 'vernizes',
      'detergentes industriais', 'tratamento de superfície', 'galvanoplastia', 'anodização',
      'laboratório químico', 'fábrica de tintas', 'fábrica de verniz', 'fábrica de cola'
    ],
    'indústrias de papel e celulose': [
      'indústria de papel', 'fábrica de papel', 'celulose', 'papel e celulose', 'papeleira',
      'fábrica de papelão', 'fábrica de celulose', 'reciclagem de papel', 'aparas de papel',
      'papel kraft', 'papel ondulado', 'papel cartão', 'indústria de papel reciclado'
    ],
    'indústrias de borracha': [
      'indústria de borracha', 'fábrica de borracha', 'artefatos de borracha', 'peças de borracha',
      'vulcanização', 'vulcanizadora', 'fábrica de mangueiras', 'correias de borracha',
      'juntas de borracha', 'vedações de borracha', 'borracha industrial', 'elastômeros',
      'fábrica de pneus', 'recapagem de pneus', 'borrachas técnicas'
    ],
    'indústrias de vidro': [
      'indústria de vidro', 'fábrica de vidro', 'vidraçaria industrial', 'vidro temperado',
      'vidro laminado', 'beneficiamento de vidro', 'espelhos', 'fábrica de espelhos',
      'vidros industriais', 'vidros automotivos', 'vidros para construção', 'box de vidro',
      'fábrica de garrafas de vidro', 'embalagens de vidro'
    ],
    'indústrias de cerâmica': [
      'indústria cerâmica', 'fábrica de cerâmica', 'cerâmica industrial', 'porcelana',
      'fábrica de pisos', 'fábrica de azulejos', 'fábrica de telhas', 'olaria',
      'cerâmica de revestimento', 'louça sanitária', 'isoladores cerâmicos', 'refratários',
      'cerâmica técnica', 'cerâmica artística'
    ],
    'indústrias de cosméticos': [
      'indústria de cosméticos', 'fábrica de cosméticos', 'fabricante de cosméticos',
      'fábrica de maquiagem', 'fábrica de cremes', 'cosméticos industriais',
      'fábrica de shampoo', 'fábrica de sabonetes', 'fábrica de perfumes',
      'indústria de higiene pessoal', 'fábrica de produtos de beleza', 'terceirização de cosméticos'
    ],
    'indústrias farmacêuticas': [
      'indústria farmacêutica', 'laboratório farmacêutico', 'fábrica de medicamentos',
      'fabricante de medicamentos', 'farmacêutica', 'indústria de medicamentos',
      'fábrica de suplementos', 'manipulação industrial', 'farmoquímica',
      'indústria de genéricos', 'laboratório de medicamentos', 'fábrica de vitaminas'
    ],
    'indústrias de bebidas': [
      'indústria de bebidas', 'fábrica de bebidas', 'engarrafadora', 'fábrica de refrigerantes',
      'fábrica de sucos', 'fábrica de água mineral', 'cervejaria industrial', 'destilaria',
      'fábrica de energéticos', 'indústria de sucos', 'fábrica de isotônicos', 'vinícola industrial'
    ],
    'indústrias de embalagens': [
      'indústria de embalagens', 'fábrica de embalagens', 'embalagens industriais',
      'fábrica de caixas', 'embalagens plásticas', 'embalagens de papelão', 'embalagens metálicas',
      'embalagens flexíveis', 'embalagens descartáveis', 'fábrica de sacolas',
      'embalagens para alimentos', 'embalagens pet', 'fábrica de potes', 'fábrica de frascos'
    ],
    'indústrias de móveis': [
      'indústria de móveis', 'fábrica de móveis', 'marcenaria industrial', 'móveis industriais',
      'fábrica de estofados', 'fábrica de colchões', 'fábrica de sofás',
      'fábrica de cadeiras', 'fábrica de mesas', 'móveis sob medida industrial',
      'indústria moveleira', 'fábrica de armários', 'fábrica de cozinhas planejadas'
    ],
    'indústrias de calçados': [
      'indústria de calçados', 'fábrica de calçados', 'fábrica de sapatos', 'fábrica de tênis',
      'fábrica de sandálias', 'indústria calçadista', 'fábrica de botas',
      'fábrica de chinelos', 'calçados industriais', 'componentes para calçados',
      'solados', 'fábrica de palmilhas', 'curtume'
    ],
    'indústrias de tintas': [
      'indústria de tintas', 'fábrica de tintas', 'fabricante de tintas', 'tintas industriais',
      'fábrica de verniz', 'fábrica de resinas', 'tintas automotivas',
      'tintas para construção', 'tintas epóxi', 'tintas em pó', 'pintura eletrostática',
      'fábrica de solventes', 'pigmentos industriais'
    ],
    'indústrias de fertilizantes': [
      'indústria de fertilizantes', 'fábrica de fertilizantes', 'fábrica de adubo',
      'fertilizantes agrícolas', 'adubo químico', 'adubo orgânico', 'fábrica de NPK',
      'insumos agrícolas', 'defensivos agrícolas', 'agroquímicos', 'fábrica de calcário',
      'corretivos de solo', 'fertirrigação'
    ],
    'indústrias de ração animal': [
      'indústria de ração', 'fábrica de ração', 'fábrica de ração animal', 'ração bovina',
      'ração para gado', 'ração para aves', 'ração para suínos', 'ração para peixes',
      'ração para equinos', 'suplemento animal', 'núcleo mineral', 'premix',
      'fábrica de sal mineral', 'nutrição animal'
    ],
    'indústrias de produtos de limpeza': [
      'indústria de produtos de limpeza', 'fábrica de produtos de limpeza', 'fábrica de detergente',
      'fábrica de desinfetante', 'fábrica de sabão', 'fábrica de água sanitária',
      'fábrica de alvejante', 'produtos de limpeza industrial', 'fábrica de amaciante',
      'fábrica de multiuso', 'químicos de limpeza', 'higiene e limpeza industrial'
    ],
    'indústrias de papel higiênico e descartáveis': [
      'fábrica de papel higiênico', 'indústria de descartáveis', 'fábrica de guardanapos',
      'fábrica de toalhas de papel', 'fábrica de fraldas', 'fábrica de absorventes',
      'descartáveis industriais', 'fábrica de copos descartáveis', 'fábrica de pratos descartáveis',
      'tissue', 'converting', 'fábrica de lenços'
    ],
    'indústrias gráficas': [
      'indústria gráfica', 'gráfica industrial', 'impressão offset', 'impressão digital industrial',
      'gráfica de embalagens', 'rótulos e etiquetas', 'fábrica de etiquetas',
      'gráfica de grande formato', 'impressão flexográfica', 'rotogravura',
      'pré-impressão', 'acabamento gráfico', 'encadernação industrial'
    ],
    'indústrias de componentes eletrônicos': [
      'indústria de componentes eletrônicos', 'fábrica de componentes eletrônicos', 'montagem de placas',
      'montagem SMD', 'circuito impresso', 'PCB', 'fábrica de transformadores',
      'fábrica de capacitores', 'fábrica de conectores', 'eletrônica industrial',
      'montagem eletrônica', 'componentes semicondutores', 'placas eletrônicas'
    ],
    'indústrias de fios e cabos': [
      'indústria de fios e cabos', 'fábrica de cabos', 'fábrica de fios elétricos',
      'cabos elétricos', 'fios elétricos', 'cabos de energia', 'cabos de comunicação',
      'fábrica de chicotes elétricos', 'trefilação de cobre', 'cabos flexíveis',
      'cabos industriais', 'fábrica de cordoalha', 'fios esmaltados'
    ],
    // ===== LOTE 1: Novos segmentos =====
    // Alimentação e Gastronomia
    'açaiterias': ['açaiteria', 'açaí', 'casa de açaí', 'açaí bowl'],
    'casas de açaí': ['casa de açaí', 'açaí', 'açaiteria'],
    'creperies': ['creperie', 'crepe', 'casa de crepes'],
    'tapiocarias': ['tapiocaria', 'tapioca', 'casa de tapioca'],
    'casas de sucos': ['casa de sucos', 'sucos naturais', 'suco'],
    'restaurantes veganos': ['restaurante vegano', 'comida vegana', 'vegan'],
    'restaurantes vegetarianos': ['restaurante vegetariano', 'comida vegetariana'],
    'restaurantes fit': ['restaurante fit', 'comida fit', 'alimentação saudável'],
    'restaurantes self-service': ['restaurante self service', 'self service', 'por quilo'],
    'restaurantes italianos': ['restaurante italiano', 'cantina italiana', 'trattoria', 'osteria'],
    'restaurantes mexicanos': ['restaurante mexicano', 'comida mexicana', 'taqueria', 'burrito'],
    'restaurantes árabes': ['restaurante árabe', 'comida árabe', 'esfiha', 'quibe', 'shawarma'],
    'restaurantes de frutos do mar': ['frutos do mar', 'marisqueria', 'peixaria restaurante'],
    'marisquerias': ['marisqueria', 'frutos do mar', 'camarão', 'marisco'],
    'espetarias': ['espetaria', 'espeto', 'espetinho'],
    'marmitarias': ['marmitaria', 'marmita', 'marmitex', 'quentinha'],
    'padarias artesanais': ['padaria artesanal', 'pão artesanal', 'fermentação natural', 'sourdough'],
    'chocolaterias': ['chocolateria', 'chocolate artesanal', 'chocolate', 'bombons'],
    'gelatarias': ['gelataria', 'gelato', 'sorvete artesanal'],
    'açougues gourmet': ['açougue gourmet', 'boutique de carnes', 'carnes nobres'],
    'empórios gourmet': ['empório gourmet', 'empório', 'delicatessen', 'produtos gourmet'],
    'delicatessens': ['delicatessen', 'deli', 'empório', 'frios importados'],
    'rotisseries': ['rotisserie', 'rotisseria', 'frango assado', 'assados'],
    'casas de carnes': ['casa de carnes', 'açougue', 'boutique de carnes'],
    'distribuidoras de carnes': ['distribuidora de carnes', 'atacado de carnes', 'frigorífico distribuidor'],
    'distribuidoras de peixes': ['distribuidora de peixes', 'atacado de peixes', 'pescados atacado'],
    'distribuidoras de congelados': ['distribuidora de congelados', 'congelados atacado', 'alimentos congelados'],
    'distribuidoras de sorvetes': ['distribuidora de sorvetes', 'atacado de sorvetes', 'distribuidor de sorvetes'],
    'distribuidoras de açaí': ['distribuidora de açaí', 'açaí atacado', 'polpa de açaí atacado'],
    'distribuidoras de polpas de frutas': ['distribuidora de polpas', 'polpa de fruta atacado', 'polpas atacado'],
    'distribuidoras de ovos': ['distribuidora de ovos', 'ovos atacado', 'granja distribuidora'],
    'distribuidoras de queijos': ['distribuidora de queijos', 'queijos atacado', 'laticínios distribuidor'],
    'distribuidoras de embutidos': ['distribuidora de embutidos', 'embutidos atacado', 'frios distribuidor'],
    // Indústria
    'indústrias de alimentos congelados': ['indústria de congelados', 'fábrica de congelados', 'alimentos congelados industrial'],
    'indústrias de conservas': ['indústria de conservas', 'fábrica de conservas', 'conservas industrial'],
    'indústrias de massas': ['indústria de massas', 'fábrica de massas', 'massa industrial'],
    'indústrias de temperos e condimentos': ['indústria de temperos', 'fábrica de temperos', 'condimentos industrial'],
    'indústrias de laticínios': ['indústria de laticínios', 'fábrica de laticínios', 'laticínio', 'usina de leite'],
    'indústrias de sorvetes': ['indústria de sorvetes', 'fábrica de sorvetes', 'sorvete industrial'],
    'indústrias de chocolates': ['indústria de chocolates', 'fábrica de chocolates', 'chocolate industrial'],
    'indústrias de café': ['indústria de café', 'torrefação de café', 'fábrica de café'],
    'indústrias de sucos e polpas': ['indústria de sucos', 'fábrica de polpas', 'sucos industrial'],
    'indústrias de água mineral': ['indústria de água mineral', 'envasadora de água', 'fonte de água mineral'],
    'indústrias de colchões': ['indústria de colchões', 'fábrica de colchões', 'colchões industrial'],
    'indústrias de estofados': ['indústria de estofados', 'fábrica de estofados', 'sofás industrial'],
    'indústrias de tubos e conexões': ['indústria de tubos', 'fábrica de tubos', 'conexões industriais', 'tubos PVC'],
    'indústrias de caixas de papelão': ['indústria de caixas', 'fábrica de caixas de papelão', 'cartonagem industrial'],
    'indústrias de mdf e mdp': ['indústria de MDF', 'fábrica de MDF', 'painéis de madeira'],
    'indústrias de motores elétricos': ['indústria de motores elétricos', 'fábrica de motores', 'motores industriais'],
    'indústrias de implementos agrícolas': ['indústria de implementos agrícolas', 'fábrica de implementos', 'máquinas agrícolas'],
    // Saúde
    'clínicas de endocrinologia': ['clínica de endocrinologia', 'endocrinologista', 'endócrino'],
    'clínicas de gastroenterologia': ['clínica de gastroenterologia', 'gastroenterologista', 'gastro'],
    'clínicas de oncologia': ['clínica de oncologia', 'oncologista', 'centro oncológico'],
    'clínicas de otorrinolaringologia': ['otorrinolaringologista', 'otorrino', 'clínica de otorrino'],
    'clínicas de medicina do trabalho': ['medicina do trabalho', 'clínica ocupacional', 'saúde ocupacional'],
    'clínicas de acupuntura': ['acupuntura', 'acupunturista', 'medicina chinesa'],
    'clínicas de quiropraxia': ['quiropraxia', 'quiroprático', 'quiropraxista'],
    'clínicas de cirurgia plástica': ['cirurgia plástica', 'cirurgião plástico', 'plástica'],
    'clínicas de implantes dentários': ['implante dentário', 'implantes', 'implantodontia'],
    'clínicas de ortodontia': ['ortodontia', 'ortodontista', 'aparelho dental'],
    'farmácias de manipulação': ['farmácia de manipulação', 'manipulação', 'farmácia magistral'],
    'centros de diagnóstico por imagem': ['diagnóstico por imagem', 'radiologia', 'ressonância', 'tomografia'],
    // Serviços
    'agências de marketing digital': ['agência de marketing digital', 'marketing digital', 'agência digital'],
    'agências de seo': ['agência de SEO', 'SEO', 'otimização de sites'],
    'empresas de rh e terceirização': ['RH', 'recursos humanos', 'terceirização', 'trabalho temporário'],
    'empresas de desenvolvimento de software': ['desenvolvimento de software', 'software house', 'fábrica de software'],
    'provedores de internet': ['provedor de internet', 'internet', 'ISP', 'fibra óptica'],
    'empresas de cibersegurança': ['cibersegurança', 'segurança da informação', 'cybersecurity'],
    'empresas de cftv': ['CFTV', 'câmeras de segurança', 'vigilância', 'circuito fechado'],
    'empresas de engenharia elétrica': ['engenharia elétrica', 'projeto elétrico', 'instalações elétricas'],
    'empresas de engenharia ambiental': ['engenharia ambiental', 'meio ambiente', 'licenciamento ambiental'],
    'empresas de topografia': ['topografia', 'topógrafo', 'levantamento topográfico'],
    'empresas de perfuração de poços': ['perfuração de poços', 'poço artesiano', 'poço semi-artesiano'],
    'importadoras': ['importadora', 'importação', 'produtos importados', 'trading'],
    'exportadoras': ['exportadora', 'exportação', 'comércio exterior'],
    'empresas de auditoria': ['auditoria', 'empresa de auditoria', 'auditoria contábil'],
    'empresas de motoboy': ['motoboy', 'motofrete', 'entrega moto', 'moto entrega'],
    'empresas de transporte refrigerado': ['transporte refrigerado', 'câmara fria', 'frigorífico transporte'],
    'guincho e reboque': ['guincho', 'reboque', 'auto socorro', 'socorro mecânico'],
    // Comércio
    'lojas de bebidas': ['loja de bebidas', 'adega', 'distribuidora de bebidas', 'casa de bebidas'],
    'lojas de vinhos': ['loja de vinhos', 'wine shop', 'adega', 'enoteca'],
    'lojas de conveniência': ['loja de conveniência', 'conveniência', 'am pm', 'select'],
    'lojas de games e videogames': ['loja de games', 'videogames', 'games', 'gamer'],
    'lojas de artigos para bebê': ['artigos para bebê', 'loja de bebê', 'enxoval de bebê'],
    'lojas de material de escritório': ['material de escritório', 'papelaria corporativa', 'suprimentos de escritório'],
    'lojas de móveis para escritório': ['móveis para escritório', 'mobiliário corporativo', 'estações de trabalho'],
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
    // ===== ENHANCED SMART FALLBACK =====
    // Handles 5600+ segments by intelligently generating search terms
    const baseTerms: string[] = [term];
    
    // Normalize for accent-insensitive matching
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedTerm !== term) baseTerms.push(normalizedTerm);
    
    // Add singular/plural variations
    if (term.endsWith('s') && term.length > 4) {
      baseTerms.push(term.slice(0, -1));
    }
    if (term.endsWith('es') && term.length > 5) {
      baseTerms.push(term.slice(0, -2));
    }
    if (term.endsWith('ões') || term.endsWith('oes')) {
      baseTerms.push(term.replace(/ões$|oes$/, 'ão'));
    }
    if (term.endsWith('ais') && term.length > 5) {
      baseTerms.push(term.replace(/ais$/, 'al'));
    }
    
    // Smart prefix extraction - generate core term + variations
    const prefixPatterns: { prefix: RegExp; variations: (core: string) => string[] } = {
      // This object maps regex prefixes to variation generators
    } as any;
    
    const prefixMappings: [RegExp, (core: string) => string[]][] = [
      [/^lojas?\s+de\s+/, (core) => [core, `loja de ${core}`, `casa de ${core}`, `comércio de ${core}`]],
      [/^distribuidoras?\s+de\s+/, (core) => [core, `distribuidora de ${core}`, `distribuidor de ${core}`, `atacado de ${core}`, `atacadista de ${core}`]],
      [/^indústrias?\s+de\s+|^industrias?\s+de\s+/, (core) => [core, `indústria de ${core}`, `fábrica de ${core}`, `fabricante de ${core}`, `industrial de ${core}`]],
      [/^fábricas?\s+de\s+|^fabricas?\s+de\s+/, (core) => [core, `fábrica de ${core}`, `indústria de ${core}`, `fabricante de ${core}`]],
      [/^empresas?\s+de\s+/, (core) => [core, `empresa de ${core}`, `serviço de ${core}`, `serviços de ${core}`]],
      [/^clínicas?\s+de\s+|^clinicas?\s+de\s+/, (core) => [core, `clínica de ${core}`, `centro de ${core}`, `consultório de ${core}`]],
      [/^centros?\s+de\s+/, (core) => [core, `centro de ${core}`, `clínica de ${core}`, `espaço de ${core}`]],
      [/^agências?\s+de\s+|^agencias?\s+de\s+/, (core) => [core, `agência de ${core}`, `empresa de ${core}`]],
      [/^escritórios?\s+de\s+|^escritorios?\s+de\s+/, (core) => [core, `escritório de ${core}`, `empresa de ${core}`]],
      [/^casas?\s+de\s+/, (core) => [core, `casa de ${core}`, `loja de ${core}`]],
      [/^ateliês?\s+de\s+|^atelies?\s+de\s+/, (core) => [core, `ateliê de ${core}`, `estúdio de ${core}`]],
      [/^estúdios?\s+de\s+|^estudios?\s+de\s+/, (core) => [core, `estúdio de ${core}`, `ateliê de ${core}`]],
      [/^academias?\s+de\s+/, (core) => [core, `academia de ${core}`, `escola de ${core}`, `aula de ${core}`]],
      [/^escolas?\s+de\s+/, (core) => [core, `escola de ${core}`, `curso de ${core}`, `aula de ${core}`]],
      [/^cursos?\s+de\s+/, (core) => [core, `curso de ${core}`, `escola de ${core}`, `treinamento de ${core}`]],
      [/^instaladores?\s+de\s+|^instaladoras?\s+de\s+/, (core) => [core, `instalação de ${core}`, `instalador de ${core}`, `empresa de instalação de ${core}`]],
      [/^construtoras?\s+de\s+/, (core) => [core, `construtora de ${core}`, `construção de ${core}`, `empresa de construção de ${core}`]],
      [/^cooperativas?\s+de\s+/, (core) => [core, `cooperativa de ${core}`, `associação de ${core}`]],
      [/^criadores?\s+de\s+/, (core) => [core, `criador de ${core}`, `criadouro de ${core}`, `criação de ${core}`]],
      [/^produtores?\s+de\s+/, (core) => [core, `produtor de ${core}`, `produção de ${core}`, `fabricante de ${core}`]],
      [/^fornecedores?\s+de\s+/, (core) => [core, `fornecedor de ${core}`, `distribuidora de ${core}`, `atacado de ${core}`]],
      [/^atacadistas?\s+de\s+/, (core) => [core, `atacadista de ${core}`, `atacado de ${core}`, `distribuidora de ${core}`]],
      [/^oficinas?\s+de\s+|^oficinas?\s+especializadas?\s+em\s+/, (core) => [core, `oficina de ${core}`, `oficina especializada ${core}`, `mecânica ${core}`]],
      [/^startups?\s+de\s+/, (core) => [core, `startup de ${core}`, `empresa de ${core}`, `${core} tech`]],
      [/^franquias?\s+de\s+/, (core) => [core, `franquia de ${core}`, `rede de ${core}`, `${core}`]],
      [/^redes?\s+de\s+/, (core) => [core, `rede de ${core}`, `cadeia de ${core}`, `${core}`]],
      [/^e-commerces?\s+de\s+|^ecommerces?\s+de\s+/, (core) => [core, `loja de ${core}`, `loja online ${core}`, `${core} online`]],
      [/^laboratórios?\s+de\s+|^laboratorios?\s+de\s+/, (core) => [core, `laboratório de ${core}`, `lab de ${core}`]],
      [/^usinas?\s+de\s+/, (core) => [core, `usina de ${core}`, `planta de ${core}`]],
      [/^serviços?\s+de\s+|^servicos?\s+de\s+/, (core) => [core, `serviço de ${core}`, `empresa de ${core}`]],
      [/^provedores?\s+de\s+/, (core) => [core, `provedor de ${core}`, `empresa de ${core}`]],
      [/^consultorias?\s+de\s+/, (core) => [core, `consultoria de ${core}`, `empresa de ${core}`, `assessoria de ${core}`]],
      [/^beneficiadoras?\s+de\s+/, (core) => [core, `beneficiadora de ${core}`, `beneficiamento de ${core}`]],
      [/^fazendas?\s+de\s+/, (core) => [core, `fazenda de ${core}`, `propriedade rural ${core}`]],
      [/^aluguel\s+de\s+/, (core) => [core, `aluguel de ${core}`, `locação de ${core}`, `aluga ${core}`]],
    ];
    
    let matched = false;
    for (const [regex, variationFn] of prefixMappings) {
      if (regex.test(term)) {
        const core = term.replace(regex, '').trim();
        if (core.length >= 3) {
          const variations = variationFn(core);
          baseTerms.push(...variations.filter(v => !baseTerms.includes(v)));
          matched = true;
        }
        break;
      }
    }
    
    // If no prefix matched, try suffix patterns
    if (!matched) {
      // Handle compound terms like "Barbearias Vintage", "Barbearias Premium"
      const words = term.split(/\s+/);
      if (words.length >= 2) {
        baseTerms.push(words[0]); // Add first word alone
        baseTerms.push(words.join(' ')); // Full term
        // Add reversed for qualifiers: "vintage barbearia"
        if (words.length === 2) {
          baseTerms.push(`${words[1]} ${words[0]}`);
        }
      }
    }
    
    // Deduplicate
    searchTerms = [...new Set(baseTerms)].filter(t => t.length >= 3);
  }

  const normalizedSegment = normalizeSegmentText(term);
  const isIndustrialSegment = /(industr|fabrica|metalurg|mecanic|usinag|quimic|plast)/.test(normalizedSegment);
  const isDistributionSegment = /(distrib|atacad|fornecedor|revenda)/.test(normalizedSegment);
  const isRetailSegment = /(loja|comerc|bazar|shop|mercado|emporio|casa)/.test(normalizedSegment);

  const expandedTerms: string[] = [];
  for (const rawTerm of searchTerms) {
    const cleaned = rawTerm.trim().toLowerCase();
    if (!cleaned || cleaned.length < 3) continue;

    const normalized = normalizeSegmentText(cleaned);
    const hasPrefix = /^(loja|distribuidora|distribuidor|atacado|atacadista|empresa|industria|fabrica|fornecedor|casa)\s+de\s+/.test(normalized);

    expandedTerms.push(cleaned, normalized);

    if (cleaned.endsWith('s') && cleaned.length > 4) {
      expandedTerms.push(cleaned.slice(0, -1));
    }

    if (!hasPrefix) {
      if (isDistributionSegment) {
        expandedTerms.push(`distribuidora de ${cleaned}`, `atacado de ${cleaned}`, `fornecedor de ${cleaned}`);
      }

      if (isIndustrialSegment) {
        expandedTerms.push(`fábrica de ${cleaned}`, `indústria de ${cleaned}`, `fabricante de ${cleaned}`);
      }

      if (isRetailSegment) {
        expandedTerms.push(`loja de ${cleaned}`, `casa de ${cleaned}`, `comércio de ${cleaned}`);
      }
    }
  }

  const dedupedExpandedTerms = [...new Set(expandedTerms.map(t => t.trim()).filter(t => t.length >= 3))];
  const shouldBoost = isBoostSegment(term);

  // Boost usa cap maior; padrão também sobe para evitar buscas sem resultado em nichos long-tail
  return shouldBoost ? dedupedExpandedTerms.slice(0, 40) : dedupedExpandedTerms.slice(0, 14);
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

// Metropolitan area mappings - cities that should be accepted when searching for a nearby city
const metropolitanAreas: { [key: string]: string[] } = {
  'sao paulo': ['guarulhos', 'osasco', 'santo andre', 'sao bernardo', 'diadema', 'maua', 'carapicuiba', 'barueri', 'cotia', 'taboao da serra', 'itaquaquecetuba', 'embu das artes', 'suzano', 'ferraz de vasconcelos', 'mogi das cruzes', 'itapecerica da serra', 'francisco morato', 'franco da rocha', 'caieiras', 'aruja', 'santana de parnaiba', 'jandira', 'poa', 'itapevi'],
  'rio de janeiro': ['niteroi', 'sao goncalo', 'duque de caxias', 'nova iguacu', 'belford roxo', 'sao joao de meriti', 'mesquita', 'nilopolis', 'queimados', 'itaborai', 'mage', 'marica', 'guapimirim'],
  'belo horizonte': ['contagem', 'betim', 'ribeiro das neves', 'santa luzia', 'ibirite', 'sabara', 'vespasiano', 'nova lima', 'lagoa santa', 'pedro leopoldo'],
  'porto alegre': ['canoas', 'gravatai', 'viamao', 'novo hamburgo', 'sao leopoldo', 'alvorada', 'cachoeirinha', 'sapucaia do sul', 'esteio', 'guaiba', 'eldorado do sul'],
  'curitiba': ['sao jose dos pinhais', 'colombo', 'araucaria', 'pinhais', 'campo largo', 'almirante tamandare', 'piraquara', 'fazenda rio grande', 'quatro barras'],
  'salvador': ['lauro de freitas', 'camacari', 'simoes filho', 'candeias', 'dias davila', 'itaparica'],
  'recife': ['jaboatao dos guararapes', 'olinda', 'paulista', 'camaragibe', 'cabo de santo agostinho', 'abreu e lima'],
  'fortaleza': ['caucaia', 'maracanau', 'maranguape', 'pacatuba', 'eusebio', 'aquiraz'],
  'goiania': ['aparecida de goiania', 'trindade', 'senador canedo', 'goianira'],
  'brasilia': ['taguatinga', 'ceilandia', 'samambaia', 'aguas claras', 'gama', 'sobradinho', 'planaltina'],
  'vitoria': ['vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'fundao'],
  'florianopolis': ['sao jose', 'palhoca', 'biguacu'],
  'manaus': ['iranduba', 'manacapuru'],
  'belem': ['ananindeua', 'marituba', 'benevides'],
  'campinas': ['sumare', 'hortolandia', 'indaiatuba', 'valinhos', 'vinhedo', 'paulinia', 'americana'],
};

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesRequestedLocation(
  place: any,
  requestedRegion: string,
  countryCode: string,
  searchCenter: { lat: number; lng: number } | null = null,
  validationRadiusKm: number = 35,
): boolean {
  const address = place?.address || '';
  if (isAddressInLocation(address, requestedRegion, countryCode)) {
    return true;
  }

  if (!searchCenter) {
    return false;
  }

  const latitude = place?.location?.lat ?? place?.location?.latitude;
  const longitude = place?.location?.lng ?? place?.location?.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }

  const distanceKm = calculateDistanceKm(searchCenter.lat, searchCenter.lng, latitude, longitude);
  return distanceKm <= validationRadiusKm;
}

// Check if an address matches the requested location
function isAddressInLocation(address: string, requestedRegion: string, countryCode: string): boolean {
  if (!address || !requestedRegion) return false;
  
  const normalizedAddress = normalizeLocationString(address);
  const normalizedRegion = normalizeLocationString(requestedRegion);
  
  // Brazilian state abbreviations - MUST recognize these as valid
  const brazilianStates: { [key: string]: string } = {
    'ac': 'acre', 'al': 'alagoas', 'ap': 'amapa', 'am': 'amazonas',
    'ba': 'bahia', 'ce': 'ceara', 'df': 'distrito federal', 'es': 'espirito santo',
    'go': 'goias', 'ma': 'maranhao', 'mt': 'mato grosso', 'ms': 'mato grosso do sul',
    'mg': 'minas gerais', 'pa': 'para', 'pb': 'paraiba', 'pr': 'parana',
    'pe': 'pernambuco', 'pi': 'piaui', 'rj': 'rio de janeiro', 'rn': 'rio grande do norte',
    'rs': 'rio grande do sul', 'ro': 'rondonia', 'rr': 'roraima', 'sc': 'santa catarina',
    'sp': 'sao paulo', 'se': 'sergipe', 'to': 'tocantins'
  };
  
  // Split region into parts (could be "City, State" or "City - State" or just "City")
  const regionParts = normalizedRegion.split(/[\s,\-]+/).filter(p => p.length > 1);
  
  // For Brazilian addresses
  if (countryCode === 'BR') {
    // Check if the search is ONLY for a state (2-letter code or state name)
    const cleanRegion = normalizedRegion.trim().toLowerCase();
    const isStateOnlySearch = brazilianStates[cleanRegion] !== undefined || 
                              Object.values(brazilianStates).includes(cleanRegion);
    
    if (isStateOnlySearch) {
      const stateAbbrev = brazilianStates[cleanRegion] ? cleanRegion : 
                          Object.keys(brazilianStates).find(k => brazilianStates[k] === cleanRegion);
      
      if (stateAbbrev) {
        const statePattern = new RegExp(`[,\\s\\-]\\s*${stateAbbrev}\\s*[,\\s\\-]|[,\\s\\-]\\s*${stateAbbrev}\\s*$`, 'i');
        if (statePattern.test(address.toLowerCase())) {
          return true;
        }
        const stateName = brazilianStates[stateAbbrev];
        if (stateName && normalizedAddress.includes(stateName)) {
          return true;
        }
      }
      
      const searchedStateAbbrev = Object.keys(brazilianStates).find(k => brazilianStates[k] === cleanRegion);
      if (searchedStateAbbrev) {
        const statePattern = new RegExp(`[,\\s\\-]\\s*${searchedStateAbbrev}\\s*[,\\s\\-]|[,\\s\\-]\\s*${searchedStateAbbrev}\\s*$`, 'i');
        if (statePattern.test(address.toLowerCase())) {
          return true;
        }
      }
      
      console.log(`❌ State search: "${address}" not in state "${requestedRegion}"`);
      return false;
    }
    
    // CITY + STATE or CITY-ONLY SEARCH
    const addressParts = extractLocationParts(address);
    
    // Filter region words
    let regionCityWords = regionParts.filter(p => {
      return (p.length > 2 || brazilianStates[p.toLowerCase()] !== undefined) && 
             !['brasil', 'brazil', 'br'].includes(p.toLowerCase());
    });
    
    // Check if any region word appears in the address
    let cityMatch = false;
    for (const word of regionCityWords) {
      if (normalizedAddress.includes(word.toLowerCase())) {
        cityMatch = true;
        break;
      }
    }
    
    // If no direct match, check metropolitan area
    if (!cityMatch) {
      // Extract the main city name from region (first meaningful words)
      const mainCityWords = regionCityWords.filter(w => w.length > 2 && !brazilianStates[w.toLowerCase()]);
      const mainCity = mainCityWords.join(' ');
      
      // Check if the address is in a metropolitan area city
      for (const [metroCityKey, metroCities] of Object.entries(metropolitanAreas)) {
        // Check if the searched city matches this metro area
        if (metroCityKey.includes(mainCity) || mainCity.includes(metroCityKey) || 
            metroCities.some(mc => mainCity.includes(mc))) {
          // Now check if the address is in any city of this metro area
          const allMetroCities = [metroCityKey, ...metroCities];
          for (const metroCity of allMetroCities) {
            if (normalizedAddress.includes(metroCity)) {
              cityMatch = true;
              break;
            }
          }
          if (cityMatch) break;
        }
      }
    }
    
    if (!cityMatch) {
      // Silently skip logging for non-matching locations to reduce noise
      return false;
    }
    
    // Verify the matched word appears in city position (not street name)
    let foundInCityPosition = false;
    const allWordsToCheck = [...regionCityWords];
    
    // Also add metropolitan area cities to check
    const mainCityWords = regionCityWords.filter(w => w.length > 2 && !brazilianStates[w.toLowerCase()]);
    const mainCity = mainCityWords.join(' ');
    for (const [metroCityKey, metroCities] of Object.entries(metropolitanAreas)) {
      if (metroCityKey.includes(mainCity) || mainCity.includes(metroCityKey)) {
        allWordsToCheck.push(...[metroCityKey, ...metroCities].filter(mc => normalizedAddress.includes(mc)));
      }
    }
    
    for (const word of allWordsToCheck) {
      const wordLower = word.toLowerCase();
      const cityPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${wordLower}[^,\\-]*\\s*[,\\-]`, 'i');
      const endPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${wordLower}[^,\\-]*$`, 'i');
      
      if (cityPositionPattern.test(normalizedAddress) || endPositionPattern.test(normalizedAddress)) {
        foundInCityPosition = true;
        break;
      }
    }
    
    if (!foundInCityPosition) {
      const addressWords = normalizedAddress.split(/[\s,\-]+/);
      for (const word of allWordsToCheck) {
        if (addressWords.includes(word.toLowerCase())) {
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
    'fábricas', 'fabricas', 'industrial', 'industriais',
    'fabricante', 'fabricantes',
    'abatedouro', 'abatedouros', 'frigorífico', 'frigoríficos'
  ];
  return industryTerms.some(term => lower.includes(term));
}

// Strict exclusions for industry searches - these are NEVER real industries
const industryExclusions = [
  // Food service establishments
  'bar ', 'bares', 'boteco', 'botequim', 'pub ', 'cervejaria artesanal',
  'restaurante', 'restaurantes', 'self-service', 'self service', 'buffet', 'bistrô', 'bistro',
  'lanchonete', 'lanchonetes', 'lanches', 'fast food', 'fast-food',
  'pizzaria', 'pizzarias', 'pizza', 'rodízio',
  'padaria', 'padarias', 'panificadora', 'confeitaria', 'confeitarias', 'bakery',
  'cafeteria', 'cafeterias', 'coffee shop',
  'hamburgueria', 'hamburguerias', 'burger', 'hot dog', 'cachorro quente',
  'churrascaria', 'churrascarias', 'rodízio de carnes',
  'sushi', 'sushis', 'temaki',
  'pastelaria', 'pastel', 'pastéis',
  'sorveteria', 'sorvete', 'açaí', 'acai', 'gelato',
  'food truck', 'food-truck', 'trailer de comida',
  'cantina', 'refeitório', 'refeição coletiva',
  'doceria', 'brigadeiro', 'chocolate artesanal',
  
  // Retail ONLY (removed distribuidora/atacado - many real industries also distribute)
  'varejo', 'varejista',
  'supermercado', 'minimercado', 'hortifruti',
  'magazine', 'americanas', 'casas bahia', 'ponto frio',
  
  // Food-related services that use "industrial" but aren't industries
  'cozinha industrial', 'cozinhas industriais', 'catering',
  'linha industrial', 'produtos industriais',
  'equipamentos para cozinha',
  
  // Other services
  'açougue', 'casa de carnes', 'frios e embutidos',
  'conveniência'
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
  'ração', 'racao', 'rações', 'racoes', 'pet food', 'nutrição animal', 'nutricao animal',
  'fertilizante', 'adubo', 'agroquímico', 'agroquimico',
  'implementos', 'máquinas', 'maquinas', 'equipamentos industriais',
  // Abatedouros specific
  'avícola', 'avicola', 'granja', 'abate', 'frigorífico', 'frigorifico',
  'sala de abate', 'SIF', 'SIE'
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

// RELAXED niche relevance keywords - balanced between precision and volume
// mustMatch is now OPTIONAL - only used for very specific searches
const nicheKeywords: { [key: string]: { include: string[], exclude: string[], mustMatch?: string[] } } = {
  'hipermercados': {
    include: ['hipermercado', 'hiper', 'carrefour', 'big', 'walmart', 'assaí', 'makro', 'sam\'s club', 'atacarejo', 'extra hiper', 'atacado', 'atacadão'],
    exclude: ['roupa', 'vestuário', 'moda', 'calçado', 'eletro', 'eletrônico', 'auto peça', 'autopeça', 'ferragem', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'beleza', 'academia', 'hotel', 'restaurante', 'lanchonete', 'pizzaria', 'padaria', 'farmácia']
  },
  'supermercados': {
    include: ['supermercado', 'mercado', 'mercearia', 'minimercado', 'hortifruti', 'sacolão', 'feira', 'empório', 'armazém', 'grocery'],
    exclude: ['roupa', 'vestuário', 'moda', 'eletro', 'eletrônico', 'auto peça', 'construção', 'ferragem', 'pet', 'veterinár', 'ótica', 'joalheria', 'salão', 'beleza', 'academia', 'hotel', 'restaurante', 'lanchonete', 'pizzaria']
  },
  'restaurantes': {
    include: ['restaurante', 'churrascaria', 'buffet', 'self-service', 'gastronomia', 'bistrô', 'cantina', 'refeitório', 'comida', 'almoço', 'jantar'],
    exclude: ['roupa', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado']
  },
  'lanchonetes': {
    include: ['lanchonete', 'lanche', 'snack bar', 'fast food', 'lanches', 'hamburgueria', 'açaí', 'salgados'],
    exclude: ['roupa', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado', 'farmácia']
  },
  'hamburguerias': {
    include: ['hamburgueria', 'burger', 'hamburguer', 'hambúrguer', 'artesanal', 'smash'],
    exclude: ['supermercado', 'mercado']
  },
  'pizzarias': {
    include: ['pizzaria', 'pizza', 'rodízio de pizza', 'pizzas', 'delivery pizza'],
    exclude: ['roupa', 'vestuário', 'moda', 'eletro', 'auto peça', 'construção', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'supermercado', 'mercado']
  },
  'padarias': {
    include: ['padaria', 'panificadora', 'panificação', 'pão', 'paes', 'bakery', 'confeitaria'],
    exclude: ['supermercado', 'mercado']
  },
  'confeitarias': {
    include: ['confeitaria', 'doces', 'bolos', 'tortas', 'doceria', 'brigadeiro', 'cake'],
    exclude: ['supermercado', 'mercado']
  },
  'sorveterias': {
    include: ['sorveteria', 'sorvete', 'gelato', 'picolé', 'ice cream'],
    exclude: ['supermercado', 'mercado']
  },
  'açaí': {
    include: ['açaí', 'acai', 'açaiteria', 'bowl'],
    exclude: ['supermercado', 'mercado']
  },
  'materiais de construção': {
    include: ['material de construção', 'construção', 'home center', 'depósito', 'ferragem', 'cimento', 'tijolo', 'telha', 'madeira', 'madeireira', 'hidráulico', 'acabamento', 'piso', 'azulejo', 'tintas', 'leroy', 'tumelero', 'casa de material'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'ferramentas': {
    include: ['ferramenta', 'ferramentaria', 'ferragem', 'parafuso', 'chave', 'furadeira', 'serra', 'martelo', 'alicate', 'máquina', 'equipamento', 'tools'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'pet shop': {
    include: ['pet', 'animal', 'veterinár', 'cão', 'cachorro', 'gato', 'ração', 'banho e tosa', 'petshop', 'pet center', 'agropet'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'construção', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'pet shops': {
    include: ['pet', 'animal', 'veterinár', 'cão', 'cachorro', 'gato', 'ração', 'banho e tosa', 'petshop', 'pet center', 'agropet'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'construção', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'loja de ração pet': {
    include: ['ração', 'pet', 'animal', 'agropet', 'pet shop', 'petshop', 'cão', 'cachorro', 'gato', 'aves', 'peixe', 'casa de ração'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'construção', 'academia', 'hotel', 'salão']
  },
  'fabricantes de ração pet': {
    include: ['ração', 'rações', 'fábrica', 'indústria', 'fabricante', 'pet food', 'petiscos', 'snacks pet', 'produção', 'nutrição animal', 'nutricao', 'granvita', 'quatree', 'nutrisantos', 'alimentação animal', 'alimento animal'],
    mustMatch: ['ração', 'rações', 'ração animal', 'pet food', 'nutrição animal', 'nutricao animal', 'alimento animal', 'alimentos animal', 'alimentação animal', 'alimentacao animal', 'granvita', 'quatree', 'nutrisantos', 'fábrica de ração', 'fabrica de racao', 'indústria de ração', 'industria de racao'],
    exclude: ['pet shop', 'petshop', 'banho e tosa', 'veterinária', 'clínica', 'restaurante', 'lanchonete', 'supermercado', 'construção', 'academia', 'salão', 'agropecuária varejo']
  },
  'banho e tosa': {
    include: ['banho', 'tosa', 'grooming', 'estética animal', 'estética pet', 'tosador', 'pet'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'construção', 'academia', 'hotel humano']
  },
  'hotéis pet': {
    include: ['hotel pet', 'hospedagem pet', 'hospedagem animal', 'hotel canino', 'hotelzinho', 'day care', 'pet'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'construção', 'academia']
  },
  'creches pet': {
    include: ['creche', 'day care', 'pet', 'canino', 'animal', 'cão', 'cachorro'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'construção', 'academia', 'creche infantil', 'escola infantil']
  },
  'adestramento de animais': {
    include: ['adestramento', 'adestrador', 'treinamento', 'canino', 'comportamento', 'pet', 'cão', 'cachorro'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'construção', 'academia fitness']
  },
  'lojas de pneus': {
    include: ['pneu', 'pneus', 'borracharia', 'recapagem', 'recauchutagem', 'calibragem', 'balanceamento', 'alinhamento', 'vulcanização', 'aro', 'roda', 'automotivo', 'veicular'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'padaria', 'farmácia', 'salão', 'academia', 'loja de roupas', 'pet shop', 'bicicleta']
  },
  'lojas de rodas esportivas': {
    include: ['roda', 'rodas', 'esportiva', 'liga leve', 'aro', 'customização', 'personalização', 'automotivo', 'pneu', 'offset', 'step lip', 'furação'],
    exclude: ['restaurante', 'lanchonete', 'supermercado', 'padaria', 'farmácia', 'salão', 'academia', 'loja de roupas', 'pet shop', 'bicicleta', 'skate']
  },
  'granjas': {
    include: ['granja', 'avícola', 'avicola', 'avicultura', 'ovos', 'frango', 'postura', 'corte', 'galinha', 'pintinho', 'aves', 'poedeira', 'matrizes', 'incubatório'],
    mustMatch: ['granja', 'avícola', 'avicola', 'avicultura'],
    exclude: ['pet shop', 'restaurante', 'lanchonete', 'supermercado', 'padaria', 'farmácia', 'salão', 'academia', 'loja de roupas', 'açougue', 'abatedouro', 'frigorífico']
  },
  'abatedouros de aves': {
    include: ['abatedouro', 'frigorífico', 'aves', 'frango', 'avícola', 'abate', 'matadouro', 'processamento', 'granja', 'avicultura', 'galinha', 'peru', 'codorna', 'chester', 'pato', 'caipira'],
    mustMatch: ['abatedouro', 'frigorífico', 'matadouro', 'abate', 'avícola', 'avicola', 'granja', 'frigorific'],
    exclude: ['pet shop', 'restaurante', 'lanchonete', 'supermercado', 'loja de roupas', 'salão', 'academia', 'padaria', 'farmácia', 'açougue', 'casa de carnes']
  },
  'abatedouros de bovinos': {
    include: ['abatedouro', 'frigorífico', 'bovino', 'boi', 'gado', 'abate', 'matadouro', 'carne bovina', 'novilho', 'búfalo', 'desossa', 'charqueada', 'jerked'],
    mustMatch: ['abatedouro', 'frigorífico', 'matadouro', 'abate', 'frigorific', 'charqueada'],
    exclude: ['pet shop', 'restaurante', 'lanchonete', 'supermercado', 'loja de roupas', 'salão', 'academia', 'padaria', 'farmácia', 'açougue', 'casa de carnes']
  },
  'abatedouros de suínos': {
    include: ['abatedouro', 'frigorífico', 'suíno', 'porco', 'abate', 'matadouro', 'carne suína', 'leitão', 'desossa', 'embutidos'],
    mustMatch: ['abatedouro', 'frigorífico', 'matadouro', 'abate', 'frigorific'],
    exclude: ['pet shop', 'restaurante', 'lanchonete', 'supermercado', 'loja de roupas', 'salão', 'academia', 'padaria', 'farmácia', 'açougue', 'casa de carnes']
  },
  'abatedouros e frigoríficos': {
    include: ['abatedouro', 'frigorífico', 'matadouro', 'abate', 'processamento de carnes', 'sala de abate', 'SIF', 'SIE', 'inspeção', 'planta de abate', 'câmara fria'],
    mustMatch: ['abatedouro', 'frigorífico', 'matadouro', 'abate', 'frigorific'],
    exclude: ['pet shop', 'restaurante', 'lanchonete', 'supermercado', 'loja de roupas', 'salão', 'academia', 'padaria', 'farmácia', 'açougue', 'casa de carnes']
  },
  'farmácias': {
    include: ['farmácia', 'drogaria', 'medicamento', 'remédio', 'manipulação', 'farmácias'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'construção', 'pet', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'farmácias e drogarias': {
    include: ['farmácia', 'drogaria', 'medicamento', 'remédio', 'manipulação', 'farmácia popular'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'construção', 'pet', 'ótica', 'joalheria', 'academia', 'hotel']
  },
  'clínicas médicas e odontológicas': {
    include: ['clínica', 'consultório', 'médico', 'medica', 'saúde', 'odontologia', 'odontológica', 'dentista', 'cirurgião dentista', 'cardiologia', 'dermatologia', 'ginecologia', 'pediatria'],
    exclude: ['veterinár', 'pet', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'academia']
  },
  'hospitais e pronto-atendimentos': {
    include: ['hospital', 'pronto atendimento', 'pronto-atendimento', 'pronto socorro', 'pronto-socorro', 'upa', 'unidade de pronto atendimento', 'emergência', 'emergencia'],
    exclude: ['veterinár', 'pet', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'academia']
  },
  'laboratórios e centros de diagnóstico': {
    include: ['laboratório', 'laboratorio', 'análises clínicas', 'analises clinicas', 'diagnóstico', 'diagnostico', 'centro de diagnóstico', 'imagem', 'radiologia', 'ultrassom', 'tomografia', 'ressonância', 'raio-x', 'exames'],
    exclude: ['veterinár', 'pet', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'academia']
  },
  'clínicas de radiologia': {
    include: ['radiologia', 'raio-x', 'raio x', 'tomografia', 'ressonância', 'ressonancia', 'ultrassom', 'ultrassonografia', 'mamografia', 'densitometria', 'diagnóstico por imagem', 'centro de imagem', 'imagem', 'ecografia', 'clínica de imagem', 'radiológica', 'radiologica'],
    exclude: ['veterinár', 'pet', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'academia', 'odontológica']
  },
  'laboratórios de análises clínicas': {
    include: ['laboratório', 'laboratorio', 'análises clínicas', 'analises clinicas', 'exames', 'hemograma', 'patologia', 'coleta', 'exames laboratoriais', 'bioquímica', 'microbiologia', 'diagnóstico laboratorial'],
    exclude: ['veterinár', 'pet', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'academia', 'prótese dentária', 'dental']
  },
  'clínicas de fisioterapia e reabilitação': {
    include: ['fisioterapia', 'fisioterapeuta', 'reabilitação', 'reabilitacao', 'terapia manual', 'ortopédica', 'ortopedica'],
    exclude: ['academia', 'fitness', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'veterinár']
  },
  'ortopedias e lojas de produtos ortopédicos': {
    include: ['ortopedia', 'ortopédico', 'ortopedico', 'órtese', 'ortese', 'prótese', 'protese', 'cadeira de rodas', 'muleta', 'andador', 'colete', 'loja ortopédica', 'produtos ortopédicos'],
    exclude: ['academia', 'fitness', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'veterinár']
  },
  'distribuidoras de produtos hospitalares': {
    include: ['distribuidora hospitalar', 'produtos hospitalares', 'materiais hospitalares', 'distribuidor hospitalar', 'material médico', 'produtos médicos', 'insumos hospitalares', 'med-hosp'],
    mustMatch: ['hospitalar', 'hospital', 'médico', 'medico', 'saúde', 'distribuidora'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'loja de roupa', 'academia']
  },
  'agropecuária': {
    include: ['agropecuária', 'agrícola', 'rural', 'fazenda', 'semente', 'adubo', 'fertilizante', 'ração animal', 'trator', 'implemento', 'agro'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'ótica', 'joalheria', 'salão', 'academia', 'hotel']
  },
  'autopeças': {
    include: ['autopeça', 'auto peça', 'peça automotiva', 'peças automotivas', 'auto peças', 'peças para carro', 'peças veículos', 'auto center', 'auto elétrica', 'retífica', 'rolamento', 'freio', 'suspensão', 'motor', 'câmbio', 'embreagem', 'radiador', 'escapamento', 'amortecedor', 'filtro automotivo', 'peças caminhão', 'peças moto', 'acessórios automotivos', 'autopeças', 'peças e acessórios', 'bateria automotiva', 'pneu', 'correia', 'vela de ignição', 'alternador', 'motor de arranque', 'bomba de combustível', 'disco de freio', 'pastilha de freio', 'junta homocinética', 'kit de embreagem', 'turbina', 'bico injetor'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'padaria', 'farmácia']
  },
  'distribuidores de autopeças': {
    include: ['distribuidora', 'distribuidor', 'atacado', 'autopeça', 'peça automotiva', 'peças automotivas', 'auto peças', 'importadora', 'fornecedor', 'peças para veículos', 'peças para carros', 'peças para caminhões', 'peças importadas', 'autopeças importadas', 'peças genuínas', 'peças originais', 'atacado de peças', 'distribuidora de peças'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'padaria', 'farmácia']
  },
  'oficinas mecânicas': {
    include: ['oficina', 'mecânica', 'auto center', 'autocenter', 'funilaria', 'lanternagem', 'retífica', 'borracharia', 'car service'],
    exclude: ['supermercado', 'restaurante', 'pet', 'salão', 'academia', 'hotel']
  },
  'academias': {
    include: ['academia', 'fitness', 'musculação', 'crossfit', 'pilates', 'ginástica', 'treino', 'gym', 'sport'],
    exclude: ['roupa', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'hotel', 'construção']
  },
  'bares': {
    include: ['bar', 'boteco', 'pub', 'cervejaria', 'choperia', 'taberna', 'happy hour'],
    exclude: ['supermercado', 'mercado']
  },
  'hotéis': {
    include: ['hotel', 'pousada', 'hospedagem', 'resort', 'hostel', 'inn'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'loja']
  },
  'lojas de roupas': {
    include: ['loja de roupa', 'vestuário', 'moda', 'confecção', 'boutique', 'roupas', 'fashion', 'clothing'],
    exclude: ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'pet', 'farmácia', 'construção']
  },
  'óticas': {
    include: ['ótica', 'óptica', 'óculos', 'lentes', 'optometria'],
    exclude: ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'pet', 'farmácia', 'construção']
  },
  'joalherias': {
    include: ['joalheria', 'joias', 'jóias', 'relojoaria', 'relógios', 'bijuteria', 'ouro', 'prata'],
    exclude: ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'pet', 'farmácia', 'construção']
  },
  'salões de beleza': {
    include: ['salão', 'beleza', 'cabeleireiro', 'cabelo', 'barbearia', 'estética', 'beauty', 'hair'],
    exclude: ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'pet', 'farmácia', 'construção']
  },
  'clínicas': {
    include: ['clínica', 'consultório', 'médico', 'saúde', 'odontológica', 'dentista', 'fisioterapia'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'escolas': {
    include: ['escola', 'colégio', 'educação', 'ensino', 'curso', 'instituto', 'escola de'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'papelarias': {
    include: ['papelaria', 'livraria', 'material escolar', 'escritório', 'livros'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'construção']
  },
  'gráficas': {
    include: ['gráfica', 'impressão', 'comunicação visual', 'banner', 'panfleto', 'print'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'transportadoras': {
    include: ['transportadora', 'transporte', 'logística', 'frete', 'encomenda', 'mudanças', 'carga', 'transportes', 'cargas', 'mudança', 'entrega', 'courier', 'express'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'frotistas': {
    include: ['frotista', 'frota', 'gestão de frota', 'veículos', 'locação'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'empresas com frota própria': {
    include: ['frota própria', 'frota', 'veículos', 'transporte próprio'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'empresas de logística': {
    include: ['logística', 'operador logístico', 'armazenagem', 'distribuição', 'fulfillment', 'supply chain'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'locadoras de veículos': {
    include: ['locadora', 'locação', 'aluguel', 'rent a car', 'veículos', 'carros'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'construtoras': {
    include: ['construtora', 'construção civil', 'empreiteira', 'incorporadora', 'engenharia', 'obras', 'construções', 'edificações', 'engenharia civil', 'construção e reforma'],
    exclude: ['material de construção', 'loja', 'depósito', 'supermercado', 'restaurante', 'lanchonete', 'pet']
  },
  'lojas de materiais elétricos': {
    include: ['materiais elétricos', 'material elétrico', 'elétrica', 'loja de elétrica', 'casa de elétrica', 'distribuidora elétrica', 'componentes elétricos', 'fios e cabos', 'disjuntores', 'eletricidade'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'montadores de painel elétrico': {
    include: ['painel elétrico', 'quadro elétrico', 'montagem de painéis', 'painéis elétricos', 'quadros de comando', 'montador', 'ccm', 'centro de controle de motores', 'quadro de distribuição', 'painel de força'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'empresas de automação industrial': {
    include: ['automação industrial', 'automação', 'clp', 'plc', 'instrumentação', 'controle industrial', 'scada', 'ihm', 'inversor de frequência', 'servo motor', 'robótica industrial', 'integração de sistemas'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'instaladores elétricos': {
    include: ['instalador elétrico', 'instalação elétrica', 'eletricista', 'serviços elétricos', 'manutenção elétrica', 'empresa elétrica', 'elétrica industrial', 'elétrica predial', 'elétrica comercial', 'projetos elétricos'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'empresas de manutenção elétrica': {
    include: ['manutenção elétrica', 'reparo elétrico', 'serviços elétricos', 'elétrica industrial', 'manutenção industrial', 'manutenção preventiva', 'manutenção corretiva', 'elétrica predial'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'empresas de energia solar': {
    include: ['energia solar', 'solar', 'fotovoltaica', 'fotovoltaico', 'painel solar', 'placa solar', 'usina solar', 'geração distribuída', 'on grid', 'off grid', 'inversor solar', 'sistema solar'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'indústrias que montam ou reformam painéis': {
    include: ['montagem de painéis', 'reforma de painéis', 'painel elétrico', 'quadro de comando', 'ccm', 'painéis de força', 'quadro elétrico industrial', 'painel de automação', 'painéis industriais', 'montagem elétrica'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  'atacadistas': {
    include: ['atacadista', 'atacado', 'atacadão', 'distribuidor atacado', 'wholesale'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'postos de combustível': {
    include: ['posto', 'combustível', 'gasolina', 'diesel', 'etanol', 'gas station', 'petróleo', 'posto de gasolina', 'abastecimento'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel']
  },
  'distribuidoras': {
    include: ['distribuidora', 'distribuidor', 'distribuição', 'atacado', 'atacadista', 'fornecedor', 'revenda', 'wholesale'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria']
  },
  // Novos segmentos alimentícios
  'panificadoras': {
    include: ['panificadora', 'padaria', 'panificação', 'pão', 'paes'],
    exclude: ['supermercado', 'mercado']
  },
  'docerias': {
    include: ['doceria', 'doces', 'confeitaria', 'brigadeiro', 'trufas', 'chocolate'],
    exclude: ['supermercado', 'mercado']
  },
  'salgadeiros': {
    include: ['salgaderia', 'salgados', 'salgadinho', 'coxinha', 'empada'],
    exclude: ['supermercado', 'mercado']
  },
  'empresas de gulla': {
    include: ['gulla', 'guloseimas', 'doces', 'balas', 'pirulitos'],
    exclude: ['supermercado', 'mercado']
  },
  'pastelarias': {
    include: ['pastelaria', 'pastel', 'pastéis'],
    exclude: ['supermercado', 'mercado']
  },
  'esfiharias': {
    include: ['esfiharia', 'esfiha', 'esfirra', 'esfirras', 'árabe'],
    exclude: ['supermercado', 'mercado']
  },
  'hot dogs': {
    include: ['hot dog', 'cachorro quente', 'dogão'],
    exclude: ['supermercado', 'mercado']
  },
  'food trucks': {
    include: ['food truck', 'comida de rua', 'trailer', 'truck'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'churrascarias': {
    include: ['churrascaria', 'churrasco', 'rodízio de carnes', 'espetaria'],
    exclude: ['supermercado', 'mercado']
  },
  'catering': {
    include: ['catering', 'buffet', 'eventos', 'festas', 'coffee break'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'casas de massas': {
    include: ['casa de massas', 'massa fresca', 'massas artesanais', 'italiano', 'macarrão'],
    exclude: ['supermercado', 'mercado']
  },
  'hotéis e pousadas': {
    include: ['hotel', 'pousada', 'hospedagem', 'resort', 'hostel', 'inn'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'loja']
  },
  // Têxtil e Uniformes - NOVAS CATEGORIAS OTIMIZADAS
  'fábricas de uniformes': {
    include: ['fábrica de uniformes', 'confecção de uniformes', 'indústria de uniformes', 'uniformes profissionais', 'uniformes escolares', 'uniformes corporativos', 'uniformes industriais', 'malharia', 'uniformes esportivos', 'fardamento'],
    exclude: ['loja de roupa', 'boutique', 'moda feminina', 'moda masculina', 'supermercado', 'restaurante', 'lanchonete', 'hotel']
  },
  'confecção de roupas profissionais': {
    include: ['confecção', 'roupas profissionais', 'uniformes', 'jalecos', 'aventais', 'macacões', 'epi vestuário', 'roupas de trabalho', 'vestimenta', 'fardamento', 'scrubs'],
    exclude: ['moda casual', 'boutique', 'loja de roupa', 'supermercado', 'restaurante', 'lanchonete', 'hotel']
  },
  'lojas de tecidos': {
    include: ['tecidos', 'loja de tecidos', 'casa de tecidos', 'armarinho', 'malhas', 'tecidos metro', 'aviamentos', 'atacado de tecidos', 'tecidos decoração', 'tecidos para costura'],
    exclude: ['roupa pronta', 'moda', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'farmácia']
  },
  'lojas de tapeçaria, cortinas e persianas': {
    include: ['tapeçaria', 'cortinas', 'persianas', 'persianista', 'cortineiro', 'blackout', 'decoração de janelas', 'tapetes', 'cortinas sob medida', 'persianas horizontais', 'persianas verticais', 'rolô'],
    exclude: ['roupa', 'moda', 'supermercado', 'restaurante', 'lanchonete', 'hotel', 'farmácia', 'construção']
  },
  // Embalagens - NOVA CATEGORIA OTIMIZADA
  'distribuidoras de embalagens': {
    include: ['embalagens', 'distribuidora de embalagens', 'embalagens plásticas', 'embalagens descartáveis', 'atacado embalagens', 'caixas de papelão', 'sacolas', 'filme stretch', 'embalagens flexíveis', 'bobinas'],
    mustMatch: ['embalagens', 'embalagem', 'descartáveis'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'loja de roupa']
  },
  // Metal e Siderurgia - OTIMIZADO PARA VOLUME (mustMatch flexível)
  'metalúrgicas': {
    include: ['metalúrgica', 'metalurgica', 'fundição', 'usinagem', 'caldeiraria', 'metalurgia', 'tornearia', 'ferramentaria', 'estamparia', 'indústria metalúrgica', 'corte e dobra', 'forjaria', 'tratamento de metais', 'zincagem', 'galvanização', 'cromação', 'repuxo', 'conformação', 'eletroerosão', 'laser metal', 'serralheria industrial', 'trabalho em metal'],
    mustMatch: [], // Removido para aumentar volume - include já valida relevância
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'loja de roupa', 'padaria', 'confeitaria', 'mercado', 'escola', 'academia']
  },
  'siderúrgicas': {
    include: ['siderúrgica', 'siderurgica', 'siderurgia', 'aço', 'ferro gusa', 'laminação', 'aciaria', 'trefilação', 'beneficiamento de aço', 'perfilados', 'chapas de aço', 'corte de aço', 'vergalhão', 'bobinas', 'ferro e aço', 'metalon', 'tubo de aço', 'distribuidor de aço', 'arames', 'telas de aço'],
    mustMatch: [], // Removido para aumentar volume
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'loja de roupa', 'padaria', 'mercado', 'escola']
  },
  'empresas de solda': {
    include: ['solda', 'soldagem', 'caldeiraria', 'soldador', 'montagem industrial', 'estruturas metálicas', 'serralheria', 'solda mig', 'solda tig', 'solda elétrica', 'serviços de soldagem', 'manutenção industrial', 'soldas especiais', 'recuperação de peças', 'soldas em geral', 'oxicorte'],
    mustMatch: [], // Removido para aumentar volume
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'loja de roupa', 'padaria', 'mercado', 'escola', 'academia']
  },
  'caldeirarias': {
    include: ['caldeiraria', 'caldeireiro', 'caldeiras', 'vasos de pressão', 'tubulação industrial', 'montagem industrial', 'estruturas metálicas', 'fabricação de tanques', 'reservatórios metálicos', 'silos metálicos', 'dutos industriais', 'caldeiraria pesada', 'caldeiraria leve', 'montagem mecânica', 'tubulações', 'tanques de aço', 'equipamentos industriais'],
    mustMatch: [], // Removido para aumentar volume
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'usinagens': {
    include: ['usinagem', 'tornearia', 'fresadora', 'torno cnc', 'usinagem cnc', 'retífica', 'ferramentaria', 'peças usinadas', 'centro de usinagem', 'torno mecânico', 'fresagem', 'usinagem de precisão', 'peças sob encomenda', 'serviços de usinagem', 'tornearia mecânica', 'mandrilhamento', 'brunimento', 'balanceamento', 'torno automático', 'torno convencional', 'peças especiais'],
    mustMatch: [], // Removido para aumentar volume
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'estruturas metálicas': {
    include: ['estruturas metálicas', 'estrutura metálica', 'galpão metálico', 'cobertura metálica', 'montagem estrutural', 'serralheria industrial', 'steel frame', 'mezanino metálico', 'escadas metálicas', 'passarelas metálicas', 'portões industriais', 'grades metálicas', 'gradis', 'estrutura de aço', 'construção metálica', 'montagem de galpão', 'barracão metálico', 'serralheria de obras', 'serralheria', 'metalon'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'empresas de steel frame': {
    include: ['steel frame', 'light steel frame', 'steel framing', 'construção a seco', 'construção industrializada', 'construção modular', 'perfil de aço', 'drywall', 'casa steel frame'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'construtoras de pré-moldado': {
    include: ['pré-moldado', 'pré moldado', 'pré-fabricado', 'pré fabricado', 'artefatos de concreto', 'lajes pré-moldadas', 'concreto pré-moldado', 'galpão pré-moldado', 'blocos de concreto', 'muros pré-moldados', 'postes pré-moldados', 'pilares pré-moldados', 'vigas pré-moldadas', 'barracão pré-moldado'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'fabricantes de máquinas e equipamentos': {
    include: ['fábrica de máquinas', 'fabricante de equipamentos', 'máquinas industriais', 'equipamentos industriais', 'indústria de máquinas', 'máquinas e equipamentos', 'equipamentos sob medida', 'máquinas especiais', 'automação industrial', 'linha de produção', 'equipamentos para indústria', 'máquinas para alimentos', 'máquinas para embalagem', 'equipamentos metalúrgicos', 'máquinas agrícolas', 'implementos', 'fabricação de equipamentos', 'máquinas sob encomenda'],
    mustMatch: [], // Removido para aumentar volume
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'loja de roupas', 'escola']
  },
  'distribuidores de aço e ferro': {
    include: ['distribuidora de aço', 'distribuidor de ferro', 'ferro e aço', 'depósito de ferro', 'comércio de aço', 'distribuidora de ferro', 'aço e ferro', 'distribuidora de metais', 'vergalhão', 'chapas de aço', 'metalon', 'tubo de aço', 'perfilados', 'cantoneira', 'viga de aço', 'barra de ferro', 'ferro para construção', 'siderúrgica', 'corte de aço'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  'distribuidores de material médico hospitalar': {
    include: ['distribuidora', 'distribuidor', 'hospitalar', 'hospital', 'médico', 'material médico', 'insumos hospitalares', 'equipamentos médicos', 'cirúrgico', 'ortopédico', 'prótese', 'órtese', 'descartáveis hospitalares', 'laboratório', 'reagentes', 'medicamentos', 'suprimentos', 'OPME', 'gases medicinais', 'oxigênio medicinal', 'curativos', 'seringas', 'luvas', 'sondas', 'cateteres', 'enfermagem', 'saúde'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'padaria', 'escola', 'academia', 'salão', 'pet shop', 'veterinário']
  },
  'distribuidores de pêssegos': {
    include: ['pêssego', 'pessego', 'pêssegos', 'pessegos', 'peach', 'polpa de pêssego', 'conserva de pêssego', 'pêssego em calda', 'beneficiadora de pêssego', 'packing house pêssego', 'pomar de pêssego', 'cultivo de pêssego', 'cooperativa de pêssego', 'processadora de pêssego', 'fruticultura pêssego', 'durazno'],
    mustMatch: ['pêssego', 'pessego', 'pêssegos', 'pessegos', 'peach', 'durazno'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'hotel', 'farmácia', 'padaria', 'escola', 'academia', 'salão', 'pet shop', 'veterinário', 'açougue', 'pizzaria', 'supermercado', 'hortifruti', 'mercado', 'empório', 'loja de', 'armazém', 'varejo', 'varejão', 'mercearia', 'quitanda', 'bomboniere', 'conveniência', 'delivery', 'bebidas', 'descartáveis', 'cesta básica', 'kit churrasco', 'açaí', 'sorvete', 'sacolão', 'feira', 'hortifruit', 'frutas e verduras', 'verdurão', 'frutaria', 'banana', 'maçã', 'laranja', 'manga', 'abacaxi', 'morango', 'uva', 'melancia', 'mamão', 'goiaba', 'limão']
  },
  'serralherias': {
    include: ['serralheria', 'serralheiro', 'portões', 'grades', 'esquadrias metálicas', 'estruturas metálicas', 'portão de ferro', 'grade de ferro', 'corrimão', 'escada de ferro', 'serralheria artística', 'serralheria industrial', 'portão automático', 'gradil', 'portão basculante', 'metalon', 'ferro e aço'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola']
  },
  // Distribuidoras específicas - FILTRO RÍGIDO
  'distribuidoras de doces': {
    include: ['distribuidora de doces', 'atacado de doces', 'doces atacado', 'distribuidor de doces', 'doces distribuidor'],
    mustMatch: ['doces', 'guloseimas', 'balas', 'chocolates'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'padaria', 'confeitaria', 'hotel', 'supermercado', 'fábrica']
  },
  'distribuidores de frios': {
    include: ['distribuidora de frios', 'distribuidor de frios', 'laticínios', 'frios e laticínios', 'frigorífico distribuidor', 'frios atacado'],
    mustMatch: ['frios', 'laticínios', 'lacticínios', 'queijo', 'presunto', 'embutidos'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'padaria', 'confeitaria', 'hotel', 'supermercado']
  },
  'distribuidores de food service': {
    include: ['food service', 'distribuidor', 'distribuidora', 'atacado', 'atacadista', 'fornecedor', 'horeca', 'gastronomia', 'restaurante', 'cozinha profissional', 'cozinha industrial', 'congelados', 'porcionados', 'ingredientes', 'insumos'],
    mustMatch: ['food service', 'foodservice', 'horeca', 'distribuidor', 'distribuidora', 'atacado', 'atacadista', 'fornecedor'],
    exclude: ['pet shop', 'veterinário', 'escola', 'academia', 'salão', 'farmácia', 'roupas', 'calçados', 'móveis', 'eletrônicos', 'informática']
  },
  'atacadistas de food service': {
    include: ['food service', 'atacado', 'atacadista', 'cash and carry', 'atacarejo', 'horeca', 'distribuidor', 'gastronomia'],
    mustMatch: ['food service', 'foodservice', 'horeca', 'atacado', 'atacadista', 'atacarejo'],
    exclude: ['pet shop', 'veterinário', 'escola', 'farmácia', 'roupas', 'calçados']
  },
  'distribuidores de alimentos': {
    include: ['distribuidora de alimentos', 'distribuidor de alimentos', 'atacado alimentos', 'alimentos atacado', 'alimentos distribuidor'],
    mustMatch: ['alimentos', 'alimentício', 'food service', 'horeca'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'padaria', 'confeitaria', 'hotel', 'farmácia', 'roupa']
  },
  // Presentes de Alto Padrão
  'lojas de presentes de alto padrão': {
    include: ['presentes', 'gift', 'cristais', 'porcelana', 'luxo', 'decoração', 'importados', 'presentes finos', 'presentes corporativos', 'artigos de luxo', 'loja de presentes'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'farmácia', 'construção', 'autopeças', 'pet']
  },
  // Perfumarias
  'perfumarias': {
    include: ['perfumaria', 'perfume', 'fragrância', 'cosmético', 'beleza', 'importados', 'essência', 'aromatizador', 'beauty', 'make up', 'maquiagem'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'farmácia', 'construção', 'autopeças', 'pet']
  },
  // Restaurantes Japoneses / Orientais / Chineses
  'restaurantes japoneses': {
    include: ['japonês', 'japones', 'japonesa', 'sushi', 'sashimi', 'temaki', 'yakisoba', 'ramen', 'udon', 'teppanyaki', 'izakaya', 'japa', 'nippon', 'oriental', 'asiático'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'construção', 'autopeças', 'pet']
  },
  'sushi bars': {
    include: ['sushi', 'sashimi', 'temaki', 'japonês', 'japones', 'japonesa', 'japa', 'rodízio de sushi', 'oriental', 'asiático'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'construção', 'autopeças', 'pet']
  },
  'restaurantes orientais': {
    include: ['oriental', 'chinês', 'chines', 'chinesa', 'japonês', 'japones', 'japonesa', 'asiático', 'coreano', 'tailandês', 'wok', 'dim sum', 'yakisoba', 'sushi', 'ramen'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'construção', 'autopeças', 'pet']
  },
  'restaurantes chineses': {
    include: ['chinês', 'chines', 'chinesa', 'china', 'wok', 'dim sum', 'chop suey', 'chow mein', 'oriental', 'asiático', 'yakisoba'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'construção', 'autopeças', 'pet']
  },
  'temakerias': {
    include: ['temakeria', 'temaki', 'hand roll', 'sushi', 'japonês', 'japones', 'japa'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'construção', 'autopeças', 'pet']
  },
  // Restaurantes Premium
  'restaurantes premium': {
    include: ['restaurante', 'gastronomia', 'gourmet', 'fine dining', 'bistrô', 'chef', 'haute cuisine', 'premium', 'sofisticado', 'executivo', 'alta gastronomia'],
    exclude: ['lanchonete', 'fast food', 'supermercado', 'mercado', 'pet', 'construção', 'autopeças']
  },
  // Buffets de Festas
  'buffets de festas': {
    include: ['buffet', 'festas', 'eventos', 'salão de festas', 'casa de festas', 'cerimonial', 'festa infantil', 'casamento', 'aniversário', 'decoração de festas', 'espaço para eventos'],
    exclude: ['supermercado', 'mercado', 'farmácia', 'autopeças', 'pet', 'construção']
  },
  // Locação de Materiais para Eventos
  'empresas de locação de materiais para eventos': {
    include: ['locação', 'aluguel', 'mesas', 'cadeiras', 'toalhas', 'louças', 'tendas', 'festas', 'eventos', 'mobiliário', 'som', 'iluminação', 'decoração'],
    exclude: ['supermercado', 'mercado', 'farmácia', 'autopeças', 'pet', 'restaurante', 'lanchonete']
  },
  // Indústrias de Alimentos
  'indústrias de alimentos': {
    include: ['indústria', 'fábrica', 'industrial', 'alimentos', 'alimentícia', 'alimentar', 'processamento', 'produção', 'manufatura', 'frigorífico', 'laticínio', 'embutidos', 'conservas', 'congelados', 'enlatados'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'padaria', 'confeitaria', 'pizzaria', 'hamburgueria', 'sorveteria', 'cafeteria', 'hotel', 'farmácia', 'escola', 'academia', 'pet shop']
  },
  // Indústrias de Mineração
  'indústrias de mineração': {
    include: ['mineração', 'mineradora', 'mina', 'extração', 'minério', 'beneficiamento', 'lavra', 'garimpo', 'pedreira', 'britagem', 'areia', 'cascalho', 'minerais', 'jazida', 'mining'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola', 'academia']
  },
  // Indústrias Sucroalcooleiras
  'indústrias sucroalcooleiras': {
    include: ['usina', 'açúcar', 'etanol', 'sucroalcooleira', 'destilaria', 'cana-de-açúcar', 'cana', 'álcool', 'bioenergia', 'cogeração', 'bagaço', 'sucro'],
    mustMatch: [],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'farmácia', 'padaria', 'mercado', 'escola', 'academia']
  },
  // Autopeças de Vans e Utilitários
  'autopeças de vans e utilitários': {
    include: ['autopeça', 'auto peça', 'peças', 'van', 'utilitário', 'ducato', 'sprinter', 'master', 'iveco', 'furgão', 'importado', 'land rover', 'bmw', 'mercedes', 'hr', 'bongo', 'veículos importados', 'peças importadas'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'padaria', 'farmácia']
  },
  // E-commerces de Peças Automotivas
  'e-commerces de peças automotivas': {
    include: ['autopeça', 'auto peça', 'peças automotivas', 'online', 'loja virtual', 'e-commerce', 'delivery', 'internet', 'peças para carro', 'peças veículos'],
    exclude: ['roupa', 'alimento', 'supermercado', 'restaurante', 'pet', 'ótica', 'joalheria', 'salão', 'academia', 'hotel', 'padaria', 'farmácia']
  },
  // E-commerces de UD
  'e-commerces de utilidades domésticas': {
    include: ['utilidades', 'domésticas', 'casa', 'cozinha', 'panelas', 'utensílios', 'online', 'loja virtual', 'e-commerce', 'artigos para casa', 'decoração'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'autopeças', 'pet', 'farmácia', 'construção']
  },
  // E-commerces de Perfumaria e Casa
  'e-commerces de perfumaria e casa': {
    include: ['perfumaria', 'aromatizador', 'velas', 'aromáticas', 'home spray', 'difusor', 'ambiente', 'online', 'loja virtual', 'e-commerce', 'fragrância', 'essência'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'autopeças', 'pet', 'farmácia', 'construção', 'supermercado']
  },
  // E-commerces de Sabonetes
  'e-commerces de sabonetes': {
    include: ['sabonete', 'saboaria', 'artesanal', 'cosméticos naturais', 'vegano', 'online', 'loja virtual', 'e-commerce', 'sabão', 'banho', 'corpo'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'autopeças', 'pet', 'farmácia', 'construção', 'supermercado']
  },
  // E-commerces de Presentes Finos
  'e-commerces de presentes finos': {
    include: ['presentes', 'gift', 'luxo', 'finos', 'importados', 'corporativos', 'online', 'loja virtual', 'e-commerce', 'presentes premium', 'decoração'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'autopeças', 'pet', 'farmácia', 'construção', 'supermercado']
  },
  // ===== LOTE 1: Novos nicheKeywords =====
  // Alimentação
  'açaiterias': {
    include: ['açaí', 'acai', 'açaiteria', 'bowl', 'creme de açaí'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'farmácia']
  },
  'casas de açaí': {
    include: ['açaí', 'acai', 'açaiteria', 'bowl'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'farmácia']
  },
  'creperies': {
    include: ['crepe', 'creperie', 'crêpe', 'panqueca'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'farmácia']
  },
  'tapiocarias': {
    include: ['tapioca', 'tapiocaria', 'goma', 'beiju'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'farmácia']
  },
  'restaurantes veganos': {
    include: ['vegano', 'vegan', 'plant based', 'vegetariano', 'restaurante'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes vegetarianos': {
    include: ['vegetariano', 'vegano', 'natural', 'restaurante'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes fit': {
    include: ['fit', 'saudável', 'low carb', 'funcional', 'healthy', 'restaurante'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes self-service': {
    include: ['self service', 'self-service', 'por quilo', 'buffet', 'restaurante'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes italianos': {
    include: ['italiano', 'italiana', 'trattoria', 'osteria', 'cantina', 'pizza', 'massa', 'risoto'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes mexicanos': {
    include: ['mexicano', 'mexicana', 'taco', 'burrito', 'nachos', 'guacamole', 'taqueria'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes árabes': {
    include: ['árabe', 'arabe', 'esfiha', 'quibe', 'shawarma', 'kebab', 'falafel', 'hummus'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'restaurantes de frutos do mar': {
    include: ['frutos do mar', 'peixe', 'camarão', 'lagosta', 'marisco', 'seafood', 'pescados'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'marisquerias': {
    include: ['marisqueria', 'marisco', 'frutos do mar', 'camarão', 'ostra', 'caranguejo'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria', 'pet', 'farmácia']
  },
  'espetarias': {
    include: ['espetaria', 'espeto', 'espetinho', 'churrasco'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'marmitarias': {
    include: ['marmitaria', 'marmita', 'marmitex', 'quentinha', 'refeição'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'chocolaterias': {
    include: ['chocolate', 'chocolateria', 'bombom', 'trufa', 'cacau'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'gelatarias': {
    include: ['gelato', 'gelataria', 'sorvete artesanal', 'sorvete'],
    exclude: ['supermercado', 'mercado', 'fábrica', 'indústria']
  },
  'empórios gourmet': {
    include: ['empório', 'gourmet', 'delicatessen', 'deli', 'importados', 'produtos finos'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet']
  },
  'delicatessens': {
    include: ['delicatessen', 'deli', 'empório', 'finos', 'importados'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet']
  },
  'rotisseries': {
    include: ['rotisserie', 'rotisseria', 'frango assado', 'assados', 'grelhados'],
    exclude: ['supermercado', 'fábrica', 'indústria']
  },
  'casas de carnes': {
    include: ['casa de carnes', 'açougue', 'carnes', 'boutique de carnes', 'churrasco'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet']
  },
  'distribuidoras de carnes': {
    include: ['distribuidora de carnes', 'atacado de carnes', 'frigorífico', 'carnes atacado', 'distribuidor'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de peixes': {
    include: ['distribuidora de peixes', 'pescados', 'peixes atacado', 'frutos do mar atacado'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de congelados': {
    include: ['distribuidora de congelados', 'congelados atacado', 'alimentos congelados', 'distribuidor congelados'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de sorvetes': {
    include: ['distribuidora de sorvetes', 'sorvetes atacado', 'picolés atacado'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de açaí': {
    include: ['distribuidora de açaí', 'açaí atacado', 'polpa de açaí', 'açaí distribuidor'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de polpas de frutas': {
    include: ['distribuidora de polpas', 'polpa de fruta', 'polpas atacado', 'frutas polpa'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de ovos': {
    include: ['distribuidora de ovos', 'ovos atacado', 'granja', 'ovos distribuidor'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de queijos': {
    include: ['distribuidora de queijos', 'queijos atacado', 'laticínios', 'queijo distribuidor'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  'distribuidoras de embutidos': {
    include: ['distribuidora de embutidos', 'embutidos atacado', 'frios', 'salame', 'presunto', 'linguiça'],
    exclude: ['restaurante', 'lanchonete', 'pet', 'farmácia']
  },
  // Indústrias novas
  'indústrias de alimentos congelados': {
    include: ['indústria', 'fábrica', 'congelados', 'alimentos congelados', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de conservas': {
    include: ['indústria', 'fábrica', 'conservas', 'enlatados', 'palmito', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de massas': {
    include: ['indústria', 'fábrica', 'massas', 'macarrão', 'massa industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de temperos e condimentos': {
    include: ['indústria', 'fábrica', 'temperos', 'condimentos', 'especiarias', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de laticínios': {
    include: ['indústria', 'fábrica', 'laticínio', 'laticínios', 'leite', 'queijo', 'iogurte', 'usina de leite'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de sorvetes': {
    include: ['indústria', 'fábrica', 'sorvetes', 'picolés', 'gelados', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de chocolates': {
    include: ['indústria', 'fábrica', 'chocolates', 'cacau', 'bombons', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  'indústrias de café': {
    include: ['indústria', 'fábrica', 'café', 'torrefação', 'torrefadora', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia', 'cafeteria']
  },
  'indústrias de colchões': {
    include: ['indústria', 'fábrica', 'colchões', 'colchão', 'espuma', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia', 'loja']
  },
  'lojas de colchões': {
    include: ['colchão', 'colchões', 'colchoaria', 'cama', 'estofado', 'ortopédico'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'pet', 'farmácia']
  },
  'revendedores de colchões': {
    include: ['colchão', 'colchões', 'revenda', 'revendedor', 'atacado', 'distribuidor', 'colchoaria'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'pet', 'farmácia']
  },
  'colchoarias': {
    include: ['colchão', 'colchões', 'colchoaria', 'cama', 'travesseiro', 'estofado'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'pet', 'farmácia']
  },
  'lojas de colchões terapêuticos': {
    include: ['colchão', 'terapêutico', 'magnético', 'ortopédico', 'hospitalar', 'anti-escaras'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'pet', 'farmácia']
  },
  'distribuidores de colchões': {
    include: ['colchão', 'colchões', 'distribuidora', 'distribuidor', 'atacado', 'atacadista'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'pet', 'farmácia']
  },
  'indústrias de estofados': {
    include: ['indústria', 'fábrica', 'estofados', 'sofá', 'sofás', 'poltrona', 'industrial'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia', 'loja']
  },
  'indústrias de motores elétricos': {
    include: ['indústria', 'fábrica', 'motores elétricos', 'motor elétrico', 'motores industriais', 'WEG'],
    exclude: ['restaurante', 'lanchonete', 'bar', 'supermercado', 'mercado', 'pet', 'farmácia']
  },
  // Saúde
  'clínicas de endocrinologia': {
    include: ['endocrinologia', 'endocrinologista', 'endócrino', 'diabetes', 'tireoide', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de gastroenterologia': {
    include: ['gastroenterologia', 'gastroenterologista', 'gastro', 'digestivo', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de oncologia': {
    include: ['oncologia', 'oncologista', 'câncer', 'quimioterapia', 'centro oncológico', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de medicina do trabalho': {
    include: ['medicina do trabalho', 'ocupacional', 'saúde ocupacional', 'exame admissional', 'PCMSO', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de acupuntura': {
    include: ['acupuntura', 'acupunturista', 'medicina chinesa', 'medicina oriental', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de cirurgia plástica': {
    include: ['cirurgia plástica', 'cirurgião plástico', 'estética', 'lipoaspiração', 'rinoplastia', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de implantes dentários': {
    include: ['implante dentário', 'implantes', 'implantodontia', 'implante', 'dental', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'clínicas de ortodontia': {
    include: ['ortodontia', 'ortodontista', 'aparelho', 'invisalign', 'dental', 'clínica'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'farmácias de manipulação': {
    include: ['manipulação', 'farmácia de manipulação', 'magistral', 'fórmulas', 'farmácia'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  'centros de diagnóstico por imagem': {
    include: ['diagnóstico por imagem', 'radiologia', 'ressonância', 'tomografia', 'ultrassom', 'raio-x', 'centro de diagnóstico'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'autopeças']
  },
  // Serviços e B2B
  'agências de marketing digital': {
    include: ['marketing digital', 'agência digital', 'marketing', 'publicidade digital', 'social media'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'farmácia']
  },
  'empresas de desenvolvimento de software': {
    include: ['desenvolvimento de software', 'software', 'software house', 'sistemas', 'aplicativos', 'TI'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'farmácia']
  },
  'provedores de internet': {
    include: ['provedor de internet', 'internet', 'fibra óptica', 'banda larga', 'ISP', 'telecomunicações'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'farmácia']
  },
  'empresas de cftv': {
    include: ['CFTV', 'câmeras', 'vigilância', 'monitoramento', 'segurança eletrônica', 'circuito fechado'],
    exclude: ['supermercado', 'restaurante', 'pet', 'construção', 'farmácia']
  },
  'importadoras': {
    include: ['importadora', 'importação', 'comércio exterior', 'produtos importados', 'trading'],
    exclude: ['supermercado', 'restaurante', 'pet', 'farmácia']
  },
  'exportadoras': {
    include: ['exportadora', 'exportação', 'comércio exterior', 'trading'],
    exclude: ['supermercado', 'restaurante', 'pet', 'farmácia']
  },
  'empresas de motoboy': {
    include: ['motoboy', 'motofrete', 'moto entrega', 'entrega rápida', 'courier moto'],
    exclude: ['supermercado', 'restaurante', 'pet', 'farmácia', 'construção']
  },
  'guincho e reboque': {
    include: ['guincho', 'reboque', 'auto socorro', 'socorro mecânico', 'resgate veicular'],
    exclude: ['supermercado', 'restaurante', 'pet', 'farmácia', 'construção']
  },
  // Comércio
  'lojas de bebidas': {
    include: ['bebidas', 'adega', 'distribuidora de bebidas', 'casa de bebidas', 'drink'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet', 'construção']
  },
  'lojas de vinhos': {
    include: ['vinhos', 'wine', 'adega', 'enoteca', 'vinho'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet', 'construção']
  },
  'lojas de conveniência': {
    include: ['conveniência', 'am pm', 'select', 'loja 24h'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet', 'construção']
  },
  'lojas de games e videogames': {
    include: ['games', 'videogames', 'gamer', 'playstation', 'xbox', 'nintendo', 'jogos'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet', 'construção', 'restaurante']
  },
  'lojas de artigos para bebê': {
    include: ['bebê', 'baby', 'enxoval', 'infantil', 'gestante', 'maternidade'],
    exclude: ['fábrica', 'indústria', 'farmácia', 'pet', 'construção', 'restaurante']
  }
};

// RELAXED: Universal exclusion map - only exclude very different business types
// Reduced exclusions to maximize leads while maintaining basic relevance
const universalExclusionsByCategory: { [key: string]: string[] } = {
  // Food industries - only exclude clear non-industries
  'indústrias de alimentos': ['bar', 'boteco', 'pub', 'cafeteria', 'mercado', 'supermercado'],
  'indústrias de salgados': ['bar', 'boteco', 'pub', 'mercado', 'supermercado'],
  'indústrias de biscoitos': ['bar', 'boteco', 'pub', 'mercado', 'supermercado'],
  'indústrias de massas': ['bar', 'pub', 'supermercado', 'mercado'],
  'indústrias de pães': ['bar', 'pub', 'supermercado', 'mercado'],
  'indústrias de doces': ['bar', 'pub', 'supermercado', 'mercado'],
  'indústrias de laticínios': ['bar', 'pub', 'supermercado', 'mercado'],
  'indústrias de produtos pet': ['restaurante', 'lanchonete', 'bar', 'pub'],
  'fabricantes de ração pet': ['restaurante', 'lanchonete', 'bar', 'pub', 'supermercado'],
  'banho e tosa': ['restaurante', 'lanchonete', 'supermercado', 'construção'],
  'hotéis pet': ['restaurante', 'lanchonete', 'supermercado', 'construção'],
  'creches pet': ['restaurante', 'lanchonete', 'supermercado', 'construção'],
  'adestramento de animais': ['restaurante', 'lanchonete', 'supermercado', 'construção'],
  'abatedouros de aves': ['pet shop', 'restaurante', 'lanchonete', 'supermercado'],
  'abatedouros de bovinos': ['pet shop', 'restaurante', 'lanchonete', 'supermercado'],
  'abatedouros de suínos': ['pet shop', 'restaurante', 'lanchonete', 'supermercado'],
  'abatedouros e frigoríficos': ['pet shop', 'restaurante', 'lanchonete', 'supermercado'],
  
  // Distributors - only exclude direct retail competitors
  'distribuidoras de doces': ['restaurante', 'lanchonete'],
  'distribuidores de frios': ['restaurante', 'lanchonete'],
  'distribuidoras': ['restaurante', 'lanchonete'],
  
  // Food service - reduced exclusions
  'restaurantes': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'lanchonetes': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'pizzarias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'hamburguerias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'padarias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'panificadoras': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'confeitarias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'docerias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'pastelarias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'esfiharias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'hot dogs': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'food trucks': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'bares': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'churrascarias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'catering': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'casas de massas': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'restaurantes japoneses': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'sushi bars': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'restaurantes orientais': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'restaurantes chineses': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'temakerias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'sorveterias': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  'açaí': ['mercado', 'supermercado', 'fábrica', 'indústria'],
  
  // Retail - minimal exclusions
  'supermercados': ['fábrica', 'indústria'],
  'hipermercados': ['fábrica', 'indústria'],
  'atacadistas': ['fábrica', 'indústria'],
  'farmácias': ['fábrica', 'indústria'],
  'farmácias e drogarias': ['fábrica', 'indústria'],
  'pet shop': ['fábrica', 'indústria'],
  // Hospitalidade
  'hotéis e pousadas': ['supermercado', 'mercado', 'fábrica', 'indústria', 'loja'],
  // Saúde (evitar misturar com varejo/serviços não-relacionados)
  'hospitais e pronto-atendimentos': ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'bar', 'hotel', 'academia'],
  'laboratórios e centros de diagnóstico': ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'bar', 'hotel', 'academia'],
  'clínicas médicas e odontológicas': ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'bar', 'hotel'],
  'clínicas de fisioterapia e reabilitação': ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'bar', 'hotel'],
  'ortopedias e lojas de produtos ortopédicos': ['supermercado', 'mercado', 'restaurante', 'lanchonete', 'bar', 'hotel'],
  'distribuidoras de produtos hospitalares': ['restaurante', 'lanchonete', 'bar', 'supermercado', 'hotel', 'academia'],
};


// Check if result is relevant to searched niche - ULTRA STRICT VERSION
function isRelevantToNiche(place: any, segment: string): boolean {
  const segmentLower = segment.toLowerCase();
  const title = (place.title || '').toLowerCase();
  const category = (place.categoryName || place.categories?.[0] || '').toLowerCase();
  const allCategories = (place.categories || []).join(' ').toLowerCase();
  const combinedText = `${title} ${category} ${allCategories}`;
  
  // ===== STEP 1: UNIVERSAL EXCLUSIONS =====
  // Check if the segment has universal exclusions
  let universalExclusions = universalExclusionsByCategory[segmentLower];
  
  // Try partial matching for universal exclusions
  if (!universalExclusions) {
    for (const [key, exclusions] of Object.entries(universalExclusionsByCategory)) {
      if (segmentLower.includes(key) || key.includes(segmentLower)) {
        universalExclusions = exclusions;
        break;
      }
    }
  }
  
  // Apply universal exclusions STRICTLY
  if (universalExclusions) {
    for (const exclusion of universalExclusions) {
      if (combinedText.includes(exclusion)) {
        // Exception: if title explicitly contains the search term, allow it
        // e.g., searching "indústrias de alimentos" and title contains "indústria de alimentos"
        const segmentWords = segmentLower.split(/\s+/).filter(w => w.length > 3);
        const hasExplicitMatch = segmentWords.some(word => title.includes(word));
        
        if (!hasExplicitMatch) {
          console.log(`❌ Universal exclusion: "${place.title}" excluded for "${segmentLower}" - matches: ${exclusion}`);
          return false;
        }
      }
    }
  }
  
  // ===== STEP 2: SPECIAL HANDLING FOR INDUSTRY SEARCHES =====
  if (isIndustrySearch(segmentLower)) {
    if (!isRealIndustry(place)) {
      return false;
    }
  }
  
  // ===== STEP 3: SPECIAL HANDLING FOR SOCCER SCHOOL SEARCHES =====
  if (isSoccerSchoolSearch(segmentLower)) {
    if (!isIndependentSoccerSchool(place)) {
      return false;
    }
  }
  
  // ===== STEP 4: NICHE-SPECIFIC KEYWORD MATCHING =====
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
  
  // If no specific niche config, use SMART AUTO-MATCHING
  if (!nicheConfig) {
    // Generic exclusions
    const genericExclusions = ['magazine luiza', 'americanas', 'casas bahia'];
    for (const exclude of genericExclusions) {
      if (combinedText.includes(exclude)) {
        console.log(`❌ Generic exclusion: "${place.title}" - matches: ${exclude}`);
        return false;
      }
    }
    
    // Normalize text for accent-insensitive matching
    const normalizeForMatch = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedCombined = normalizeForMatch(combinedText);
    const normalizedSegment = normalizeForMatch(segmentLower);
    
    // Extract meaningful keywords from segment (skip common prefixes/articles)
    const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'para', 'por', 'com', 'sem', 'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'lojas', 'loja', 'empresas', 'empresa', 'servicos', 'servico', 'centro', 'centros']);
    const searchTermWords = normalizedSegment.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    // Also extract the core concept (after removing common prefixes)
    const prefixRemoval = normalizedSegment
      .replace(/^(lojas?|distribuidoras?|industrias?|fabricas?|empresas?|clinicas?|centros?|agencias?|escritorios?|casas?|atelies?|estudios?|academias?|escolas?|cursos?|instalador(as|es)?|construtoras?|cooperativas?|criador(as|es)?|produtor(as|es)?|fornecedor(as|es)?|atacadistas?|oficinas?|startups?|franquias?|redes?|e-commerces?|laboratorios?|usinas?|provedores?|consultorias?|beneficiadoras?|fazendas?)\s+(de|do|da|dos|das|em|para|)\s*/i, '')
      .trim();
    
    let foundMatch = false;
    
    // Strategy 1: Check if any meaningful word from segment appears in place data
    for (const word of searchTermWords) {
      if (normalizedCombined.includes(word)) {
        foundMatch = true;
        break;
      }
    }
    
    // Strategy 2: Check core concept (without prefix)
    if (!foundMatch && prefixRemoval.length >= 3) {
      const coreWords = prefixRemoval.split(/\s+/).filter(w => w.length >= 3);
      for (const coreWord of coreWords) {
        if (normalizedCombined.includes(coreWord)) {
          foundMatch = true;
          break;
        }
      }
    }
    
    // Strategy 3: Check if segment root (singular form) appears
    if (!foundMatch) {
      const roots = [normalizedSegment];
      if (normalizedSegment.endsWith('s')) roots.push(normalizedSegment.slice(0, -1));
      if (normalizedSegment.endsWith('es')) roots.push(normalizedSegment.slice(0, -2));
      if (normalizedSegment.endsWith('oes')) roots.push(normalizedSegment.replace(/oes$/, 'ao'));
      if (normalizedSegment.endsWith('ais')) roots.push(normalizedSegment.replace(/ais$/, 'al'));
      
      for (const root of roots) {
        if (root.length >= 4 && normalizedCombined.includes(root)) {
          foundMatch = true;
          break;
        }
      }
    }
    
    // Strategy 4: For very specific segments, accept if the Google Places category 
    // is semantically related (e.g. types contain relevant Google categories)
    if (!foundMatch) {
      const googleTypes = (place.types || place.categories || []).map((t: string) => normalizeForMatch(t));
      const categoryHints: { [key: string]: string[] } = {
        'restaurant': ['restaurante', 'bistr', 'cantina', 'churrascaria', 'pizzaria', 'hamburgueria', 'lanchonete', 'espetaria', 'marmitaria', 'rotisserie', 'buffet', 'casas de'],
        'cafe': ['cafe', 'cafeteria', 'coffee', 'cha'],
        'bakery': ['padaria', 'panificadora', 'confeitaria', 'doceria', 'patisserie'],
        'bar': ['bar', 'pub', 'cervejaria', 'choperia'],
        'store': ['loja', 'comercio', 'varejo'],
        'gym': ['academia', 'fitness', 'crossfit', 'musculacao', 'pilates', 'yoga'],
        'beauty_salon': ['salao', 'beleza', 'cabeleireiro', 'barbearia', 'estetica'],
        'health': ['clinica', 'consultorio', 'medico', 'saude', 'fisioterapia', 'odontologia'],
        'hospital': ['hospital', 'pronto', 'upa'],
        'school': ['escola', 'colegio', 'curso', 'ensino', 'educacao'],
        'lodging': ['hotel', 'pousada', 'hospedagem', 'hostel'],
        'car_repair': ['oficina', 'mecanica', 'funilaria', 'auto', 'autopeca', 'auto peca', 'peca', 'pneu'],
        'car_parts_store': ['autopeca', 'auto peca', 'peca', 'auto', 'automotiv'],
        'auto_parts_store': ['autopeca', 'auto peca', 'peca', 'auto', 'automotiv'],
        'pet_store': ['pet', 'animal', 'veterinar', 'racao'],
        'pharmacy': ['farmacia', 'drogaria', 'manipulacao'],
      };
      
      for (const gType of googleTypes) {
        const hints = categoryHints[gType];
        if (hints) {
          for (const hint of hints) {
            if (normalizedSegment.includes(hint)) {
              foundMatch = true;
              break;
            }
          }
          if (foundMatch) break;
        }
      }
    }
    
    if (!foundMatch && searchTermWords.length > 0) {
      console.log(`❌ No search term match: "${place.title}" - none of [${searchTermWords.join(', ')}] found in "${combinedText.substring(0, 100)}"`);
      return false;
    }
    
    // Auto-generate category-aware exclusions for unmapped segments
    // ONLY exclude from TITLE (not categories) to avoid false positives from Google types
    const autoExclusions: { [key: string]: string[] } = {
      'restaurante': ['supermercado', 'fabrica', 'industria'],
      'loja': ['restaurante', 'lanchonete', 'fabrica', 'industria'],
      'industria': ['restaurante', 'lanchonete', 'bar ', 'supermercado'],
      'fabrica': ['restaurante', 'lanchonete', 'bar ', 'supermercado'],
      'distribuidora': ['restaurante', 'lanchonete'],
      'clinica': ['restaurante', 'lanchonete', 'supermercado'],
      'escola': ['restaurante', 'lanchonete', 'supermercado'],
      'academia': ['restaurante', 'lanchonete', 'supermercado'],
      'hotel': ['restaurante', 'lanchonete', 'supermercado'],
      'escritorio': ['restaurante', 'lanchonete', 'supermercado'],
      'agencia': ['restaurante', 'lanchonete', 'supermercado'],
    };
    
    for (const [categoryKey, exclusions] of Object.entries(autoExclusions)) {
      if (normalizedSegment.includes(categoryKey)) {
        for (const excl of exclusions) {
          // Only check against the TITLE, not combined text (Google types cause false positives)
          if (normalizeForMatch(title).includes(excl) && !normalizedSegment.includes(excl.trim())) {
            console.log(`❌ Auto-exclusion: "${place.title}" excluded for "${segmentLower}" - title matches: ${excl}`);
            return false;
          }
        }
        break;
      }
    }
    
    return true;
  }
  
  // ===== STEP 5: Check ALL exclusions from niche config =====
  for (const exclude of nicheConfig.exclude) {
    if (combinedText.includes(exclude)) {
      console.log(`❌ Niche exclusion: "${place.title}" - matches: ${exclude}`);
      return false;
    }
  }
  
  // ===== STEP 5.5: MUST MATCH check (strict segments like distribuidores de pêssegos) =====
  if (nicheConfig.mustMatch && nicheConfig.mustMatch.length > 0) {
    let hasMustMatch = false;
    for (const must of nicheConfig.mustMatch) {
      if (combinedText.includes(must)) {
        hasMustMatch = true;
        break;
      }
    }
    if (!hasMustMatch) {
      console.log(`❌ Must-match failed: "${place.title}" in ${segmentLower} - none of [${nicheConfig.mustMatch.join(', ')}] found`);
      return false;
    }
  }
  
  // ===== STEP 6: REQUIRE at least one include keyword match =====
  let hasIncludeMatch = false;
  for (const incl of nicheConfig.include) {
    if (combinedText.includes(incl)) {
      hasIncludeMatch = true;
      break;
    }
  }
  
  if (!hasIncludeMatch) {
    console.log(`❌ No include match: "${place.title}" in ${segmentLower} - rejected (no relevant keyword found)`);
    return false;
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
  const beforePlaceIdDedup = results.length;
  results = results.filter((place: any) => {
    if (place.placeId && seenPlaceIds.has(place.placeId)) return false;
    if (place.placeId) seenPlaceIds.add(place.placeId);
    return true;
  });
  if (results.length < beforePlaceIdDedup) console.log(`📊 PlaceId dedup removed ${beforePlaceIdDedup - results.length}`);
  
  // Step 3b: Deduplicate by phone number (same phone = same business)
  const seenPhones = new Set<string>();
  const beforePhoneDedup = results.length;
  results = results.filter((place: any) => {
    const phone = (place.phone || place.phoneUnformatted || '').replace(/\D/g, '');
    if (phone.length >= 8) {
      const phoneKey = phone.slice(-8); // last 8 digits to normalize
      if (seenPhones.has(phoneKey)) return false;
      seenPhones.add(phoneKey);
    }
    return true;
  });
  if (results.length < beforePhoneDedup) console.log(`📊 Phone dedup removed ${beforePhoneDedup - results.length}`);
  
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
    // Regular deduplication by normalized name (same name = same business, even with different address)
    const seenNames = new Set<string>();
    const beforeNameDedup = results.length;
    results = results.filter((place: any) => {
      const key = normalizeCompanyName(place.title);
      if (key.length >= 5 && seenNames.has(key)) return false;
      if (key.length >= 5) seenNames.add(key);
      return true;
    });
    if (results.length < beforeNameDedup) console.log(`📊 Name dedup removed ${beforeNameDedup - results.length}`);
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

// Email extraction from website - tries main page + contact page
async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl || websiteUrl === 'Não disponível') return '';
  
  try {
    let url = websiteUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;
    
    const fetchPage = async (pageUrl: string): Promise<string[]> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch(pageUrl, { 
          signal: controller.signal,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
          },
          redirect: 'follow'
        });
        clearTimeout(timeout);
        
        if (!response.ok) return [];
        
        const html = await response.text();
        
        // Extract emails from mailto: links and text content
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        const emails = html.match(emailRegex) || [];
        
        // Also extract from mailto: links specifically
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
        const mailtoMatches = [...html.matchAll(mailtoRegex)].map(m => m[1]);
        
        return [...new Set([...mailtoMatches, ...emails])];
      } catch {
        return [];
      }
    };
    
    // Filter out common false positives
    const blacklist = ['example.com', 'email.com', 'domain.com', 'yoursite.com', 'sentry.io', 'wixpress.com', 'google.com', 'facebook.com', 'wordpress.com', 'w3.org', 'schema.org', 'gravatar.com', 'jquery.com', 'googleapis.com', 'cloudflare.com', 'gstatic.com', 'bootstrapcdn.com', 'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fontawesome.com'];
    
    const filterEmails = (emails: string[]) => {
      return emails.filter(email => {
        const domain = email.split('@')[1]?.toLowerCase() || '';
        return !blacklist.some(bl => domain.includes(bl)) && 
               !email.includes('..') && 
               !email.startsWith('.') &&
               !email.endsWith('.') &&
               email.length < 60 &&
               email.length > 5;
      });
    };
    
    // Try main page first
    let allEmails = filterEmails(await fetchPage(url));
    
    // If no emails found, try common contact pages
    if (allEmails.length === 0) {
      const baseUrl = url.replace(/\/+$/, '');
      const contactPaths = ['/contato', '/contact', '/fale-conosco', '/sobre', '/about'];
      
      for (const path of contactPaths) {
        const contactEmails = filterEmails(await fetchPage(`${baseUrl}${path}`));
        if (contactEmails.length > 0) {
          allEmails = contactEmails;
          break;
        }
      }
    }
    
    if (allEmails.length === 0) return '';
    
    // Prefer contact/commercial emails
    const priorityKeywords = ['contato', 'comercial', 'vendas', 'sac', 'atendimento', 'info', 'contact', 'sales', 'financeiro', 'adm', 'compras'];
    const priorityEmail = allEmails.find(e => priorityKeywords.some(k => e.toLowerCase().includes(k)));
    
    return priorityEmail || allEmails[0] || '';
  } catch {
    return '';
  }
}

// Batch extract emails from websites (parallel with concurrency limit)
async function batchExtractEmails(places: any[], concurrency = 3): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  const placesWithWebsite = places.filter(p => {
    const w = p.website || p._website;
    return w && w !== 'Não disponível' && typeof w === 'string' && w.trim().length > 5;
  });
  
  if (placesWithWebsite.length === 0) return emailMap;
  
  // Limit to max 25 websites to extract emails from (with contact page fallback, each takes longer)
  const limitedPlaces = placesWithWebsite.slice(0, 25);
  console.log(`📧 Extracting emails from ${limitedPlaces.length} websites (of ${placesWithWebsite.length} available)...`);
  
  // Process in batches of 3 (lower concurrency since we now try contact pages too)
  for (let i = 0; i < limitedPlaces.length; i += concurrency) {
    const batch = limitedPlaces.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (place) => {
        const websiteUrl = place.website || place._website;
        const email = await extractEmailFromWebsite(websiteUrl);
        return { id: place.placeId || place.place_id || place.id, email };
      })
    );
    results.forEach(r => {
      if (r.email) emailMap.set(r.id, r.email);
    });
  }
  
  console.log(`📧 Found ${emailMap.size} emails from ${limitedPlaces.length} websites`);
  return emailMap;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global search cache
const searchCacheGlobal = new Map<string, any[]>();

serve(async (req) => {
  searchCacheGlobal.clear();
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, products, region, country, filters, ecommerceType, businessType, digitalPresence, digitalActivity, whatsappOnly, receitaFederalOnly } = await req.json();
    console.log('🔍 SEARCH v13 - State Search Boost - Input:', { segment, products, region, country, ecommerceType, businessType, digitalPresence, digitalActivity, whatsappOnly, receitaFederalOnly });
    
    const countryCode = country || 'BR';
    const bizType = businessType || 'all';
    const digPresence = digitalPresence || 'all';
    const digActivity = digitalActivity || 'all';
    const filterWhatsappOnly = whatsappOnly || false;
    const filterReceitaFederal = receitaFederalOnly || false;
    
    // Check if this is an e-commerce search with specific type
    const isEcommerceSearch = segment.toLowerCase().includes('e-commerce') || segment.toLowerCase().includes('ecommerce');
    
    // Build location query
    const cleanRegion = region.trim();
    const locationQuery = countryCode === 'BR' 
      ? `${cleanRegion}, Brazil`
      : `${cleanRegion}, ${countryCode}`;
    
    // Detect state-only search (2-letter state abbreviation or full state name)
    const brazilianStateAbbrevs = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];
    const brazilianStateNames: { [key: string]: boolean } = {'acre':true,'alagoas':true,'amapa':true,'amazonas':true,'bahia':true,'ceara':true,'distrito federal':true,'espirito santo':true,'goias':true,'maranhao':true,'mato grosso':true,'mato grosso do sul':true,'minas gerais':true,'para':true,'paraiba':true,'parana':true,'pernambuco':true,'piaui':true,'rio de janeiro':true,'rio grande do norte':true,'rio grande do sul':true,'rondonia':true,'roraima':true,'santa catarina':true,'sao paulo':true,'sergipe':true,'tocantins':true};
    const normalizedRegionCheck = cleanRegion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const isStateOnlySearch = brazilianStateAbbrevs.includes(normalizedRegionCheck) || brazilianStateNames[normalizedRegionCheck] === true;
    
    console.log('📍 Location:', locationQuery);
    console.log('🏢 Business type:', bizType);
    console.log('📱 WhatsApp only:', filterWhatsappOnly);
    console.log('🏛️ Receita Federal only:', filterReceitaFederal);
    console.log('🗺️ State-only search:', isStateOnlySearch);
    
    // ===== GOOGLE PLACES API KEY =====
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY não configurada.");
    }
    
    console.log(`🔑 Google Places API Key configured`);

    // ===== FETCH USER-SPECIFIC LEAD LIMITS =====
    let userMaxLeads: number | null = null;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          const { data: limitData } = await supabaseClient
            .from("user_lead_limits")
            .select("leads_per_search")
            .eq("user_id", user.id)
            .maybeSingle();
          if (limitData?.leads_per_search) {
            userMaxLeads = limitData.leads_per_search;
            console.log(`👤 User ${user.email} has custom lead limit: ${userMaxLeads}`);
          }
        }
      }
    } catch (e) {
      console.error("⚠️ Error fetching user limits:", e);
    }

    // State-only searches get higher limits (up to 347)
    // Distribuidores de Material gets maximum volume
    const isDistribuidorMaterialSearch = segment.toLowerCase().includes('distribuidores de material');
    const isIndustriaMecanicaSearch = segment.toLowerCase().includes('indústrias mecânicas') || segment.toLowerCase().includes('industrias mecanicas');
    const isDistribuidorPessegosSearch = segment.toLowerCase().includes('distribuidores de pêssegos') || segment.toLowerCase().includes('distribuidores de pessegos');
    const isBoostSearch = isDistribuidorMaterialSearch || isIndustriaMecanicaSearch || isDistribuidorPessegosSearch;
    
    // Count selected segments to adjust limits (segments are comma-separated)
    const selectedSegments = segment.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const segmentCount = selectedSegments.length;
    console.log(`📋 Number of selected segments: ${segmentCount}`);
    
    // Dynamic limits based on number of selected segments — maximized for all users
    let defaultMaxLeads: number;
    if (isBoostSearch) {
      defaultMaxLeads = 1500;
    } else if (segmentCount >= 3) {
      defaultMaxLeads = 1200;
    } else if (segmentCount === 2) {
      defaultMaxLeads = 1000;
    } else {
      defaultMaxLeads = isStateOnlySearch ? 800 : 500;
    }
    
    const MAX_TOTAL_LEADS = userMaxLeads || defaultMaxLeads;
    const MIN_LEADS_TARGET = isBoostSearch ? 300 : (segmentCount >= 3 ? 350 : (segmentCount === 2 ? 250 : (isStateOnlySearch ? 200 : 150)));
    const TARGET_LEADS = isBoostSearch ? 800 : (segmentCount >= 3 ? 900 : (segmentCount === 2 ? 700 : (isStateOnlySearch ? 500 : 300)));
    const MAX_TARGET_LEADS = isBoostSearch ? 1200 : (segmentCount >= 3 ? 1100 : (segmentCount === 2 ? 900 : (isStateOnlySearch ? 700 : 450)));
    const MIN_LEADS_EARLY_EXIT = isBoostSearch ? 1400 : (segmentCount >= 3 ? 1150 : (segmentCount === 2 ? 950 : (isStateOnlySearch ? 750 : 480)));
    
    console.log(`📊 Lead limits: max=${MAX_TOTAL_LEADS}, target=${TARGET_LEADS}, stateSearch=${isStateOnlySearch}`);

    // Major cities by state for expanded state searches
    const stateCities: { [key: string]: string[] } = {
      'ac': ['Rio Branco', 'Cruzeiro do Sul'],
      'al': ['Maceió', 'Arapiraca'],
      'ap': ['Macapá', 'Santana'],
      'am': ['Manaus', 'Parintins'],
      'ba': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Juazeiro', 'Barreiras'],
      'ce': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato'],
      'df': ['Brasília', 'Taguatinga', 'Ceilândia', 'Samambaia'],
      'es': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Linhares', 'Cachoeiro de Itapemirim'],
      'go': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia'],
      'ma': ['São Luís', 'Imperatriz', 'Timon'],
      'mt': ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop'],
      'ms': ['Campo Grande', 'Dourados', 'Três Lagoas'],
      'mg': ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Poços de Caldas'],
      'pa': ['Belém', 'Ananindeua', 'Santarém', 'Marabá'],
      'pb': ['João Pessoa', 'Campina Grande'],
      'pr': ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá'],
      'pe': ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista'],
      'pi': ['Teresina', 'Parnaíba'],
      'rj': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Macaé', 'São João de Meriti', 'Mesquita', 'Nilópolis', 'Itaboraí', 'Magé', 'Maricá', 'Cabo Frio', 'Angra dos Reis', 'Resende', 'Teresópolis'],
      'rn': ['Natal', 'Mossoró', 'Parnamirim'],
      'rs': ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul', 'Cachoeirinha', 'Bagé', 'Bento Gonçalves', 'Erechim', 'Lajeado'],
      'ro': ['Porto Velho', 'Ji-Paraná'],
      'rr': ['Boa Vista'],
      'sc': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma', 'Itajaí', 'Jaraguá do Sul', 'Lages', 'Palhoça', 'Balneário Camboriú'],
      'sp': ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'São José do Rio Preto', 'Mogi das Cruzes', 'Diadema', 'Jundiaí', 'Piracicaba', 'Bauru', 'Mauá', 'Carapicuíba', 'Limeira', 'Taubaté'],
      'se': ['Aracaju', 'Nossa Senhora do Socorro'],
      'to': ['Palmas', 'Araguaína'],
    };

    // Resolve state abbreviation from region
    const stateAbbrev = normalizedRegionCheck.length === 2 ? normalizedRegionCheck : 
      Object.entries({
        'acre':'ac','alagoas':'al','amapa':'ap','amazonas':'am','bahia':'ba','ceara':'ce',
        'distrito federal':'df','espirito santo':'es','goias':'go','maranhao':'ma',
        'mato grosso':'mt','mato grosso do sul':'ms','minas gerais':'mg','para':'pa',
        'paraiba':'pb','parana':'pr','pernambuco':'pe','piaui':'pi','rio de janeiro':'rj',
        'rio grande do norte':'rn','rio grande do sul':'rs','rondonia':'ro','roraima':'rr',
        'santa catarina':'sc','sao paulo':'sp','sergipe':'se','tocantins':'to'
      }).find(([name]) => name === normalizedRegionCheck)?.[1] || '';
    
    const citiesForState = isStateOnlySearch && stateAbbrev ? (stateCities[stateAbbrev] || []) : [];

    // Function to search places using Google Places API (New)
    // Geocode a location string to get lat/lng for locationBias
    const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
    async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
      if (geocodeCache.has(location)) return geocodeCache.get(location) || null;
      try {
        const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            geocodeCache.set(location, loc);
            return loc;
          }
        }
      } catch (e) {
        console.error('⚠️ Geocode error:', e);
      }
      geocodeCache.set(location, null);
      return null;
    }

    // Pre-geocode the main location for locationBias
    const mainGeocode = await geocodeLocation(locationQuery);
    if (mainGeocode) {
      console.log(`📍 Geocoded ${locationQuery} → ${mainGeocode.lat}, ${mainGeocode.lng}`);
    }

    // Concurrency limiter to avoid exceeding 600 req/min quota
    const MAX_CONCURRENT = 25;
    let activeRequests = 0;
    const requestQueue: (() => void)[] = [];

    async function acquireSlot(): Promise<void> {
      if (activeRequests < MAX_CONCURRENT) {
        activeRequests++;
        return;
      }
      return new Promise<void>((resolve) => {
        requestQueue.push(() => {
          activeRequests++;
          resolve();
        });
      });
    }

    function releaseSlot(): void {
      activeRequests--;
      if (requestQueue.length > 0) {
        const next = requestQueue.shift();
        if (next) next();
      }
    }

    // Fetch with retry and exponential backoff for 429 errors
    async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        await acquireSlot();
        let response: Response;
        try {
          response = await fetch(url, options);
        } catch (err) {
          releaseSlot();
          if (attempt === maxRetries) throw err;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        releaseSlot();

        if (response.status === 429 && attempt < maxRetries) {
          const waitMs = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
          console.log(`⏳ Rate limited (429). Waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return response;
      }
      throw new Error('Max retries exceeded');
    }

    async function searchPlaces(query: string, location: string, _maxPages: number = 3, radiusMetersOverride?: number): Promise<any[]> {
      const searchCache = searchCacheGlobal;
      const radiusMeters = Math.min(radiusMetersOverride ?? (isStateOnlySearch ? 50000 : 30000), 50000);
      const cacheKey = `${query}|${location}|${radiusMeters}|${_maxPages}`;
      if (searchCache.has(cacheKey)) {
        console.log(`💾 Cache hit for: ${query}`);
        return searchCache.get(cacheKey) || [];
      }

      const allResults: any[] = [];
      const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus,places.location';

      console.log(`📍 Google Places search: ${query} em ${location}`);

      // Get coordinates for this specific location (may differ from main for neighborhood searches)
      const searchGeocode = location === locationQuery ? mainGeocode : await geocodeLocation(location);

      try {
        let nextPageToken: string | undefined;
        let pagesSearched = 0;
        const maxPages = Math.min(_maxPages, 10);

        while (pagesSearched < maxPages) {
          const body: any = {
            textQuery: `${query} em ${location}`,
            languageCode: 'pt',
            regionCode: 'BR',
            maxResultCount: 20,
          };

          // Add locationBias to prioritize results near the target location
          if (searchGeocode && !nextPageToken) {
            body.locationBias = {
              circle: {
                center: { latitude: searchGeocode.lat, longitude: searchGeocode.lng },
                radius: radiusMeters,
              }
            };
          }

          if (nextPageToken) {
            body.pageToken = nextPageToken;
          }

          const response = await fetchWithRetry('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
              'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Google Places error: ${response.status} - ${errorText}`);
            break;
          }

          const data = await response.json();
          const places = data.places || [];

          for (const place of places) {
            allResults.push({
              place_id: place.id || '',
              name: place.displayName?.text || '',
              formatted_address: place.formattedAddress || '',
              vicinity: place.formattedAddress || '',
              rating: place.rating || 0,
              user_ratings_total: place.userRatingCount || 0,
              types: place.types || [],
              geometry: {
                location: {
                  lat: place.location?.latitude || 0,
                  lng: place.location?.longitude || 0,
                }
              },
              business_status: place.businessStatus || 'OPERATIONAL',
              permanently_closed: place.businessStatus === 'CLOSED_PERMANENTLY',
              _phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
              _website: place.websiteUri || '',
              _email: '',
            });
          }

          console.log(`📊 Google Places page ${pagesSearched + 1}: ${places.length} results`);

          pagesSearched++;
          nextPageToken = data.nextPageToken;
          if (!nextPageToken || places.length === 0) break;
        }
      } catch (error) {
        console.error('❌ Google Places search error:', error);
      }

      searchCache.set(cacheKey, allResults);
      return allResults;
    }

    async function expandCitySearchIfNeeded(currentPlaces: any[], currentLeadCount: number): Promise<{ places: any[]; validationRadiusKm: number }> {
      const baseRadiusKm = 35;
      if (isStateOnlySearch || !mainGeocode || currentLeadCount >= MIN_LEADS_TARGET) {
        return { places: currentPlaces, validationRadiusKm: baseRadiusKm };
      }

      const severeShortage = currentLeadCount < Math.max(20, Math.floor(MIN_LEADS_TARGET * 0.35));
      const expansionRadiusMeters = severeShortage ? 50000 : 50000;
      const expansionRadiusKm = Math.round(expansionRadiusMeters / 1000);
      const expansionPages = severeShortage ? 8 : 5;
      const topTermsPerSegment = severeShortage ? 8 : 5;

      console.log(`🛰️ LOW VOLUME: ${currentLeadCount} leads. Expanding search radius to ${expansionRadiusKm}km with ${topTermsPerSegment} top terms per segment.`);

      const expansionPromises = segments.flatMap((seg) => {
        const isBoostSeg = isBoostSegment(seg);

        let expansionTerms: string[];
        if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
          const ecomType = ecommerceType.trim().toLowerCase();
          expansionTerms = [`loja ${ecomType}`, `${ecomType}`, `loja de ${ecomType}`, `e-commerce ${ecomType}`];
        } else {
          const limit = isBoostSeg ? Math.max(topTermsPerSegment, 10) : topTermsPerSegment;
          expansionTerms = generateSearchTerms(seg).slice(0, limit);
        }

        return expansionTerms.map(async (term) => {
          const places = await searchPlaces(term, locationQuery, isBoostSeg ? Math.max(expansionPages, 6) : expansionPages, expansionRadiusMeters);
          return places.map((place) => ({
            ...place,
            _searchSegment: seg.toLowerCase(),
            _displayCategory: segmentDisplayNames[seg.toLowerCase()] || seg,
          }));
        });
      });

      const expandedTaggedPlaces = (await Promise.all(expansionPromises)).flat();
      if (expandedTaggedPlaces.length === 0) {
        return { places: currentPlaces, validationRadiusKm: baseRadiusKm };
      }

      console.log(`🛰️ Regional expansion added ${expandedTaggedPlaces.length} raw places`);
      return {
        places: [...currentPlaces, ...expandedTaggedPlaces],
        validationRadiusKm: expansionRadiusKm,
      };
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
    let allPlacesWithSegment: any[] = [];
    const pagesPerSegment = isStateOnlySearch ? 5 : 15;
    
    if (isStateOnlySearch && citiesForState.length > 0) {
      // STATE SEARCH: For boost segments, search more cities
      const isBoostStateSearch = segments.some((s) => isBoostSegment(s));
      const maxCities = isBoostStateSearch ? 18 : 10;
      const citiesToSearch = citiesForState.slice(0, maxCities);
      console.log(`🏙️ STATE SEARCH: Searching across ${citiesToSearch.length} cities in ${stateAbbrev.toUpperCase()} (of ${citiesForState.length} total)${isBoostStateSearch ? ' [BOOSTED]' : ''}`);
      
      for (const seg of segments) {
        let searchTerms: string[];
        const isBoostSeg = isBoostSegment(seg);
        
        if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
          const ecomType = ecommerceType.trim().toLowerCase();
          searchTerms = [`loja ${ecomType}`, `${ecomType}`, `e-commerce ${ecomType}`];
        } else {
          searchTerms = generateSearchTerms(seg);
          // Estado multiplica por cidades; aumenta sem explodir custo
          searchTerms = isBoostSeg ? searchTerms.slice(0, 18) : searchTerms.slice(0, 6);
        }
        
        console.log(`📤 Searching segment "${seg}" with terms:`, searchTerms);
        
        // Search cities in parallel batches of 4
        const batchSize = 4;
        for (let i = 0; i < citiesToSearch.length; i += batchSize) {
          const cityBatch = citiesToSearch.slice(i, i + batchSize);
          
          const cityPromises = cityBatch.flatMap(city => {
            const cityLocation = `${city}, ${stateAbbrev.toUpperCase()}, Brazil`;
            return searchTerms.map(term => searchPlaces(term, cityLocation, isBoostSeg ? 3 : 2));
          });
          
          const cityResults = await Promise.all(cityPromises);
          
          const placesFromBatch = cityResults.flat().map(place => ({
            ...place,
            _searchSegment: seg.toLowerCase(),
            _displayCategory: segmentDisplayNames[seg.toLowerCase()] || seg
          }));
          
          allPlacesWithSegment.push(...placesFromBatch);
          
          console.log(`📊 Cities batch ${Math.floor(i/batchSize)+1}: +${placesFromBatch.length} places (total: ${allPlacesWithSegment.length})`);
          
          // Early exit if we have enough raw results
          if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 3) {
            console.log(`⚡ Enough raw places (${allPlacesWithSegment.length}), stopping city search`);
            break;
          }
        }
        
        // For boost segments in state search, also search neighborhoods of the capital
        if (isBoostSeg && allPlacesWithSegment.length < MAX_TOTAL_LEADS * 3) {
          const stateCapitalNeighborhoods: { [key: string]: string[] } = {
            'rj': ['Centro Rio de Janeiro', 'Zona Norte Rio de Janeiro', 'Zona Oeste Rio de Janeiro', 'Méier RJ', 'Madureira RJ', 'Campo Grande RJ', 'Bangu RJ', 'Jacarepaguá RJ', 'Penha RJ', 'Realengo RJ', 'Pavuna RJ', 'Irajá RJ', 'Cascadura RJ', 'Del Castilho RJ', 'Barra da Tijuca RJ', 'Santa Cruz RJ'],
            'sp': ['Centro São Paulo', 'Zona Norte SP', 'Zona Sul SP', 'Zona Leste SP', 'Zona Oeste SP', 'Santo Amaro SP', 'Penha SP', 'São Miguel Paulista', 'Itaquera SP', 'Lapa SP', 'Santana SP', 'Ipiranga SP'],
            'mg': ['Centro BH', 'Barreiro BH', 'Venda Nova BH', 'Pampulha BH', 'Lagoinha BH', 'Padre Eustáquio BH'],
            'rs': ['Centro Porto Alegre', 'Zona Norte Porto Alegre', 'Zona Sul Porto Alegre', 'Restinga', 'Sarandi', 'Rubem Berta'],
          };
          
          const capitalNeighborhoods = stateCapitalNeighborhoods[stateAbbrev.toLowerCase()];
          if (capitalNeighborhoods) {
            const topTerms = searchTerms.slice(0, 4);
            const neighborhoodPromises = capitalNeighborhoods.flatMap(neighborhood =>
              topTerms.map(term => searchPlaces(term, `${neighborhood}, Brazil`, 2))
            );
            console.log(`🏘️ STATE BOOST: Adding ${neighborhoodPromises.length} neighborhood searches for capital`);
            const neighborhoodResults = await Promise.all(neighborhoodPromises);
            const neighborhoodPlaces = neighborhoodResults.flat().map(place => ({
              ...place,
              _searchSegment: seg.toLowerCase(),
              _displayCategory: segmentDisplayNames[seg.toLowerCase()] || seg
            }));
            allPlacesWithSegment.push(...neighborhoodPlaces);
            console.log(`🏘️ Neighborhoods added ${neighborhoodPlaces.length} places (total: ${allPlacesWithSegment.length})`);
          }
        }
        
        console.log(`📊 Segment "${seg}": ${allPlacesWithSegment.length} raw places after city search`);
        
        if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 3) break;
      }
    } else {
      // CITY/REGION SEARCH: Original behavior
      const isBoostSegmentSearch = segments.some((s) => isBoostSegment(s));
      const maxPagesPerSegment = isBoostSegmentSearch ? 40 : 32;
      const adjustedPages = isBoostSegmentSearch 
        ? 40 
        : Math.max(18, Math.min(maxPagesPerSegment, Math.floor(120 / segments.length)));
      console.log(`⚡ MAXIMUM VOLUME: ${adjustedPages} pages per segment (${segments.length} segments)${isBoostSegmentSearch ? ' [BOOSTED]' : ''}`);
      
      for (const seg of segments) {
        let searchTerms: string[];
        const isBoostSeg = isBoostSegment(seg);
        
        if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
          const ecomType = ecommerceType.trim().toLowerCase();
          searchTerms = [`loja ${ecomType}`, `${ecomType}`, `loja de ${ecomType}`, `e-commerce ${ecomType}`];
          console.log(`🛒 E-commerce específico: ${ecomType}`);
        } else {
          searchTerms = generateSearchTerms(seg);
          // Padrão sobe para 14 termos para reduzir segmentos com zero resultado
          searchTerms = isBoostSeg ? searchTerms : searchTerms.slice(0, 14);
        }
        
        if (isBoostSeg) {
          console.log(`🚀 BOOST MODE: ${seg} - using ${searchTerms.length} terms with ${adjustedPages} pages`);
        }
        
        console.log(`📤 Searching segment "${seg}" with ${searchTerms.length} terms:`, searchTerms);
        
        // Search all terms in parallel
        const searchPromises = searchTerms.map(term => searchPlaces(term, locationQuery, adjustedPages));
        const searchResults = await Promise.all(searchPromises);
        
        // Additionally, search major neighborhoods/zones for large cities to get MORE unique results
        const cityNeighborhoods: { [key: string]: string[] } = {
          'porto alegre': ['Centro Porto Alegre', 'Zona Norte Porto Alegre', 'Zona Sul Porto Alegre', 'Moinhos de Vento', 'Cidade Baixa', 'Bom Fim', 'Restinga', 'Lomba do Pinheiro', 'Partenon', 'Sarandi', 'Rubem Berta', 'Cavalhada'],
          'são paulo': ['Centro São Paulo', 'Zona Norte SP', 'Zona Sul SP', 'Zona Leste SP', 'Zona Oeste SP', 'Vila Mariana', 'Pinheiros', 'Moema', 'Santo Amaro SP', 'Penha SP', 'São Miguel Paulista', 'Itaquera SP', 'Lapa SP', 'Santana SP', 'Ipiranga SP', 'Vila Prudente SP'],
          'rio de janeiro': ['Centro Rio de Janeiro', 'Zona Norte Rio de Janeiro', 'Zona Sul Rio de Janeiro', 'Zona Oeste Rio de Janeiro', 'Barra da Tijuca RJ', 'Tijuca RJ', 'Méier RJ', 'Madureira RJ', 'Campo Grande RJ', 'Bangu RJ', 'Santa Cruz RJ', 'Jacarepaguá RJ', 'Penha RJ', 'Ilha do Governador RJ', 'São Cristóvão RJ', 'Realengo RJ', 'Pavuna RJ', 'Irajá RJ', 'Vila da Penha RJ', 'Cascadura RJ', 'Ramos RJ', 'Olaria RJ', 'Del Castilho RJ', 'Abolição RJ'],
          'belo horizonte': ['Centro BH', 'Savassi', 'Pampulha', 'Barreiro', 'Venda Nova', 'Região Nordeste BH', 'Contagem MG', 'Betim MG', 'Santa Luzia MG', 'Lagoinha BH', 'Carlos Prates BH', 'Padre Eustáquio BH'],
          'curitiba': ['Centro Curitiba', 'Batel', 'Santa Felicidade', 'Boqueirão', 'Portão', 'CIC', 'Cajuru', 'Pinheirinho', 'Xaxim', 'Fazendinha'],
          'salvador': ['Centro Salvador', 'Barra', 'Pituba', 'Itapuã', 'Lauro de Freitas', 'Paralela', 'Cajazeiras Salvador', 'Pau da Lima', 'Brotas Salvador', 'Subúrbio Salvador'],
          'fortaleza': ['Centro Fortaleza', 'Aldeota', 'Meireles', 'Messejana', 'Maraponga', 'Parangaba', 'Montese Fortaleza', 'Barra do Ceará', 'Mondubim', 'José Walter'],
          'recife': ['Centro Recife', 'Boa Viagem', 'Casa Forte', 'Espinheiro', 'Imbiribeira', 'Aflitos', 'Boa Vista Recife', 'Pina Recife', 'Areias Recife'],
          'brasília': ['Asa Sul', 'Asa Norte', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Samambaia', 'Gama DF', 'Sobradinho DF', 'Planaltina DF'],
          'goiânia': ['Centro Goiânia', 'Setor Bueno', 'Setor Marista', 'Jardim Goiás', 'Campinas', 'Setor Pedro Ludovico', 'Setor Aeroporto Goiânia'],
          'manaus': ['Centro Manaus', 'Adrianópolis', 'Cidade Nova', 'Aleixo', 'Flores', 'Compensa', 'São José Manaus'],
          'belém': ['Centro Belém', 'Nazaré', 'Umarizal', 'Marco', 'Pedreira', 'Marituba', 'Ananindeua'],
          'florianópolis': ['Centro Florianópolis', 'Norte da Ilha', 'Sul da Ilha', 'Trindade', 'Estreito', 'Palhoça SC', 'São José SC'],
          'vitória': ['Centro Vitória', 'Praia do Canto', 'Jardim da Penha', 'Vila Velha Centro', 'Serra ES', 'Cariacica ES'],
          'niterói': ['Centro Niterói', 'Icaraí', 'São Gonçalo Centro', 'Alcântara São Gonçalo', 'Itaboraí Centro'],
          'duque de caxias': ['Centro Duque de Caxias', 'Jardim Primavera Caxias', 'São João de Meriti Centro', 'Belford Roxo Centro'],
          'nova iguaçu': ['Centro Nova Iguaçu', 'Mesquita Centro', 'Nilópolis Centro', 'Queimados Centro'],
        };
        
        // Find matching city for neighborhood search
        const regionLower = cleanRegion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let neighborhoodQueries: Promise<any[]>[] = [];
        for (const [city, neighborhoods] of Object.entries(cityNeighborhoods)) {
          const cityNorm = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (regionLower.includes(cityNorm)) {
            // Use first 2 search terms across neighborhoods
            const topTermsCount = isBoostSeg ? 4 : 2;
            const topTerms = searchTerms.slice(0, topTermsCount);
            const pagesPerNeighborhood = isBoostSeg ? 2 : 1;
            neighborhoodQueries = neighborhoods.flatMap(neighborhood => 
              topTerms.map(term => searchPlaces(term, `${neighborhood}, ${countryCode === 'BR' ? 'Brazil' : countryCode}`, pagesPerNeighborhood))
            );
            console.log(`🏘️ Adding ${neighborhoodQueries.length} neighborhood searches for ${city} (${topTermsCount} terms, ${pagesPerNeighborhood} pages each)`);
            break;
          }
        }
        
        const neighborhoodResults = neighborhoodQueries.length > 0 ? await Promise.all(neighborhoodQueries) : [];
        
        const allSegmentResults = [...searchResults.flat(), ...neighborhoodResults.flat()];
        const placesFromSegment = allSegmentResults.map(place => ({
          ...place,
          _searchSegment: seg.toLowerCase(),
          _displayCategory: segmentDisplayNames[seg.toLowerCase()] || seg
        }));
        
        allPlacesWithSegment.push(...placesFromSegment);
        console.log(`📊 Segment "${seg}": ${placesFromSegment.length} raw places (${searchResults.flat().length} from main + ${neighborhoodResults.flat().length} from neighborhoods)`);
        
        if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 8) {
          console.log(`⚡ Enough raw places (${allPlacesWithSegment.length}), skipping remaining segments`);
          break;
        }
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
    
    // Transform RapidAPI format to our expected format
    // RapidAPI already includes phone and website - no separate detail calls needed!
    const transformedPlaces = allPlacesWithSegment.map(place => ({
      placeId: place.place_id,
      title: place.name,
      address: place.formatted_address || place.vicinity,
      categoryName: place.types?.[0]?.replace(/_/g, ' ') || '',
      categories: place.types || [],
      stars: place.rating || 0,
      reviewsCount: place.user_ratings_total || 0,
      phone: place._phone || '',
      phoneUnformatted: place._phone || '',
      website: place._website || '',
      email: place._email || '',
      permanentlyClosed: place.permanently_closed || place.business_status === 'CLOSED_PERMANENTLY',
      location: place.geometry?.location,
      _searchSegment: place._searchSegment,
      _displayCategory: place._displayCategory
    }));
    
    // Filter out closed businesses
    const activePlaces = transformedPlaces.filter(p => !p.permanentlyClosed);
    console.log(`📊 Active businesses: ${activePlaces.length}`);
    
    // Sort by rating/reviews first to get best leads initially
    activePlaces.sort((a, b) => {
      const scoreA = (a.stars || 0) * 10 + Math.min(a.reviewsCount || 0, 100);
      const scoreB = (b.stars || 0) * 10 + Math.min(b.reviewsCount || 0, 100);
      return scoreB - scoreA;
    });

    let validationRadiusKm = 35;

    // No detail fetching needed - RapidAPI returns phone/website directly!
    const placesWithPhone = activePlaces.filter(p => p.phone && p.phone.trim() !== '');
    console.log(`📞 ${placesWithPhone.length} places with phone out of ${activePlaces.length}`);

    // Compute final leads after ALL strict filters
    let leads = processResultsWithCategories(
      activePlaces,
      segment,
      cleanRegion,
      MAX_TOTAL_LEADS,
      bizType,
      digPresence,
      digActivity,
      countryCode,
      isStateOnlySearch ? null : mainGeocode,
      validationRadiusKm,
    );
    console.log(`✅ FINAL: ${leads.length} leads ready (target: ${MIN_LEADS_TARGET}-${MAX_TOTAL_LEADS})`);

    if (!isStateOnlySearch && leads.length < MIN_LEADS_TARGET) {
      const expandedSearch = await expandCitySearchIfNeeded(allPlacesWithSegment, leads.length);

      if (expandedSearch.places.length > allPlacesWithSegment.length) {
        allPlacesWithSegment = expandedSearch.places;
        validationRadiusKm = expandedSearch.validationRadiusKm;

        const expandedSeenIds = new Set<string>();
        allPlacesWithSegment = allPlacesWithSegment.filter(place => {
          if (expandedSeenIds.has(place.place_id)) return false;
          expandedSeenIds.add(place.place_id);
          return true;
        });
        console.log(`🛰️ After regional deduplication: ${allPlacesWithSegment.length} unique places`);

        const expandedTransformedPlaces = allPlacesWithSegment.map(place => ({
          placeId: place.place_id,
          title: place.name,
          address: place.formatted_address || place.vicinity,
          categoryName: place.types?.[0]?.replace(/_/g, ' ') || '',
          categories: place.types || [],
          stars: place.rating || 0,
          reviewsCount: place.user_ratings_total || 0,
          phone: place._phone || '',
          phoneUnformatted: place._phone || '',
          website: place._website || '',
          email: place._email || '',
          permanentlyClosed: place.permanently_closed || place.business_status === 'CLOSED_PERMANENTLY',
          location: place.geometry?.location,
          _searchSegment: place._searchSegment,
          _displayCategory: place._displayCategory
        }));

        const expandedActivePlaces = expandedTransformedPlaces.filter(p => !p.permanentlyClosed);
        expandedActivePlaces.sort((a, b) => {
          const scoreA = (a.stars || 0) * 10 + Math.min(a.reviewsCount || 0, 100);
          const scoreB = (b.stars || 0) * 10 + Math.min(b.reviewsCount || 0, 100);
          return scoreB - scoreA;
        });

        leads = processResultsWithCategories(
          expandedActivePlaces,
          segment,
          cleanRegion,
          MAX_TOTAL_LEADS,
          bizType,
          digPresence,
          digActivity,
          countryCode,
          mainGeocode,
          validationRadiusKm,
        );
        console.log(`✅ AFTER REGIONAL EXPANSION: ${leads.length} leads ready (validation radius: ${validationRadiusKm}km)`);
      }
    }
    
    // Extract emails from websites - ALWAYS attempt, limit batch size to avoid CPU timeout
    const placesWithWebsite = leads.filter((l: any) => l.website && l.website !== 'Não disponível' && l.website.trim().length > 5);
    console.log(`📧 Places with website: ${placesWithWebsite.length} of ${leads.length}`);
    if (placesWithWebsite.length > 0) {
      // For large sets, extract from first 30; for state searches first 20
      const maxToExtract = isStateOnlySearch ? 20 : 30;
      const emailMap = await batchExtractEmails(leads.slice(0, maxToExtract * 2), 5);
      if (emailMap.size > 0) {
        leads = leads.map((lead: any) => ({
          ...lead,
          email: lead.email || emailMap.get(lead.placeId) || emailMap.get(lead.id) || ''
        }));
        console.log(`📧 Enriched ${emailMap.size} leads with emails`);
      }
    } else {
      console.log(`⏩ No websites found for email extraction`);
    }
    
    // Apply WhatsApp filter if requested
    if (filterWhatsappOnly && leads.length > 0) {
      const beforeWhatsapp = leads.length;
      leads = leads.filter((lead: any) => lead.hasWhatsApp === true);
      console.log(`📱 WhatsApp filter applied: ${leads.length} leads with WhatsApp (removed ${beforeWhatsapp - leads.length})`);
    }

    // Apply Receita Federal filter if requested - keep only businesses with formal registration indicators
    if (filterReceitaFederal && leads.length > 0) {
      const beforeRF = leads.length;
      const formalTerms = ['ltda', 'me ', 'mei', 'eireli', 's/a', 's.a', 'epp', 'sa ', 'ltda.', 'ltda-', 'ss ', 'sociedade', 'comércio', 'comercio', 'indústria', 'industria', 'distribuidora', 'serviços', 'servicos', 'empreendimentos', 'importação', 'exportação', 'cia', 'companhia'];
      leads = leads.filter((lead: any) => {
        const name = (lead.name || '').toLowerCase();
        // Has formal business suffix in name
        const hasFormalName = formalTerms.some(term => name.includes(term));
        // Has website (indicates formal registration)
        const hasWebsite = !!lead.website;
        // Has significant reviews (established business)
        const hasGoodReviews = (lead.reviews || 0) >= 10;
        return hasFormalName || hasWebsite || hasGoodReviews;
      });
      console.log(`🏛️ Receita Federal filter applied: ${leads.length} formal businesses (removed ${beforeRF - leads.length})`);
    }

    // ===== FILTER OUT PREVIOUSLY SEEN LEADS =====
    let userId: string | null = null;
    let allFilteredBySeen = false;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        
        // Extract user from auth header
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        
        if (user) {
          userId = user.id;
          const leadPlaceIds = leads.map((l: any) => l.placeId).filter(Boolean);
          
          if (leadPlaceIds.length > 0) {
            // Fetch already seen place_ids for this user
            const { data: seenData } = await adminClient
              .from("user_seen_leads")
              .select("place_id")
              .eq("user_id", user.id)
              .in("place_id", leadPlaceIds);
            
            const seenSet = new Set((seenData || []).map((s: any) => s.place_id));
            const beforeFilter = leads.length;
            
            if (seenSet.size > 0) {
              leads = leads.filter((lead: any) => !lead.placeId || !seenSet.has(lead.placeId));
              console.log(`👁️ Seen leads filter: removed ${beforeFilter - leads.length} already seen, ${leads.length} remaining`);
              if (leads.length === 0 && beforeFilter > 0) {
                allFilteredBySeen = true;
              }
            }
            
            // Record newly shown leads
            if (leads.length > 0) {
              const newPlaceIds = leads
                .map((l: any) => l.placeId)
                .filter(Boolean)
                .map((placeId: string) => ({
                  user_id: user.id,
                  place_id: placeId,
                  search_type: 'leads',
                }));
              
              if (newPlaceIds.length > 0) {
                const { error: insertError } = await adminClient
                  .from("user_seen_leads")
                  .upsert(newPlaceIds, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
                
                if (insertError) {
                  console.error("⚠️ Error recording seen leads:", insertError);
                } else {
                  console.log(`💾 Recorded ${newPlaceIds.length} new seen leads for user ${user.email}`);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("⚠️ Error in seen leads filter:", e);
    }

    if (leads.length === 0) {
      if (allFilteredBySeen) {
        return new Response(JSON.stringify({ 
          error: `Todos os leads desta pesquisa já foram exibidos anteriormente. Tente buscar em outra região ou com outros filtros.`,
          allSeen: true
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rfMsg = filterReceitaFederal ? ' ligadas à Receita Federal' : '';
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento${rfMsg} encontrado em ${cleanRegion}. Tente outra região ou desative os filtros.` 
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
function processResultsWithCategories(
  apifyResults: any[],
  segment: string,
  cleanRegion: string,
  maxLeads: number,
  businessType: string = 'all',
  digitalPresence: string = 'all',
  digitalActivity: string = 'all',
  countryCode: string = 'BR',
  searchCenter: { lat: number; lng: number } | null = null,
  validationRadiusKm: number = 35,
): any[] {
  console.log(`📊 Processing ${apifyResults.length} raw results for segment: ${segment}, businessType: ${businessType}, digitalPresence: ${digitalPresence}, digitalActivity: ${digitalActivity}, validationRadiusKm: ${validationRadiusKm}`);
  
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
    if (!matchesRequestedLocation(place, cleanRegion, countryCode, searchCenter, validationRadiusKm)) {
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
  const seenPlaceIds2 = new Set<string>();
  const beforePlaceIdDedup2 = results.length;
  results = results.filter((place: any) => {
    if (place.placeId && seenPlaceIds2.has(place.placeId)) return false;
    if (place.placeId) seenPlaceIds2.add(place.placeId);
    return true;
  });
  if (results.length < beforePlaceIdDedup2) console.log(`📊 PlaceId dedup removed ${beforePlaceIdDedup2 - results.length}`);
  
  // Step 5b: Deduplicate by phone number (same phone = same business)
  const seenPhones2 = new Set<string>();
  const beforePhoneDedup2 = results.length;
  results = results.filter((place: any) => {
    const phone = (place.phone || place.phoneUnformatted || '').replace(/\D/g, '');
    if (phone.length >= 8) {
      const phoneKey = phone.slice(-8);
      if (seenPhones2.has(phoneKey)) return false;
      seenPhones2.add(phoneKey);
    }
    return true;
  });
  if (results.length < beforePhoneDedup2) console.log(`📊 Phone dedup removed ${beforePhoneDedup2 - results.length}`);
  
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
    // Regular deduplication by normalized name
    const seenNames2 = new Set<string>();
    const beforeNameDedup2 = results.length;
    results = results.filter((place: any) => {
      const key = normalizeCompanyName(place.title);
      if (key.length >= 5 && seenNames2.has(key)) return false;
      if (key.length >= 5) seenNames2.add(key);
      return true;
    });
    if (results.length < beforeNameDedup2) console.log(`📊 Name dedup removed ${beforeNameDedup2 - results.length}`);
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

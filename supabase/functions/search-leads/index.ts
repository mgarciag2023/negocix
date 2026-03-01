import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    'distribuidores de food service': ['distribuidor food service', 'distribuidor restaurantes'],
    'atacadistas de food service': ['atacadista food service', 'atacado restaurantes'],
    'distribuidores de alimentos': ['distribuidora de alimentos', 'distribuidor de alimentos', 'atacado alimentos', 'alimentos atacado'],
    'distribuidores de bebidas': ['distribuidora de bebidas', 'distribuidor de bebidas', 'atacado bebidas', 'bebidas atacado', 'depósito de bebidas'],
    'distribuidores de água': ['distribuidora de água', 'distribuidor de água', 'água mineral distribuidora', 'depósito de água', 'distribuidora de água mineral'],
    'distribuidores de refrigerantes': ['distribuidora de refrigerantes', 'distribuidor de refrigerantes', 'depósito de refrigerantes', 'distribuidora de bebidas refrigerantes', 'atacado de refrigerantes'],
    'distribuidores de cervejas': ['distribuidora de cervejas', 'distribuidor de cervejas', 'depósito de cerveja', 'distribuidora de cerveja artesanal', 'atacado de cervejas'],
    'artigos de caça, pesca e camping': ['loja de pesca', 'artigos de pesca', 'caça e pesca', 'camping', 'loja de camping', 'artigos de camping', 'pesca esportiva', 'loja de caça'],
    'lojas de materiais elétricos': ['loja de materiais elétricos', 'material elétrico', 'casa de elétrica', 'distribuidora elétrica', 'componentes elétricos'],
    'empresas de energia solar': ['energia solar', 'solar fotovoltaica', 'instalação solar', 'empresa de energia solar', 'painel solar'],
    'distribuidores de aço e ferro': ['distribuidora de aço', 'distribuidor de ferro', 'ferro e aço', 'depósito de ferro', 'comércio de aço', 'distribuidora de ferro', 'aço e ferro', 'distribuidora de metais', 'ferro para construção', 'vergalhão', 'chapas de aço', 'metalon', 'tubo de aço', 'perfilados', 'cantoneira', 'viga de aço', 'barra de ferro'],
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
    'lojas de colchões': ['loja de colchões', 'colchões e estofados', 'colchoaria', 'loja de camas e colchões', 'colchões ortopédicos'],
    'lojas de eletrodomésticos': ['loja de eletrodomésticos', 'eletrodomésticos', 'loja de eletrônicos', 'magazine', 'loja de eletro', 'casa de eletro'],
    'lojas de cosméticos': ['loja de cosméticos', 'perfumaria', 'beleza', 'maquiagem', 'produtos de beleza', 'loja de maquiagem', 'cosméticos e perfumaria'],
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
  
  // Return up to 10 terms for maximum coverage
  return searchTerms.slice(0, 10);
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
      // STATE-ONLY SEARCH: Accept any address that contains this state
      const stateAbbrev = brazilianStates[cleanRegion] ? cleanRegion : 
                          Object.keys(brazilianStates).find(k => brazilianStates[k] === cleanRegion);
      
      if (stateAbbrev) {
        // Check if address contains " - XX," or " - XX " or ", XX," pattern (state abbreviation position)
        const statePattern = new RegExp(`[,\\s\\-]\\s*${stateAbbrev}\\s*[,\\s\\-]|[,\\s\\-]\\s*${stateAbbrev}\\s*$`, 'i');
        if (statePattern.test(address.toLowerCase())) {
          return true;
        }
        // Also check for full state name
        const stateName = brazilianStates[stateAbbrev];
        if (stateName && normalizedAddress.includes(stateName)) {
          return true;
        }
      }
      
      // If search is state name, check for abbreviation in address
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
    
    // CITY + STATE or CITY-ONLY SEARCH: Original logic but more flexible
    // Extract location from address
    const addressParts = extractLocationParts(address);
    
    // Filter region words - include state abbreviations (2 chars) too!
    let regionCityWords = regionParts.filter(p => {
      // Accept words > 2 chars, OR state abbreviations
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
    
    if (!cityMatch) {
      console.log(`❌ Location mismatch: "${address}" does not contain city from "${requestedRegion}"`);
      return false;
    }
    
    // Additional check: the matched word should appear in the city position
    let foundInCityPosition = false;
    for (const word of regionCityWords) {
      const wordLower = word.toLowerCase();
      // Check if word appears after a comma or dash (city position in Brazilian addresses)
      const cityPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${wordLower}[^,\\-]*\\s*[,\\-]`, 'i');
      const endPositionPattern = new RegExp(`[,\\-]\\s*[^,\\-]*${wordLower}[^,\\-]*$`, 'i');
      
      if (cityPositionPattern.test(normalizedAddress) || endPositionPattern.test(normalizedAddress)) {
        foundInCityPosition = true;
        break;
      }
    }
    
    if (!foundInCityPosition) {
      // Check if the word appears standalone (not as part of a street name)
      const addressWords = normalizedAddress.split(/[\s,\-]+/);
      for (const word of regionCityWords) {
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
  'açougue', 'casa de carnes', 'frios e embutidos',
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
    include: ['distribuidora', 'distribuidor', 'distribuição'],
    mustMatch: ['distribuidora', 'distribuidor', 'distribuição'],
    exclude: ['supermercado', 'restaurante', 'lanchonete', 'pet', 'salão', 'academia', 'hotel', 'padaria', 'loja']
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
    mustMatch: [], // Removido para aumentar volume
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
  
  // If no specific niche config, accept if search term appears OR has include keywords
  if (!nicheConfig) {
    // Very minimal exclusions for undefined categories
    const genericExclusions = ['magazine luiza', 'americanas', 'casas bahia'];
    for (const exclude of genericExclusions) {
      if (combinedText.includes(exclude)) {
        console.log(`❌ Generic exclusion: "${place.title}" - matches: ${exclude}`);
        return false;
      }
    }
    
    // For undefined categories, check if any search term word appears
    const searchTermWords = segmentLower.split(/\s+/).filter(w => w.length > 3);
    let foundSearchTermInPlace = false;
    for (const word of searchTermWords) {
      if (combinedText.includes(word)) {
        foundSearchTermInPlace = true;
        break;
      }
    }
    
    // RELAXED: Accept if no specific search term words, just pass through
    if (!foundSearchTermInPlace && searchTermWords.length > 0) {
      // Only log, don't reject - be more permissive
      console.log(`⚠️ Weak match: "${place.title}" - accepting anyway for volume`);
    }
    
    return true;
  }
  
  // ===== STEP 5: Check exclusions from niche config =====
  // For segments with mustMatch (strict), check ALL exclusions; otherwise only first 5
  const hasStrictFilter = nicheConfig.mustMatch && nicheConfig.mustMatch.length > 0;
  const exclusionsToCheck = hasStrictFilter ? nicheConfig.exclude : nicheConfig.exclude.slice(0, 5);
  for (const exclude of exclusionsToCheck) {
    if (combinedText.includes(exclude)) {
      console.log(`❌ Niche exclusion: "${place.title}" - matches: ${exclude}`);
      return false;
    }
  }
  
  // ===== STEP 6: mustMatch DISABLED =====
  // mustMatch was removed per user request: all leads returned by the Google Places
  // search for the segment are accepted as long as they pass exclusion filters.
  // This ensures businesses with the correct CNAE but without specific keywords
  // in their name/category are not incorrectly filtered out.
  
  // Check if at least one include keyword matches (SOFT check)
  let hasIncludeMatch = false;
  for (const incl of nicheConfig.include) {
    if (combinedText.includes(incl)) {
      hasIncludeMatch = true;
      break;
    }
  }
  
  // If no include match, still accept but log it
  if (!hasIncludeMatch) {
    console.log(`⚠️ No include match for "${place.title}" in ${segmentLower}, but accepting for volume`);
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

// Email extraction from website
async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl || websiteUrl === 'Não disponível') return '';
  
  try {
    let url = websiteUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    clearTimeout(timeout);
    
    if (!response.ok) return '';
    
    const html = await response.text();
    
    // Extract emails from mailto: links and text content
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    
    // Filter out common false positives
    const blacklist = ['example.com', 'email.com', 'domain.com', 'yoursite.com', 'sentry.io', 'wixpress.com', 'google.com', 'facebook.com', 'wordpress.com', 'w3.org', 'schema.org', 'gravatar.com', 'jquery.com', 'googleapis.com', 'cloudflare.com'];
    
    const validEmails = emails.filter(email => {
      const domain = email.split('@')[1]?.toLowerCase() || '';
      return !blacklist.some(bl => domain.includes(bl)) && 
             !email.includes('..') && 
             email.length < 60;
    });
    
    // Prefer contact/commercial emails
    const priorityKeywords = ['contato', 'comercial', 'vendas', 'sac', 'atendimento', 'info', 'contact', 'sales'];
    const priorityEmail = validEmails.find(e => priorityKeywords.some(k => e.toLowerCase().includes(k)));
    
    return priorityEmail || validEmails[0] || '';
  } catch {
    return '';
  }
}

// Batch extract emails from websites (parallel with concurrency limit)
async function batchExtractEmails(places: any[], concurrency = 10): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  const placesWithWebsite = places.filter(p => p.website && p.website !== 'Não disponível' && p.website.trim().length > 5);
  
  if (placesWithWebsite.length === 0) return emailMap;
  
  console.log(`📧 Extracting emails from ${placesWithWebsite.length} websites...`);
  
  // Process in batches
  for (let i = 0; i < placesWithWebsite.length; i += concurrency) {
    const batch = placesWithWebsite.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (place) => {
        const email = await extractEmailFromWebsite(place.website || place._website);
        return { id: place.placeId || place.place_id, email };
      })
    );
    results.forEach(r => {
      if (r.email) emailMap.set(r.id, r.email);
    });
  }
  
  console.log(`📧 Found ${emailMap.size} emails from ${placesWithWebsite.length} websites`);
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
    const MAX_TOTAL_LEADS = userMaxLeads || (isStateOnlySearch ? 347 : 187);
    const MIN_LEADS_TARGET = isStateOnlySearch ? 100 : 70;
    const TARGET_LEADS = isStateOnlySearch ? 200 : 80;
    const MAX_TARGET_LEADS = isStateOnlySearch ? 300 : 90;
    const MIN_LEADS_EARLY_EXIT = isStateOnlySearch ? 340 : 95;
    
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
      'rj': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'Petrópolis', 'Volta Redonda', 'Macaé'],
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
    async function searchPlaces(query: string, location: string, _maxPages: number = 3): Promise<any[]> {
      const searchCache = searchCacheGlobal;
      const cacheKey = `${query}|${location}`;
      if (searchCache.has(cacheKey)) {
        console.log(`💾 Cache hit for: ${query}`);
        return searchCache.get(cacheKey) || [];
      }

      const allResults: any[] = [];
      const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus,places.location';

      console.log(`📍 Google Places search: ${query} em ${location}`);

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

          if (nextPageToken) {
            body.pageToken = nextPageToken;
          }

          const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
    const pagesPerSegment = isStateOnlySearch ? 3 : 12;
    
    if (isStateOnlySearch && citiesForState.length > 0) {
      // STATE SEARCH: Limit cities to avoid CPU timeout (max 5 cities)
      const maxCities = 5;
      const citiesToSearch = citiesForState.slice(0, maxCities);
      console.log(`🏙️ STATE SEARCH: Searching across ${citiesToSearch.length} cities in ${stateAbbrev.toUpperCase()} (of ${citiesForState.length} total)`);
      
      for (const seg of segments) {
        let searchTerms: string[];
        
        if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
          const ecomType = ecommerceType.trim().toLowerCase();
          searchTerms = [`loja ${ecomType}`, `${ecomType}`];
        } else {
          searchTerms = generateSearchTerms(seg);
          searchTerms = searchTerms.slice(0, 2); // Use only top 2 terms to avoid timeout
        }
        
        console.log(`📤 Searching segment "${seg}" with terms:`, searchTerms);
        
        // Search cities in parallel batches of 4
        const batchSize = 4;
        for (let i = 0; i < citiesToSearch.length; i += batchSize) {
          const cityBatch = citiesToSearch.slice(i, i + batchSize);
          
          const cityPromises = cityBatch.flatMap(city => {
            const cityLocation = `${city}, ${stateAbbrev.toUpperCase()}, Brazil`;
            return searchTerms.map(term => searchPlaces(term, cityLocation, 1)); // Only 1 page per search
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
          if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 1.5) {
            console.log(`⚡ Enough raw places (${allPlacesWithSegment.length}), stopping city search`);
            break;
          }
        }
        
        console.log(`📊 Segment "${seg}": ${allPlacesWithSegment.length} raw places after city search`);
        
        if (allPlacesWithSegment.length >= MAX_TOTAL_LEADS * 1.5) break;
      }
    } else {
      // CITY/REGION SEARCH: Original behavior
      const maxPagesPerSegment = 20;
      const adjustedPages = Math.max(12, Math.min(maxPagesPerSegment, Math.floor(60 / segments.length)));
      console.log(`⚡ MAXIMUM VOLUME: ${adjustedPages} pages per segment (${segments.length} segments)`);
      
      for (const seg of segments) {
        let searchTerms: string[];
        
        if (isEcommerceSearch && ecommerceType && ecommerceType.trim()) {
          const ecomType = ecommerceType.trim().toLowerCase();
          searchTerms = [`loja ${ecomType}`, `${ecomType}`, `loja de ${ecomType}`];
          console.log(`🛒 E-commerce específico: ${ecomType}`);
        } else {
          searchTerms = generateSearchTerms(seg);
          searchTerms = searchTerms.slice(0, 10);
        }
        
        console.log(`📤 Searching segment "${seg}" with ${searchTerms.length} terms:`, searchTerms);
        
        // Search all terms in parallel
        const searchPromises = searchTerms.map(term => searchPlaces(term, locationQuery, adjustedPages));
        const searchResults = await Promise.all(searchPromises);
        
        // Additionally, search major neighborhoods/zones for large cities to get MORE unique results
        const cityNeighborhoods: { [key: string]: string[] } = {
          'porto alegre': ['Centro Porto Alegre', 'Zona Norte Porto Alegre', 'Zona Sul Porto Alegre', 'Moinhos de Vento', 'Cidade Baixa', 'Bom Fim'],
          'são paulo': ['Centro São Paulo', 'Zona Norte SP', 'Zona Sul SP', 'Zona Leste SP', 'Zona Oeste SP', 'Vila Mariana', 'Pinheiros', 'Moema'],
          'rio de janeiro': ['Centro Rio', 'Zona Norte RJ', 'Zona Sul RJ', 'Zona Oeste RJ', 'Barra da Tijuca', 'Copacabana', 'Tijuca'],
          'belo horizonte': ['Centro BH', 'Savassi', 'Pampulha', 'Barreiro', 'Venda Nova', 'Região Nordeste BH'],
          'curitiba': ['Centro Curitiba', 'Batel', 'Santa Felicidade', 'Boqueirão', 'Portão', 'CIC'],
          'salvador': ['Centro Salvador', 'Barra', 'Pituba', 'Itapuã', 'Lauro de Freitas', 'Paralela'],
          'fortaleza': ['Centro Fortaleza', 'Aldeota', 'Meireles', 'Messejana', 'Maraponga', 'Parangaba'],
          'recife': ['Centro Recife', 'Boa Viagem', 'Casa Forte', 'Espinheiro', 'Imbiribeira', 'Aflitos'],
          'brasília': ['Asa Sul', 'Asa Norte', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Samambaia'],
          'goiânia': ['Centro Goiânia', 'Setor Bueno', 'Setor Marista', 'Jardim Goiás', 'Campinas'],
          'manaus': ['Centro Manaus', 'Adrianópolis', 'Cidade Nova', 'Aleixo', 'Flores'],
          'belém': ['Centro Belém', 'Nazaré', 'Umarizal', 'Marco', 'Pedreira'],
          'florianópolis': ['Centro Florianópolis', 'Norte da Ilha', 'Sul da Ilha', 'Trindade', 'Estreito'],
          'vitória': ['Centro Vitória', 'Praia do Canto', 'Jardim da Penha', 'Vila Velha Centro'],
        };
        
        // Find matching city for neighborhood search
        const regionLower = cleanRegion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let neighborhoodQueries: Promise<any[]>[] = [];
        for (const [city, neighborhoods] of Object.entries(cityNeighborhoods)) {
          const cityNorm = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (regionLower.includes(cityNorm)) {
            // Use first 2 search terms across neighborhoods
            const topTerms = searchTerms.slice(0, 2);
            neighborhoodQueries = neighborhoods.flatMap(neighborhood => 
              topTerms.map(term => searchPlaces(term, `${neighborhood}, ${countryCode === 'BR' ? 'Brazil' : countryCode}`, 1))
            );
            console.log(`🏘️ Adding ${neighborhoodQueries.length} neighborhood searches for ${city}`);
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

    // No detail fetching needed - RapidAPI returns phone/website directly!
    const placesWithPhone = activePlaces.filter(p => p.phone && p.phone.trim() !== '');
    console.log(`📞 ${placesWithPhone.length} places with phone out of ${activePlaces.length}`);

    // Compute final leads after ALL strict filters
    let leads = processResultsWithCategories(activePlaces, segment, cleanRegion, MAX_TOTAL_LEADS, bizType, digPresence, digActivity);
    console.log(`✅ FINAL: ${leads.length} leads ready (target: ${MIN_LEADS_TARGET}-${MAX_TOTAL_LEADS})`);
    
    // Extract emails from websites (skip for state searches to save CPU time)
    if (!isStateOnlySearch) {
      const emailMap = await batchExtractEmails(leads);
      if (emailMap.size > 0) {
        leads = leads.map((lead: any) => ({
          ...lead,
          email: lead.email || emailMap.get(lead.placeId) || emailMap.get(lead.id) || ''
        }));
        console.log(`📧 Enriched ${emailMap.size} leads with emails`);
      }
    } else {
      console.log(`⏩ Skipping email extraction for state search to save CPU time`);
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

    if (leads.length === 0) {
      const whatsappMsg = filterWhatsappOnly ? ' com WhatsApp' : '';
      const rfMsg = filterReceitaFederal ? ' ligadas à Receita Federal' : '';
      return new Response(JSON.stringify({ 
        error: `Nenhum estabelecimento${whatsappMsg}${rfMsg} encontrado em ${cleanRegion}. Tente outra região ou desative os filtros.` 
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

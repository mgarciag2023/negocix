import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ===== PHONE VALIDATION =====
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

function isPhoneValid(phone: string | null): boolean {
  if (!phone || phone.trim() === '' || phone === '()-' || phone === '(0)0-' || phone === '(0000)0000-0000') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8;
}

// ===== TEXT NORMALIZATION =====
function normalizeText(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// ===== CNAE MAPPING DESATIVADO =====
// CNAE mapping - only for highly specific segments where CNAE is a reliable indicator
function getCnaesForSegment(segment: string): string[] {
  const seg = segment.toLowerCase();
  const cnaeMap: { [key: string]: string[] } = {
    'loja de caça e pesca': ['4763604', '4789009', '9319101', '4763601', '4789099'], // 4763604=caça/pesca/camping, 4789009=armas/munições
    'artigos de caça, pesca e camping': ['4763604', '4789009', '9319101', '4763601', '4789099'],
  };
  return cnaeMap[seg] || [];
}

// ===== CATEGORY SEARCH TERMS MAPPING =====
// Maps user-facing segment names to search terms for matching against nome_fantasia and descricao_cnae
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  const categoryTerms: { [key: string]: string[] } = {
    // ===== ALIMENTAÇÃO / RESTAURANTES =====
    // "Restaurantes" é amplo: inclui todos os subtipos (pizzarias, hamburguerias, etc.)
    'restaurantes': ['restaurante', 'restaurantes', 'self service', 'bistro', 'bistrô', 'comida', 'bar e restaurante', 'cantina', 'buffet', 'por quilo', 'grelhados', 'cozinha', 'pizzaria', 'pizza', 'hamburgueria', 'burger', 'lanchonete', 'churrascaria', 'rodizio', 'rodízio', 'espetaria', 'marmitaria', 'rotisserie', 'sushi', 'temakeria', 'trattoria', 'taqueria', 'restaurante a la carte', 'restaurante à la carte', 'casa de massas', 'cozinha contemporanea', 'cozinha contemporânea', 'restaurante familiar', 'culinaria internacional', 'casa de carnes restaurante'],
    // Subtipos específicos: NÃO incluem restaurantes genéricos
    'pizzarias': ['pizzaria', 'pizza', 'pizzas', 'pizzaiolo', 'rodizio de pizza', 'rodízio de pizza', 'delivery de pizza', 'pizza italiana', 'pizza napolitana', 'pizza artesanal', 'pizzaria delivery', 'pizza forno a lenha', 'pizza e massas', 'massas e pizzas', 'pizzaria forneria', 'forno a lenha pizzaria', 'pizza gourmet', 'pizza light', 'disco de pizza', 'calzone', 'pizza doce', 'pizza salgada', 'pizzaria express', 'pizza by slice'],
    'hamburguerias': ['hamburgueria', 'burger', 'hamburguer', 'hamburger', 'burgers', 'smash burger', 'artesanal burger'],
    'lanchonetes': ['lanchonete', 'lanche', 'fast food', 'lanches'],
    'pastelarias': ['pastelaria', 'pastel', 'pasteis'],
    'esfiharias': ['esfiharia', 'esfiha', 'comida arabe', 'esfihas'],
    'hot dogs': ['hot dog', 'cachorro quente', 'hotdog'],
    'food trucks': ['food truck', 'food park', 'foodtruck'],
    'churrascarias': ['churrascaria', 'churrascarias', 'churrasco', 'churrascaria gaucha', 'churrascaria gaúcha', 'rodizio', 'rodízio', 'rodizio de carnes', 'rodízio de carnes', 'espetaria', 'espeto corrido', 'casa de carnes', 'casa de carne', 'parrilla', 'parrillada', 'churrascaria rodizio', 'churrasco a la carte', 'churrasco à la carte', 'restaurante de carnes', 'steakhouse', 'steak house', 'grill', 'grelhados', 'churrascaria premium', 'churrascaria premium rodizio', 'rancho do churrasco', 'churrasqueira', 'casa do churrasco'],
    'espetarias': ['espetaria', 'espeto', 'espetinho', 'espetos'],
    'marmitarias': ['marmitaria', 'marmita', 'marmitex', 'quentinha'],
    'rotisseries': ['rotisserie', 'rotisseria', 'frango assado', 'assados'],
    'restaurantes japoneses': ['restaurante japones', 'comida japonesa', 'sushi', 'sashimi', 'japa'],
    'sushi bars': ['sushi', 'sushi bar', 'sushiman', 'sashimi', 'temaki'],
    'restaurantes chineses': ['restaurante chines', 'comida chinesa', 'china'],
    'restaurantes italianos': ['restaurante italiano', 'cantina italiana', 'trattoria', 'massas'],
    'restaurantes mexicanos': ['restaurante mexicano', 'comida mexicana', 'taqueria', 'burrito'],
    'restaurantes árabes': ['restaurante arabe', 'comida arabe', 'esfiha', 'shawarma', 'kebab'],
    'restaurantes veganos': ['restaurante vegano', 'comida vegana', 'vegan'],
    'restaurantes vegetarianos': ['restaurante vegetariano', 'comida vegetariana'],
    'restaurantes fit': ['restaurante fit', 'comida fit', 'alimentacao saudavel', 'fit food'],
    'restaurantes self-service': ['self service', 'por quilo'],
    'restaurantes orientais': ['restaurante oriental', 'comida oriental', 'culinaria asiatica'],
    'restaurantes indianos': ['restaurante indiano', 'comida indiana', 'curry'],
    'restaurantes tailandeses': ['restaurante tailandes', 'comida tailandesa', 'thai'],
    'restaurantes coreanos': ['restaurante coreano', 'comida coreana', 'korean bbq'],
    'restaurantes peruanos': ['restaurante peruano', 'comida peruana', 'ceviche'],
    'restaurantes portugueses': ['restaurante portugues', 'comida portuguesa', 'bacalhau'],
    'restaurantes de frutos do mar': ['frutos do mar', 'marisqueira', 'pescado', 'camarao'],
    'restaurantes por quilo': ['restaurante por quilo', 'por quilo', 'self service'],
    'restaurantes de comida baiana': ['comida baiana', 'acaraje', 'culinaria baiana'],
    'restaurantes de comida mineira': ['comida mineira', 'culinaria mineira', 'comida de minas'],
    'restaurantes de comida nordestina': ['comida nordestina', 'culinaria nordestina'],
    'restaurantes de comida gaúcha': ['comida gaucha', 'culinaria gaucha', 'churrasco gaucho'],
    'marisquerias': ['marisqueria', 'frutos do mar', 'camarao'],
    'temakerias': ['temakeria', 'temaki'],
    'cozinhas industriais': ['cozinha industrial', 'cozinhas industriais', 'refeicao coletiva', 'refeição coletiva', 'servico de alimentacao coletiva', 'serviço de alimentação coletiva', 'catering', 'catering corporativo', 'empresa de refeicoes', 'empresa de refeições', 'fornecedor de refeicoes', 'fornecedor de refeições', 'refeitorio industrial', 'refeitório industrial', 'cozinha hospitalar', 'cozinha escolar', 'cozinha terceirizada', 'alimentacao corporativa', 'alimentação corporativa', 'refeicoes industriais', 'refeições industriais', 'marmita industrial', 'marmitex industrial', 'refeicoes coletivas', 'refeições coletivas', 'copeiragem industrial', 'operadora de cozinhas', 'operadora de refeicoes', 'quentinha industrial', 'gastronomia industrial', 'restaurante industrial', 'restaurantes industriais', 'servico de bandejas', 'serviço de bandejas', 'linha quente industrial', 'transporte de refeicoes', 'transporte de refeições', 'pdq cozinha', 'sodexo', 'gr sa', 'grande cozinha', 'equipamento de cozinha industrial'],
    'quentinhas e marmitas': ['quentinha', 'marmita', 'marmitex'],
    'casas de massas': ['casa de massas', 'massas', 'macarrao', 'pasta'],
    'casas de feijoada': ['feijoada', 'casa de feijoada'],
    'casas de fondue': ['casa de fondue', 'fondue'],
    'catering': ['catering', 'buffet', 'refeicao coletiva', 'servico de alimentacao'],

    // ===== PADARIAS E CONFEITARIAS =====
    // Padarias e confeitarias são praticamente a mesma coisa - termos compartilhados
    'padarias': ['padaria', 'panificadora', 'panificacao', 'panificação', 'panificio', 'panifício', 'casa de pães', 'casa do pão', 'confeitaria', 'bakery', 'padoca', 'panetteria', 'panetaria', 'boulangerie', 'pão artesanal', 'pão caseiro', 'forno de pão', 'forneria', 'padaria e confeitaria', 'panificadora e confeitaria', 'padaria artesanal', 'pao quentinho', 'pão quentinho', 'padaria gourmet', 'panificio padaria', 'padaria do bairro'],
    'panificadoras': ['panificadora', 'padaria', 'panificacao', 'panificio', 'confeitaria', 'panetteria', 'boulangerie'],
    'confeitarias': ['confeitaria', 'confeitarias', 'bolos', 'cake', 'patisserie', 'padaria', 'panificadora', 'doces', 'tortas', 'bolo artesanal', 'cake shop', 'confeitaria fina', 'confeitaria artesanal', 'confeitaria boutique', 'confeitaria de luxo', 'docinhos para festa', 'docinhos finos', 'brigaderia', 'brigadeiros gourmet', 'loja de bolos', 'loja de tortas', 'bolo no pote', 'naked cake', 'cake design', 'cupcake', 'cupcakes', 'macarons', 'macaron', 'confeitaria francesa', 'confeitaria gourmet', 'confeitaria infantil', 'bolo de aniversario', 'bolo de casamento', 'confeitaria para festas', 'salgados e doces', 'doceria confeitaria', 'encomenda de bolos', 'sobremesas finas', 'confeitaria sem gluten', 'confeitaria sem lactose', 'confeitaria fitness', 'confeitaria vegana', 'escola de confeitaria'],
    'docerias': ['doceria', 'doces', 'brigadeiro', 'bombons', 'candy', 'doces finos', 'doces artesanais'],
    'chocolaterias': ['chocolateria', 'chocolate artesanal', 'bombons', 'chocolate', 'cacau'],
    'pâtisseries': ['patisserie', 'doces finos', 'confeitaria fina'],

    // ===== SORVETERIAS E BEBIDAS GELADAS =====
    'sorveterias': ['sorveteria', 'sorvete', 'gelato', 'picole', 'acai'],
    'gelatarias': ['gelataria', 'gelato', 'sorvete artesanal'],
    'açaiterias': ['acaiteria', 'acai'],
    'casas de açaí': ['casa de acai', 'acai'],
    'smoothie bars': ['smoothie', 'vitaminas', 'sucos'],
    'frozen yogurts': ['frozen yogurt', 'iogurte', 'sorvete iogurte'],
    'bubble tea': ['bubble tea', 'cha', 'boba'],
    'casas de sucos': ['casa de sucos', 'sucos naturais'],

    // ===== CAFETERIAS =====
    'cafeterias': ['cafeteria', 'cafe', 'coffee', 'coffee shop'],

    // ===== BARES =====
    'bares': ['bar', 'bar e', 'bares', 'boteco', 'botequim', 'butiquim', 'pub', 'cervejaria', 'cervejarias', 'choperia', 'chopperia', 'chopp', 'choparia', 'lounge', 'adega', 'adegas', 'petisqueira', 'petiscaria', 'drinkeria', 'drinks', 'gastrobar', 'gastro bar', 'beer', 'beerhouse', 'beer house', 'taberna', 'tasca', 'wine bar', 'whisky', 'whiskeria', 'bar e restaurante', 'bar e lanchonete', 'bar e mercearia', 'esquina', 'sinuca', 'snooker', 'karaoke', 'karaokê'],

    // ===== SUPERMERCADOS E MERCADOS =====
    'supermercados': ['supermercado', 'supermercados', 'mercado', 'mercados', 'minimercado', 'mini mercado', 'mercearia', 'mercadinho', 'hipermercado', 'atacarejo', 'atacadao', 'atacadão', 'rede de supermercados', 'super', 'supermarket', 'auto serviço', 'autoservico', 'mercado de bairro', 'mercado popular', 'mercado familiar', 'rede supermercadista', 'cash and carry', 'cash & carry', 'compre bem', 'bom preco', 'bom preço'],
    'hipermercados': ['hipermercado', 'hipermercados', 'atacadao', 'atacadão', 'atacarejo', 'hiper', 'cash and carry', 'cash & carry', 'mega mercado', 'mega supermercado', 'megastore alimentar', 'rede hiper', 'super atacado', 'atacado e varejo', 'extra hiper', 'carrefour hiper', 'walmart', 'sams club', 'makro', 'assai', 'assaí', 'tenda atacado', 'maxxi atacado', 'roldao', 'roldão'],
    'mercados': ['mercado', 'mercados', 'minimercado', 'mini mercado', 'mercadinho', 'mercearia', 'supermercado', 'mercado de bairro', 'mercado popular', 'auto serviço', 'autoservico', 'mercado familiar', 'mercado central', 'mercado municipal', 'casa de carnes mercado', 'empório mercado', 'emporio mercado', 'mercado de conveniencia', 'mercado de conveniência', 'conveniencia', 'conveniência', 'lojinha de bairro', 'mercado express', 'mercado 24h', 'mercado e padaria', 'mini mercado e padaria'],
    'mercearias': ['mercearia', 'mercearias', 'armazem', 'armazém', 'secos e molhados', 'mercadinho', 'minimercado', 'mini mercado', 'venda', 'bodega', 'quitanda', 'mercearia de bairro', 'empório mercearia', 'casa de secos', 'casa de armazem', 'armazem de bairro', 'armarinho mercearia', 'mercearia popular', 'mercearia tradicional', 'mercearia familiar', 'mercearia portuguesa'],

    // ===== FARMÁCIAS E DROGARIAS =====
    'farmácias': ['farmacia', 'drogaria', 'farmacia popular', 'farmacia de manipulacao', 'botica'],
    'farmácias e drogarias': ['farmacia', 'drogaria', 'farmacia popular'],
    'drogarias': ['drogaria', 'farmacia'],
    'farmácias de manipulação': ['farmacia de manipulacao', 'manipulacao', 'farmacia magistral'],

    // ===== PET =====
    'pet shop': ['pet shop', 'petshop', 'pet center', 'animais', 'agropet', 'banho e tosa', 'racao'],
    'pet shops': ['pet shop', 'petshop', 'pet shops', 'petshops', 'pet center', 'animais', 'agropet', 'banho e tosa', 'racao', 'ração', 'loja de pet', 'loja para pets', 'loja de animais', 'loja de produtos pet', 'pet store', 'pet boutique', 'pet shop com banho e tosa', 'pet shop 24h', 'pet shop delivery', 'pet shop online', 'pet shop completo', 'centro pet', 'mundo pet', 'planeta pet', 'clinica e pet shop', 'clínica e pet shop', 'pet shop com veterinario', 'pet shop com veterinário', 'pet shop com hotel', 'pet shop com creche', 'pet shop premium', 'franquia de pet shop', 'rede de pet shops', 'pet shop pequeno porte', 'pet shop bairro', 'pet shop com farmacia veterinaria', 'pet shop com aquarismo', 'pet shop com aves', 'pet shop com roedores', 'pet shop com gatos', 'pet shop com caes', 'pet shop com cães'],
    'loja de ração pet': ['racao', 'ração', 'racao pet', 'ração pet', 'agropet', 'casa de racao', 'casa de ração', 'loja de racao', 'loja de ração', 'loja de racao pet', 'agropecuaria pet', 'agropecuária pet', 'pet shop racao', 'pet shop ração', 'distribuidora de racao', 'distribuidor de racao', 'racao para caes', 'ração para cães', 'racao para gatos', 'ração para gatos', 'racao para cavalos', 'racao para passaros', 'ração para pássaros', 'racao para peixes', 'racao para aves', 'racao para roedores', 'casa de racoes', 'casa de rações', 'depósito de racao', 'deposito de ração', 'racao premium', 'racao super premium', 'racao a granel', 'ração a granel', 'centro pet racao', 'loja agropecuaria', 'loja agropecuária', 'depósito de produtos pet', 'racao e produtos pet', 'racao para porte pequeno', 'racao para porte grande', 'rações pet', 'racoes pet', 'feed pet'],
    'banho e tosa': ['banho e tosa', 'tosador', 'pet grooming', 'estetica animal'],
    'hotéis pet': ['hotel pet', 'hotel para caes', 'hotel para cães', 'hotel para gatos', 'hotelzinho pet', 'hospedagem pet', 'hospedagem para caes', 'hospedagem para cães', 'hospedagem para animais', 'hotel para animais', 'pousada pet', 'pousada para caes', 'pousada para cães', 'creche e hotel pet', 'daycare pet', 'pet hotel', 'dog hotel', 'cat hotel', 'resort pet', 'spa pet', 'hotel pet de luxo', 'hospedagem canina', 'hospedagem felina', 'hotel para pets pequenos', 'hotel para caes grandes', 'hospedagem com banho', 'hospedagem com adestramento', 'pet sitter hotel', 'hospedaria pet', 'hotel pet 24h', 'hospedagem domiciliar pet', 'hospedagem pet com camera', 'hospedagem pet com webcam', 'hotel pet ar condicionado'],
    'creches pet': ['creche pet', 'creche para caes', 'day care pet'],
    'clínicas veterinárias': ['clinica veterinaria', 'veterinario', 'hospital veterinario'],
    'adestramento de animais': ['adestramento', 'adestrador', 'treinamento de caes'],
    'fabricantes de ração pet': ['fabrica de racao', 'fábrica de ração', 'fabricante de racao', 'fabricante de ração', 'industria de racao pet', 'indústria de ração pet', 'racao pet', 'ração pet', 'nutricao animal', 'nutrição animal', 'alimento para animais', 'alimentos para animais', 'alimento pet', 'industria de alimentos pet', 'fabrica de alimentos pet', 'pet food', 'pet food industry', 'racao para caes', 'racao para cães', 'racao para gatos', 'racao para aves', 'racao para peixes', 'fabrica de petiscos', 'industria de petiscos pet', 'racao premium', 'racao super premium', 'racao economica', 'racao natural', 'racao seca', 'racao umida'],
    'indústrias de produtos pet': ['industria pet', 'indústria pet', 'industria de produtos pet', 'indústria de produtos pet', 'fabrica de racao', 'fábrica de ração', 'produtos pet', 'fabricante de produtos pet', 'industria de acessorios pet', 'indústria de acessórios pet', 'fabrica de coleiras', 'industria de coleiras', 'industria de roupas pet', 'indústria de roupas pet', 'industria de brinquedos pet', 'industria de areia higienica', 'indústria de areia higiênica', 'fabrica de areia higienica', 'industria de petiscos', 'fabricante de petiscos pet', 'industria de tapete higienico', 'industria de comedouros', 'industria de bebedouros', 'industria de caminhas pet', 'industria de casinhas pet', 'industria de transportadoras pet', 'industria de guias pet', 'industria de focinheiras', 'industria de cosmeticos pet', 'indústria de cosméticos pet', 'industria de shampoo pet', 'industria de medicamentos pet', 'industria farmaceutica veterinaria', 'indústria farmacêutica veterinária', 'industria de suplementos pet', 'industria de snacks pet', 'industria de brinquedos para caes', 'industria de brinquedos para gatos', 'industria de produtos veterinarios'],

    // ===== SAÚDE =====
    'clínicas': ['clinica', 'consultorio', 'clinica medica', 'clinica odontologica', 'centro medico'],
    'clínicas médicas': ['clinica medica', 'consultorio medico', 'centro medico'],
    'clínicas odontológicas': ['clinica odontologica', 'consultorio odontologico', 'dentista'],
    'clínicas médicas e odontológicas': ['clinica medica', 'clinica odontologica', 'consultorio medico', 'consultorio odontologico'],
    'hospitais': ['hospital', 'pronto socorro', 'pronto atendimento'],
    'hospitais e pronto-atendimentos': ['hospital', 'pronto atendimento', 'pronto-socorro'],
    'laboratórios': ['laboratorio', 'analises clinicas', 'diagnostico', 'patologia'],
    'laboratórios e centros de diagnóstico': ['laboratorio', 'analises clinicas', 'diagnostico'],
    'clínicas de fisioterapia': ['fisioterapia', 'clinica de fisioterapia', 'reabilitacao'],
    'clínicas de fisioterapia e reabilitação': ['fisioterapia', 'reabilitacao', 'fisioterapeuta'],
    'ortopedias': ['ortopedia', 'produtos ortopedicos', 'orteses'],
    'ortopedias e lojas de produtos ortopédicos': ['ortopedia', 'produtos ortopedicos', 'orteses e proteses'],
    'clínicas de estética': ['clinica de estetica', 'estetica', 'estetica facial', 'estetica corporal'],
    'clínicas de psicologia': ['clinica de psicologia', 'psicologo', 'psicoterapia'],
    'nutricionistas': ['nutricionista', 'nutricao', 'consultorio de nutricao'],
    'fonoaudiólogos': ['fonoaudiologo', 'fonoaudiologia'],
    'planos de saúde': ['plano de saude', 'operadora de saude', 'convenio medico'],
    'home care': ['home care', 'atendimento domiciliar', 'enfermagem domiciliar'],
    'spas': ['spa', 'day spa', 'spa urbano'],

    // ===== BELEZA =====
    'salões de beleza': ['salao de beleza', 'cabeleireiro', 'barbearia', 'estetica', 'manicure', 'hair'],
    'barbearias': ['barbearia', 'barbeiro', 'barber shop'],
    'estúdios de tatuagem': ['estudio de tatuagem', 'tatuagem', 'tattoo', 'piercing'],
    'perfumarias': ['perfumaria', 'perfume', 'cosmeticos e perfumes'],
    'lojas de cosméticos': ['cosmeticos', 'maquiagem', 'beleza'],

    // ===== CONSTRUÇÃO CIVIL =====
    'materiais de construção': ['material de construcao', 'material de construção', 'materiais de construcao', 'materiais de construção', 'home center', 'homecenter', 'deposito de construcao', 'depósito de construção', 'casa de construcao', 'casa de construção', 'constrular', 'constru', 'casa do construtor', 'loja de construcao', 'loja de construção', 'ferragem', 'ferragens', 'ferragista', 'cimento', 'tijolo', 'areia', 'brita', 'cal', 'argamassa', 'telha', 'telhas', 'hidraulica', 'hidráulica', 'eletrica e hidraulica', 'tintas', 'loja de tintas', 'acabamentos', 'pisos e revestimentos', 'pisos', 'azulejos', 'ceramica', 'cerâmica', 'madeireira', 'madeiras', 'serralheria'],
    'depósitos de materiais de construção': ['deposito de construcao', 'depósito de construção', 'deposito de materiais', 'depósito de materiais', 'material de construcao', 'material de construção', 'materiais de construcao', 'materiais de construção', 'home center', 'homecenter', 'casa de construcao', 'casa de construção', 'constrular', 'constru', 'casa do construtor', 'loja de construcao', 'loja de construção', 'ferragem', 'ferragens', 'ferragista', 'cimento', 'tijolo', 'areia', 'brita', 'cal', 'argamassa', 'telha', 'telhas', 'hidraulica', 'hidráulica', 'tintas', 'loja de tintas', 'acabamentos', 'pisos e revestimentos', 'pisos', 'azulejos', 'ceramica', 'cerâmica', 'madeireira', 'madeiras', 'serralheria', 'deposito', 'depósito'],
    'construtoras': ['construtora', 'construtoras', 'construcoes', 'construções', 'construcao civil', 'construção civil', 'empreiteira', 'empreiteiras', 'incorporadora', 'incorporadoras', 'engenharia civil', 'engenharia e construcao', 'obras e servicos', 'edificacoes', 'edificações', 'construtora e incorporadora', 'obras civis', 'engenharia e empreendimentos', 'empreendimentos imobiliarios', 'empreendimentos imobiliários', 'incorporacao imobiliaria', 'incorporação imobiliária', 'obras e edificacoes', 'obras e edificações', 'engenharia construcao', 'engenharia construção', 'obra civil', 'reformas e construcoes', 'predial', 'edificios', 'edifícios', 'urbanismo', 'loteadora', 'loteamentos', 'engenharia predial'],
    'empreiteiras': ['empreiteira', 'empreiteiras', 'empreiteira de obras', 'construcao civil', 'construção civil', 'obra', 'obras civis', 'subempreiteira', 'mao de obra para construcao', 'mão de obra para construção', 'empreitada', 'empreitada de obras', 'empresa de obras', 'prestadora de servicos para construcao', 'execucao de obras', 'execução de obras', 'gerenciadora de obras', 'gerenciamento de obras', 'construtora terceirizada', 'engenharia civil', 'servicos de engenharia', 'serviços de engenharia', 'reformas e construcao', 'mao de obra civil', 'empreiteira predial', 'empreiteira industrial'],
    'incorporadoras': ['incorporadora', 'incorporacao', 'empreendimento imobiliario'],
    'lojas de revestimentos': ['revestimentos', 'porcelanato', 'pisos', 'ceramica'],
    'lojas de pisos e azulejos': ['pisos', 'azulejos', 'ceramica', 'porcelanato'],
    'lojas de tintas': ['tintas', 'loja de tintas', 'tinta', 'verniz'],
    'lojas de portas': ['portas', 'portas e janelas', 'portas de madeira', 'portas de aco'],
    'marmorarias': ['marmoraria', 'marmore', 'granito', 'pedras decorativas'],
    'vidraçarias': ['vidracaria', 'vidraçaria', 'vidracarias', 'vidraçarias', 'vidracaria e espelhos', 'vidracaria e espelho', 'vidracaria espelhos', 'comercio de vidros', 'comércio de vidros', 'comercio de vidros e espelhos', 'box de vidro', 'box para banheiro', 'box blindex', 'blindex', 'vidro temperado', 'vidros temperados', 'porta de vidro', 'portas de vidro', 'janela de vidro', 'janelas de vidro', 'fachada de vidro', 'pele de vidro', 'cobertura de vidro', 'guarda corpo de vidro', 'guarda-corpo de vidro', 'corrimao de vidro', 'corrimão de vidro', 'sacada de vidro', 'envidracamento', 'envidraçamento', 'instalacao de vidros', 'instalação de vidros', 'troca de vidros', 'corte de vidros', 'beneficiamento de vidros', 'fechamento de sacada', 'kit box', 'vidracaria 24 horas', 'vidracaria 24h', 'vidracaria express'],
    'empresas de drywall': ['drywall', 'gesso acartonado', 'construcao a seco'],
    'gesseiros': ['gesseiro', 'gesso', 'forro de gesso', 'sanca de gesso'],
    'empresas de steel frame': ['steel frame', 'steel framing', 'light steel frame', 'lsf', 'construcao a seco', 'construção a seco', 'sistema steel frame', 'perfil steel frame', 'perfis metalicos leves', 'estrutura steel frame', 'casa em steel frame', 'obra em steel frame', 'steel frame brasil', 'aco galvanizado', 'aço galvanizado', 'estruturas leves', 'perfilados', 'drywall steel frame', 'industrializado a seco', 'painel osb', 'placa cimenticia', 'placa cimentícia', 'wood frame e steel frame', 'frame metalico', 'frame metálico', 'engenharia steel frame'],
    'construtoras de pré-moldado': ['pre-moldado', 'pre moldado', 'pré-moldado', 'pré moldado', 'artefatos de concreto', 'lajes', 'pre-fabricado', 'pré-fabricado', 'concreto pre-moldado', 'concreto pré-moldado', 'vigas pre-moldadas', 'pilares pre-moldados', 'painel pre-moldado', 'painéis pre-moldados', 'estrutura pre-moldada', 'galpão pre-moldado', 'galpao pre-moldado', 'obra pre-moldada', 'industrializado', 'sistema construtivo', 'fabricante pre-moldado', 'construtora pre-moldado', 'engenharia pre-moldados', 'estruturas de concreto', 'concreto armado'],
    'empresas de contêineres e módulos': ['container', 'contêiner', 'containers', 'contêineres', 'modulo habitacional', 'módulo habitacional', 'construcao modular', 'construção modular', 'fabrica de containers', 'fábrica de contêineres', 'container habitacional', 'container comercial', 'container escritorio', 'container escritório', 'container reefer', 'container dry', 'container maritimo', 'container marítimo', 'container customizado', 'container adaptado', 'locacao de containers', 'locação de contêineres', 'venda de containers', 'venda de contêineres', 'modulo pre-fabricado', 'módulo pré-fabricado', 'modulos pre-fabricados', 'módulos pré-fabricados', 'obra modular', 'sistema modular', 'industria de containers', 'indústria de contêineres', 'fabricante de containers', 'reforma de container', 'transporte de containers', 'container para canteiro', 'banheiro container', 'vestiario container', 'vestiário container', 'container habitacao', 'container habitação'],
    'sistemas de incêndio': ['sistema de incendio', 'extintores', 'bombeiro civil', 'combate a incendio'],
    'engenharias': ['engenharia', 'consultoria em engenharia', 'projeto de engenharia'],

    // ===== FERRAGENS E FERRAMENTAS =====
    'ferramentas': ['ferramentas', 'ferragem', 'loja de ferramentas'],
    'ferragens': ['ferragem', 'ferragens', 'parafusos', 'dobradicas', 'fechaduras', 'cadeados'],
    'lojas de ferragens': ['ferragens', 'parafusos', 'ferragem'],
    'lojas de ferramentas': ['ferramentas', 'ferragem', 'ferragens', 'loja de ferramentas', 'casa das ferramentas', 'casa de ferramentas', 'ferramentaria', 'loja de ferragens', 'casa do parafuso', 'parafusos e ferragens', 'ferramentas eletricas', 'ferramentas elétricas', 'ferramentas manuais', 'ferramentas profissionais', 'ferramentas industriais', 'ferramentas para construcao', 'ferramentas para construção', 'maquinas e ferramentas', 'máquinas e ferramentas', 'ferramentas pneumaticas', 'ferramentas pneumáticas', 'loja de ferramentas eletricas', 'centro de ferramentas', 'rede ferragens', 'mundo das ferramentas', 'super ferramentas'],
    'chaveiros': ['chaveiro', 'chaves', 'carimbos'],

    // ===== ELÉTRICA E ENERGIA =====
    'lojas de materiais elétricos': ['materiais eletricos', 'materiais elétricos', 'material eletrico', 'material elétrico', 'eletrica', 'elétrica', 'componentes eletricos', 'componentes elétricos', 'loja de material eletrico', 'casa do eletricista', 'casa da eletrica', 'eletro material', 'fios e cabos', 'fios e cabos eletricos', 'iluminacao e eletrica', 'iluminação e elétrica', 'lampadas e luminarias', 'lâmpadas e luminárias', 'disjuntores', 'quadros eletricos', 'tomadas e interruptores', 'distribuidor de material eletrico', 'atacado de material eletrico', 'rede eletrica', 'comercio de eletrica', 'instalacoes eletricas materiais', 'condulete', 'eletroduto'],
    'instaladores elétricos': ['instalador eletrico', 'instalador elétrico', 'eletricista', 'instalacao eletrica', 'instalação elétrica', 'servicos eletricos', 'serviços elétricos', 'manutencao eletrica', 'manutenção elétrica', 'eletricista predial', 'eletricista industrial', 'eletricista residencial', 'instalador de quadros eletricos', 'instalador de paineis eletricos', 'reparos eletricos', 'projetos eletricos', 'engenharia eletrica', 'engenharia elétrica', 'spda', 'aterramento', 'cabeamento eletrico', 'rede eletrica', 'instalador de geradores', 'instalador de no break', 'eletrotecnico', 'eletrotécnico', 'empresa de eletrica'],
    'empresas de manutenção elétrica': ['manutencao eletrica', 'eletricista', 'manutencao eletrica predial'],
    'empresas de engenharia elétrica': ['engenharia eletrica', 'projeto eletrico', 'instalacoes eletricas'],
    'montadores de painel elétrico': ['painel eletrico', 'quadro eletrico', 'montagem de paineis'],
    'lojas de iluminação': ['iluminacao', 'luminarias', 'lustres', 'led'],
    'lojas de lustres e luminárias': ['lustres', 'luminarias', 'iluminacao decorativa'],

    // ===== AUTOMOTIVO =====
    'autopeças': ['autopecas', 'autopeças', 'auto pecas', 'auto peças', 'pecas automotivas', 'peças automotivas', 'auto center', 'pecas para carros', 'peças para carros', 'pecas para veiculos', 'peças para veículos', 'loja de autopecas', 'casa de autopecas', 'pecas para motos', 'peças para motos', 'autopeca multimarcas', 'autopeças multimarcas', 'pecas originais', 'peças originais', 'pecas e acessorios', 'peças e acessórios', 'centro automotivo', 'pecas para caminhao', 'peças para caminhão', 'pecas para onibus', 'peças para ônibus', 'pecas pesadas', 'peças pesadas', 'pecas usadas', 'peças usadas', 'desmanche', 'ferro velho automotivo'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'distribuidora de autopeças', 'atacado de autopecas', 'atacado de autopeças', 'pecas automotivas atacado', 'peças automotivas atacado', 'distribuidor de pecas', 'distribuidor de peças', 'atacadista de autopecas', 'atacadista de autopeças', 'pecas automotivas distribuidor', 'distribuidora de pecas para veiculos', 'distribuidor de pecas pesadas', 'distribuidora de pecas para caminhao', 'distribuidor de pecas para motos', 'representante de autopecas', 'central de autopecas', 'rede de autopecas', 'fornecedor de autopecas', 'pecas multimarcas atacado', 'distribuidora de pecas originais', 'pecas para revenda', 'distribuidor de pecas eletricas automotivas', 'distribuidora de filtros', 'distribuidora de oleos lubrificantes', 'pecas e acessorios atacado'],
    'autopeças de vans e utilitários': ['autopecas van', 'autopeças van', 'pecas utilitarios', 'peças utilitários', 'pecas van', 'peças van', 'autopecas utilitarios', 'autopeças utilitários', 'pecas para van', 'peças para van', 'pecas para utilitarios', 'peças para utilitários', 'van pecas', 'utilitario pecas', 'utilitário peças', 'pecas para furgao', 'peças para furgão', 'pecas sprinter', 'pecas ducato', 'pecas master', 'pecas iveco daily', 'pecas hr', 'pecas bongo', 'pecas kombi', 'pecas fiorino', 'pecas saveiro', 'pecas strada', 'pecas montana', 'pecas oroch', 'pecas l200', 'pecas hilux'],
    'autopeças de importados': ['autopecas importados', 'pecas importadas', 'pecas carro importado', 'autopecas importadas', 'pecas para importados', 'import car parts'],
    'e-commerce de peças automotivas': ['ecommerce autopecas', 'pecas automotivas online', 'loja virtual autopecas', 'autopecas online', 'pecas online'],
    'oficinas mecânicas': ['oficina mecanica', 'oficina mecânica', 'oficinas mecanicas', 'auto center', 'autocenter', 'funilaria', 'funilaria e pintura', 'mecanica automotiva', 'mecânica automotiva', 'mecanico', 'mecânico', 'mecanica de carros', 'oficina automotiva', 'oficina de motos', 'mecanica de motos', 'oficina de caminhoes', 'oficina de caminhões', 'mecanica diesel', 'mecânica diesel', 'centro automotivo', 'auto eletrica', 'auto elétrica', 'eletrica automotiva', 'elétrica automotiva', 'oficina multimarcas', 'oficina especializada', 'mecanica geral', 'mecanica preventiva', 'manutencao automotiva', 'manutenção automotiva', 'troca de oleo', 'alinhamento e balanceamento', 'oficina credenciada'],
    'funilarias e pinturas': ['funilaria', 'pintura automotiva', 'lanternagem'],
    'auto elétricas': ['auto eletrica', 'eletrica automotiva', 'eletricista automotivo'],
    'borracharias': ['borracharia', 'pneus', 'borracheiro'],
    'lojas de pneus': ['pneus', 'borracharia', 'borracharias', 'recapagem', 'recauchutagem', 'loja de pneus', 'centro de pneus', 'pneu', 'pneus novos', 'pneus usados', 'pneus remoldados', 'pneus para carros', 'pneus para caminhao', 'pneus para caminhão', 'pneus para motos', 'centro automotivo de pneus', 'auto pneus', 'super pneus', 'distribuidora de pneus', 'comercio de pneus', 'comércio de pneus', 'rede de pneus', 'pneus michelin', 'pneus pirelli', 'pneus goodyear', 'pneus continental', 'pneus bridgestone', 'alinhamento balanceamento pneus', 'troca de pneus', 'instalacao de pneus'],
    'lojas de rodas esportivas': ['rodas esportivas', 'rodas automotivas', 'rodas liga leve'],
    'lava-rápidos': ['lava rapido', 'lava jato', 'lavagem de carros'],
    'concessionárias': ['concessionaria', 'revenda de veiculos', 'veiculos novos'],
    'postos de combustível': ['posto de combustivel', 'posto de combustível', 'postos de combustivel', 'postos de combustível', 'posto de gasolina', 'postos de gasolina', 'auto posto', 'autoposto', 'auto-posto', 'posto shell', 'posto ipiranga', 'posto petrobras', 'posto br', 'posto ale', 'posto raizen', 'posto graal', 'posto de etanol', 'posto de alcool', 'posto de álcool', 'posto de diesel', 'posto de gnv', 'posto bandeirado', 'posto bandeira branca', 'posto rodoviario', 'posto rodoviário', 'posto urbano', 'rede de postos', 'posto 24 horas', 'posto 24h', 'posto e conveniencia', 'posto e conveniência', 'posto multi-bandeira', 'posto multibandeira', 'revenda de combustiveis', 'revenda de combustíveis', 'revendedor de combustiveis'],
    'guincho e reboque': ['guincho', 'reboque', 'auto socorro'],
    'lojas de moto': ['moto', 'motocicleta', 'concessionaria de motos'],
    'lojas de carro': ['carro', 'automovel', 'revenda de veiculos'],

    // ===== AGROPECUÁRIA =====
    'agropecuária': ['agropecuaria', 'agropecuária', 'agropecuarias', 'produtos rurais', 'casa agropecuaria', 'casa agropecuária', 'insumos agricolas', 'insumos agrícolas', 'loja agropecuaria', 'loja agropecuária', 'agro', 'agro center', 'agronegocio', 'agronegócio', 'casa do produtor rural', 'casa do agricultor', 'agro veterinaria', 'agro veterinária', 'agro insumos', 'agroquimicos', 'agroquímicos', 'sementes e insumos', 'fertilizantes e defensivos', 'racao animal', 'ração animal', 'medicamentos veterinarios', 'medicamentos veterinários', 'agropet', 'rural shop', 'casa rural', 'comercio agricola', 'comércio agrícola', 'cooperativa agropecuaria', 'distribuidora agropecuaria'],
    'casas agropecuárias': ['agropecuaria', 'casa agropecuaria', 'produtos rurais'],
    'cooperativas agrícolas': ['cooperativa agricola', 'cooperativa rural'],
    'revendas de insumos agrícolas': ['revenda de insumos', 'defensivos agricolas', 'agroquimicos'],
    'revendas de máquinas agrícolas': ['maquinas agricolas', 'tratores'],
    'tratores e implementos agrícolas': ['tratores', 'implementos agricolas', 'maquinas agricolas'],
    'irrigação': ['irrigacao', 'sistema de irrigacao', 'aspersao', 'gotejamento'],
    'silos e armazéns': ['silo', 'armazem', 'armazenagem de graos'],
    'granjas': ['granja', 'avicola', 'avicultura', 'ovos'],

    // ===== MODA E VESTUÁRIO =====
    'lojas de roupas': ['roupas', 'vestuario', 'vestuário', 'boutique', 'moda', 'confeccao', 'confecção', 'loja de roupas', 'loja de moda', 'magazine de moda', 'moda feminina', 'moda masculina', 'moda jovem', 'moda casual', 'moda festa', 'moda praia', 'moda fitness', 'moda evangelica', 'moda evangélica', 'roupas femininas', 'roupas masculinas', 'roupas casuais', 'roupas sociais', 'jeanswear', 'malharia', 'malhas', 'bazar de roupas', 'brecho', 'brechó', 'outlet de roupas', 'multimarcas', 'fast fashion', 'pronta entrega vestuario'],
    'lojas de moda infantil': ['loja de moda infantil', 'moda infantil', 'roupas infantis', 'loja de roupas infantis', 'enxoval de bebe', 'enxoval de bebê', 'loja para criancas', 'loja para crianças', 'baby shop', 'kids store', 'loja infantil', 'loja de bebe', 'loja de bebê', 'roupinhas infantis', 'loja de roupas para criancas', 'loja de roupas para crianças', 'loja de roupas para bebe', 'loja de roupas para bebê', 'loja de calcados infantis', 'loja de calçados infantis', 'loja de uniforme escolar', 'loja de moda teen', 'moda teen', 'loja de festa infantil', 'loja de presentes infantis', 'loja de moda infantil masculina', 'loja de moda infantil feminina', 'franquia de moda infantil', 'butique infantil', 'loja de roupinhas', 'loja de bebe e crianca', 'loja de bebê e criança', 'loja de produtos infantis', 'loja de roupas para recem-nascido', 'loja de roupas para recém-nascido', 'loja de pijamas infantis', 'loja de moda kids', 'loja de roupas para gestantes e bebes'],
    'lojas de calçados': ['calcados', 'calçados', 'sapatos', 'tenis', 'tênis', 'sapataria', 'loja de calcados', 'loja de calçados', 'loja de sapatos', 'sapatilharia', 'sapatos femininos', 'sapatos masculinos', 'sapatos infantis', 'calcados infantis', 'calçados infantis', 'calcados femininos', 'calçados femininos', 'calcados masculinos', 'calçados masculinos', 'sapatenis', 'sapatênis', 'botas', 'sandalias', 'sandálias', 'chinelos', 'tenis esportivos', 'tênis esportivos', 'sapatos sociais', 'sapato de couro', 'outlet de calcados', 'magazine de calcados', 'rede de calcados'],
    'lojas de bolsas e acessórios': ['bolsas', 'acessorios', 'malas', 'carteiras'],
    'joalherias': ['joalheria', 'joias', 'relojoaria', 'bijuteria', 'ourivesaria'],
    'óticas': ['otica', 'ótica', 'oticas', 'óticas', 'oculos', 'óculos', 'oculos de grau', 'óculos de grau', 'oculos de sol', 'óculos de sol', 'optica', 'óptica', 'lentes de contato', 'armacao de oculos', 'armação de óculos', 'consultoria optometrica', 'consultoria optométrica', 'exame de vista', 'optometrista', 'optometria', 'oftalmologia comercial', 'oculos infantil', 'óculos infantil', 'oculos esportivo', 'óculos esportivo', 'oculos polarizado', 'óculos polarizado', 'oculos multifocal', 'óculos multifocal', 'lentes oftalmicas', 'lentes oftálmicas', 'lentes transitions', 'oticas e relojoarias', 'franquia de oticas', 'laboratorio otico', 'laboratório óptico', 'rede de oticas', 'rede de óticas', 'oculos de grife', 'óculos de grife'],
    'confecções': ['confeccao', 'confecção', 'confeccoes', 'confecções', 'fabrica de roupas', 'fábrica de roupas', 'vestuario', 'vestuário', 'industria de confeccao', 'indústria de confecção', 'malharia', 'malharias', 'fabrica de malhas', 'fábrica de malhas', 'fabrica de uniformes', 'fábrica de uniformes', 'confeccao de moda', 'facção de costura', 'faccao de costura', 'oficina de costura', 'atelie de costura', 'ateliê de costura', 'industria textil', 'indústria têxtil', 'confeccao de jeans', 'confeccao de plus size', 'confeccao infantil', 'confeccao feminina', 'confeccao masculina', 'confeccao moda praia', 'confeccao moda fitness', 'confeccao multimarcas', 'pronta entrega confeccao'],
    'lojas de tecidos': ['tecidos', 'armarinho', 'malhas'],
    'lojas de tecidos para decoração': ['tecidos para decoracao', 'tecidos decorativos'],
    'ateliês de costura': ['atelie de costura', 'costureira', 'modista'],
    'fábricas de uniformes': ['fabrica de uniformes', 'fábrica de uniformes', 'confeccao de uniformes', 'confecção de uniformes', 'uniformes', 'uniformes profissionais', 'uniformes industriais', 'uniformes corporativos', 'uniformes empresariais', 'uniformes sociais', 'uniformes escolares', 'uniformes hospitalares', 'uniformes esportivos', 'uniformes para empresas', 'fabricante de uniformes', 'industria de uniformes', 'indústria de uniformes', 'workwear', 'epi vestuario', 'roupa profissional', 'jaleco profissional', 'macacao industrial', 'macacão industrial', 'avental profissional', 'camisaria corporativa', 'camisetas personalizadas uniformes', 'uniformes em malha', 'confeccao para empresas'],
    'malharias': ['malharia', 'malhas', 'tricot'],
    'bordados': ['bordado', 'bordados', 'bordadeira'],

    // ===== CASA E DECORAÇÃO =====
    'móveis': ['moveis', 'moveis planejados', 'marcenaria', 'loja de moveis'],
    'lojas de cama, mesa e banho': [
      'cama mesa banho', 'cama mesa e banho', 'cama e mesa', 'mesa e banho', 'cama banho',
      'cama, mesa e banho', 'cama mesa, banho', 'banho cama mesa',
      'enxoval', 'enxovais', 'enxoval para noivas', 'enxoval de noiva', 'enxoval de bebe',
      'enxoval infantil', 'enxoval para casa', 'enxoval do lar', 'loja de enxovais',
      'toalhas', 'toalha', 'toalha de banho', 'toalhas de banho', 'toalhas de mesa',
      'toalha de mesa', 'toalha de rosto', 'toalhas de rosto',
      'lencois', 'lencol', 'lençol', 'lençóis',
      'jogo de cama', 'jogos de cama', 'jogo de toalha', 'jogos de toalha', 'jogo americano',
      'jogos americanos', 'jogo de banho', 'kit cama',
      'roupa de cama', 'roupas de cama', 'roupa de banho', 'roupa de mesa', 'roupas de mesa',
      'roupa para cama', 'roupas para cama mesa e banho',
      'colcha', 'colchas', 'cobre leito', 'cobre-leito',
      'edredom', 'edredons', 'edredon',
      'protetor de colchao', 'protetores de colchao', 'capa de colchao',
      'fronha', 'fronhas',
      'travesseiro', 'travesseiros',
      'almofada', 'almofadas', 'capa de almofada', 'capas de almofada',
      'cortina', 'cortinas', 'persiana', 'persianas',
      'tapete', 'tapetes', 'passadeira', 'passadeiras',
      'manta', 'mantas', 'cobertor', 'cobertores', 'mantas e cobertores',
      'colchao', 'colchoes', 'colchoes e enxovais',
      'artigos para o lar', 'artigos do lar', 'artigos para casa', 'artigos para o lar e decoracao',
      'casa e decoracao', 'casa decoracao', 'lar e decoracao', 'tudo para casa', 'tudo para o lar',
      'cama mesa banho e decoracao', 'roupas de cama mesa e banho',
      'loja de cama', 'loja de cama mesa e banho', 'comercio de enxovais',
      'cama mesa banho cortinas', 'enxoval e decoracao',
      'magazine', 'magazines', 'loja de departamento', 'lojas de departamento', 'loja de departamentos', 'utilidades para o lar',
      'fabrica de toalhas', 'fabrica de enxovais', 'fabrica de roupa de cama',
      'distribuidora de enxovais', 'atacado de enxovais', 'atacado de toalhas',
      'confeccao de enxovais', 'confeccao de toalhas', 'confeccao de roupa de cama',
      // Redes/marcas conhecidas do segmento
      'daju', 'mmartan', 'm martan', 'altenburg', 'buettner', 'teka', 'artex', 'karsten',
      'santista', 'lepper', 'camesa', 'camessa', 'casa moysés', 'casa moyses',
      'la casa', 'westwing', 'tok stok', 'tok&stok', 'etna', 'camicado',
    ],
    'lojas de utilidades domésticas': ['utilidades domesticas', 'utilidades domésticas', 'artigos para casa', 'utensilios domesticos', 'utensílios domésticos', 'loja de utilidades', 'casa e cozinha', 'cama mesa e banho', 'cama mesa banho', 'artigos para o lar', 'casa & decoração', 'casa e decoracao', 'organizadores domesticos', 'utensilios de cozinha', 'utensílios de cozinha', 'panelaria', 'panelas e utensilios', 'utilidades para o lar', 'enxoval', 'enxoval para casa', 'magazine de utilidades', 'rede de utilidades', 'mundo do lar', 'casa pratica', 'casa prática', 'utilidades em geral', 'lar e cozinha', 'casa fácil', 'casa facil', 'utilidades importadas'],
    'lojas de utilidades': ['utilidades', 'bazar', 'variedades', 'presentes', 'loja de utilidades', 'loja de variedades', 'loja de presentes', 'magazine de variedades', 'bazar e presentes', 'utilidades em geral', 'loja de R$ 1,99', 'loja de tudo por', 'loja de produtos importados', 'loja popular', 'loja de R$ 5', 'loja de R$ 10', 'casa do bazar', 'mundo das variedades', 'achadinhos', 'utilidades para o lar', 'organizadores e utilidades', 'lembrancinhas', 'artigos para festa', 'papelaria e variedades', 'mil utilidades', 'casa de presentes', 'utilidades baratas'],
    'lojas de decoração': ['decoracao', 'loja de decoracao', 'artigos decorativos'],
    'design de interiores': ['design de interiores', 'decoracao de interiores', 'interiores'],
    'lojas de tapeçaria, cortinas e persianas': ['tapecaria', 'cortinas', 'persianas', 'blackout'],
    'lojas de colchões': ['colchoes', 'colchao', 'cama e colchao'],
    'revendedores de colchões': ['revenda de colchoes', 'colchao', 'colchoes'],
    'colchoarias': ['colchoaria', 'colchoes', 'cama e colchao'],
    'distribuidores de colchões': ['distribuidora de colchoes', 'colchoes atacado'],
    'lojas de colchões terapêuticos': ['colchao terapeutico', 'colchao ortopedico', 'colchao magnetico'],
    'lojas de artigos para piscina': ['artigos para piscina', 'artigos para piscinas', 'piscina', 'piscinas', 'piscinaria', 'tratamento de agua', 'tratamento de piscina', 'produtos para piscina', 'produtos quimicos para piscina', 'aquecedor de piscina', 'capa de piscina', 'manutencao de piscinas', 'limpeza de piscinas', 'piscineiro', 'mundo da piscina', 'casa da piscina', 'cloro'],
    'lojas de eletrodomésticos': ['eletrodomesticos', 'eletro', 'magazine'],

    // ===== JARDINAGEM E FLORICULTURA =====
    'floriculturas': ['floricultura', 'floriculturas', 'flores', 'garden center', 'plantas', 'arranjos florais', 'flora', 'casa de flores', 'loja de flores', 'flores e plantas', 'plantas ornamentais', 'jardinagem', 'jardim e plantas', 'paisagismo', 'flores naturais', 'flores artificiais', 'buques de flores', 'buquês de flores', 'coroa de flores', 'coroas funebres', 'coroas fúnebres', 'arranjos para casamento', 'arranjos para festa', 'cesta de flores', 'cestas de flores', 'flores delivery', 'flores online', 'florista', 'arte floral', 'paisagismo e jardinagem', 'mundo das flores'],
    'garden center': ['garden center', 'jardinagem', 'plantas', 'floricultura'],
    'garden centers': ['garden center', 'jardinagem', 'plantas', 'floricultura'],
    'paisagismo e jardinagem': ['paisagismo', 'jardinagem', 'jardim'],
    'empresas de paisagismo e jardinagem': ['paisagismo', 'jardinagem', 'manutencao de jardim'],
    'viveiros de plantas': ['viveiro de plantas', 'mudas', 'viveiro'],

    // ===== CARNES E AÇOUGUES =====
    'açougues': ['acougue', 'casa de carnes', 'carnes e frios', 'boutique de carnes', 'frigorifico'],
    'açouguerias': ['acougue', 'acougueria', 'casa de carnes', 'frios e embutidos'],
    'casas de carnes': ['casa de carnes', 'acougue', 'boutique de carnes'],
    'açougues gourmet': ['acougue gourmet', 'boutique de carnes', 'carnes nobres', 'carnes premium'],
    'casas de frangos': ['casa de frangos', 'frango assado', 'grelhados'],
    'peixarias': ['peixaria', 'pescado', 'frutos do mar'],

    // ===== LATICÍNIOS E QUEIJOS =====
    'laticínios': ['laticinios', 'laticinio', 'leite', 'queijo'],
    'queijarias': ['queijaria', 'queijos', 'queijo artesanal'],
    'empórios de queijos': ['emporio de queijo', 'empório de queijo', 'emporio de queijos', 'empório de queijos', 'emporio', 'queijaria', 'queijarias', 'queijos artesanais', 'casa de queijos', 'queijo', 'laticinios', 'laticínios', 'laticinio', 'queijos', 'queijos finos', 'queijos especiais', 'queijos importados', 'queijos coloniais', 'queijo minas', 'queijo da serra', 'queijo canastra', 'casa do queijo', 'mundo do queijo', 'rota do queijo', 'frios e queijos', 'embutidos e queijos', 'tabua de frios', 'tábua de frios', 'queijos e vinhos', 'fromagerie', 'queijaria artesanal'],

    // ===== EMPÓRIOS E DELICATESSENS =====
    'delicatessens': ['delicatessen', 'deli', 'emporio', 'frios importados'],
    'empórios': ['emporio', 'emporio', 'delicatessen', 'mercearia gourmet'],
    'empórios gourmet': ['emporio gourmet', 'empório gourmet', 'mercearia gourmet', 'delicatessen', 'casa gourmet', 'emporio', 'empório'],
    'empórios naturais': ['emporio natural', 'empório natural', 'emporios naturais', 'empórios naturais', 'produtos naturais', 'organicos', 'orgânicos', 'loja de produtos naturais', 'casa de produtos naturais', 'casa naturalista', 'mundo natural', 'natural shop', 'emporio organico', 'empório orgânico', 'alimentos naturais', 'alimentos saudaveis', 'alimentos saudáveis', 'sem gluten', 'sem glúten', 'sem lactose', 'vegano', 'vegana', 'vegetariano', 'integral', 'integrais', 'graos e cereais', 'grãos e cereais', 'suplementos naturais', 'fitoterapicos', 'fitoterápicos', 'cha e ervas', 'chá e ervas', 'casa do natural'],

    // ===== BEBIDAS =====
    'lojas de bebidas': ['loja de bebidas', 'adega', 'distribuidora de bebidas', 'deposito de bebidas'],
    'lojas de vinhos': ['loja de vinhos', 'wine', 'adega', 'enoteca'],
    'cervejarias': ['cervejaria', 'cerveja artesanal', 'brewpub'],
    'vinícolas': ['vinicola', 'vinho', 'vitinica'],
    'destilarias': ['destilaria', 'cachaca', 'destilados'],
    'torrefadoras de café': ['torrefadora', 'cafe torrado', 'torrefacao'],

    // ===== PRODUTOS NATURAIS E SAUDÁVEIS =====
    'lojas de produtos naturais': ['produtos naturais', 'loja natural', 'naturais', 'organicos', 'orgânicos', 'loja de produtos naturais', 'casa de produtos naturais', 'mundo natural', 'casa natural', 'natural shop', 'emporio natural', 'empório natural', 'alimentos saudaveis', 'alimentos saudáveis', 'sem gluten', 'sem glúten', 'sem lactose', 'vegano', 'vegetariano', 'suplementos naturais', 'fitoterapicos', 'fitoterápicos', 'cha e ervas', 'chá e ervas', 'graos e cereais', 'grãos e cereais', 'integral', 'integrais', 'mel e derivados', 'casa de chas', 'casa de chás', 'casa do natural'],
    'lojas de suplementos': ['suplementos', 'whey', 'suplemento alimentar'],
    'lojas veganas': ['vegano', 'vegana', 'produtos veganos'],
    'hortifrútis': ['hortifruti', 'hortifrutigranjeiro', 'frutas', 'verduras', 'sacolao'],

    // ===== CESTAS BÁSICAS =====
    'cestas básicas': ['cestas basicas', 'cesta basica', 'cestas de alimentos', 'cesta de alimentos', 'distribuidora de cestas', 'distribuidora de alimentos', 'atacado de alimentos', 'kits de alimentos', 'cestas natalinas', 'cesta natalina', 'fornecedor de cestas', 'cestas corporativas', 'cesta corporativa', 'cestas de natal', 'cesta de natal'],

    // ===== EDUCAÇÃO =====
    'escolas': ['escola', 'colegio', 'ensino', 'centro educacional', 'instituto educacional'],
    'escolas e cursos': ['escola', 'curso', 'centro educacional', 'ensino'],
    'escolas de idiomas': ['escola de idiomas', 'curso de ingles', 'idiomas'],
    'escolas de música': ['escola de musica', 'aula de musica', 'conservatorio'],
    'autoescolas': ['autoescola', 'auto escola', 'centro de formacao de condutores'],

    // ===== ESPORTES =====
    'academias': ['academia', 'academias', 'academia de ginastica', 'academia de ginástica', 'academia de musculacao', 'academia de musculação', 'crossfit', 'box de crossfit', 'academia de crossfit', 'academia 24h', 'academia popular', 'academia premium', 'smart fit', 'bio ritmo', 'bodytech', 'rede de academias', 'franquia de academia', 'academia feminina', 'academia funcional', 'treinamento funcional', 'academia de pilates', 'estudio de pilates', 'estúdio de pilates', 'academia de yoga', 'estudio de yoga', 'academia de spinning', 'estudio de spinning', 'academia de boxe', 'academia de muay thai', 'academia de jiu jitsu', 'academia de mma', 'academia de luta', 'academia de artes marciais', 'academia esportiva', 'academia de natacao', 'academia de natação', 'centro de treinamento', 'studio de treinamento', 'academia high end', 'academia low cost', 'treinamento personalizado', 'personal trainer studio', 'academia para terceira idade', 'academia kids', 'academia 24 horas'],
    'escolinhas de futebol': ['escolinha de futebol', 'escola de futebol', 'futebol'],
    'escolinhas de basquete': ['escolinha de basquete', 'escola de basquete', 'basquete'],
    'escolinhas de natação': ['escolinha de natacao', 'escola de natacao', 'natacao', 'piscina'],
    'escolinhas de artes marciais': ['artes marciais', 'academia de luta', 'jiu jitsu', 'karate', 'judo'],
    'arenas de beach tennis': ['beach tennis', 'arena de beach', 'quadra de beach'],
    'quadras de tênis': ['quadra de tenis', 'tenis', 'clube de tenis'],
    'clubes esportivos': ['clube esportivo', 'clube recreativo', 'clube social', 'associacao esportiva'],
    'lojas de material esportivo': ['material esportivo', 'artigos esportivos', 'esportes'],

    // ===== HOSPEDAGEM =====
    'hotéis': ['hotel', 'pousada', 'hospedagem', 'resort', 'apart hotel', 'hostel'],
    'hotéis e pousadas': ['hotel', 'pousada', 'hospedagem'],

    // ===== GRÁFICA E COMUNICAÇÃO VISUAL =====
    'gráficas': ['grafica', 'comunicacao visual', 'impressao', 'offset', 'digital'],
    'comunicação visual': ['comunicacao visual', 'letreiro', 'placa', 'fachada'],
    'impressão digital': ['impressao digital', 'plotagem', 'banner'],
    'serigrafias': ['serigrafia', 'silk screen', 'estamparia'],
    'estamparias': ['estamparia', 'sublimacao', 'transfer'],
    'editoras': ['editora', 'editorial', 'publicacao'],
    'cartonagem': ['cartonagem', 'caixas de papelao', 'embalagens de papelao'],

    // ===== TÊXTIL E MALHARIAS =====
    'malharias': ['malharia', 'malha', 'malhacao', 'tricot', 'trico', 'confeccao de malha', 'malhas', 'tecido de malha', 'industria de malha'],
    'ateliês de costura': ['atelie de costura', 'atelie', 'costura', 'costureira', 'alfaiataria', 'alta costura'],
    'lojas de aviamentos': ['aviamentos', 'armarinho', 'aviamento', 'botoes', 'linhas', 'tecidos'],
    'fábricas de uniformes': ['fabrica de uniformes', 'fábrica de uniformes', 'uniformes', 'confeccao de uniformes', 'confecção de uniformes', 'uniformes profissionais', 'uniformes industriais', 'uniformes corporativos', 'uniformes empresariais', 'uniformes escolares', 'uniformes hospitalares', 'uniformes esportivos', 'fabricante de uniformes', 'industria de uniformes', 'indústria de uniformes', 'workwear', 'roupa profissional', 'jaleco profissional', 'macacao industrial', 'macacão industrial', 'avental profissional', 'camisaria corporativa', 'uniformes em malha', 'confeccao para empresas', 'fardamento', 'farda industrial', 'roupa de servico'],

    // ===== METALURGIA E SIDERURGIA =====
    'metalúrgicas': ['metalurgica', 'metalúrgica', 'metalurgicas', 'metalurgia', 'fundicao', 'fundição', 'usinagem', 'caldeiraria', 'serralheria', 'industria metalurgica', 'indústria metalúrgica', 'fabrica metalurgica', 'fábrica metalúrgica', 'metalmecanica', 'metalmecânica', 'industria metalmecanica', 'indústria metalmecânica', 'estamparia', 'estampagem', 'corte e dobra de metais', 'usinagem cnc', 'torno mecanico', 'torno mecânico', 'fresagem', 'solda industrial', 'solda mig mag', 'tratamento termico', 'tratamento térmico', 'galvanoplastia', 'pintura industrial metalurgica', 'inox industria', 'industria de aco', 'indústria de aço'],
    'serralherias': ['serralheria', 'serralherias', 'serralheiro', 'portoes', 'portões', 'grades', 'esquadrias metalicas', 'esquadrias metálicas', 'serralheria de aluminio', 'serralheria de alumínio', 'serralheria de ferro', 'serralheria artistica', 'serralheria artística', 'serralheria de inox', 'serralheria predial', 'serralheria industrial', 'portoes automaticos', 'portões automáticos', 'cercas metalicas', 'gradil', 'guarda corpo', 'guarda-corpo', 'corrimao metalico', 'corrimão metálico', 'estruturas metalicas serralheria', 'escadas metalicas', 'fabricacao de portoes', 'fabricação de portões', 'manutencao de portoes', 'manutenção de portões', 'serralheria sob medida'],
    'empresas de solda': ['solda', 'soldagem', 'caldeiraria', 'soldador'],
    'caldeirarias': ['caldeiraria', 'caldeireiro', 'vasos de pressao'],
    'usinagens': ['usinagem', 'usinagens', 'usinagem industrial', 'usinagem cnc', 'torno cnc', 'fresa cnc', 'centro de usinagem', 'usinagem de precisao', 'usinagem de precisão', 'torno mecanico', 'torno mecânico', 'fresadora industrial', 'usinagem de pecas', 'usinagem de peças', 'usinagem sob medida', 'usinagem em aco', 'usinagem em aço', 'usinagem em aluminio', 'usinagem em alumínio', 'usinagem em latao', 'usinagem em latão', 'retifica', 'retífica', 'retifica industrial', 'retífica industrial', 'retifica de motores', 'retífica de motores', 'caldeiraria e usinagem', 'metalurgica e usinagem', 'metalúrgica e usinagem', 'solda e usinagem', 'industria de usinagem', 'indústria de usinagem', 'servicos de usinagem', 'serviços de usinagem', 'usinagem pesada', 'usinagem de eixos', 'usinagem de engrenagens', 'torno automatico', 'torno automático', 'fabrica de pecas usinadas', 'tornearia mecanica', 'tornearia mecânica'],
    'estruturas metálicas': ['estruturas metalicas', 'estruturas metálicas', 'estrutura metalica', 'estrutura metálica', 'galpao metalico', 'galpão metálico', 'serralheria industrial', 'aço estrutural', 'aco estrutural', 'perfis metalicos', 'perfis metálicos', 'telhado metalico', 'telhado metálico', 'mezanino metalico', 'mezanino metálico', 'cobertura metalica', 'cobertura metálica', 'tesoura metalica', 'steel deck', 'caldeiraria', 'caldeireiro', 'fabricante de estruturas metalicas', 'montagem de estruturas', 'estruturas para galpoes', 'estruturas para galpões', 'estrutura para industria', 'estrutura para indústria', 'engenharia metalica', 'engenharia metálica', 'galpao em aco', 'galpão em aço', 'estrutura tubular', 'vigas metalicas', 'vigas metálicas', 'colunas metalicas', 'colunas metálicas', 'pergolado metalico', 'escada metalica', 'escada metálica', 'passarela metalica', 'passarela metálica', 'estrutura para cobertura'],

    // ===== ESQUADRIAS =====
    'fabricantes de esquadrias de alumínio': ['esquadrias de aluminio', 'esquadrias de alumínio', 'janelas de aluminio', 'janelas de alumínio', 'portas de aluminio', 'portas de alumínio', 'fabrica de esquadrias', 'fábrica de esquadrias', 'fachada de aluminio', 'fachada de alumínio', 'pele de vidro', 'vidracaria', 'vidraçaria', 'caixilho de aluminio', 'caixilho de alumínio', 'perfil de aluminio', 'perfil de alumínio', 'porta balcao', 'porta balcão', 'janela maxim ar', 'janela de correr', 'box de aluminio', 'box de alumínio', 'esquadrias sob medida', 'aluminio para construcao', 'alumínio para construção', 'sistemas de aluminio', 'sistemas de alumínio', 'vidros e esquadrias', 'serralheria de aluminio'],
    'fabricantes de esquadrias de madeira': ['esquadrias de madeira', 'janelas de madeira', 'portas de madeira', 'fabrica de esquadrias', 'fábrica de esquadrias', 'marcenaria', 'marcenaria industrial', 'portas internas', 'portas externas', 'janela de madeira macica', 'janela de madeira maciça', 'porta macica', 'porta maciça', 'venezianas de madeira', 'batentes de madeira', 'marcos de madeira', 'portas de correr', 'portas pivotantes', 'portas almofadadas', 'janelas guilhotina', 'esquadrias sob medida', 'madeireira esquadrias', 'industria de esquadrias', 'indústria de esquadrias', 'fabricante de portas', 'fabricante de janelas', 'aberturas de madeira', 'esquadrias artesanais', 'portas de eucalipto', 'portas de cedro'],

    // ===== INDÚSTRIAS =====
    'indústrias de alimentos': ['industria de alimentos', 'indústria de alimentos', 'fabrica de alimentos', 'fábrica de alimentos', 'alimenticia', 'alimentícia', 'alimentos industrializados', 'industria alimenticia', 'indústria alimentícia', 'fabricante de alimentos', 'agroindustria', 'agroindústria', 'processamento de alimentos', 'beneficiamento de alimentos', 'industria de food service', 'indústria de food service', 'alimentos prontos', 'alimentos congelados', 'alimentos desidratados', 'alimentos em po', 'alimentos em pó', 'industria de bebidas e alimentos', 'envase de alimentos', 'industria de paneficacao', 'industria de massas', 'industria de doces', 'industria de salgados', 'industria de conservas', 'food industry'],
    'indústrias de alimentos congelados': ['industria de congelados', 'indústria de congelados', 'fabrica de congelados', 'fábrica de congelados', 'alimentos congelados', 'congelados', 'congelados industriais', 'salgados congelados', 'pratos congelados', 'vegetais congelados', 'massas congeladas', 'carnes congeladas', 'frutos do mar congelados', 'sorvetes industriais', 'industria de salgados congelados', 'fabricante de congelados', 'industria frigorificada', 'frigorifico industrial', 'iqf', 'individual quick freezing', 'tunel de congelamento', 'túnel de congelamento', 'camara fria', 'câmara fria', 'linha de congelamento', 'envase de congelados', 'industria de pratos prontos', 'fabrica de pratos prontos', 'frozen food', 'industria food service congelados', 'lasanhas congeladas', 'pizzas congeladas'],
    'indústrias de laticínios': ['industria de laticinios', 'indústria de laticínios', 'fabrica de laticinios', 'fábrica de laticínios', 'laticinio', 'laticínio', 'industria de leite', 'indústria de leite', 'fabrica de queijo', 'fábrica de queijo', 'queijaria industrial', 'industria de iogurte', 'indústria de iogurte', 'fabrica de iogurte', 'industria de manteiga', 'indústria de manteiga', 'fabrica de manteiga', 'industria de requeijao', 'indústria de requeijão', 'fabrica de leite', 'fábrica de leite', 'industria de creme de leite', 'industria de leite condensado', 'industria de leite em po', 'indústria de leite em pó', 'industria de bebida lactea', 'indústria de bebida láctea', 'usina de beneficiamento de leite', 'laticinio cooperativa', 'industria de doce de leite', 'industria de queijos finos', 'indústria de queijos finos', 'industria de soro de leite', 'indústria de soro de leite', 'industria de mussarela', 'industria de coalhada', 'agroindustria de leite'],
    'indústrias de ração animal': ['industria de racao', 'fabrica de racao', 'nutricao animal'],
    'indústrias de biscoitos': ['industria de biscoitos', 'indústria de biscoitos', 'fabrica de biscoitos', 'fábrica de biscoitos', 'biscoitos', 'biscoito', 'bolacha', 'bolachas', 'fabricante de biscoitos', 'industria de bolachas', 'indústria de bolachas', 'biscoito recheado', 'biscoito laminado', 'biscoito waffer', 'biscoito wafer', 'biscoito amanteigado', 'biscoito doce', 'biscoito salgado', 'industria de cookies', 'indústria de cookies', 'fabrica de cookies', 'industria de snacks', 'indústria de snacks', 'industria de panificacao seca', 'biscoito artesanal industria', 'biscoito industrializado', 'industria de biscoitos finos', 'fabrica de bolachas recheadas', 'industria de cracker', 'linha de biscoitos', 'linha de bolachas', 'industria de biscoito caseiro', 'fabricante de biscoitos finos'],
    'indústrias de pão de queijo': ['pao de queijo', 'fabrica de pao de queijo'],
    'indústrias de cosméticos': ['industria de cosmeticos', 'indústria de cosméticos', 'fabrica de cosmeticos', 'fábrica de cosméticos', 'cosmeticos', 'cosméticos', 'fabricante de cosmeticos', 'industria de perfumes', 'indústria de perfumes', 'fabrica de perfumes', 'industria de maquiagem', 'indústria de maquiagem', 'industria de shampoo', 'industria de cremes', 'indústria de cremes', 'industria de hidratantes', 'indústria de hidratantes', 'industria de produtos de beleza', 'industria de protetor solar', 'industria de batom', 'indústria de batom', 'industria de esmaltes', 'indústria de esmaltes', 'industria de coloracao capilar', 'indústria de coloração capilar', 'industria de tintura', 'indústria de tintura', 'industria de cosmeticos naturais', 'industria de cosmeticos veganos', 'industria de cosmeticos profissionais', 'industria farmacosmetica', 'indústria farmacosmética', 'industria de saboes liquidos', 'industria de sabonetes', 'industria de desodorantes', 'industria de cremes faciais', 'industria de cosmeticos infantis', 'industria de cosmeticos masculinos', 'envasadora de cosmeticos', 'envase de cosmeticos'],
    'indústrias farmacêuticas': ['industria farmaceutica', 'indústria farmacêutica', 'laboratorio farmaceutico', 'laboratório farmacêutico', 'fabrica de medicamentos', 'fábrica de medicamentos', 'industria de medicamentos', 'indústria de medicamentos', 'fabricante de medicamentos', 'industria de remedios', 'indústria de remédios', 'laboratorio de remedios', 'industria farmoquimica', 'indústria farmoquímica', 'industria de genericos', 'indústria de genéricos', 'industria de similares', 'indústria de similares', 'industria de fitoterapicos', 'indústria de fitoterápicos', 'industria de manipulados', 'indústria de manipulados', 'industria veterinaria farmaceutica', 'industria de vacinas', 'industria de soros', 'industria de antibioticos', 'indústria de antibióticos', 'industria de injetaveis', 'industria de comprimidos', 'industria de capsulas', 'indústria de cápsulas', 'industria de xaropes', 'industria de pomadas', 'industria de cremes farmaceuticos', 'industria farma', 'farmaceutica industrial', 'farmacêutica industrial', 'industria de principios ativos', 'indústria de princípios ativos', 'industria de cosmeticos farmaceuticos'],
    'indústrias de bebidas': ['industria de bebidas', 'indústria de bebidas', 'fabrica de bebidas', 'fábrica de bebidas', 'engarrafadora', 'envasadora', 'envase de bebidas', 'industria de refrigerantes', 'fabrica de refrigerantes', 'industria de sucos', 'fabrica de sucos', 'industria de cervejas', 'fabrica de cervejas', 'cervejaria industrial', 'industria de aguas', 'indústria de águas', 'fabrica de agua mineral', 'industria de bebidas alcoolicas', 'indústria de bebidas alcoólicas', 'destilaria', 'licoreira', 'licoreria', 'fabricante de bebidas', 'industria vinicola', 'indústria vinícola', 'vinicola industrial', 'vinícola industrial', 'industria de bebidas energeticas', 'fabrica de energetico', 'industria de bebidas isotonicas', 'industria de cha gelado', 'industria de chá gelado', 'industria de bebidas lacteas', 'indústria de bebidas lácteas'],
    'indústrias de embalagens': ['industria de embalagens', 'indústria de embalagens', 'fabrica de embalagens', 'fábrica de embalagens', 'embalagens', 'fabricante de embalagens', 'industria de embalagens plasticas', 'indústria de embalagens plásticas', 'industria de embalagens de papel', 'industria de embalagens de papelao', 'indústria de embalagens de papelão', 'industria de embalagens de vidro', 'industria de embalagens metalicas', 'indústria de embalagens metálicas', 'industria de embalagens flexiveis', 'indústria de embalagens flexíveis', 'industria de embalagens rigidas', 'indústria de embalagens rígidas', 'industria de embalagens descartaveis', 'industria de embalagens para alimentos', 'industria de embalagens cosmeticas', 'industria de embalagens farmaceuticas', 'industria de embalagens industriais', 'industria de embalagens corporativas', 'industria de embalagens personalizadas', 'industria de embalagens promocionais', 'industria de embalagens biodegradaveis', 'industria de embalagens recicladas', 'industria de embalagens a vacuo', 'indústria de embalagens a vácuo', 'industria de pet embalagem', 'industria de saches', 'indústria de sachês', 'industria de potes plasticos', 'industria de garrafas plasticas', 'industria de bisnagas', 'industria de tubos para embalagem', 'industria de tampas plasticas', 'industria de rotulos', 'indústria de rótulos'],
    'indústrias de móveis': ['industria de moveis', 'indústria de móveis', 'fabrica de moveis', 'fábrica de móveis', 'moveis', 'móveis', 'marcenaria industrial', 'fabricante de moveis', 'fabricante de móveis', 'industria de moveis planejados', 'fabrica de moveis planejados', 'fábrica de móveis planejados', 'industria de moveis sob medida', 'industria de moveis residenciais', 'industria de moveis corporativos', 'indústria de móveis corporativos', 'industria de moveis para escritorio', 'industria de móveis para escritório', 'industria de moveis hospitalares', 'industria de moveis escolares', 'industria de cadeiras', 'indústria de cadeiras', 'industria de mesas', 'industria de armarios', 'indústria de armários', 'industria de guarda-roupas', 'indústria de guarda-roupas', 'industria de cozinhas planejadas', 'industria de moveis em mdf', 'industria de móveis em mdf', 'industria de moveis em madeira macica', 'industria de moveis em mdp', 'industria de moveis tubulares', 'industria de estantes', 'industria de moveis para hotel', 'industria de moveis institucionais', 'industria de moveis modulados', 'industria de moveis para banheiro', 'industria de moveis para sala'],
    'indústrias de tintas': ['industria de tintas', 'indústria de tintas', 'fabrica de tintas', 'fábrica de tintas', 'tintas industriais', 'fabricante de tintas', 'industria de vernizes', 'indústria de vernizes', 'fabrica de vernizes', 'industria de solventes', 'indústria de solventes', 'tinta imobiliaria', 'tinta imobiliária', 'tinta automotiva', 'tinta industrial', 'tinta epoxi', 'tinta epóxi', 'tinta acrilica', 'tinta acrílica', 'tinta latex', 'tinta látex', 'tinta a oleo', 'tinta a óleo', 'tinta poliuretanica', 'tinta poliuretânica', 'fabricante de pigmentos', 'industria de pigmentos', 'indústria de pigmentos', 'fabrica de resinas', 'industria de resinas', 'indústria de resinas', 'massa corrida fabrica', 'industria de selador', 'tinta para piso industrial', 'tinta anti-corrosiva', 'tinta hidrorrepelente', 'industria quimica de tintas'],
    'indústrias de produtos de limpeza': ['industria de limpeza', 'indústria de limpeza', 'fabrica de limpeza', 'fábrica de limpeza', 'fabrica de detergente', 'industria de produtos de limpeza', 'indústria de produtos de limpeza', 'fabricante de produtos de limpeza', 'industria de saneantes', 'indústria de saneantes', 'industria de desinfetantes', 'indústria de desinfetantes', 'fabrica de desinfetante', 'industria de agua sanitaria', 'indústria de água sanitária', 'fabrica de agua sanitaria', 'industria de sabao em po', 'indústria de sabão em pó', 'fabrica de sabao em po', 'industria de sabao liquido', 'fabrica de sabao liquido', 'industria de amaciante', 'indústria de amaciante', 'fabrica de amaciante', 'industria de limpa vidros', 'industria de multiuso', 'indústria de multiuso', 'industria de produtos de higiene', 'industria de alcool', 'indústria de álcool', 'fabrica de alcool em gel', 'industria de removedor', 'indústria de removedor', 'industria de cera para piso', 'industria de produtos institucionais de limpeza', 'industria de cloro', 'fabricante de detergente industrial', 'industria de produtos de limpeza profissional'],
    'indústrias gráficas': ['industria grafica', 'grafica industrial', 'impressao offset'],
    'indústrias de calçados': ['industria de calcados', 'indústria de calçados', 'fabrica de calcados', 'fábrica de calçados', 'fabrica de sapatos', 'fábrica de sapatos', 'calçados', 'industria de sapatos', 'indústria de sapatos', 'fabricante de calcados', 'fabricante de calçados', 'industria de tenis', 'indústria de tênis', 'fabrica de tenis', 'industria de sandalias', 'indústria de sandálias', 'fabrica de sandalias', 'industria de chinelos', 'fabrica de chinelos', 'industria de botas', 'indústria de botas', 'industria de calcados femininos', 'industria de calcados masculinos', 'industria de calcados infantis', 'industria de calcados de seguranca', 'indústria de calçados de segurança', 'industria de epi calcados', 'industria de solas', 'indústria de solas', 'fabrica de solados', 'industria de palmilhas', 'indústria de palmilhas', 'industria de couro para calcados', 'fabricante de tenis esportivos', 'industria de calcados esportivos', 'industria de calcados sociais', 'industria de saltos', 'industria de calcados ortopedicos', 'indústria de calçados ortopédicos', 'industria de calcados profissionais', 'industria de calcados em couro', 'calçadista', 'calcadista', 'industria coureiro-calcadista'],
    'indústrias de componentes eletrônicos': ['componentes eletronicos', 'montagem de placas', 'circuito impresso'],
    'indústrias de fios e cabos': ['industria de fios e cabos', 'indústria de fios e cabos', 'fabrica de fios', 'fábrica de fios', 'fabrica de cabos', 'fábrica de cabos', 'industria de fios eletricos', 'indústria de fios elétricos', 'industria de cabos eletricos', 'indústria de cabos elétricos', 'fabricante de fios', 'fabricante de cabos', 'industria de cabos de energia', 'industria de cabos de cobre', 'industria de cabos de aluminio', 'indústria de cabos de alumínio', 'industria de fios de cobre', 'industria de cabos coaxiais', 'industria de cabos opticos', 'indústria de cabos ópticos', 'industria de cabos blindados', 'industria de cabos automotivos', 'industria de cabos solares', 'fabrica de extensoes', 'fabrica de cordoes eletricos', 'industria de fios esmaltados', 'industria de cabos de telecomunicacao', 'indústria de cabos de telecomunicação', 'industria de cabos de fibra optica', 'industria de cabos de baixa tensao', 'indústria de cabos de baixa tensão', 'industria de cabos de alta tensao', 'industria de cabeamento estruturado'],
    'indústrias de plásticos': ['industria de plasticos', 'indústria de plásticos', 'plasticos', 'plásticos', 'injecao plastica', 'injeção plástica', 'sopro plastico', 'sopro plástico', 'extrusao plastica', 'extrusão plástica', 'fabrica de plasticos', 'fábrica de plásticos', 'fabricante de plasticos', 'industria de polimeros', 'indústria de polímeros', 'industria de pet', 'indústria de pet', 'fabrica de embalagens plasticas', 'fábrica de embalagens plásticas', 'industria de polietileno', 'industria de polipropileno', 'industria de pvc', 'indústria de pvc', 'industria de polimeros plasticos', 'rotomoldagem', 'termoformagem', 'industria de plasticos tecnicos', 'industria de pecas plasticas', 'industria de peças plásticas', 'industria de plastico industrial', 'recicladora de plastico', 'industria de filme plastico', 'industria de chapas plasticas', 'industria de tubos plasticos', 'industria de utilidades plasticas', 'fabrica de baldes', 'fabrica de garrafas pet'],
    'indústrias químicas': ['industria quimica', 'indústria química', 'quimica', 'química', 'produtos quimicos', 'produtos químicos', 'fabrica de produtos quimicos', 'fábrica de produtos químicos', 'industria petroquimica', 'indústria petroquímica', 'fabricante de quimicos', 'fabricante de químicos', 'industria de solventes', 'indústria de solventes', 'industria de resinas', 'indústria de resinas', 'industria de polimeros', 'indústria de polímeros', 'industria de aditivos', 'indústria de aditivos', 'industria de fertilizantes', 'industria de defensivos', 'industria de tintas e quimicos', 'industria de saneantes', 'indústria de saneantes', 'industria de cosmeticos quimicos', 'industria de detergentes', 'industria de produtos para limpeza', 'industria de catalisadores', 'industria de pigmentos', 'industria de oleos quimicos', 'indústria de óleos químicos', 'industria de gases', 'indústria de gases', 'industria de plasticos quimicos', 'industria de adesivos', 'industria de selantes', 'industria farmoquimica', 'indústria farmoquímica'],
    'indústrias de papel e celulose': ['industria de papel', 'celulose', 'papel'],
    'indústrias de borracha': ['industria de borracha', 'indústria de borracha', 'fabrica de borracha', 'fábrica de borracha', 'borracha', 'vulcanizacao', 'vulcanização', 'industria de artefatos de borracha', 'indústria de artefatos de borracha', 'fabricante de borracha', 'industria de pneus', 'indústria de pneus', 'recauchutagem industrial', 'industria de mangueiras', 'industria de mangueiras de borracha', 'industria de vedacao', 'indústria de vedação', 'industria de juntas de borracha', 'industria de pecas de borracha', 'indústria de peças de borracha', 'industria de borracha automotiva', 'industria de borracha industrial', 'industria de tapetes de borracha', 'industria de pisos de borracha', 'industria de borracha sintetica', 'indústria de borracha sintética', 'industria de borracha natural', 'industria de elastomeros', 'indústria de elastômeros', 'industria de retentores', 'indústria de retentores', 'industria de baixo tubular', 'industria de borracha tecnica', 'indústria de borracha técnica', 'fabrica de borrachas para industria', 'industria de coxins', 'industria de buchas de borracha', 'industria de oring'],
    'indústrias de vidro': ['industria de vidro', 'vidro', 'cristal'],
    'indústrias de cerâmica': ['industria de ceramica', 'indústria de cerâmica', 'fabrica de ceramica', 'fábrica de cerâmica', 'ceramica', 'cerâmica', 'porcelana', 'industria de porcelana', 'indústria de porcelana', 'fabricante de ceramica', 'industria de revestimentos ceramicos', 'indústria de revestimentos cerâmicos', 'industria de pisos ceramicos', 'industria de azulejos', 'indústria de azulejos', 'fabrica de telhas ceramicas', 'fábrica de telhas cerâmicas', 'industria de tijolos ceramicos', 'industria de blocos ceramicos', 'indústria de blocos cerâmicos', 'olaria', 'olaria industrial', 'industria de louca sanitaria', 'indústria de louça sanitária', 'fabrica de louca', 'industria de louca de mesa', 'industria de utensilios ceramicos', 'industria de ceramica artistica', 'industria de porcelanato', 'indústria de porcelanato', 'fabrica de pisos', 'industria de telhas', 'industria de manilhas', 'industria de ceramica vermelha', 'indústria de cerâmica vermelha', 'industria de ceramica branca', 'industria de ceramica industrial', 'industria de ceramica tecnica', 'industria de refratarios', 'indústria de refratários'],
    'indústrias de fertilizantes': ['industria de fertilizantes', 'fertilizante', 'adubo'],
    'indústrias de papel higiênico e descartáveis': ['industria de papel higienico', 'indústria de papel higiênico', 'fabrica de papel higienico', 'fábrica de papel higiênico', 'papel higienico', 'papel higiênico', 'industria de descartaveis', 'indústria de descartáveis', 'fabrica de descartaveis', 'fábrica de descartáveis', 'fabricante de papel higienico', 'fabricante de descartaveis', 'industria de guardanapos', 'fabrica de guardanapos', 'industria de papel toalha', 'indústria de papel toalha', 'fabrica de papel toalha', 'industria de lencos de papel', 'indústria de lenços de papel', 'industria de fraldas', 'indústria de fraldas', 'fabrica de fraldas', 'industria de absorventes', 'fabrica de absorventes', 'industria de copos descartaveis', 'indústria de copos descartáveis', 'industria de pratos descartaveis', 'industria de talheres descartaveis', 'industria de canudos descartaveis', 'industria de copos plasticos descartaveis', 'industria de embalagens descartaveis food service', 'industria de papel interfolha', 'industria de bobinas de papel toalha', 'industria de papel toalha institucional', 'industria de papel higienico institucional', 'industria tissue', 'indústria tissue', 'industria de papel sulfite', 'industria de papel kraft', 'fabrica de toucas descartaveis', 'fabrica de luvas descartaveis', 'industria de protetores descartaveis', 'industria de mascaras descartaveis', 'indústria de máscaras descartáveis'],
    'indústrias de mineração': ['mineracao', 'mineradora', 'extracao mineral', 'pedreira', 'britagem'],
    'indústrias sucroalcooleiras': ['usina de acucar', 'usina de etanol', 'sucroalcooleira', 'destilaria'],
    'indústrias têxteis': ['industria textil', 'indústria têxtil', 'textil', 'têxtil', 'tecelagem', 'fiacao', 'fiação', 'industria de tecidos', 'indústria de tecidos', 'fabrica de tecidos', 'fábrica de tecidos', 'fabricante de tecidos', 'industria de malhas', 'indústria de malhas', 'malharia industrial', 'industria de fios texteis', 'indústria de fios têxteis', 'fiacao textil', 'industria de algodao', 'indústria de algodão', 'beneficiamento de algodao', 'industria de poliester', 'indústria de poliéster', 'industria de viscose', 'industria de la', 'indústria de lã', 'industria de seda', 'indústria de seda', 'industria de jeans', 'fabrica de jeans', 'industria de denim', 'industria de tecido plano', 'industria de tecido tubular', 'industria de aviamentos', 'industria de linhas', 'industria de tecidos tecnicos', 'indústria de tecidos técnicos', 'industria de feltro', 'industria de tecidos nao tecidos', 'industria de tnt', 'industria de tecidos para confeccao', 'indústria de tecidos para confecção', 'industria de tecelagem plana', 'industria de tecelagem circular', 'industria de estamparia textil', 'industria de tinturaria', 'beneficiamento textil', 'beneficiamento têxtil'],
    'indústrias de eletrônica': ['industria de eletronica', 'indústria de eletrônica', 'eletronicos', 'eletrônicos', 'componentes eletronicos', 'componentes eletrônicos', 'fabrica de eletronicos', 'fábrica de eletrônicos', 'industria de eletronicos', 'fabricante de eletronicos', 'fabricante de eletrônicos', 'industria de placas de circuito', 'indústria de placas de circuito', 'pcb', 'pcba', 'industria de smartphones', 'indústria de smartphones', 'industria de tv', 'indústria de tv', 'industria de aparelhos eletronicos', 'industria de eletronica de consumo', 'indústria de eletrônica de consumo', 'industria de eletronica industrial', 'industria de microeletronica', 'indústria de microeletrônica', 'industria de semicondutores', 'indústria de semicondutores', 'industria de iluminacao led', 'indústria de iluminação led', 'industria de placas eletronicas', 'fabrica de placas', 'industria de produtos de informatica', 'indústria de produtos de informática', 'industria de telecom', 'industria de equipamentos eletronicos', 'industria de eletronica embarcada', 'industria de eletronica automotiva', 'industria de eletronica medica', 'industria de eletronica industrial pesada', 'industria de gadgets', 'indústria de gadgets'],
    'indústrias automotivas': ['industria automotiva', 'indústria automotiva', 'autopecas', 'autopeças', 'automoveis', 'automóveis', 'fabrica de autopecas', 'fábrica de autopeças', 'montadora', 'montadoras', 'industria de veiculos', 'indústria de veículos', 'fabricante de carros', 'industria de pecas automotivas', 'indústria de peças automotivas', 'industria de motos', 'indústria de motos', 'industria de caminhoes', 'indústria de caminhões', 'industria de onibus', 'indústria de ônibus', 'autopeca industrial', 'industria de retrovisores', 'industria de bancos automotivos', 'industria de pneus', 'indústria de pneus', 'industria de baterias automotivas', 'industria de freios', 'indústria de freios', 'industria de suspensao', 'indústria de suspensão', 'industria de motores', 'indústria de motores', 'industria de transmissao', 'indústria de transmissão', 'industria de chassis', 'industria de tapetes automotivos', 'industria de plasticos automotivos', 'industria de vidros automotivos', 'indústria de vidros automotivos', 'autoindustria', 'autoindústria', 'industria de implementos rodoviarios'],
    'indústrias de automação': ['industria de automacao', 'indústria de automação', 'automacao industrial', 'automação industrial', 'automacao', 'automação', 'fabricante de automacao', 'fabricante de automação', 'sistemas de automacao', 'sistemas de automação', 'automacao de processos', 'automação de processos', 'automacao predial', 'automação predial', 'integrador de automacao', 'integrador de automação', 'clp programacao', 'clp programação', 'paineis de automacao', 'painéis de automação', 'plc industrial', 'scada', 'iiot', 'industria 4.0', 'indústria 4.0', 'robotica industrial', 'robótica industrial', 'sensores industriais', 'inversores de frequencia', 'inversores de frequência', 'controladores logicos', 'soft starter', 'instrumentacao industrial', 'instrumentação industrial'],
    'indústrias de iluminação e led': ['industria de iluminacao', 'indústria de iluminação', 'led', 'luminarias', 'luminárias', 'iluminacao', 'iluminação', 'fabrica de luminarias', 'fábrica de luminárias', 'industria de led', 'indústria de led', 'fabricante de led', 'iluminacao led', 'iluminação led', 'lampadas led', 'lâmpadas led', 'luminarias led', 'luminárias led', 'iluminacao industrial', 'iluminação industrial', 'iluminacao publica', 'iluminação pública', 'iluminacao decorativa', 'iluminação decorativa', 'iluminacao comercial', 'iluminação comercial', 'spots led', 'paineis led', 'painéis led', 'fitas led', 'refletores led', 'postes de iluminacao', 'postes de iluminação', 'iluminacao automotiva led', 'plafons led', 'arandelas led'],
    'indústrias mecânicas': ['industria mecanica', 'indústria mecânica', 'mecanica industrial', 'mecânica industrial', 'usinagem', 'fabrica mecanica', 'fábrica mecânica', 'metalmecanica', 'metalmecânica', 'industria metalmecanica', 'indústria metalmecânica', 'usinagem de precisao', 'usinagem de precisão', 'fabricacao mecanica', 'fabricação mecânica', 'pecas mecanicas', 'peças mecânicas', 'componentes mecanicos', 'componentes mecânicos', 'caldeiraria mecanica', 'usinagem cnc', 'torno mecanico industrial', 'torno mecânico industrial', 'fresagem industrial', 'solda industrial', 'manutencao mecanica industrial', 'manutenção mecânica industrial', 'projetos mecanicos', 'projetos mecânicos', 'engenharia mecanica industrial', 'mecanica de precisao', 'mecânica de precisão'],
    'indústrias que montam ou reformam painéis': ['painel eletrico', 'montagem de paineis', 'quadro eletrico'],
    'fabricantes de máquinas e equipamentos': ['fabrica de maquinas', 'fábrica de máquinas', 'equipamentos industriais', 'maquinas industriais', 'máquinas industriais', 'fabricante de equipamentos', 'industria de maquinas', 'indústria de máquinas', 'maquinario industrial', 'maquinário industrial', 'equipamentos pesados', 'linha de producao', 'linha de produção', 'automacao de maquinas', 'equipamentos de processo', 'maquinas especiais', 'máquinas especiais', 'metalmecanica', 'metalmecânica', 'projetos de maquinas', 'equipamentos sob medida', 'maquinas para industria', 'máquinas para indústria', 'equipamentos agroindustriais', 'equipamentos de envase', 'transportadores industriais', 'esteiras industriais', 'caldeiras', 'maquinas e implementos'],
    'fábricas de embalagens': ['fabrica de embalagens', 'embalagens', 'industria de embalagens'],
    'abatedouros e frigoríficos': ['abatedouro', 'frigorifico', 'frigorífico', 'matadouro', 'abate', 'abate de animais', 'frigorifico industrial', 'frigorífico industrial', 'abatedouro de bovinos', 'abatedouro de suinos', 'abatedouro de aves', 'frigorifico de aves', 'frigorifico de bovinos', 'abatedouro de frango', 'avicola', 'avícola', 'matadouro frigorifico', 'sif', 'inspecao federal', 'inspeção federal', 'industria frigorifica', 'indústria frigorífica', 'carnes e derivados', 'processamento de carnes', 'desossa', 'sala de cortes', 'graxaria', 'agroindustria de carnes', 'agroindústria de carnes', 'frigorifico atacadista'],
    'abatedouros de aves': ['abatedouro de aves', 'frigorifico de aves', 'frigorífico de aves', 'abatedouro de frango', 'abatedouro de frangos', 'frigorifico de frangos', 'frigorífico de frangos', 'avicola', 'avícola', 'industria avicola', 'indústria avícola', 'abate de aves', 'abate de frangos', 'matadouro de aves', 'matadouro de frangos', 'frigorifico avicola', 'frigorífico avícola', 'agroindustria avicola', 'agroindústria avícola', 'sif aves', 'industria de carne de frango', 'indústria de carne de frango', 'frigorifico de peru', 'frigorífico de peru', 'abatedouro de peru', 'frigorifico de patos', 'abatedouro de patos', 'industria de aves', 'industria de frango congelado', 'industria de frango resfriado', 'industria de cortes de frango', 'industria de hamburguer de frango', 'indústria de hambúrguer de frango', 'industria de salsicha de frango', 'industria de embutidos de frango', 'industria de file de frango', 'industria de coxinha da asa', 'industria de sobrecoxa', 'industria de peito de frango', 'industria de coxa e sobrecoxa', 'industria de empanados de frango', 'industria de nuggets', 'industria de aves caipiras', 'industria de aves organicas', 'indústria de aves orgânicas', 'frigorifico exportador de aves', 'frigorifico de aves com sif'],
    'abatedouros de bovinos': ['abatedouro de bovinos', 'frigorifico de bovinos', 'frigorífico de bovinos', 'abatedouro de gado', 'frigorifico de gado', 'frigorífico de gado', 'abate de bovinos', 'abate de gado', 'matadouro de bovinos', 'matadouro de gado', 'industria de carne bovina', 'indústria de carne bovina', 'frigorifico bovino', 'frigorífico bovino', 'agroindustria bovina', 'agroindústria bovina', 'sif bovinos', 'sif bovinos com inspecao', 'frigorifico com sif', 'industria de boi', 'indústria de boi', 'industria frigorifica de bovinos', 'desossa de bovinos', 'sala de cortes bovinos', 'industria de couro bovino', 'graxaria bovina', 'industria de carnes nobres', 'industria de hamburguer bovino', 'indústria de hambúrguer bovino', 'industria de carne em po', 'indústria de carne em pó', 'industria de carne maturada', 'industria de carne resfriada', 'industria de carne congelada', 'frigorifico de carne resfriada', 'industria de boi confinado', 'industria de novilho', 'industria de vitelo', 'industria de carne premium', 'industria de cortes especiais bovino', 'frigorifico exportador'],
    'abatedouros de suínos': ['abatedouro de suinos', 'abatedouro de suínos', 'frigorifico de suinos', 'frigorífico de suínos', 'abatedouro de porco', 'abatedouro de porcos', 'frigorifico de porcos', 'frigorífico de porcos', 'industria suinocultora', 'indústria suinocultora', 'frigorifico suino', 'frigorífico suíno', 'abatedouro suino', 'abatedouro suíno', 'agroindustria suinocultora', 'agroindústria suinocultura', 'frigorifico de carne suina', 'frigorífico de carne suína', 'abate de suinos', 'abate de suínos', 'industria de carne suina', 'indústria de carne suína', 'sif suinos', 'sif suínos', 'frigorifico com sif', 'matadouro de suinos', 'matadouro de suínos', 'industria de embutidos suinos', 'industria de presunto', 'industria de bacon', 'industria de linguica', 'indústria de linguiça', 'industria de salsicha', 'industria de toucinho', 'industria de costela suina', 'industria de pernil', 'industria de paleta suina', 'frigorifico de carne de porco', 'industria de defumados suinos', 'industria de salame', 'agroindustria suinos'],
    'frigoríficos': ['frigorifico', 'abatedouro', 'carnes'],

    // ===== DISTRIBUIDORAS =====
    'distribuidoras de embalagens': ['distribuidora de embalagens', 'distribuidor de embalagens', 'embalagens', 'descartaveis', 'descartáveis', 'atacado de embalagens', 'fornecedor de embalagens', 'embalagens plasticas', 'embalagens plásticas', 'embalagens de papel', 'embalagens de papelao', 'embalagens de papelão', 'embalagens para alimentos', 'embalagens flexiveis', 'embalagens flexíveis', 'embalagens industriais', 'embalagens personalizadas', 'embalagens delivery', 'embalagens take away', 'embalagens biodegradaveis', 'embalagens biodegradáveis', 'embalagens ecologicas', 'embalagens ecológicas', 'sacolas plasticas', 'sacolas plásticas', 'sacos plasticos', 'caixas de papelao', 'caixas de papelão', 'fitas adesivas', 'plastico bolha', 'plástico bolha', 'embalagens hospitalares'],
    'distribuidores de aço e ferro': ['distribuidora de aco', 'ferro e aco', 'deposito de ferro', 'metalon', 'vergalhao'],
    'distribuidores de food service': ['distribuidor de food service', 'distribuidora de food service', 'distribuidores de food service', 'food service distribuidor', 'distribuidor para restaurantes', 'distribuidor para padarias', 'distribuidor para bares', 'distribuidor para hoteis', 'distribuidor para hotéis', 'distribuidor para lanchonetes', 'atacado food service', 'atacadista de food service', 'distribuidor de alimentos para restaurantes', 'distribuidor de alimentos profissionais', 'distribuidor horeca', 'horeca', 'distribuidor de bebidas food service', 'distribuidor de descartaveis food service', 'distribuidor de descartáveis food service', 'distribuidor de produtos institucionais', 'distribuidor de embalagens food service', 'distribuidor de molhos food service', 'distribuidor de carnes food service', 'distribuidor de queijos food service', 'distribuidor de hortifruti food service', 'distribuidor de óleos food service', 'distribuidor de oleos food service', 'distribuidor de produtos congelados food service', 'distribuidor de pre-preparados', 'distribuidor de pré-preparados', 'distribuidor de paneficacao food service', 'distribuidor de salgados', 'distribuidor de produtos de cozinha', 'distribuidor de utensilios food service', 'centro de distribuicao food service', 'centro de distribuição food service', 'distribuidor multiproduto food service', 'distribuidor para coffee shop', 'distribuidor para fast food', 'atacarejo food service'],
    'distribuidores de alimentos': ['distribuidora de alimentos', 'distribuidor de alimentos', 'distribuidoras de alimentos', 'atacado de alimentos', 'atacadista de alimentos', 'distribuidor food service', 'distribuidor de food service', 'distribuidor de produtos alimenticios', 'distribuidor de produtos alimentícios', 'distribuidor de cesta basica', 'distribuidor de cesta básica', 'distribuidor de mercearia', 'distribuidor de bebidas e alimentos', 'distribuidor de congelados', 'distribuidor de carnes', 'distribuidor de laticinios', 'distribuidor de laticínios', 'distribuidor de hortifruti', 'distribuidor de hortifrúti', 'distribuidor de doces', 'distribuidor de matinais', 'distribuidor de cereais', 'distribuidor de oleos', 'distribuidor de óleos', 'distribuidor de massas', 'distribuidor de molhos', 'distribuidor de descartaveis', 'distribuidor de descartáveis', 'atacado de food service', 'distribuidor de produtos secos', 'distribuidor de bebidas', 'depósito de alimentos atacado', 'centro de distribuicao de alimentos', 'centro de distribuição de alimentos', 'distribuidor de produtos para restaurante', 'distribuidor para padarias', 'distribuidor para supermercados', 'atacarejo'],
    'distribuidores de bebidas': ['distribuidora de bebidas', 'deposito de bebidas', 'atacadista de bebidas', 'atacado de bebidas'],
    'distribuidores de frios': ['distribuidora de frios', 'distribuidor de frios', 'frios e laticinios', 'frios e laticínios', 'atacadista de frios', 'atacado de frios', 'fornecedor de frios', 'frios atacado', 'distribuidora de embutidos', 'distribuidor de embutidos', 'frios e embutidos atacado', 'fornecedor de queijos', 'distribuidora de queijos', 'distribuidor de presunto', 'distribuidor de mortadela', 'distribuidor de salame', 'distribuidor de salsicha', 'distribuidor de linguica', 'distribuidor de linguiça', 'fornecedor de bacon', 'distribuidor de manteiga', 'distribuidor de margarina', 'distribuidor de iogurte', 'fornecedor de leite', 'frios para padaria', 'frios para restaurante', 'frios para pizzaria', 'frios para hamburgueria', 'frios food service'],
    'distribuidoras de alimentos congelados': ['distribuidora de congelados', 'congelados atacado', 'atacadista de congelados', 'alimentos congelados', 'frigorifico'],
    'distribuidoras de alimentos para food service': ['distribuidora de alimentos', 'food service', 'atacadista de alimentos', 'distribuidor food service', 'refeicao coletiva'],
    'distribuidoras de alimentos': ['distribuidora de alimentos', 'atacadista de alimentos', 'comercio atacadista de produtos alimenticios', 'generos alimenticios'],
    'distribuidoras de carnes': ['distribuidora de carnes', 'atacado de carnes', 'atacadista de carnes', 'frigorifico'],
    'distribuidoras de congelados': ['distribuidora de congelados', 'congelados atacado', 'atacadista de congelados'],
    'distribuidoras de sorvetes': ['distribuidora de sorvetes', 'sorvetes atacado', 'atacadista de sorvetes'],
    'distribuidoras de açaí': ['distribuidora de acai', 'acai atacado', 'atacadista de acai'],
    'distribuidoras de polpas de frutas': ['distribuidora de polpas', 'polpa de fruta', 'atacadista de polpas'],
    'distribuidoras de ovos': ['distribuidora de ovos', 'ovos atacado', 'granja distribuidora', 'atacadista de ovos'],
    'distribuidoras de queijos': ['distribuidora de queijos', 'queijos atacado', 'laticinios', 'atacadista de queijos'],
    'distribuidoras de peixes': ['distribuidora de peixes', 'pescado', 'frutos do mar'],
    'distribuidoras de embutidos': ['distribuidora de embutidos', 'embutidos', 'frios'],
    'distribuidoras de doces': ['distribuidora de doces', 'distribuidor de doces', 'doces atacado', 'distribuidora de balas', 'atacadista de doces', 'atacado de balas', 'fornecedor de doces', 'doces e guloseimas atacado', 'distribuidora de chocolates', 'atacado de chocolates', 'distribuidora de bombons', 'distribuidor de chicletes', 'distribuidor de pirulitos', 'distribuidor de salgadinhos', 'distribuidor de biscoitos', 'distribuidor de bolachas', 'distribuidor de wafer', 'distribuidor de balinhas', 'fornecedor para festas doces', 'doces para revenda', 'doces para festas atacado', 'distribuidora de docinhos', 'doces gourmet atacado', 'doces importados atacado', 'paçoca atacado', 'pacoca atacado', 'doces tradicionais atacado'],
    'distribuidoras de material hospitalar': ['material hospitalar', 'material medico', 'produtos hospitalares'],
    'distribuidoras de produtos hospitalares': ['material hospitalar', 'produtos hospitalares'],
    'distribuidoras de gases industriais': ['gases industriais', 'distribuidora de gases', 'distribuidor de gases industriais', 'oxigenio', 'oxigênio', 'acetileno', 'gas industrial', 'gás industrial', 'distribuidor de oxigenio', 'distribuidor de oxigênio', 'distribuidor de acetileno', 'argonio', 'argônio', 'distribuidor de argonio', 'nitrogenio', 'nitrogênio', 'distribuidor de nitrogenio', 'hidrogenio', 'hidrogênio', 'distribuidor de hidrogenio', 'distribuidor de co2', 'co2 industrial', 'gases medicinais', 'distribuidora de gases medicinais', 'distribuidor de gas helio', 'helio industrial', 'hélio industrial', 'cilindros de gas', 'cilindros de gás', 'recarga de cilindros', 'distribuidor de gas para solda', 'gas de solda', 'gás de solda', 'distribuidor de gases especiais', 'gases especiais', 'gases para industria', 'gases para indústria', 'gases criogenicos', 'gases criogênicos', 'distribuidor de gases criogenicos', 'envase de gases', 'distribuidor de gases para hospital'],
    'distribuidores de material médico hospitalar': ['material medico', 'material hospitalar'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'distribuidora de autopeças', 'atacado de autopecas', 'atacado de autopeças', 'distribuidor de autopecas', 'pecas automotivas atacado', 'peças automotivas atacado', 'atacadista de autopecas', 'central de autopecas', 'rede de autopecas', 'fornecedor de autopecas', 'pecas multimarcas atacado', 'distribuidora de pecas originais', 'distribuidora de filtros', 'distribuidora de oleos lubrificantes', 'pecas pesadas atacado', 'distribuidora de pecas para caminhao', 'distribuidor de pecas para motos', 'distribuidor de pecas para vans', 'representante de autopecas', 'pecas e acessorios atacado', 'pecas para revenda', 'pecas para reposicao atacado', 'distribuidora de pecas eletricas automotivas', 'distribuidora de baterias automotivas', 'distribuidora de pneus e autopecas'],
    'distribuidores de água': ['distribuidora de agua', 'distribuidora de água', 'distribuidor de agua', 'distribuidor de água', 'distribuidoras de agua', 'distribuidoras de água', 'distribuidora de agua mineral', 'distribuidora de água mineral', 'distribuidor de agua mineral', 'distribuidora de galao', 'distribuidora de galão', 'distribuidora de galoes', 'distribuidora de galões', 'fornecedor de agua mineral', 'fornecedor de água mineral', 'fornecedora de agua mineral', 'deposito de agua mineral', 'depósito de água mineral', 'deposito de agua', 'depósito de água', 'venda de agua mineral', 'venda de água mineral', 'entrega de agua', 'entrega de água', 'entrega de agua mineral', 'entrega de galao', 'entrega de galão', 'tele agua', 'tele água', 'tele entrega de agua', 'agua mineral em domicilio', 'água mineral em domicílio', 'distribuidor de agua e gas', 'distribuidor de água e gás', 'distribuidora de agua e gas', 'distribuidora de água e gás', 'agua e gas distribuidora', 'água e gás distribuidora', 'distribuidora agua de coco', 'distribuidora de bebedouros', 'comercio de agua mineral', 'comércio de água mineral'],
    'distribuidores de refrigerantes': ['distribuidora de refrigerantes', 'refrigerantes'],
    'distribuidores de cervejas': ['distribuidora de cervejas', 'cervejas'],
    'distribuidores de colchões': ['distribuidora de colchoes', 'colchoes atacado'],
    'distribuidores de pêssegos': ['pessego', 'pessegos', 'distribuidor de pessegos', 'fruta'],

    // ===== TRANSPORTES E LOGÍSTICA =====
    'transportadoras': ['transportadora', 'transportadoras', 'transporte', 'logistica', 'logística', 'frete', 'mudancas', 'mudanças', 'caminhao', 'caminhão', 'transporte de cargas', 'transporte rodoviario', 'transporte rodoviário', 'frete de cargas', 'transportador autonomo', 'transportadora de cargas', 'logistica de transporte', 'transportadora rodoviaria', 'transportadora rodoviária', 'transporte fracionado', 'transporte de carga seca', 'transporte refrigerado', 'transporte de carga viva', 'transporte de produtos perigosos', 'cooperativa de transportes', 'transportadora intermunicipal', 'transportadora interestadual', 'frete dedicado', 'transporte expresso', 'transporte de mudancas', 'fretamento de caminhoes'],
    'empresas de logística': ['logistica', 'logística', 'operador logistico', 'operador logístico', 'armazenagem', 'centro de distribuicao', 'centro de distribuição', 'empresa de logistica', 'empresa de logística', 'logistica integrada', 'logística integrada', 'logistica reversa', 'logística reversa', '4pl', '3pl', 'gestao de armazem', 'gestão de armazém', 'cross docking', 'fulfillment', 'last mile', 'transporte e logistica', 'distribuicao logistica', 'distribuição logística', 'roteirizacao', 'roteirização', 'wms', 'tms', 'operadora logistica', 'operadora logística', 'logistica de armazenagem', 'logistica de transporte', 'logística de transporte', 'logistica e-commerce'],
    'locadoras de veículos': ['locadora de veiculos', 'aluguel de carros', 'rent a car'],
    'empresas de motoboy': ['motoboy', 'motofrete', 'entrega moto'],
    'frotistas': ['frotista', 'frota', 'gestao de frota'],
    'empresas com frota própria': ['frota propria', 'frota corporativa'],
    'vans escolares': ['van escolar', 'transporte escolar'],
    'táxis e cooperativas': ['taxi', 'cooperativa de taxi', 'radiotaxi'],
    'motoristas de aplicativo': ['motorista de aplicativo', 'uber', 'transporte por aplicativo'],
    'empresas de turismo': ['turismo', 'agencia de turismo', 'receptivo'],

    // ===== ESCRITÓRIOS E SERVIÇOS PROFISSIONAIS =====
    'escritórios': ['escritorio', 'coworking', 'sala comercial'],
    'coworkings': ['coworking', 'espaco compartilhado', 'escritorio compartilhado'],
    'escritórios de contabilidade': ['escritorio de contabilidade', 'contabilidade', 'contador'],
    'escritórios de advocacia': ['escritorio de advocacia', 'advocacia', 'advogado'],
    'escritórios de arquitetura': ['escritorio de arquitetura', 'arquiteto', 'arquitetura'],
    'arquitetos': ['arquiteto', 'arquitetura', 'projeto arquitetonico'],
    'imobiliárias': ['imobiliaria', 'imobiliárias', 'imobiliarias', 'imobiliária', 'corretor de imoveis', 'corretor de imóveis', 'corretora de imoveis', 'corretora de imóveis', 'venda de imoveis', 'aluguel de imoveis', 'locacao de imoveis', 'locação de imóveis', 'administradora de imoveis', 'administradora de imóveis', 'imobiliaria residencial', 'imobiliaria comercial', 'imobiliária comercial', 'imobiliaria de luxo', 'imobiliária de luxo', 'imobiliaria de praia', 'imobiliaria de campo', 'imoveis novos', 'imóveis novos', 'imoveis usados', 'imoveis para temporada', 'imobiliaria temporada', 'consultoria imobiliaria', 'consultoria imobiliária', 'rede imobiliaria', 'franquia imobiliaria', 'franquia imobiliária', 'imobiliaria boutique', 'imoveis comerciais', 'imóveis comerciais', 'imobiliaria condominio', 'imobiliária condomínio', 'imobiliaria rural', 'imobiliária rural', 'venda de terrenos', 'venda de apartamentos', 'venda de casas', 'venda de salas comerciais'],
    'corretoras de seguros': ['corretora de seguros', 'seguros', 'seguradora'],

    // ===== TECNOLOGIA =====
    'eletrônicos': ['eletronicos', 'informatica', 'eletronica'],
    'lojas de informática': ['informatica', 'computadores', 'notebook', 'hardware'],
    'lojas de celular': ['celular', 'smartphone', 'acessorios celular', 'telefonia'],
    'empresas de desenvolvimento de software': ['desenvolvimento de software', 'software house', 'fabrica de software'],
    'empresas de consultoria em ti': ['consultoria em ti', 'consultoria de tecnologia'],
    'empresas de infraestrutura de ti': ['infraestrutura de ti', 'datacenter', 'rede'],
    'empresas de suporte técnico': ['suporte tecnico', 'assistencia tecnica', 'help desk'],
    'empresas de telecomunicações': ['telecomunicacoes', 'telecom', 'telefonia'],
    'provedores de internet': ['provedor de internet', 'internet', 'fibra optica'],
    'empresas de data center': ['data center', 'datacenter', 'hospedagem'],
    'empresas de cloud computing': ['cloud computing', 'nuvem', 'computacao em nuvem'],
    'empresas de cibersegurança': ['ciberseguranca', 'seguranca da informacao', 'cyber security'],
    'empresas de automação comercial': ['automacao comercial', 'pdv', 'sistema para comercio'],
    'empresas de automação industrial': ['automacao industrial', 'automacao', 'instrumentacao industrial'],
    'empresas de cftv': ['cftv', 'cameras de seguranca', 'vigilancia'],
    'empresas de controle de acesso': ['controle de acesso', 'catraca', 'biometria'],
    'empresas de alarmes': ['alarmes', 'sistema de alarme', 'monitoramento'],
    'empresas de monitoramento': ['monitoramento', 'central de monitoramento', 'vigilancia'],
    'empresas de portaria remota': ['portaria remota', 'portaria virtual'],

    // ===== MARKETING E PUBLICIDADE =====
    'agências de marketing digital': ['agencia de marketing', 'marketing digital', 'agencia digital'],
    'agências de publicidade': ['agencia de publicidade', 'propaganda', 'publicidade'],
    'agências de seo': ['agencia de seo', 'seo', 'otimizacao para buscadores'],
    'agências de mídias sociais': ['midias sociais', 'redes sociais', 'social media'],
    'agências de branding': ['branding', 'marca', 'identidade visual'],
    'agências de comunicação': ['agencia de comunicacao', 'comunicacao', 'assessoria de imprensa'],
    'agências de relações públicas': ['relacoes publicas', 'rp', 'assessoria de comunicacao'],
    'estúdios de design': ['estudio de design', 'design grafico', 'designer'],
    'produtoras de conteúdo': ['produtora de conteudo', 'producao de video', 'audiovisual'],

    // ===== RH =====
    'empresas de rh e terceirização': ['recursos humanos', 'terceirizacao', 'trabalho temporario'],
    'agências de recrutamento': ['recrutamento', 'selecao', 'headhunter', 'rh'],
    'empresas de treinamento corporativo': ['treinamento corporativo', 'capacitacao', 'treinamento empresarial'],

    // ===== SEGURANÇA E LIMPEZA =====
    'empresas de segurança': ['empresa de seguranca', 'vigilancia', 'seguranca patrimonial'],
    'empresas de limpeza': ['empresa de limpeza', 'empresas de limpeza', 'limpeza profissional', 'limpeza comercial', 'limpeza industrial', 'limpeza condominial', 'limpeza pos obra', 'limpeza pós obra', 'limpeza pesada', 'limpeza terceirizada', 'conservacao e limpeza', 'conservação e limpeza', 'servicos de limpeza', 'serviços de limpeza', 'prestadora de servicos de limpeza', 'prestadora de serviços de limpeza', 'higienizacao de estofados', 'higienização de estofados', 'limpeza de carpetes', 'limpeza de sofas', 'limpeza de sofás', 'limpeza de vidros', 'limpeza de fachadas', 'limpeza de caixa dagua', 'limpeza de caixa d agua', 'limpeza de caixa d\'água', 'limpeza de piscinas', 'limpeza de escritorios', 'limpeza de escritórios', 'mao de obra para limpeza', 'mão de obra para limpeza', 'asseio e conservacao', 'asseio e conservação', 'terceirizacao de limpeza', 'terceirização de limpeza', 'limpeza hospitalar', 'limpeza de obras', 'faxina profissional', 'gerenciamento de limpeza', 'limpeza predial', 'limpeza corporativa'],
    'dedetizadoras': ['dedetizadora', 'controle de pragas', 'desinsetizacao'],
    'lojas de produtos de limpeza': ['produtos de limpeza', 'limpeza', 'material de limpeza'],

    // ===== AR CONDICIONADO =====
    'empresas de ar condicionado': ['ar condicionado', 'climatizacao', 'split'],

    // ===== EVENTOS =====
    'agência de eventos': ['agencia de eventos', 'organizadora de eventos', 'produtora de eventos', 'buffet e eventos'],
    'buffets de festas': ['buffet de festas', 'buffet infantil', 'espaco para eventos', 'salao de festas'],
    'casas de festas': ['casa de festas', 'salao de festas', 'espaco para eventos'],
    'empresas de locação de materiais para eventos': ['locacao de materiais', 'mesas e cadeiras', 'toalhas para eventos'],
    'lojas de artigos para festas': ['artigos para festas', 'festas', 'decoracao de festas'],

    // ===== TABACARIAS =====
    'tabacarias': ['tabacaria', 'tabaco', 'charutos', 'cachimbos'],

    // ===== LOJAS DIVERSAS =====
    'papelarias': ['papelaria', 'papelarias', 'livraria', 'material escolar', 'material de escritorio', 'material de escritório', 'loja de papelaria', 'casa do papel', 'papel e papelaria', 'papelaria escolar', 'papelaria infantil', 'papelaria criativa', 'papelaria personalizada', 'papelaria fina', 'papelaria gourmet', 'papelaria e presentes', 'papelaria e brinquedos', 'cartorio papelaria', 'cartório papelaria', 'papelaria comercial', 'papelaria empresarial', 'papelaria e copiadora', 'copiadora e papelaria', 'graficas e papelaria', 'gráficas e papelaria', 'papelaria online', 'papelaria delivery', 'papelaria 24h', 'super papelaria', 'mega papelaria', 'rede de papelarias'],
    'livrarias': ['livraria', 'livros', 'livro'],
    'lojas de brinquedos': ['brinquedos', 'brinquedo', 'loja de brinquedos'],
    'lojas de games e videogames': ['games', 'videogames', 'gamer'],
    'lojas de artigos para bebê': ['artigos para bebe', 'loja de bebe', 'enxoval de bebe'],
    'lojas de conveniência': ['conveniencia', 'loja de conveniencia'],
    'lojas de variedades': ['loja de variedades', 'lojas de variedades', 'loja de 1.99', '1 99', 'loja de 1,99', 'loja de 5 reais', 'loja de 10 reais', 'magazine de variedades', 'bazar de variedades', 'bazar', 'loja popular', 'loja de utilidades', 'loja de presentes', 'loja de utilidades domesticas', 'loja de utilidades domésticas', 'loja popular de variedades', 'loja preco baixo', 'loja preço baixo', 'loja de papelaria e variedades', 'loja oriental de variedades', 'loja de produtos importados', 'loja chinesa de variedades', 'armarinho', 'armarinhos', 'loja popular do bairro', 'rede de variedades', 'franquia variedades', 'magazinen variedades', 'depósito de variedades', 'distribuidora de variedades', 'loja de produtos diversos', 'loja de produtos para casa', 'loja barateira', 'loja achados', 'loja de tudo', 'loja de quase tudo', 'loja a granel variedades', 'loja sortida', 'loja de utensilios diversos', 'loja popular utilidades', 'loja com mais de mil itens'],
    'lojas de presentes de alto padrão': ['presentes finos', 'presentes de luxo', 'gifts'],
    'lojas de bicicleta': ['bicicleta', 'bike', 'ciclismo', 'bike shop'],
    'lojas de veículos elétricos': ['veiculos eletricos', 'patinete eletrico', 'bicicleta eletrica'],
    'lojas de epi': ['epi', 'equipamento de protecao', 'seguranca do trabalho'],
    'lojas de sinalização': ['sinalizacao', 'placas', 'comunicacao visual'],
    'artigos de caça, pesca e camping': ['caca e pesca', 'caça e pesca', 'camping', 'pesca esportiva', 'artigos de pesca', 'loja de pesca', 'casa do pescador', 'pesca e camping', 'artigos esportivos pesca', 'pesca amadora', 'pesca profissional', 'iscas e anzóis', 'iscas e anzois', 'varas de pesca', 'molinetes', 'carretilhas', 'kit pesca', 'casa de camping', 'loja de camping', 'artigos para camping', 'barracas de camping', 'fogareiro camping', 'lanternas camping', 'sleeping bag', 'mochilao trilha', 'mochilão trilha', 'trekking', 'aventura outdoor', 'casa do caçador', 'artigos de caca', 'artigos de caça', 'arcos e flechas', 'munição', 'municao', 'embarcacoes para pesca', 'embarcações para pesca', 'pescador', 'pescaria', 'pesca', 'anzol', 'isca', 'iscas', 'linha de pesca', 'caiaque pesca', 'barco pesca', 'motor de popa', 'nautica', 'náutica', 'mergulho', 'carabina', 'espingarda', 'armeiro', 'armamento', 'tiro esportivo', 'stand de tiro', 'coldre', 'cutelaria', 'canivete', 'faca de caça', 'facas taticas', 'facas táticas', 'sobrevivencia', 'sobrevivência', 'bushcraft', 'outdoor', 'trilha', 'montanhismo', 'rapel', 'escalada outdoor', 'loja de caca e pesca', 'loja de caça e pesca', 'caca pesca camping', 'caça pesca camping', 'nautika', 'nautica pesca', 'náutica pesca', 'casa de pesca', 'mundo da pesca', 'ponto da pesca', 'acampamento', 'barraca', 'lanterna tatica', 'lanterna tática', 'binóculo', 'binoculo', 'luneta', 'mira telescopica', 'mira telescópica', 'equipamento de pesca', 'material de pesca', 'artigos nauticos', 'artigos náuticos', 'loja nautica', 'loja náutica', 'casa de camping', 'pet e pesca', 'agropecuaria pesca', 'agropecuária pesca', 'redes de pesca', 'tarrafas', 'chumbo pesca', 'boia de pesca', 'bóia de pesca', 'armas e municoes', 'armas e munições', 'loja de armas', 'comercio de armas', 'comércio de armas', 'casa de armas', 'armaria', 'rifle', 'revolver', 'revólver', 'pistola', 'shotgun', 'calibre', 'airsoft', 'paintball', 'selaria', 'artigos de selaria', 'artigos country', 'loja country', 'casa country', 'artigos rurais', 'esportivo', 'artigos esportivos', 'loja de esportes', 'casa de esportes', 'artigos de aventura', 'aventura', 'loja aventura', 'mundo aventura', 'casa da aventura', 'equipamentos de aventura', 'equipamentos esportivos', 'artigos militares', 'loja militar', 'militar', 'loja tatica', 'loja tática', 'tatico', 'tático', 'artigos taticos', 'artigos táticos', 'equipamento tatico', 'equipamento tático', 'survival', 'caiaque', 'kayak', 'caiaqueiros', 'stand up paddle', 'sup', 'jet ski', 'lancha', 'barco', 'embarcacao', 'embarcação', 'marina', 'marinharia', 'loja de barcos', 'pecas nauticas', 'peças náuticas', 'motor nautico', 'motor náutico', 'motor barco', 'trailer nautico', 'trailer náutico', 'equipamento nautico', 'equipamento náutico', 'acessorios nauticos', 'acessórios náuticos', 'chumbada', 'ancora', 'âncora', 'salva vidas', 'colete salva-vidas', 'coletes', 'botas taticas', 'botas táticas', 'roupas taticas', 'roupas táticas', 'camuflado', 'camuflagem', 'ghillie', 'mochila tatica', 'mochila tática', 'mochila militar', 'faca', 'facas', 'facao', 'facão', 'machado', 'machadinha', 'foice', 'loja de cutelaria', 'casa de cutelaria', 'canivetes', 'multiferramenta', 'multi ferramenta', 'leatherman', 'victorinox', 'gerber', 'pesca submarina', 'arbalete', 'arpao', 'arpão', 'neoprene', 'cilindro mergulho', 'regulador mergulho', 'mascara mergulho', 'máscara mergulho', 'snorkel', 'barbatana', 'nadadeira', 'speedo pesca', 'shimano', 'marine sports', 'intruder', 'pesque pague', 'pesque e pague', 'pesqueiro', 'clube de pesca', 'colonia de pescadores', 'colônia de pescadores', 'associacao de pesca', 'associação de pesca', 'federacao de pesca', 'federação de pesca', 'vara de pesca', 'vara telescopica', 'vara telescópica', 'carretilha de pesca', 'molinete de pesca', 'fly fishing', 'fly tying', 'mosca artificial', 'isca artificial', 'isca viva', 'minhoca', 'camarao', 'camarão', 'corrupto', 'massa de pesca', 'engodo', 'ceva', 'cevadeira', 'chicote de pesca', 'anzol circle', 'anzol encastoado', 'girador', 'snap', 'presilha', 'fluorcarbono', 'fluorcarbon', 'multifilamento', 'monofilamento', 'nylon pesca', 'braid', 'trançado', 'trancado', 'leader', 'empate', 'destorcedor', 'alicate de pesca', 'alicate boga', 'grip de pesca', 'passaguia', 'puçá', 'puca', 'samburá', 'sambura', 'cooler de pesca', 'caixa de pesca', 'bolsa de pesca', 'mochila de pesca', 'cadeira de pesca', 'banqueta de pesca', 'suporte de vara', 'porta varas', 'viveiro de iscas', 'oxigenador', 'aerador', 'balança de pesca', 'sonar de pesca', 'motor eletrico', 'motor elétrico', 'motor trolling', 'reboque nautico', 'reboque náutico', 'tinta nautica', 'tinta náutica', 'antifouling'],
    'loja de caça e pesca': ['caca e pesca', 'caça e pesca', 'camping', 'pesca esportiva', 'artigos de pesca', 'loja de pesca', 'casa do pescador', 'pesca e camping', 'artigos esportivos pesca', 'pesca amadora', 'pesca profissional', 'iscas e anzóis', 'iscas e anzois', 'varas de pesca', 'molinetes', 'carretilhas', 'kit pesca', 'casa de camping', 'loja de camping', 'artigos para camping', 'barracas de camping', 'fogareiro camping', 'lanternas camping', 'sleeping bag', 'mochilao trilha', 'mochilão trilha', 'trekking', 'aventura outdoor', 'casa do caçador', 'artigos de caca', 'artigos de caça', 'arcos e flechas', 'munição', 'municao', 'embarcacoes para pesca', 'embarcações para pesca', 'pescador', 'pescaria', 'pesca', 'anzol', 'isca', 'iscas', 'linha de pesca', 'caiaque pesca', 'barco pesca', 'motor de popa', 'nautica', 'náutica', 'mergulho', 'carabina', 'espingarda', 'armeiro', 'armamento', 'tiro esportivo', 'stand de tiro', 'coldre', 'cutelaria', 'canivete', 'faca de caça', 'facas taticas', 'facas táticas', 'sobrevivencia', 'sobrevivência', 'bushcraft', 'outdoor', 'trilha', 'montanhismo', 'rapel', 'escalada outdoor', 'loja de caca e pesca', 'loja de caça e pesca', 'caca pesca camping', 'caça pesca camping', 'nautika', 'nautica pesca', 'náutica pesca', 'casa de pesca', 'mundo da pesca', 'ponto da pesca', 'acampamento', 'barraca', 'lanterna tatica', 'lanterna tática', 'binóculo', 'binoculo', 'luneta', 'mira telescopica', 'mira telescópica', 'equipamento de pesca', 'material de pesca', 'artigos nauticos', 'artigos náuticos', 'loja nautica', 'loja náutica', 'casa de camping', 'pet e pesca', 'agropecuaria pesca', 'agropecuária pesca', 'redes de pesca', 'tarrafas', 'chumbo pesca', 'boia de pesca', 'bóia de pesca', 'armas e municoes', 'armas e munições', 'loja de armas', 'comercio de armas', 'comércio de armas', 'casa de armas', 'armaria', 'rifle', 'revolver', 'revólver', 'pistola', 'shotgun', 'calibre', 'airsoft', 'paintball', 'selaria', 'artigos de selaria', 'artigos country', 'loja country', 'casa country', 'artigos rurais', 'esportivo', 'artigos esportivos', 'loja de esportes', 'casa de esportes', 'artigos de aventura', 'aventura', 'loja aventura', 'mundo aventura', 'casa da aventura', 'equipamentos de aventura', 'equipamentos esportivos', 'artigos militares', 'loja militar', 'militar', 'loja tatica', 'loja tática', 'tatico', 'tático', 'artigos taticos', 'artigos táticos', 'equipamento tatico', 'equipamento tático', 'survival', 'caiaque', 'kayak', 'caiaqueiros', 'stand up paddle', 'sup', 'jet ski', 'lancha', 'barco', 'embarcacao', 'embarcação', 'marina', 'marinharia', 'loja de barcos', 'pecas nauticas', 'peças náuticas', 'motor nautico', 'motor náutico', 'motor barco', 'trailer nautico', 'trailer náutico', 'equipamento nautico', 'equipamento náutico', 'acessorios nauticos', 'acessórios náuticos', 'chumbada', 'ancora', 'âncora', 'salva vidas', 'colete salva-vidas', 'coletes', 'botas taticas', 'botas táticas', 'roupas taticas', 'roupas táticas', 'camuflado', 'camuflagem', 'ghillie', 'mochila tatica', 'mochila tática', 'mochila militar', 'faca', 'facas', 'facao', 'facão', 'machado', 'machadinha', 'foice', 'loja de cutelaria', 'casa de cutelaria', 'canivetes', 'multiferramenta', 'multi ferramenta', 'leatherman', 'victorinox', 'gerber', 'pesca submarina', 'arbalete', 'arpao', 'arpão', 'neoprene', 'cilindro mergulho', 'regulador mergulho', 'mascara mergulho', 'máscara mergulho', 'snorkel', 'barbatana', 'nadadeira', 'speedo pesca', 'shimano', 'marine sports', 'intruder', 'pesque pague', 'pesque e pague', 'pesqueiro', 'clube de pesca', 'colonia de pescadores', 'colônia de pescadores', 'associacao de pesca', 'associação de pesca', 'federacao de pesca', 'federação de pesca', 'vara de pesca', 'vara telescopica', 'vara telescópica', 'carretilha de pesca', 'molinete de pesca', 'fly fishing', 'fly tying', 'mosca artificial', 'isca artificial', 'isca viva', 'minhoca', 'camarao', 'camarão', 'corrupto', 'massa de pesca', 'engodo', 'ceva', 'cevadeira', 'chicote de pesca', 'anzol circle', 'anzol encastoado', 'girador', 'snap', 'presilha', 'fluorcarbono', 'fluorcarbon', 'multifilamento', 'monofilamento', 'nylon pesca', 'braid', 'trançado', 'trancado', 'leader', 'empate', 'destorcedor', 'alicate de pesca', 'alicate boga', 'grip de pesca', 'passaguia', 'puçá', 'puca', 'samburá', 'sambura', 'cooler de pesca', 'caixa de pesca', 'bolsa de pesca', 'mochila de pesca', 'cadeira de pesca', 'banqueta de pesca', 'suporte de vara', 'porta varas', 'viveiro de iscas', 'oxigenador', 'aerador', 'balança de pesca', 'sonar de pesca', 'motor eletrico', 'motor elétrico', 'motor trolling', 'reboque nautico', 'reboque náutico', 'tinta nautica', 'tinta náutica', 'antifouling'],
    'lojas de artigos para piscina': ['artigos para piscina', 'artigos para piscinas', 'piscina', 'piscinas', 'piscinaria', 'tratamento de agua', 'tratamento de piscina', 'produtos para piscina', 'produtos quimicos para piscina', 'aquecedor de piscina', 'capa de piscina', 'manutencao de piscinas', 'limpeza de piscinas', 'piscineiro', 'mundo da piscina', 'casa da piscina', 'cloro'],
    'lojas de revestimentos': ['revestimentos', 'porcelanato', 'pisos', 'ceramica'],

    // ===== E-COMMERCE =====
    'e-commerce': ['e-commerce', 'ecommerce', 'loja virtual', 'loja online', 'comercio eletronico', 'comércio eletrônico', 'venda online', 'vendas online', 'marketplace', 'e-shop', 'eshop', 'loja na internet', 'comercio digital', 'comércio digital', 'tienda online', 'online shop', 'loja eletronica', 'loja eletrônica', 'venda pela internet', 'site de vendas', 'plataforma de vendas online', 'dropshipping', 'fulfillment ecommerce', 'loja virtual b2b', 'loja virtual b2c', 'venda em marketplace', 'mercado livre seller', 'shopee seller', 'amazon seller', 'tray loja virtual', 'nuvem shop seller', 'vtex seller', 'loja shopify', 'magento loja', 'woocommerce loja'],
    'e-commerces de peças automotivas': ['ecommerce autopecas', 'ecommerce autopeças', 'pecas automotivas online', 'peças automotivas online', 'loja virtual autopecas', 'loja virtual autopeças', 'autopecas online', 'autopeças online', 'pecas automotivas e-commerce', 'venda de pecas online', 'venda de peças online', 'loja online de pecas', 'pecas para carro online', 'peças para carro online', 'pecas para moto online', 'peças para moto online', 'loja virtual de pecas pesadas', 'autocenter online', 'pecas e acessorios online', 'peças e acessórios online', 'site de autopecas', 'site de autopeças', 'pecas originais online', 'peças originais online', 'pecas multimarcas online', 'pecas para caminhao online', 'peças para caminhão online', 'loja online auto pecas', 'autoshop online', 'pecas express online'],
    'e-commerces de utilidades domésticas': ['ecommerce utilidades', 'utilidades domesticas online', 'utilidades domésticas online', 'loja virtual utilidades', 'utensilios domesticos online', 'utensílios domésticos online', 'loja online utilidades', 'utilidades para casa online', 'cama mesa banho online', 'utensilios de cozinha online', 'utensílios de cozinha online', 'casa e cozinha online', 'organizadores online', 'panelaria online', 'loja virtual cama mesa banho', 'utilidades em geral online', 'magazine online utilidades', 'site de utilidades domesticas', 'site de utilidades domésticas', 'lar e cozinha online', 'casa pratica online', 'casa prática online', 'enxoval online', 'achadinhos para casa online', 'utilidades importadas online', 'mundo do lar online'],
    'e-commerces de perfumaria e casa': ['ecommerce perfumaria', 'perfumes online'],
    'e-commerces de sabonetes': ['ecommerce sabonetes', 'sabonetes artesanais'],
    'e-commerces de presentes finos': ['ecommerce presentes', 'presentes online'],
    'e-commerces de máquinas e ferramentas elétricas': [
      'ferramentas eletricas', 'ferramentas elétricas', 'maquinas e ferramentas', 'máquinas e ferramentas',
      'comercio de ferramentas', 'comércio de ferramentas', 'loja de ferramentas',
      'ferramentas em geral', 'ferramentas gerais', 'ferramentaria',
      'furadeira', 'parafusadeira', 'lixadeira', 'esmerilhadeira', 'serra eletrica', 'serra elétrica',
      'ferramentas industriais', 'ferramentas profissionais', 'distribuidora de ferramentas',
      'ferramentas e ferragens', 'ferragens e ferramentas',
      'ecommerce ferramentas', 'ferramentas online', 'loja virtual ferramentas', 'loja online ferramentas',
    ],
    'e-commerces de máquinas e ferramentas a combustão': [
      'motosserra', 'roçadeira', 'rocadeira', 'roçadeiras', 'rocadeiras',
      'maquinas a combustao', 'máquinas a combustão', 'equipamentos a combustao',
      'cortador de grama', 'cortadores de grama', 'aparador de grama',
      'soprador', 'sopradores', 'motopoda', 'motobomba', 'motocultivador',
      'gerador', 'geradores', 'grupo gerador', 'grupos geradores',
      'maquinas agricolas', 'máquinas agrícolas', 'equipamentos agricolas', 'equipamentos florestais',
      'maquinas e equipamentos', 'comercio de maquinas', 'comércio de máquinas',
      'ferramentas a gasolina', 'equipamentos a gasolina',
      'ecommerce motosserra', 'motosserra online', 'roçadeira online',
    ],

    // ===== IMPORTAÇÃO E EXPORTAÇÃO =====
    'importadoras': ['importadora', 'importacao', 'produtos importados', 'trading'],
    'exportadoras': ['exportadora', 'exportacao', 'comercio exterior'],
    'despachantes aduaneiros': ['despachante aduaneiro', 'desembaraco aduaneiro', 'importacao'],
    'empresas de comércio exterior': ['comercio exterior', 'importacao', 'exportacao'],
    'trading companies': ['trading', 'trading company', 'comercio internacional'],

    // ===== LAVANDERIA =====
    'lavanderias': ['lavanderia', 'lavagem', 'tinturaria'],

    // ===== ENGENHARIA =====
    'empresas de engenharia mecânica': ['engenharia mecanica', 'projeto mecanico'],
    'empresas de engenharia ambiental': ['engenharia ambiental', 'meio ambiente', 'licenciamento ambiental'],
    'empresas de topografia': ['topografia', 'levantamento topografico', 'agrimensura'],
    'empresas de demolição': ['demolicao', 'demolidora'],
    'empresas de fundações': ['fundacoes', 'estacas', 'fundacao profunda'],
    'empresas de perfuração de poços': ['perfuracao de pocos', 'poco artesiano', 'poco'],
    'empresas de energia eólica': ['energia eolica', 'aerogerador', 'turbina eolica'],

    // ===== SALGADOS =====
    'salgadeiros': ['salgadeiro', 'salgados', 'fabrica de salgados'],
    'poké bowls': ['poke', 'poke bowl', 'comida havaiana'],
    'creperies': ['creperie', 'crepe'],
    'casas de crepe': ['casa de crepe', 'crepe', 'creperie'],
    'casas de waffle': ['casa de waffle', 'waffle'],
    'tapiocarias': ['tapiocaria', 'tapioca'],

    // ===== MISSING CATEGORIES - SERVIÇOS DIVERSOS =====
    'lojas de aviamentos': ['aviamentos', 'armarinho', 'aviamento', 'botoes', 'ziper', 'linhas'],
    'lojas de aviamentos e armarinhos': ['aviamentos', 'armarinho', 'armarinhos', 'botoes', 'botões', 'ziper', 'zíper', 'loja de aviamentos', 'loja de armarinhos', 'casa de aviamentos', 'casa de armarinhos', 'aviamentos para costura', 'aviamentos e tecidos', 'aviamentos atacado', 'linhas e agulhas', 'linhas para costura', 'agulhas para costura', 'fitas e cordoes', 'fitas e cordões', 'la para tricô', 'lã para tricô', 'la para crochê', 'lã para crochê', 'apliques bordados', 'paetês', 'paetes', 'rendas e bordados', 'enfeites para roupas', 'aviamentos infantis', 'feltro e EVA', 'galões e fitas', 'cordões e cadarços', 'cordoes e cadarcos', 'tecido e aviamentos'],
    'empresas de gulla': ['gulla', 'gulosices', 'doces', 'guloseimas'],
    'lojas de móveis': ['moveis', 'moveis planejados', 'marcenaria', 'loja de moveis'],
    'casas lotéricas': ['casa loterica', 'loterica', 'loteria'],
    'cartórios': ['cartorio', 'registro civil', 'tabelionato', 'notas'],
    'despachantes': ['despachante', 'despachante veicular', 'detran'],
    'estacionamentos': ['estacionamento', 'garagem', 'parking', 'vaga'],
    'funerárias': ['funeraria', 'velorio', 'servicos funerarios', 'cemiterio', 'crematorio'],
    'casas de repouso': ['casa de repouso', 'casas de repouso', 'asilo', 'asilos', 'lar de idosos', 'lares de idosos', 'lar dos idosos', 'residencial senior', 'residencial sênior', 'residencial para idosos', 'residencial geriatrico', 'residencial geriátrico', 'clinica geriatrica', 'clínica geriátrica', 'clinica de repouso', 'clínica de repouso', 'instituicao de longa permanencia', 'instituição de longa permanência', 'ilpi', 'cuidados com idosos', 'cuidador de idosos empresa', 'lar geriatrico', 'lar geriátrico', 'casa de cuidados', 'casa de convivencia', 'casa de convivência', 'centro dia idoso', 'centro-dia para idosos', 'recanto dos idosos', 'recanto do idoso', 'pousada para idosos', 'hospedagem para idosos', 'lar terceira idade', 'casa terceira idade', 'cuidados especiais para idosos', 'home care para idosos', 'casa de retiro para idosos', 'residencia para idosos', 'residência para idosos', 'morada do idoso'],
    'creches e berçários': ['creche', 'bercario', 'educacao infantil', 'maternal'],
    'escolas particulares': ['escola particular', 'colegio particular', 'escola privada'],
    'faculdades e universidades': ['faculdade', 'universidade', 'centro universitario', 'instituicao de ensino superior'],
    'cursos técnicos e profissionalizantes': ['curso tecnico', 'profissionalizante', 'senai', 'senac'],
    'cursos preparatórios': ['curso preparatorio', 'cursinho', 'pre-vestibular'],
    'cursos profissionalizantes': ['profissionalizante', 'curso tecnico', 'qualificacao'],
    'agências de viagens': ['agencia de viagens', 'turismo', 'viagem', 'pacote turistico'],
    'casas de câmbio': ['casa de cambio', 'cambio', 'moeda estrangeira'],
    'financeiras e crédito': ['financeira', 'credito', 'emprestimo', 'consorcio'],
    'cooperativas de crédito': ['cooperativa de credito', 'sicoob', 'sicredi', 'unicred'],
    'seguradoras': ['seguradora', 'seguros', 'seguro'],
    'empresas de mudanças': ['mudanca', 'empresa de mudancas', 'frete', 'carreto'],
    'guardas-móveis': ['guarda moveis', 'self storage', 'armazenagem'],
    'empresas de reciclagem': ['reciclagem', 'recicladora', 'coleta seletiva', 'cooperativa de reciclagem'],
    'sucateiros': ['sucateiro', 'sucata', 'ferro velho'],
    'ferro-velhos': ['ferro velho', 'sucata', 'reciclagem de metais'],
    'empresas de elevadores': ['elevador', 'elevadores', 'escadas rolantes'],
    'empresas de impermeabilização': ['impermeabilizacao', 'impermeabilizante', 'manta asfaltica'],
    'empresas de desentupimento': ['desentupimento', 'desentupidora', 'limpa fossa'],
    'lojas de produtos de limpeza': ['produtos de limpeza', 'limpeza', 'material de limpeza'],

    // ===== CLÍNICAS ESPECIALIZADAS =====
    'clínicas de dermatologia': ['clinica de dermatologia', 'dermatologista', 'dermatologia'],
    'clínicas de oftalmologia': ['clinica de oftalmologia', 'oftalmologista', 'oculista'],
    'clínicas de cardiologia': ['clinica de cardiologia', 'cardiologista', 'cardiologia'],
    'clínicas de pediatria': ['clinica de pediatria', 'pediatra', 'pediatria'],
    'clínicas de ginecologia': ['clinica de ginecologia', 'ginecologista', 'ginecologia'],
    'clínicas de ortopedia': ['clinica de ortopedia', 'ortopedista', 'ortopedia'],
    'clínicas de neurologia': ['clinica de neurologia', 'neurologista', 'neurologia'],
    'clínicas de radiologia': ['clinica de radiologia', 'radiologia', 'raio-x', 'tomografia', 'ressonancia'],
    'clínicas de harmonização facial': ['harmonizacao facial', 'estetica facial', 'botox', 'preenchimento'],
    'clínicas de reprodução humana': ['reproducao humana', 'fertilidade', 'inseminacao', 'fertilizacao'],
    'clínicas de cirurgia plástica': ['cirurgia plastica', 'cirurgiao plastico', 'plastica'],
    'centros de reabilitação': ['centro de reabilitacao', 'reabilitacao', 'fisioterapia'],
    'centros de hemodiálise': ['hemodialise', 'dialise', 'nefrologia'],
    'centros de diagnóstico por imagem': ['diagnostico por imagem', 'ultrassom', 'tomografia', 'ressonancia magnetica'],
    'centros de medicina nuclear': ['medicina nuclear', 'cintilografia', 'pet scan'],
    'centros de radioterapia': ['radioterapia', 'oncologia', 'tratamento de cancer'],
    'centros médicos': ['centro medico', 'policlinica', 'clinica medica'],
    'dentistas e consultórios odontológicos': ['dentista', 'consultorio odontologico', 'odontologia'],
    'próteses dentárias': ['protese dentaria', 'laboratorio de protese', 'protese'],
    'distribuidoras de produtos odontológicos': ['produtos odontologicos', 'material odontologico', 'dental'],

    // ===== INDÚSTRIAS FALTANTES =====
    'indústrias de conservas': ['industria de conservas', 'indústria de conservas', 'fabrica de conservas', 'fábrica de conservas', 'conservas', 'fabricante de conservas', 'industria de palmito', 'indústria de palmito', 'fabrica de palmito', 'industria de picles', 'indústria de picles', 'fabrica de picles', 'industria de azeitonas', 'indústria de azeitonas', 'industria de pepino em conserva', 'industria de milho em conserva', 'industria de ervilha em conserva', 'industria de cogumelos em conserva', 'industria de pimentas em conserva', 'industria de alcaparras', 'industria de tomate seco', 'industria de tomate em conserva', 'industria de atum em conserva', 'industria de sardinha em conserva', 'industria de pescados em conserva', 'industria de carne em conserva', 'industria de doces em calda', 'industria de geleias', 'indústria de geléias', 'fabrica de geleias', 'industria de compotas', 'industria de frutas em calda', 'industria de molhos em conserva', 'industria de antepastos', 'industria de patê', 'industria de pate', 'envase de conservas', 'industria de vegetais em conserva', 'industria de pimentao em conserva', 'indústria de pimentão em conserva', 'fabrica de conservas vegetais', 'industria de palmito pupunha'],
    'indústrias de massas': ['industria de massas', 'indústria de massas', 'fabrica de massas', 'fábrica de massas', 'macarrao', 'macarrão', 'massas alimenticias', 'massas alimentícias', 'fabricante de macarrao', 'fabricante de macarrão', 'industria de macarrao', 'industria de macarrão', 'industria de massa fresca', 'industria de massa seca', 'fabrica de massa fresca', 'fabrica de lasanha', 'industria de lasanha', 'indústria de lasanha', 'industria de nhoque', 'indústria de nhoque', 'industria de ravioli', 'industria de capeletti', 'industria de talharim', 'industria de espaguete', 'industria de penne', 'industria de fettuccine', 'industria de massas frescas refrigeradas', 'industria de massa para pastel', 'industria de massa para pizza', 'industria de massas instantaneas', 'indústria de massas instantâneas', 'industria de macarrao instantaneo', 'fabrica de salgados massa', 'industria de pasteis', 'industria de yakisoba', 'industria de massa congelada', 'industria alimenticia massas', 'indústria alimentícia massas', 'massas pre-cozidas'],
    'indústrias de temperos e condimentos': ['industria de temperos', 'fabrica de temperos', 'condimentos'],
    'indústrias de molhos': ['industria de molhos', 'indústria de molhos', 'fabrica de molhos', 'fábrica de molhos', 'molhos', 'fabricante de molhos', 'industria de ketchup', 'indústria de ketchup', 'fabrica de ketchup', 'industria de maionese', 'indústria de maionese', 'fabrica de maionese', 'industria de mostarda', 'indústria de mostarda', 'fabrica de mostarda', 'industria de molho de tomate', 'industria de molho shoyu', 'indústria de molho shoyu', 'industria de molho ingles', 'industria de molho inglês', 'industria de molho barbecue', 'industria de molho de pimenta', 'industria de molho branco', 'industria de molho de salada', 'industria de molhos prontos', 'industria de molhos industriais', 'indústria de molhos industriais', 'fabricante de catchup', 'industria de pesto', 'indústria de pesto', 'industria de molho para macarrao', 'industria de molho para massa', 'industria de molho para churrasco', 'industria de molho de soja', 'industria de extrato de tomate', 'industria de polpa de tomate', 'industria de tempero liquido', 'industria de molho gourmet', 'industria de molho artesanal', 'envase de molhos', 'envasadora de molhos', 'industria food service molhos'],
    'indústrias de sorvetes': ['industria de sorvetes', 'fabrica de sorvetes', 'sorvete'],
    'indústrias de chocolates': ['industria de chocolates', 'indústria de chocolates', 'fabrica de chocolates', 'fábrica de chocolates', 'chocolate', 'chocolateria industrial', 'cacau', 'bombom', 'bombons', 'trufas', 'achocolatado', 'cobertura de chocolate', 'chocolate em barra', 'tabletes de chocolate', 'chocolate artesanal', 'confeitaria de chocolate', 'cacau em po', 'cacau em pó', 'nibs de cacau', 'manteiga de cacau', 'gotas de chocolate', 'industria de cacau', 'indústria de cacau', 'fabricante de chocolate', 'industria de bombons', 'indústria de bombons', 'industria de trufas', 'industria de pascoa', 'indústria de páscoa', 'ovos de pascoa', 'ovos de páscoa', 'industria de chocolate fino', 'industria de chocolate ao leite', 'industria de chocolate amargo', 'industria de chocolate branco', 'industria de cobertura fracionada', 'industria de wafer de chocolate', 'industria de barras de chocolate'],
    'indústrias de barrinhas de cereal': ['industria de barrinhas', 'fabrica de barrinhas', 'barrinhas de cereal', 'barra de cereal', 'barra de cereais', 'barras de cereal', 'barra proteica', 'barrinhas proteicas', 'barra energetica', 'barrinhas energeticas', 'snack saudavel', 'barra de frutas', 'barra de nuts', 'granola em barra', 'cereal em barra', 'fabrica de barras'],
    'indústrias de balas e guloseimas': ['industria de balas', 'indústria de balas', 'fabrica de balas', 'fábrica de balas', 'guloseimas', 'confeitos', 'industria de doces', 'indústria de doces', 'fabrica de doces', 'fábrica de doces', 'industria de chicletes', 'indústria de chicletes', 'fabrica de chicletes', 'industria de pirulito', 'indústria de pirulito', 'fabrica de pirulito', 'industria de jujuba', 'fabrica de jujuba', 'industria de caramelo', 'indústria de caramelo', 'fabrica de caramelo', 'industria de pao de mel', 'indústria de pão de mel', 'industria de marshmallow', 'indústria de marshmallow', 'fabrica de marshmallow', 'industria de gomas', 'fabrica de gomas', 'industria de balas duras', 'industria de balas mastigaveis', 'industria de doces finos', 'industria de paçoca', 'industria de pe de moleque', 'industria de pé de moleque', 'industria confeiteira', 'indústria confeiteira', 'fabricante de balas', 'fabricante de doces'],
    'indústrias de salgadinhos': ['industria de salgadinhos', 'indústria de salgadinhos', 'fabrica de salgadinhos', 'fábrica de salgadinhos', 'salgadinhos', 'fabricante de salgadinhos', 'industria de chips', 'indústria de chips', 'fabrica de chips', 'industria de batata frita', 'fabrica de batata frita', 'industria de snacks', 'indústria de snacks', 'fabrica de snacks', 'industria de salgadinhos extrusados', 'industria de salgadinhos de milho', 'industria de salgadinhos de batata', 'industria de pipocas industrializadas', 'fabrica de pipoca pronta', 'industria de salgados industriais', 'indústria de salgados industriais', 'industria de torradinhas', 'industria de petiscos industriais', 'industria de salgadinhos a base de farinha', 'industria de cheetos', 'industria de doritos', 'industria de fandangos', 'industria de aperitivos salgados', 'industria de salgadinhos de queijo', 'industria de salgadinhos saudaveis', 'industria de salgadinhos zero', 'industria de salgadinhos light', 'industria de salgadinhos de soja', 'industria de salgadinhos integrais', 'industria de salgadinho de bacon', 'industria de chips de mandioca', 'industria de chips de batata doce', 'industria de chips de banana', 'industria de salgadinhos para bar'],
    'indústrias de café': ['industria de cafe', 'indústria de café', 'fabrica de cafe', 'fábrica de café', 'torrefadora', 'torrefacao de cafe', 'torrefação de café', 'torrefadora de cafe', 'torrefadora de café', 'industria de cafe torrado', 'industria de cafe moido', 'industria de café moído', 'industria de cafe soluvel', 'indústria de café solúvel', 'fabricante de cafe', 'industria cafeeira', 'indústria cafeeira', 'envase de cafe', 'envase de café', 'beneficiamento de cafe', 'beneficiamento de café', 'industria de capsulas de cafe', 'indústria de cápsulas de café', 'fabrica de capsulas de cafe', 'industria de cafe expresso', 'industria de cafe gourmet', 'industria de cafe especial', 'industria de cafe verde', 'indústria de café verde', 'exportadora de cafe', 'industria de descafeinado', 'industria de blend de cafe', 'industria de cafe organico', 'indústria de café orgânico', 'cooperativa de cafe industria', 'industria de cafe arabica', 'indústria de café arábica', 'industria de cafe conilon', 'industria de cafe robusta'],
    'indústrias de sucos e polpas': ['industria de sucos', 'indústria de sucos', 'industria de polpas', 'indústria de polpas', 'fabrica de sucos', 'fábrica de sucos', 'fabrica de polpas', 'fábrica de polpas', 'industria de polpa de fruta', 'indústria de polpa de fruta', 'fabricante de sucos', 'fabricante de polpas', 'industria de sucos naturais', 'industria de sucos integrais', 'industria de sucos concentrados', 'industria de polpa congelada', 'industria de polpa de acai', 'indústria de polpa de açaí', 'industria de acai', 'indústria de açaí', 'industria de nectar', 'indústria de néctar', 'industria de refresco', 'industria de bebida de fruta', 'envasadora de sucos', 'envase de sucos', 'industria de polpa de cupuacu', 'industria de polpa de cupuaçu', 'industria de polpa de manga', 'industria de polpa de maracuja', 'indústria de polpa de maracujá', 'industria de polpa de morango', 'industria de polpa de abacaxi', 'industria de polpa de goiaba', 'industria de polpa de caja', 'fabrica de suco de uva', 'industria de suco prensado a frio', 'industria de sucos detox', 'industria de sucos engarrafados', 'industria de polpa industrial', 'industria de polpa congelada artesanal', 'envasadora de polpa de fruta'],
    'indústrias de água mineral': ['industria de agua mineral', 'indústria de água mineral', 'fabrica de agua mineral', 'fábrica de água mineral', 'engarrafadora de agua', 'engarrafadora de água', 'envase de agua mineral', 'envase de água mineral', 'industria de agua', 'indústria de água', 'fabricante de agua mineral', 'fabricante de água mineral', 'mina de agua', 'mina de água', 'fonte de agua mineral', 'fonte de água mineral', 'agua mineral natural', 'água mineral natural', 'agua gaseificada', 'água gaseificada', 'industria de bebidas nao alcoolicas', 'indústria de bebidas não alcoólicas', 'envasadora de agua', 'industria de garrafao 20l', 'indústria de garrafão 20l', 'fabrica de galao de agua', 'distribuidora industria agua', 'fonte mineral', 'agua de fonte', 'água de fonte', 'industria envasadora', 'industria de pet agua mineral', 'fabrica de pet agua mineral', 'agua de manancial', 'água de manancial', 'industria de agua alcalina', 'industria de agua com gas', 'industria de agua sem gas', 'envase de agua engarrafada'],
    'indústrias de refrigerantes': ['industria de refrigerantes', 'fabrica de refrigerantes'],
    'indústrias de cervejas': ['industria de cervejas', 'indústria de cervejas', 'fabrica de cervejas', 'fábrica de cervejas', 'cervejaria industrial', 'cervejaria', 'fabricante de cerveja', 'industria cervejeira', 'indústria cervejeira', 'cervejaria artesanal', 'fabrica de chopp', 'fábrica de chopp', 'industria de chopp', 'industria de cerveja artesanal', 'indústria de cerveja artesanal', 'micro cervejaria', 'microcervejaria', 'cervejaria craft', 'industria de cerveja sem alcool', 'indústria de cerveja sem álcool', 'industria de cerveja pilsen', 'industria de cerveja ipa', 'industria de cerveja stout', 'envasadora de cerveja', 'envase de cerveja', 'engarrafadora de cerveja', 'industria de cerveja em lata', 'industria de cerveja em garrafa', 'industria de cerveja em barril', 'fabrica de barris de cerveja', 'cervejaria de luxo', 'cervejaria de festival', 'industria de cerveja saborizada', 'industria de bebidas alcoolicas cerveja', 'indústria de bebidas alcoólicas cerveja', 'fabricante de chopp artesanal', 'industria de cerveja organica', 'indústria de cerveja orgânica', 'fabrica de extrato de malte'],
    'indústrias de cachaça': ['industria de cachaca', 'destilaria', 'alambique'],
    'indústrias de colchões': ['industria de colchoes', 'indústria de colchões', 'fabrica de colchoes', 'fábrica de colchões', 'colchao', 'colchão', 'colchoes', 'colchões', 'fabricante de colchoes', 'industria de espumas', 'indústria de espumas', 'industria de molas para colchao', 'indústria de molas para colchão', 'industria de colchao de mola', 'industria de colchao de espuma', 'industria de colchao de molejo', 'industria de colchao de latex', 'indústria de colchão de látex', 'industria de colchao king size', 'industria de colchao queen size', 'industria de colchao de casal', 'industria de colchao de solteiro', 'industria de colchao infantil', 'industria de colchao ortopedico', 'indústria de colchão ortopédico', 'industria de colchao para bebe', 'industria de travesseiros', 'industria de almofadas', 'industria de cama box', 'industria de bases para cama', 'industria de estrados', 'industria de molejo', 'industria de espuma poliuretano', 'industria de capas de colchao', 'indústria de capas de colchão', 'industria de protetores de colchao', 'industria de cama box bau', 'industria de colchoes hoteleiros', 'industria de colchoes premium', 'industria de espumas tecnicas'],
    'indústrias de estofados': ['industria de estofados', 'indústria de estofados', 'fabrica de estofados', 'fábrica de estofados', 'estofados', 'estofaria industrial', 'fabricante de estofados', 'industria de sofas', 'indústria de sofás', 'fabrica de sofas', 'fábrica de sofás', 'industria de poltronas', 'indústria de poltronas', 'fabrica de poltronas', 'industria de cadeiras estofadas', 'industria de moveis estofados', 'indústria de móveis estofados', 'industria de estofamento automotivo', 'industria de estofados sob medida', 'industria de espumas para estofados', 'industria de couro para estofados', 'indústria de couro para estofados', 'industria de tecidos para estofados', 'industria de bancos estofados', 'industria de cabeceiras estofadas', 'industria de chaises', 'indústria de chaises', 'industria de retratil', 'industria de sofa retratil', 'indústria de sofá retrátil', 'industria de recliner', 'industria de poltrona reclinavel', 'industria de estofados hoteleiros', 'industria de estofados corporativos', 'fabrica de estofados planejados', 'industria de capas para estofados', 'industria de mocho', 'industria de puffs'],
    'indústrias de tubos e conexões': ['industria de tubos e conexoes', 'indústria de tubos e conexões', 'fabrica de tubos', 'fábrica de tubos', 'fabrica de conexoes', 'fábrica de conexões', 'tubos e conexoes', 'tubos e conexões', 'fabricante de tubos', 'fabricante de conexoes', 'industria de tubos pvc', 'indústria de tubos pvc', 'industria de tubos de aco', 'indústria de tubos de aço', 'industria de tubos de cobre', 'industria de tubos hidraulicos', 'indústria de tubos hidráulicos', 'industria de tubos para gas', 'indústria de tubos para gás', 'industria de tubos para esgoto', 'industria de tubos de pead', 'fabrica de conexoes hidraulicas', 'industria de conexoes em ferro fundido', 'industria de tubos para irrigacao', 'indústria de tubos para irrigação', 'industria de tubos eletricos', 'indústria de tubos elétricos', 'industria de tubos sem costura', 'industria de tubos com costura', 'industria de tubos quadrados', 'industria de tubos retangulares', 'industria de tubos galvanizados', 'industria de tubos de polietileno', 'industria de tubos de polipropileno', 'industria de tubos schedule', 'industria de conexoes industriais', 'industria de tubos para construcao civil', 'industria de mangotes', 'fabrica de joelhos e tes', 'industria de tubos para mineracao'],
    'indústrias de pvc': ['industria de pvc', 'fabrica de pvc', 'perfis de pvc'],
    'indústrias de fibra de vidro': ['industria de fibra de vidro', 'fibra de vidro', 'fiberglass'],
    'indústrias de sacolas plásticas': ['industria de sacolas plasticas', 'indústria de sacolas plásticas', 'fabrica de sacolas plasticas', 'fábrica de sacolas plásticas', 'sacolas plasticas', 'sacolas plásticas', 'fabricante de sacolas', 'industria de sacolas', 'indústria de sacolas', 'industria de sacos plasticos', 'indústria de sacos plásticos', 'fabrica de sacos plasticos', 'industria de sacolas para mercado', 'industria de sacolas para supermercado', 'industria de sacolas para padaria', 'industria de sacolas para farmacia', 'industria de sacolas oxibiodegradaveis', 'industria de sacolas biodegradaveis', 'industria de sacolas reciclaveis', 'industria de sacos de lixo', 'industria de sacolas reutilizaveis', 'indústria de sacolas reutilizáveis', 'industria de sacolas personalizadas', 'industria de sacolas com alca camiseta', 'industria de sacolas alca vazada', 'industria de sacolas com solda lateral', 'industria de sacolas com fundo retangular', 'industria de sacos para congelados', 'industria de embalagens flexiveis sacola', 'industria de filme plastico sacolas', 'industria de polietileno sacolas', 'industria de sacolas de polipropileno', 'industria de sacolas de pead', 'industria de sacolas de pebd', 'industria de sacolas tnt', 'industria de ecobag', 'indústria de ecobag', 'fabricante de sacolas customizadas', 'industria de sacolas para delivery'],
    'indústrias de descartáveis plásticos': ['industria de descartaveis', 'descartaveis plasticos', 'copos plasticos'],
    'indústrias de brinquedos': ['industria de brinquedos', 'indústria de brinquedos', 'fabrica de brinquedos', 'fábrica de brinquedos', 'brinquedos', 'fabricante de brinquedos', 'industria de brinquedos plasticos', 'indústria de brinquedos plásticos', 'industria de brinquedos educativos', 'industria de bonecas', 'indústria de bonecas', 'industria de carrinhos de brinquedo', 'industria de pelucias', 'indústria de pelúcias', 'fabrica de pelucias', 'industria de jogos', 'indústria de jogos', 'industria de quebra-cabeca', 'indústria de quebra-cabeça', 'industria de brinquedos de madeira', 'industria de brinquedos pedagogicos', 'industria de brinquedos infantis', 'industria de brinquedos eletronicos', 'indústria de brinquedos eletrônicos', 'industria de brinquedos para bebe', 'industria de bichinhos de pelucia', 'industria de blocos de montar', 'industria de carrinhos eletricos', 'indústria de carrinhos elétricos', 'industria de bicicletas infantis', 'industria de patinetes', 'industria de triciclos', 'industria de balanços', 'industria de gangorras', 'industria de brinquedos de praca', 'indústria de brinquedos de praça', 'industria de brinquedos infantis em pvc', 'fabrica de bonecos colecionaveis'],
    'indústrias de joias': ['industria de joias', 'fabrica de joias', 'ourivesaria'],
    'indústrias de etiquetas e rótulos': ['industria de etiquetas', 'fabrica de etiquetas', 'rotulos'],
    'indústrias de caixas de papelão': ['industria de caixas de papelao', 'indústria de caixas de papelão', 'fabrica de caixas de papelao', 'fábrica de caixas de papelão', 'caixas de papelao', 'caixas de papelão', 'fabrica de papelao', 'fábrica de papelão', 'industria de papelao', 'indústria de papelão', 'fabricante de caixas', 'industria de embalagens de papelao', 'indústria de embalagens de papelão', 'fabricante de papelao ondulado', 'industria de papelao ondulado', 'indústria de papelão ondulado', 'industria de chapas de papelao', 'industria de caixas de transporte', 'industria de caixas para mudanca', 'industria de caixas para ecommerce', 'industria de caixas personalizadas', 'industria de embalagens corrugadas', 'industria de papelao corrugado', 'indústria de papelão corrugado', 'industria de caixas para frutas', 'industria de caixa exportacao', 'industria de caixas grandes', 'fabrica de embalagens de papel', 'industria de display de papelao', 'industria de berco de papelao', 'industria de divisorias de papelao', 'industria de bandeja de papelao', 'industria de caixas pesadas', 'industria de caixas leves', 'industria de papel kraft'],
    'indústrias de paletes': ['industria de paletes', 'fabrica de paletes', 'palete'],
    'indústrias de compensados': ['industria de compensados', 'fabrica de compensados', 'madeira compensada'],
    'indústrias de mdf e mdp': ['industria de mdf', 'fabrica de mdf', 'mdp', 'painel de madeira'],
    'indústrias de portas e janelas': ['industria de portas e janelas', 'indústria de portas e janelas', 'fabrica de portas', 'fábrica de portas', 'fabrica de janelas', 'fábrica de janelas', 'industria de portas', 'indústria de portas', 'industria de janelas', 'indústria de janelas', 'fabricante de portas', 'fabricante de janelas', 'industria de esquadrias', 'indústria de esquadrias', 'esquadrias de aluminio', 'esquadrias de alumínio', 'esquadrias de madeira', 'esquadrias de pvc', 'esquadrias de aco', 'esquadrias de aço', 'industria de portas de madeira', 'indústria de portas de madeira', 'industria de portas de aluminio', 'industria de portas de aço', 'industria de janelas de aluminio', 'industria de janelas de madeira', 'industria de janelas de pvc', 'industria de portas blindadas', 'indústria de portas blindadas', 'industria de portas corta fogo', 'industria de portas anti-ruido', 'industria de portas pivotantes', 'industria de porta camarao', 'indústria de porta camarão', 'industria de portas de correr', 'industria de janelas maxim ar', 'industria de portas residenciais', 'industria de portas comerciais', 'industria de janelas guilhotina', 'industria de janelas basculantes', 'industria de portas seccionadas', 'industria de portas industriais', 'industria de portoes industriais'],
    'indústrias de telhas': ['industria de telhas', 'fabrica de telhas', 'ceramica de telhado'],
    'indústrias de blocos e tijolos': ['industria de blocos', 'fabrica de tijolos', 'blocos de concreto', 'olaria'],
    'indústrias de argamassa': ['industria de argamassa', 'fabrica de argamassa'],
    'indústrias de impermeabilizantes': ['industria de impermeabilizantes', 'fabrica de impermeabilizantes'],
    'indústrias de baterias': ['industria de baterias', 'indústria de baterias', 'fabrica de baterias', 'fábrica de baterias', 'baterias automotivas', 'bateria automotiva', 'industria de bateria estacionaria', 'indústria de bateria estacionária', 'bateria estacionaria', 'bateria estacionária', 'industria de bateria de litio', 'indústria de bateria de lítio', 'bateria de litio', 'bateria de lítio', 'industria de pilhas', 'indústria de pilhas', 'fabricante de baterias', 'industria de bateria tracionaria', 'industria de bateria solar', 'bateria solar', 'bateria nobreak', 'bateria de nobreak', 'industria de bateria de chumbo acido', 'indústria de bateria de chumbo ácido', 'industria de baterias industriais', 'industria de bateria recarregavel', 'indústria de bateria recarregável', 'industria de bateria moto', 'industria de bateria caminhao', 'indústria de bateria caminhão', 'reciclagem de baterias industria', 'industria de bateria nautica', 'indústria de bateria náutica', 'bateria para empilhadeira', 'industria de bateria empilhadeira', 'industria de pilha alcalina', 'fabrica de pilhas', 'linha de baterias'],
    'indústrias de transformadores': ['industria de transformadores', 'fabrica de transformadores'],
    'indústrias de motores elétricos': ['industria de motores', 'fabrica de motores eletricos', 'motores'],
    'indústrias de geradores': ['industria de geradores', 'fabrica de geradores', 'grupo gerador'],
    'indústrias de painéis solares': ['industria de paineis solares', 'fabrica de paineis solares'],
    'indústrias de implementos agrícolas': ['industria de implementos', 'fabrica de implementos agricolas'],
    'indústrias de equipamentos hospitalares': ['industria de equipamentos hospitalares', 'fabrica de equipamentos medicos'],
    'indústrias de alumínio': ['industria de aluminio', 'indústria de alumínio', 'fabrica de aluminio', 'fábrica de alumínio', 'aluminio', 'alumínio', 'laminado de aluminio', 'laminado de alumínio', 'perfil de aluminio', 'perfil de alumínio', 'extrusao de aluminio', 'extrusão de alumínio', 'industria de extrusao de aluminio', 'indústria de extrusão de alumínio', 'fundicao de aluminio', 'fundição de alumínio', 'tarugo de aluminio', 'tarugo de alumínio', 'chapa de aluminio', 'chapa de alumínio', 'bobina de aluminio', 'bobina de alumínio', 'industria de esquadrias de aluminio', 'industria de embalagens de aluminio', 'industria de papel aluminio', 'fabricante de aluminio', 'fabricante de alumínio', 'aluminio industrial', 'alumínio industrial', 'industria metalurgica aluminio', 'indústria metalúrgica alumínio', 'industria de panelas de aluminio', 'industria de utensilios de aluminio', 'reciclagem de aluminio industria', 'industria de aluminio anodizado', 'industria de aluminio pintado', 'industria de tubo de aluminio', 'industria de barra de aluminio', 'industria de fio de aluminio', 'aluminio para construcao'],
    'indústrias de carrocerias': ['industria de carrocerias', 'fabrica de carrocerias', 'carroceria'],
    'indústrias de casas pré-fabricadas': ['fabrica de casas pre-fabricadas', 'fábrica de casas pré-fabricadas', 'industria de casas', 'indústria de casas', 'casa pre-fabricada', 'casa pré-fabricada', 'casas pre-fabricadas', 'casas pré-fabricadas', 'pre-fabricacao habitacional', 'pré-fabricação habitacional', 'fabricante de casas', 'industrializacao de casas', 'industrialização de casas', 'steel frame casas', 'wood frame casas', 'casa modular fabrica', 'casa modular fábrica', 'casa container industria', 'fabrica de modulos habitacionais', 'industria habitacional', 'indústria habitacional', 'casa de madeira pre-fabricada', 'casa de madeira pré-fabricada', 'casa popular pre-fabricada', 'kit casa', 'kit pre-fabricado', 'kit pré-fabricado', 'industrializacao construtiva', 'industrialização construtiva', 'planta de casas', 'industria de habitacoes', 'indústria de habitações'],
    'indústrias farmoquímicas': ['industria farmoquimica', 'indústria farmoquímica', 'farmoquimica', 'farmoquímica', 'insumo farmaceutico', 'insumo farmacêutico', 'insumos farmaceuticos', 'insumos farmacêuticos', 'principio ativo farmaceutico', 'princípio ativo farmacêutico', 'ifa', 'industria farmoquimica brasileira', 'fabricante de insumos farmaceuticos', 'fabricante de farmoquimicos', 'industria de farmoquimicos', 'sintese de farmoquimicos', 'síntese de farmoquímicos', 'fabricacao de medicamentos farmoquimica', 'industria quimica farmaceutica', 'indústria química farmacêutica', 'matéria prima farmacêutica', 'materia prima farmaceutica', 'industria de excipientes', 'fabrica de excipientes', 'industria de api', 'fabricante de api', 'farmoquimica nacional', 'farmoquímica nacional', 'farmoquimica veterinaria', 'farmoquímica veterinária', 'industria de quimicos para saude', 'farmoquimica industrial'],
    'agroindústrias de embutidos': ['agroindustria de embutidos', 'agroindústria de embutidos', 'industria de embutidos', 'indústria de embutidos', 'fabrica de embutidos', 'fábrica de embutidos', 'embutidos', 'fabricante de embutidos', 'industria de linguica', 'indústria de linguiça', 'fabrica de linguica', 'fábrica de linguiça', 'industria de salame', 'fabrica de salame', 'fábrica de salame', 'industria de salsicha', 'fabrica de salsicha', 'industria de presunto', 'fabrica de presunto', 'fábrica de presunto', 'industria de mortadela', 'fabrica de mortadela', 'industria de bacon', 'fabrica de bacon', 'agroindustria de carnes', 'agroindústria de carnes', 'frigorifico de embutidos', 'frigorífico de embutidos', 'embutidos artesanais', 'embutidos coloniais', 'embutidos defumados', 'industria de defumados', 'fabrica de copa', 'fábrica de copa', 'industria de calabresa'],
    'lojas de tapetes orientais': ['tapetes orientais', 'tapete oriental', 'loja de tapetes orientais', 'tapetes persas', 'tapete persa', 'tapetes turcos', 'tapete turco', 'tapeçaria oriental', 'tapecaria oriental', 'casa de tapetes orientais', 'tapetes importados', 'tapetes artesanais orientais', 'tapetes feitos a mao', 'tapetes feitos à mão', 'tapetes de seda', 'tapetes de la', 'tapetes de lã', 'galeria de tapetes orientais', 'comercio de tapetes orientais', 'comércio de tapetes orientais', 'tapetes kilim', 'tapetes shiraz', 'tapetes tabriz', 'tapetes esfahan', 'tapetes nain', 'restauracao de tapetes orientais', 'restauração de tapetes orientais', 'lavagem de tapetes orientais', 'avaliacao de tapetes orientais', 'avaliação de tapetes orientais', 'tapetes decorativos orientais', 'showroom de tapetes orientais'],
    'indústrias galvânicas': ['industria galvanica', 'galvanoplastia', 'zincagem', 'cromagem'],
    'indústrias madeireiras': ['industria madeireira', 'serraria', 'madeireira'],
    'indústrias moveleiras': ['industria moveleira', 'fabrica de moveis', 'movelaria'],
    'indústrias naval': ['industria naval', 'estaleiro', 'construcao naval'],
    'indústrias petroquímicas': ['industria petroquimica', 'petroquimica', 'refinaria'],

    // ===== EMPRESAS DIVERSAS FALTANTES =====
    'empresas de climatização': ['climatizacao', 'ar condicionado', 'hvac'],
    'empresas de refrigeração industrial': ['refrigeracao industrial', 'refrigeração industrial', 'empresa de refrigeracao industrial', 'empresa de refrigeração industrial', 'sistema de refrigeracao industrial', 'camara fria', 'câmara fria', 'camaras frias', 'câmaras frias', 'tunel de congelamento', 'túnel de congelamento', 'chiller industrial', 'rack de refrigeracao', 'rack de refrigeração', 'condensadora industrial', 'evaporadora industrial', 'manutencao de camara fria', 'manutenção de câmara fria', 'instalacao de camara fria', 'instalação de câmara fria', 'projeto de refrigeracao', 'projeto de refrigeração', 'engenharia de refrigeracao', 'climatizacao industrial', 'climatização industrial', 'sistema de amonia', 'sistema de amônia', 'refrigeracao por amonia', 'refrigeração por amônia', 'refrigeracao por co2', 'refrigeracao a glicol', 'sistemas frigorificos', 'sistemas frigoríficos', 'refrigeracao para frigorifico', 'refrigeracao para industria alimenticia', 'refrigeração para indústria alimentícia', 'refrigeracao para laboratorio', 'refrigeração para laboratório', 'refrigeracao para supermercado', 'manutencao de chiller', 'manutencao de compressor industrial', 'assistencia tecnica refrigeracao industrial', 'assistência técnica refrigeração industrial', 'expansao direta refrigeracao', 'sistemas de refrigeracao comercial pesada', 'condensador evaporativo'],
    'empresas de ventilação industrial': ['ventilacao industrial', 'ventilação industrial', 'exaustao industrial', 'exaustão industrial', 'sistema de exaustao', 'sistema de exaustão', 'exaustores industriais', 'ventiladores industriais', 'dutos industriais', 'duto galvanizado', 'exaustor centrifugo', 'exaustor centrífugo', 'coifa industrial', 'sistema de ar industrial', 'renovacao de ar', 'renovação de ar', 'climatizacao industrial', 'climatização industrial', 'ar comprimido', 'filtragem industrial', 'captacao de poeira', 'captação de poeira', 'despoeiramento', 'manga filtrante', 'soprador industrial', 'insuflamento', 'pressurizacao industrial', 'pressurização industrial', 'exaustao para galpao', 'exaustão para galpão', 'projeto de ventilacao', 'projeto de ventilação', 'engenharia de ventilacao', 'engenharia de ventilação', 'industria de exaustao'],
    'empresas de caldeiras e vapor': ['caldeiras', 'vapor', 'caldeira industrial'],
    'empresas de compressores': ['compressores', 'ar comprimido', 'compressor'],
    'empresas de bombas hidráulicas': ['bombas hidraulicas', 'bomba de agua', 'motobomba'],
    'empresas de saneamento': ['saneamento', 'tratamento de agua', 'esgoto'],
    'empresas de terraplanagem': ['terraplanagem', 'terraplenagem', 'movimento de terra'],
    'empresas de pavimentação': ['pavimentacao', 'asfalto', 'pavimento'],
    'concreteiras': ['concreteira', 'concreto', 'concreto usinado', 'usina de concreto'],
    'usinas de asfalto': ['usina de asfalto', 'asfalto', 'massa asfaltica'],
    'pedras e mármores': ['pedras', 'marmore', 'granito', 'marmoraria'],
    'granitos': ['granito', 'marmore', 'pedras ornamentais'],
    'empresas de esquadrias': ['esquadrias', 'janelas', 'portas', 'esquadria de aluminio'],
    'centros de distribuição': ['centro de distribuicao', 'cd', 'armazenagem', 'logistica'],
    'centros automotivos': ['centro automotivo', 'auto center', 'oficina', 'mecanica'],
    'funilarias': ['funilaria', 'lanternagem', 'pintura automotiva', 'chapeacao'],

    // ===== BELEZA FALTANTES =====
    'esmaltarias': ['esmaltaria', 'nail bar', 'unhas', 'manicure'],
    'cabeleireiros infantis': ['cabeleireiro infantil', 'salao infantil'],
    'espaços de beleza': ['espaco de beleza', 'beauty center', 'centro de beleza'],
    'studios de maquiagem': ['studio de maquiagem', 'maquiadora', 'maquiagem'],

    // ===== HOSPEDAGEM FALTANTES =====
    'apart-hotéis': ['apart hotel', 'flat', 'residence'],
    'bed and breakfast': ['bed and breakfast', 'b&b', 'pousada'],
    'camping e glamping': ['camping', 'glamping', 'acampamento'],
    'chalés e cabanas': ['chale', 'cabana', 'chalé'],
    'hostels': ['hostel', 'albergue'],
    'hotéis fazenda': ['hotel fazenda', 'fazenda hotel', 'turismo rural'],
    'motéis': ['motel'],
    'resorts': ['resort', 'resort all inclusive'],

    // ===== ESPORTE E LAZER FALTANTES =====
    'estúdios de pilates': ['estudio de pilates', 'pilates', 'studio pilates'],
    'estúdios de yoga': ['estudio de yoga', 'yoga', 'ioga'],
    'arenas de futebol society': ['futebol society', 'society', 'quadra de futebol'],
    'quadras de padel': ['padel', 'quadra de padel'],
    'quadras poliesportivas': ['quadra poliesportiva', 'ginasio', 'centro esportivo'],
    'baladas e casas noturnas': ['balada', 'casa noturna', 'boate', 'nightclub'],
    'casas de show': ['casa de show', 'casa de espetaculos'],
    'cinemas': ['cinema', 'multiplex', 'sala de cinema'],
    'parques aquáticos': ['parque aquatico', 'toboagua', 'piscinas'],
    'parques de diversões': ['parque de diversoes', 'parque tematico'],
    'pesque e pague': ['pesque e pague', 'pesqueiro', 'pesca'],
    'bowling': ['bowling', 'boliche'],
    'karting': ['karting', 'kart', 'kartódromo'],
    'escape rooms': ['escape room', 'sala de fuga'],

    // ===== AGRO FALTANTES =====
    'aviários': ['aviario', 'avicultura', 'granja de aves'],
    'beneficiadoras de arroz': ['beneficiadora de arroz', 'engenho de arroz', 'beneficiamento de arroz'],
    'beneficiadoras de café': ['beneficiadora de cafe', 'beneficiamento de cafe'],

    // ===== DISTRIBUIDORAS FALTANTES =====
    'distribuidoras de alimentos orgânicos': ['distribuidora de organicos', 'organicos atacado', 'alimentos organicos'],
    'distribuidoras de alimentos sem glúten': ['distribuidora sem gluten', 'sem gluten', 'alimentos sem gluten'],
    'distribuidoras de carnes nobres': ['distribuidora de carnes nobres', 'carnes premium', 'carnes importadas'],
    'distribuidoras de frango': ['distribuidora de frango', 'frango atacado', 'avicola'],
    'distribuidoras de frutas tropicais': ['distribuidora de frutas', 'frutas tropicais', 'frutas atacado'],
    'distribuidoras de hortifrúti': ['distribuidora de hortifruti', 'hortifruti atacado', 'ceasa'],
    'distribuidoras de ingredientes para panificação': ['ingredientes para panificacao', 'insumos para padaria', 'farinha atacado'],
    'distribuidoras de ingredientes para sorvete': ['ingredientes para sorvete', 'insumos para sorvete'],
    'distribuidoras de insumos para restaurantes': ['insumos para restaurantes', 'atacado restaurante', 'food service'],
    'distribuidoras de produtos para confeitaria': ['produtos para confeitaria', 'insumos confeitaria'],
    'distribuidoras de suínos': ['distribuidora de suinos', 'suinos atacado', 'porco'],
    'distribuidoras de ração animal': ['distribuidora de racao', 'racao atacado', 'racao animal'],
    'distribuidoras de adubo': ['distribuidora de adubo', 'fertilizante', 'adubo atacado'],
    'distribuidoras de eletrônicos': ['distribuidora de eletronicos', 'eletronicos atacado'],

    // ===== FORNECEDORES FALTANTES =====
    'fornecedores de descartáveis para food service': ['descartaveis food service', 'embalagens descartaveis', 'descartaveis restaurante'],
    'fornecedores de embalagens para food service': ['embalagens food service', 'embalagens para restaurante'],
    'fornecedores de equipamentos para cozinha': ['equipamentos para cozinha', 'cozinha industrial', 'equipamento gastronomico'],
    'fornecedores de equipamentos para panificação': ['equipamentos para panificacao', 'forno industrial', 'maquinas para padaria'],

    // ===== AUTOMOTIVO FALTANTES =====
    'retíficas de motores': ['retifica de motores', 'retifica', 'motor retificado'],
    'autovidros': ['autovidros', 'vidro automotivo', 'para-brisa'],
    'empresas de estética automotiva': ['estetica automotiva', 'polimento', 'detailing'],
    'empresas de instalação de gnv': ['gnv', 'gas natural veicular', 'kit gnv'],
    'oficinas especializadas em motos': ['oficina de motos', 'mecanica de motos', 'motocicletas'],
    'oficinas especializadas em caminhões': ['oficina de caminhoes', 'mecanica de caminhoes', 'caminhao'],
    'lojas de baterias automotivas': ['baterias automotivas', 'bateria de carro', 'bateria'],
    'lojas de escapamentos': ['escapamentos', 'escapamento', 'catalisador'],
    'lojas de amortecedores': ['amortecedores', 'suspensao', 'molas'],

    // ===== MÍDIA E PRODUÇÃO =====
    'estúdios de fotografia': ['estudio de fotografia', 'fotografia', 'fotografo'],
    'produtoras de vídeo': ['produtora de video', 'video', 'filmagem', 'audiovisual'],
    'estúdios de gravação': ['estudio de gravacao', 'gravacao', 'musica'],

    // ===== ARTESANATO E LOJAS ESPECIAIS =====
    'lojas de artesanato': ['artesanato', 'artesanal', 'loja de artesanato'],
    'antiquários': ['antiquario', 'antiguidades', 'moveis antigos'],
    'brechós': ['brecho', 'roupa usada', 'segunda mao'],
    'lojas de instrumentos musicais': ['instrumentos musicais', 'loja de musica', 'violao', 'guitarra'],
    'lojas de artigos religiosos': ['artigos religiosos', 'loja religiosa', 'imagenes sacras'],
    'lojas de produtos orgânicos': ['produtos organicos', 'organicos', 'natural'],
    'lojas de relógios': ['relogios', 'relojoaria', 'conserto de relogios'],
    'lojas de lingerie': ['lingerie', 'moda intima', 'roupa intima'],
    'lojas de louças e porcelanas': ['loucas', 'porcelanas', 'cristais'],
    'lojas de materiais hidráulicos': ['materiais hidraulicos', 'tubos e conexoes', 'encanamento'],
    'lojas de placas solares': ['placas solares', 'painel solar', 'energia solar'],
    'lojas de sementes': ['sementes', 'mudas', 'loja de sementes'],
    'lojas de equipamentos agrícolas': ['equipamentos agricolas', 'maquinas agricolas', 'implementos'],
    'adegas e distribuidoras de vinhos': ['adega', 'distribuidora de vinhos', 'wine', 'importadora de vinhos'],
    'lojas de aquarismo': ['aquarismo', 'aquario', 'peixes ornamentais'],
    'lojas de câmeras de vigilância': ['cameras de vigilancia', 'cftv', 'monitoramento'],

    // ===== CONSTRUÇÃO FALTANTES =====
    'construtoras de casas de madeira': ['casa de madeira', 'casas de madeira', 'construtora de casa de madeira', 'obra em madeira', 'wood frame', 'casa em wood frame', 'clt cross laminated timber', 'clt', 'madeira engenheirada', 'madeira macica', 'madeira maciça', 'log home', 'casa de log', 'chale de madeira', 'chalé de madeira', 'bangalo de madeira', 'bangalô de madeira', 'casa pre-fabricada de madeira', 'casa pré-fabricada de madeira', 'fabrica de casas de madeira', 'fábrica de casas de madeira', 'arquitetura em madeira', 'engenharia em madeira', 'sistema construtivo madeira', 'estrutura de madeira', 'painel de madeira', 'painel osb', 'tijolo ecologico de madeira', 'casa rustica', 'casa rústica', 'casa de campo', 'casa de praia em madeira', 'industrializado em madeira', 'obra a seco em madeira', 'casa modular de madeira', 'casa container e madeira'],
    'construtoras de casas em container': ['casa container', 'casa em container', 'container habitacional', 'construtora container', 'arquitetura container', 'casa de container', 'obra container', 'escritorio container', 'escritório container', 'modulo container', 'módulo container', 'container residencial', 'container comercial', 'container habitacao', 'container habitação', 'reforma de container', 'container customizado', 'container adaptado', 'container maritimo', 'container marítimo', 'projeto container', 'engenharia container', 'steel frame e container', 'offgrid container', 'pousada container', 'hotel container', 'kit container', 'container pronto', 'fabrica de containers', 'casa pre-fabricada container'],
    'construtoras de casas modulares': ['casa modular', 'casas modulares', 'construtora modular', 'obra modular', 'sistema modular', 'modulo habitacional', 'módulo habitacional', 'construcao modular', 'construção modular', 'arquitetura modular', 'engenharia modular', 'casa em modulos', 'casa em módulos', 'modulos pre-fabricados', 'módulos pré-fabricados', 'casa container', 'steel frame modular', 'wood frame modular', 'fabrica de casas modulares', 'fábrica de casas modulares', 'industrializacao modular', 'industrialização modular', 'projeto modular', 'casa pronta modular', 'expansao modular', 'expansão modular', 'habitacao modular', 'habitação modular', 'construtora industrializada', 'modular building'],
    'construtoras de casas pré-fabricadas': ['casa pre-fabricada', 'casa pré-fabricada', 'casas pre-fabricadas', 'casas pré-fabricadas', 'pre-fabricado', 'pré-fabricado', 'casa modular', 'casas modulares', 'construtora pre-fabricada', 'construtora pré-fabricada', 'fabrica de casas', 'fábrica de casas', 'casa industrializada', 'casas industrializadas', 'sistema construtivo pre-fabricado', 'casa pronta', 'casa de madeira pre-fabricada', 'casa container pre-fabricada', 'steel frame pre-fabricado', 'wood frame pre-fabricado', 'casa modular pre-fabricada', 'obra pre-fabricada', 'engenharia pre-fabricada', 'casa rapida', 'casa rápida', 'construcao pre-fabricada', 'construção pré-fabricada', 'industrializacao habitacional', 'industrialização habitacional'],
    'construtoras de estruturas de aço': ['estrutura de aco', 'estrutura de aço', 'estruturas metalicas', 'estruturas metálicas', 'galpao em aco', 'galpão em aço', 'construtora de galpoes', 'construtora de galpões', 'aço estrutural', 'aco estrutural', 'engenharia metalica', 'engenharia metálica', 'obra em estrutura metalica', 'obra em estrutura metálica', 'telhado metalico', 'telhado metálico', 'mezanino metalico', 'mezanino metálico', 'perfis metalicos', 'perfis metálicos', 'steel deck', 'tesoura metalica', 'cobertura metalica', 'cobertura metálica', 'fabricante de estruturas', 'montagem de estruturas', 'serralheria industrial', 'caldeiraria', 'ponte rolante', 'aco galvanizado', 'aço galvanizado'],
    'construtoras de obras industriais': ['construtora industrial', 'obras industriais', 'construcao industrial', 'construção industrial', 'galpao industrial', 'galpão industrial', 'fabrica industrial', 'fábrica industrial', 'planta industrial', 'engenharia industrial', 'obra industrial', 'construtora de galpoes', 'construtora de galpões', 'instalacoes industriais', 'instalações industriais', 'montagem industrial', 'obra civil industrial', 'engenharia e montagem', 'construtora de plantas', 'planta fabril', 'edificacao industrial', 'edificação industrial', 'obras pesadas', 'infraestrutura industrial', 'engenharia de obras', 'estrutura industrial', 'retrofit industrial'],
    'empresas de divisórias e forros': ['divisorias', 'forro', 'divisoria de vidro'],
    'empresas de reformas residenciais': ['reforma residencial', 'reforma', 'reforma de apartamento'],
    'empresas de decoração de interiores': ['decoracao de interiores', 'design de interiores', 'decoracao'],

    // ===== TRANSPORTE FALTANTES =====
    'empresas de transporte refrigerado': ['transporte refrigerado', 'caminhao frigorifico', 'transporte de congelados'],
    'empresas de transporte de valores': ['transporte de valores', 'carro forte', 'escolta'],
    'empresas de courier': ['courier', 'entrega expressa', 'servico de entregas'],
    'empresas de entrega expressa': ['entrega expressa', 'courier', 'same day delivery'],
    'empresas de transporte escolar': ['transporte escolar', 'van escolar'],

    // ===== ESCOLAS FALTANTES =====
    'escolas bilíngues': ['escola bilingue', 'educacao bilingue', 'escola internacional'],
    'escolas de ballet': ['escola de ballet', 'ballet', 'danca classica'],
    'escolas de dança de salão': ['escola de danca', 'danca de salao', 'forro'],
    'escolas de teatro': ['escola de teatro', 'teatro', 'artes cenicas'],
    'escolas técnicas': ['escola tecnica', 'ensino tecnico', 'etec'],
    'centros de educação infantil': ['educacao infantil', 'cei', 'creche'],

    // ===== FINANCEIRO =====
    'fintechs': ['fintech', 'tecnologia financeira', 'pagamento digital'],

    // ===== EVENTOS FALTANTES =====
    'cerimonialistas': ['cerimonialista', 'cerimonial', 'organizacao de casamentos'],
    'decoradores de eventos': ['decorador de eventos', 'decoracao de eventos', 'cenografia'],
    'salões de festas': ['salao de festas', 'espaco para festas', 'eventos'],
    'organizadores de feiras': ['organizador de feiras', 'feira de negocios', 'exposicao'],
    'organizadores de congressos': ['organizador de congressos', 'congresso', 'convencao'],

    // ===== ALIMENTAÇÃO GOURMET FALTANTES =====
    'bistrôs': ['bistro', 'bistrô', 'restaurante intimista'],
    'dark kitchens': ['dark kitchen', 'cozinha fantasma', 'cloud kitchen', 'ghost kitchen'],
    'casas de chá': ['casa de cha', 'cha', 'tea house'],
    'cafés especiais': ['cafe especial', 'cafe gourmet', 'specialty coffee'],
    'casas de caldos': ['casa de caldos', 'caldos', 'sopas'],
    'churrerias': ['churreria', 'churros'],
    'milkshakerias': ['milkshakeria', 'milkshake'],
    'bruncherias': ['bruncheria', 'brunch'],
    'bombonieres finas': ['bomboniere', 'bombons finos', 'chocolates finos'],
    'restaurantes de alta gastronomia': ['alta gastronomia', 'fine dining', 'gastronomia'],
    'restaurantes mediterrâneos': ['restaurante mediterraneo', 'comida mediterranea'],
    'restaurantes de comida libanesa': ['comida libanesa', 'restaurante libanes', 'culinaria arabe'],
    'restaurantes de comida turca': ['comida turca', 'restaurante turco', 'kebab'],
    'restaurantes de comida grega': ['comida grega', 'restaurante grego', 'gyros'],
    'restaurantes de comida vietnamita': ['comida vietnamita', 'restaurante vietnamita', 'pho'],
    'restaurantes farm to table': ['farm to table', 'fazenda a mesa', 'organico'],
    'empórios de azeite': ['emporio de azeite', 'azeite', 'azeite importado'],
    'lojas de especiarias': ['especiarias', 'temperos', 'condimentos importados'],
    'lojas de chás importados': ['chas importados', 'loja de cha', 'tea shop'],
    'lojas de chocolates belgas': ['chocolates belgas', 'chocolates importados', 'chocolate premium'],
    'importadoras de vinhos': ['importadora de vinhos', 'vinhos importados', 'wine importer'],
    'fábricas de cerveja artesanal': ['cerveja artesanal', 'microcervejaria', 'brewpub'],
    'fábricas de gelo': ['fabrica de gelo', 'gelo', 'gelo industrial'],
    'fábricas de pão de queijo': ['fabrica de pao de queijo', 'pao de queijo'],
    'fábricas de polpas': ['fabrica de polpas', 'polpa de fruta', 'polpas'],
    'fábricas de salgados congelados': ['fabrica de salgados', 'salgados congelados', 'salgados'],
    'fábricas de tortas': ['fabrica de tortas', 'tortas', 'bolos'],
    'pubs': ['pub', 'bar', 'cervejaria'],

    // ===== MODA FALTANTES =====
    'ateliês de noiva': ['atelie de noiva', 'vestido de noiva', 'noiva'],
    'ateliês de alta costura': ['alta costura', 'haute couture', 'sob medida'],
    'lojas de moda fitness premium': ['moda fitness', 'roupa fitness', 'sportswear'],
    'lojas de moda streetwear': ['streetwear', 'moda urbana', 'street fashion'],

    // ===== SERVIÇOS PROFISSIONAIS FALTANTES =====
    'empresas de telemarketing': ['telemarketing', 'call center', 'contact center'],
    'empresas de representação comercial': ['representacao comercial', 'representante comercial', 'rep comercial'],
    'empresas de pesquisa de mercado': ['pesquisa de mercado', 'instituto de pesquisa', 'market research'],
    'empresas de compliance': ['compliance', 'conformidade', 'governanca'],
    'empresas de assessoria de imprensa': ['assessoria de imprensa', 'relacoes publicas', 'comunicacao'],

    // ===== VET FALTANTES =====
    'clínicas veterinárias de grandes animais': ['veterinario de grandes animais', 'veterinario rural', 'veterinaria equina'],
    'farmácias veterinárias': ['farmacia veterinaria', 'produtos veterinarios', 'medicamento animal'],
    'hospitais veterinários': ['hospital veterinario', 'emergencia animal', 'uti animal'],
    'laboratórios veterinários': ['laboratorio veterinario', 'exames veterinarios'],

    // ===== SEGURANÇA FALTANTES =====
    'empresas de segurança eletrônica': ['seguranca eletronica', 'alarme', 'cerca eletrica'],
    'empresas de vigilância': ['vigilancia', 'vigiar', 'seguranca patrimonial'],
    'empresas de blindagem automotiva': ['blindagem', 'blindagem automotiva', 'blindado'],

    // ===== LABS FALTANTES =====
    'laboratórios de análises clínicas': ['laboratorio de analises', 'analises clinicas', 'exames'],
    'laboratórios de manipulação': ['laboratorio de manipulacao', 'manipulacao farmaceutica'],

    // ===== CENTRAL CEASA =====
    'central de abastecimento (ceasa)': ['ceasa', 'central de abastecimento', 'hortifruti atacado'],

    // ===== CATEGORIAS COMPLEMENTARES =====
    'choperias': ['choperia', 'chopp', 'chope', 'bar de chopp'],
    'distribuidoras de frios': ['distribuidora de frios', 'frios e embutidos', 'frios atacado', 'atacadista de frios'],
    'distribuidoras de laticínios': ['distribuidora de laticinios', 'laticinios atacado', 'atacadista de laticinios'],
    'distribuidoras de pescados': ['distribuidora de pescados', 'pescado atacado', 'frutos do mar atacado', 'peixe atacado'],
    'distribuidoras de chocolates': ['distribuidora de chocolates', 'chocolates atacado', 'chocolate atacado'],
    'distribuidoras de cosméticos': ['distribuidora de cosmeticos', 'cosmeticos atacado', 'atacadista de cosmeticos'],
    'distribuidoras de perfumes': ['distribuidora de perfumes', 'perfumes atacado', 'atacadista de perfumes'],
    'distribuidoras de higiene e limpeza': ['distribuidora de higiene', 'limpeza atacado', 'produtos de limpeza atacado', 'higiene e limpeza'],
    'distribuidoras de material de construção': ['distribuidora de material de construcao', 'distribuidora de material de construção', 'atacado de material de construcao', 'atacado de material de construção', 'atacadista de construcao', 'atacadista de construção', 'distribuidor de cimento', 'distribuidor de tijolo', 'distribuidor de aco', 'distribuidor de aço', 'distribuidor de ferro', 'distribuidor de telhas', 'distribuidor de tintas', 'distribuidor de hidraulica', 'distribuidor de hidráulica', 'distribuidor de eletrica', 'distribuidor de elétrica', 'distribuidor de pisos', 'distribuidor de revestimentos', 'distribuidor de ferragens', 'distribuidor de areia', 'distribuidor de brita', 'distribuidor de cal', 'distribuidor de argamassa', 'distribuidor de gesso', 'distribuidor de drywall', 'distribuidor de madeiras', 'distribuidor de cimento e cal', 'home center atacado', 'distribuidor de acabamentos', 'atacado de ferragens', 'depósito atacadista de construção'],
    'distribuidoras de ferragens': ['distribuidora de ferragens', 'ferragens atacado', 'parafusos atacado'],
    'distribuidoras de combustíveis': ['distribuidora de combustiveis', 'combustiveis', 'posto de combustivel', 'gasolina atacado'],
    'distribuidoras de epi': ['distribuidora de epi', 'epi atacado', 'equipamento de protecao atacado'],
    'distribuidoras de material de escritório': ['distribuidora de material de escritorio', 'papelaria atacado', 'material de escritorio'],
    'distribuidoras de equipamentos médicos': ['distribuidora de equipamentos medicos', 'distribuidora de equipamentos médicos', 'distribuidor de equipamentos medicos', 'distribuidor de equipamentos médicos', 'distribuidora de equipamentos hospitalares', 'distribuidor de equipamentos hospitalares', 'distribuidora de produtos hospitalares', 'distribuidora produtos hospitalares', 'distribuidor de produtos hospitalares', 'distribuidora de material hospitalar', 'distribuidor de material hospitalar', 'distribuidora de materiais hospitalares', 'distribuidora de instrumental medico', 'distribuidora de instrumental cirurgico', 'distribuidora de instrumental hospitalar', 'distribuidora de mobiliario hospitalar', 'distribuidora de autoclaves', 'distribuidora de aparelhos medicos', 'distribuidora de aparelhos hospitalares', 'distribuidora de equipamentos odontologicos', 'distribuidor de equipamentos odontologicos', 'distribuidora de equipamentos para fisioterapia', 'distribuidora de equipamentos de diagnostico', 'distribuidora de equipamentos para uti', 'fornecedor de equipamentos medicos', 'fornecedor de equipamentos médicos', 'fornecedor de equipamentos hospitalares', 'fornecedora de produtos hospitalares', 'comercio de equipamentos medicos', 'comércio de equipamentos médicos', 'comercio de equipamentos hospitalares', 'comercio de produtos hospitalares', 'comercio de material hospitalar', 'comercio atacadista de equipamentos medicos', 'comercio atacadista de produtos hospitalares', 'comercio atacadista hospitalar', 'atacadista de produtos hospitalares', 'atacado de equipamentos medicos', 'atacado hospitalar', 'representante de equipamentos hospitalares', 'representante de equipamentos medicos', 'representacao de produtos hospitalares', 'importadora de equipamentos medicos', 'importadora de produtos hospitalares'],
    'distribuidoras de utilidades domésticas': ['distribuidora de utilidades domesticas', 'utilidades domesticas atacado', 'utensilios atacado'],
    'distribuidoras de madeiras': ['distribuidora de madeiras', 'madeireira', 'madeira atacado', 'deposito de madeira'],
    'distribuidoras de material elétrico': ['distribuidora de material eletrico', 'material eletrico atacado', 'eletrica atacado'],
    'distribuidoras de papel': ['distribuidora de papel', 'papel atacado', 'papelao atacado'],
    'empresas de manutenção industrial': ['manutencao industrial', 'manutencao de maquinas', 'manutencao preventiva', 'manutencao corretiva'],
    // ===== TOP 50 EXPANSÕES (categorias mais buscadas) =====
    'construtoras de steel frame': ['steel frame', 'construtora steel frame', 'obra steel frame', 'casa em steel frame', 'sistema steel frame', 'light steel frame', 'lsf', 'construcao a seco', 'construção a seco', 'engenharia steel frame', 'estrutura steel frame', 'perfis steel frame', 'painel osb', 'placa cimenticia', 'placa cimentícia', 'galpao steel frame', 'aço galvanizado', 'aco galvanizado', 'obra a seco', 'sobrado steel frame', 'frame metálico', 'frame metalico', 'industrializado', 'sistema construtivo a seco', 'steel deck', 'wood frame', 'construtora industrializada'],
    'empresas de construção a seco': ['construcao a seco', 'construção a seco', 'obra a seco', 'sistema a seco', 'steel frame', 'wood frame', 'drywall', 'gesso acartonado', 'light steel frame', 'lsf', 'painel osb', 'placa cimenticia', 'placa cimentícia', 'divisorias drywall', 'divisórias drywall', 'forro de gesso', 'forro drywall', 'paredes drywall', 'industrializado', 'engenharia a seco', 'arquitetura a seco', 'sistema construtivo a seco', 'montagem a seco', 'frame metalico', 'frame metálico', 'isolamento termoacustico', 'isolamento termoacústico', 'reforma a seco', 'obra rapida', 'obra rápida'],
    'empresas de construção modular': ['construcao modular', 'construção modular', 'sistema modular', 'modulo habitacional', 'módulo habitacional', 'casa modular', 'obra modular', 'engenharia modular', 'arquitetura modular', 'prefabricado modular', 'pré-fabricado modular', 'modulos pre-fabricados', 'módulos pré-fabricados', 'container modular', 'casa container', 'escritorio modular', 'escritório modular', 'banheiro modular', 'quartos modulares', 'industrializacao modular', 'industrialização modular', 'offsite construction', 'construcao industrializada', 'construção industrializada', 'projeto modular', 'modular building', 'sistema construtivo modular', 'obra rapida', 'obra rápida', 'expansao modular'],
    'construtoras de edifícios comerciais': ['edificio comercial', 'edifício comercial', 'predio comercial', 'prédio comercial', 'construtora comercial', 'obra comercial', 'sala comercial', 'torre comercial', 'centro empresarial', 'edificios corporativos', 'edifícios corporativos', 'escritorios', 'escritórios', 'retrofit comercial', 'incorporadora comercial', 'engenharia comercial', 'obra corporativa', 'torre de escritorios', 'torre de escritórios', 'build to suit', 'bts', 'centro empresarial corporativo', 'laje corporativa', 'predio de escritorios', 'prédio de escritórios', 'obra civil comercial', 'edificio multiuso', 'edifício multiuso', 'empreendimento comercial', 'construcao comercial', 'construção comercial'],
    'construtoras de wood frame': ['wood frame', 'construtora wood frame', 'obra wood frame', 'casa em wood frame', 'casa de madeira', 'estrutura de madeira', 'sistema wood frame', 'engenharia wood frame', 'madeira engenheirada', 'clt cross laminated timber', 'clt', 'painel de madeira', 'frame de madeira', 'construcao em madeira', 'construção em madeira', 'steel e wood frame', 'industrializado em madeira', 'arquitetura wood frame', 'casa pre-fabricada em madeira', 'casa pré-fabricada em madeira', 'wood building', 'madeira estrutural', 'osb wood frame', 'painel osb', 'isolamento termoacustico', 'isolamento termoacústico', 'sistema construtivo em madeira', 'madeireira estrutural', 'obra a seco em madeira', 'wood frame brasil'],
    'empresas de contech (construção tech)': ['contech', 'construtech', 'construcao tech', 'construção tech', 'tecnologia para construcao', 'tecnologia para construção', 'software para construcao', 'software para construção', 'bim', 'modelagem bim', 'plataforma bim', 'startup construcao', 'startup construção', 'proptech', 'gestao de obras', 'gestão de obras', 'erp construcao', 'erp construção', 'automatizacao da obra', 'automatização da obra', 'digitalizacao da construcao', 'digitalização da construção', 'plataforma de obras', 'app para construcao', 'app para construção', 'iot construcao', 'iot construção', 'drone para obras', 'impressao 3d construcao', 'impressão 3d construção', 'realidade aumentada construcao', 'industria 4.0 construcao', 'indústria 4.0 construção', 'industrializacao da construcao'],
    'construtoras de pontes e viadutos': ['construtora de pontes', 'construtora de viadutos', 'ponte', 'viaduto', 'obra de arte especial', 'oae', 'engenharia de pontes', 'obras de infraestrutura', 'passarela', 'ponte rodoviaria', 'ponte rodoviária', 'ponte ferroviaria', 'ponte ferroviária', 'viaduto urbano', 'obra rodoviaria', 'obra rodoviária', 'infraestrutura viaria', 'infraestrutura viária', 'engenharia rodoviaria', 'engenharia rodoviária', 'engenharia ferroviaria', 'engenharia ferroviária', 'construcao pesada', 'construção pesada', 'obras pesadas', 'dnit obras', 'passagem inferior', 'passagem superior', 'estrutura de concreto protendido', 'obra de transposicao', 'obra de transposição', 'engenharia de transportes', 'tuneis e pontes'],
    'construtoras de habitação popular': ['habitacao popular', 'habitação popular', 'minha casa minha vida', 'mcmv', 'casa popular', 'casas populares', 'construtora habitacional', 'obra habitacional', 'empreendimento habitacional', 'conjunto habitacional', 'condominio popular', 'condomínio popular', 'programa habitacional', 'habitacao social', 'habitação social', 'casa verde e amarela', 'obra de interesse social', 'his', 'hmp', 'engenharia habitacional', 'incorporadora popular', 'obras populares', 'construtora cef', 'obra com cef', 'financiamento habitacional', 'casa propria', 'casa própria', 'urbanizacao', 'urbanização', 'loteamento popular', 'empreendimento social', 'construcao habitacional'],
    'empresas de construção industrializada': ['construcao industrializada', 'construção industrializada', 'industrializacao da construcao', 'industrialização da construção', 'sistema construtivo industrializado', 'offsite construction', 'pre-fabricado', 'pré-fabricado', 'pre-moldado', 'pré-moldado', 'steel frame', 'wood frame', 'modular', 'casas modulares', 'painel pre-fabricado', 'painel pré-fabricado', 'engenharia industrializada', 'arquitetura industrializada', 'obra industrializada', 'industria da construcao', 'indústria da construção', 'fabrica de elementos construtivos', 'industrializacao habitacional', 'industrialização habitacional', 'kit construtivo', 'sistema kit', 'fabricante de modulos', 'fabricante de módulos', 'obra rapida', 'obra rápida', 'tecnologia construtiva', 'construcao 4.0', 'construção 4.0'],
    'fabricantes de implementos agrícolas': ['implementos agricolas', 'implementos agrícolas', 'fabrica de implementos', 'fábrica de implementos', 'maquinas agricolas', 'máquinas agrícolas', 'plantadeira', 'colheitadeira', 'pulverizador', 'arado', 'grade agricola', 'grade agrícola', 'semeadora', 'distribuidor de adubo', 'silos agricolas', 'silos agrícolas', 'indústria agrícola', 'industria agricola', 'equipamentos agricolas', 'equipamentos agrícolas', 'fabricante agricola', 'fabricante agrícola', 'tracionados agricolas', 'tracionados agrícolas', 'reboque agricola', 'reboque agrícola', 'carreta agricola', 'carreta agrícola', 'roçadeira agricola', 'roçadeira agrícola', 'enfardadora', 'agroindustria mecanica', 'metalurgica agricola', 'metalúrgica agrícola', 'solda agricola'],
    'construtoras de resorts': ['construtora de resort', 'obra de resort', 'resort', 'hotel resort', 'complexo turistico', 'complexo turístico', 'engenharia para resort', 'construcao de resort', 'construção de resort', 'incorporadora de resort', 'empreendimento turistico', 'empreendimento turístico', 'spa resort', 'all inclusive', 'condominio resort', 'condomínio resort', 'obra hoteleira', 'construcao hoteleira', 'construção hoteleira', 'engenharia hoteleira', 'arquitetura de resort', 'beach resort', 'eco resort', 'resort de luxo', 'obra de hotel cinco estrelas', 'complexo de lazer', 'parque tematico', 'parque temático', 'obra de pousada', 'construcao de pousada', 'obra turistica'],
    'construtoras de túneis': ['construtora de tuneis', 'construtora de túneis', 'tunel', 'túnel', 'obra de tunel', 'obra de túnel', 'engenharia de tuneis', 'engenharia de túneis', 'obras de infraestrutura', 'tunelamento', 'tbm', 'tunnel boring machine', 'escavacao subterranea', 'escavação subterrânea', 'obras subterraneas', 'obras subterrâneas', 'metro tunel', 'metrô túnel', 'tunel rodoviario', 'túnel rodoviário', 'tunel ferroviario', 'túnel ferroviário', 'geotecnia', 'obras de arte especial', 'oae', 'passagem subterranea', 'passagem subterrânea', 'engenharia geotecnica', 'engenharia geotécnica', 'construcao pesada', 'construção pesada', 'obras pesadas', 'obra civil subterranea', 'mineracao tunel'],
    'empresas de fachadas ventiladas': ['fachada ventilada', 'fachadas ventiladas', 'sistema de fachada ventilada', 'revestimento de fachada', 'revestimento de fachadas', 'envoltoria de edificios', 'envoltória de edifícios', 'painel de fachada', 'paineis de fachada', 'painéis de fachada', 'fachada em ceramica', 'fachada em cerâmica', 'fachada em porcelanato', 'fachada em aluminio', 'fachada em alumínio', 'fachada em acm', 'acm fachada', 'painel acm', 'curtain wall', 'pele de vidro', 'vidro estrutural', 'envidracamento', 'envidraçamento', 'revestimento externo', 'arquitetura de fachada', 'retrofit de fachada', 'fachada arquitetonica', 'fachada arquitetônica', 'sistema construtivo fachada', 'isolamento de fachada', 'fixacao de fachada', 'fixação de fachada', 'engenharia de fachadas', 'consultoria fachadas', 'projeto de fachada', 'fachada drenada e ventilada'],
    'empresas de reforma de fachadas': ['reforma de fachada', 'reformas de fachadas', 'retrofit de fachada', 'restauracao de fachada', 'restauração de fachada', 'manutencao de fachadas', 'manutenção de fachadas', 'pintura de fachadas', 'limpeza de fachadas', 'impermeabilizacao de fachadas', 'impermeabilização de fachadas', 'revestimento de fachadas', 'rapel para fachadas', 'servico de rapel', 'serviço de rapel', 'rapel industrial', 'recuperacao de fachada', 'recuperação de fachada', 'tratamento de fachadas', 'reforma predial', 'reforma de edificios', 'reforma de edifícios', 'retrofit predial', 'modernizacao de fachadas', 'modernização de fachadas', 'revitalizacao de fachadas', 'revitalização de fachadas', 'engenharia de fachadas', 'servicos verticais', 'serviços verticais', 'fachada nova', 'restauro de fachada', 'reforma comercial fachada'],
    'agroindústrias de açúcar mascavo': ['agroindustria de acucar mascavo', 'agroindústria de açúcar mascavo', 'acucar mascavo', 'açúcar mascavo', 'fabrica de acucar mascavo', 'fábrica de açúcar mascavo', 'engenho de acucar mascavo', 'engenho de açúcar mascavo', 'producao de acucar mascavo', 'produção de açúcar mascavo', 'industria de acucar mascavo', 'indústria de açúcar mascavo', 'agroindustria de cana', 'agroindústria de cana', 'engenho artesanal', 'acucar mascavo organico', 'açúcar mascavo orgânico', 'acucar mascavo natural', 'melado de cana', 'melaço de cana', 'rapadura', 'fabrica de rapadura', 'engenho de rapadura', 'acucar demerara', 'açúcar demerara', 'acucar cristal artesanal', 'agroindustria familiar', 'agroindústria familiar', 'engenho de cana', 'beneficiamento de cana', 'agroindustria sucroalcooleira artesanal', 'cooperativa de cana', 'agroindustria de melado', 'cachaca de alambique', 'cachaça de alambique', 'aguardente artesanal', 'agroindustria organica', 'agroindústria orgânica', 'produtor de mascavo', 'produtor de açúcar mascavo'],
    'agroindústrias de queijos': ['agroindustria de queijos', 'agroindústria de queijos', 'queijaria artesanal', 'queijaria industrial', 'fabrica de queijos', 'fábrica de queijos', 'industria de queijos', 'indústria de queijos', 'queijo artesanal', 'queijo minas', 'queijo mussarela', 'queijo mussarela artesanal', 'queijo prato', 'queijo cheddar', 'queijo coalho', 'queijo serrano', 'queijo canastra', 'queijo da serra', 'queijo curado', 'queijo maturado', 'queijo defumado', 'queijo provolone', 'queijo parmesao', 'queijo parmesão', 'queijo gorgonzola', 'queijo brie', 'queijo camembert', 'queijo gouda', 'queijo de cabra', 'queijo de bufala', 'queijo de búfala', 'queijaria', 'laticinio artesanal', 'laticínio artesanal', 'queijaria mineira', 'queijaria gaucha', 'queijaria gaúcha', 'queijaria de fazenda', 'agroindustria familiar de queijos', 'agroindústria familiar de queijos', 'cooperativa de queijos', 'queijaria organica', 'queijaria orgânica', 'produtor de queijos', 'beneficiamento de leite queijaria'],
    'lojas de cama': ['loja de cama', 'lojas de cama', 'loja de cama mesa e banho', 'cama mesa e banho', 'enxoval', 'loja de enxoval', 'roupa de cama', 'roupas de cama', 'jogo de cama', 'jogos de cama', 'lencol', 'lençol', 'colchas', 'edredons', 'cobertores', 'loja de roupa de cama', 'loja de cobertores', 'loja de toalhas', 'toalhas de banho', 'loja de roupa de mesa', 'toalha de mesa', 'loja de jogo americano', 'loja de fronhas', 'loja de cobertor casal', 'loja de cobertor solteiro', 'loja de protetor de colchao', 'loja de capa de colchao', 'loja de travesseiros', 'cama box loja', 'loja de mantas', 'loja de almofadas', 'loja de cortinas e cama', 'loja de roupa de cama infantil', 'loja enxoval bebe', 'loja enxoval bebê', 'loja casa cama mesa banho', 'loja produtos para o lar', 'loja artigos de cama', 'magazine cama mesa e banho'],
    'mesa e banho': ['cama mesa e banho', 'mesa e banho', 'loja de mesa e banho', 'loja de toalhas', 'toalhas de banho', 'toalhas de mesa', 'jogo americano', 'toalha de rosto', 'toalha de mao', 'toalha de mão', 'enxoval', 'loja de enxoval', 'roupa de mesa', 'guardanapo', 'guardanapos', 'loja de guardanapos', 'loja de toalha de mesa', 'tapete de banheiro', 'loja de tapete de banheiro', 'cortina de banheiro', 'loja de cortina de banheiro', 'jogo de banheiro', 'loja de jogo de banheiro', 'loja de roupoes', 'loja de roupões', 'loja de toalha de praia', 'toalha de praia', 'loja de manta', 'loja de toalha de piscina', 'loja de panos de prato', 'panos de prato', 'loja de tecidos para mesa', 'tecidos para mesa', 'loja de avental', 'loja de toalha gourmet', 'jogo americano de tecido', 'toalha branca para hotel', 'toalha hospitalar', 'industria de cama mesa e banho', 'distribuidora de cama mesa e banho', 'loja casa cama mesa banho', 'magazine cama mesa e banho'],
  };

  let searchTerms = categoryTerms[term] || null;

  if (!searchTerms) {
    // Find the LONGEST matching key to prefer specific entries over generic ones
    // e.g. "distribuidoras de congelados" should match before "distribuidoras"
    let bestMatch: string | null = null;
    let bestLen = 0;
    for (const cat of Object.keys(categoryTerms)) {
      if ((term.includes(cat) || cat.includes(term)) && cat.length > bestLen) {
        bestMatch = cat;
        bestLen = cat.length;
      }
    }
    if (bestMatch) {
      searchTerms = categoryTerms[bestMatch];
    }
  }

  if (!searchTerms) {
    // Enhanced Smart fallback: generate rich terms from the segment name
    const baseTerms: string[] = [term];
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedTerm !== term) baseTerms.push(normalizedTerm);
    
    // Singular/plural variations
    if (term.endsWith('s') && term.length > 4) baseTerms.push(term.slice(0, -1));
    if (term.endsWith('es') && term.length > 5) baseTerms.push(term.slice(0, -2));
    if (term.endsWith('ões') || term.endsWith('oes')) baseTerms.push(term.replace(/ões$|oes$/, 'ão'));
    if (term.endsWith('ais') && term.length > 5) baseTerms.push(term.replace(/ais$/, 'al'));
    if (term.endsWith('ias') && term.length > 5) baseTerms.push(term.slice(0, -1)); // confeitarias -> confeitaria
    if (term.endsWith('ores') && term.length > 6) baseTerms.push(term.replace(/ores$/, 'or')); // distribuidores -> distribuidor
    if (term.endsWith('eiras') && term.length > 7) baseTerms.push(term.replace(/eiras$/, 'eira'));
    if (term.endsWith('ários') || term.endsWith('arios')) {
      baseTerms.push(term.replace(/ários$|arios$/, 'ário'));
      baseTerms.push(term.replace(/ários$|arios$/, 'ario'));
    }

    // Remove common prefixes to get the core term (expanded list)
    const prefixes = [
      /^lojas?\s+de\s+/, /^distribuidoras?\s+de\s+/, /^distribuidores?\s+de\s+/,
      /^indústrias?\s+de\s+/, /^industrias?\s+de\s+/,
      /^fábricas?\s+de\s+/, /^fabricas?\s+de\s+/, /^fabricantes?\s+de\s+/,
      /^empresas?\s+de\s+/, /^clínicas?\s+de\s+/, /^clinicas?\s+de\s+/,
      /^centros?\s+de\s+/, /^casas?\s+de\s+/, /^agências?\s+de\s+/, /^agencias?\s+de\s+/,
      /^escritórios?\s+de\s+/, /^escritorios?\s+de\s+/,
      /^estúdios?\s+de\s+/, /^estudios?\s+de\s+/,
      /^escolas?\s+de\s+/, /^escolinhas?\s+de\s+/,
      /^oficinas?\s+especializadas?\s+em\s+/,
      /^oficinas?\s+de\s+/,
      /^organizadores?\s+de\s+/,
      /^fornecedores?\s+de\s+/,
      /^revendas?\s+de\s+/, /^revendedores?\s+de\s+/,
      /^cooperativas?\s+de\s+/, /^criadores?\s+de\s+/,
      /^construtoras?\s+de\s+/, /^produtoras?\s+de\s+/,
      /^laboratórios?\s+de\s+/, /^laboratorios?\s+de\s+/,
      /^arenas?\s+de\s+/, /^quadras?\s+de\s+/,
      /^provedores?\s+de\s+/, /^plataformas?\s+de\s+/,
      /^cursos?\s+de\s+/, /^beneficiadoras?\s+de\s+/,
      /^usinas?\s+de\s+/, /^fazendas?\s+de\s+/,
    ];

    let coreExtracted = '';
    for (const prefix of prefixes) {
      const match = term.match(prefix);
      if (match) {
        const core = term.replace(prefix, '').trim();
        if (core.length >= 3) {
          coreExtracted = core;
          baseTerms.push(core);
          const normalizedCore = core.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (normalizedCore !== core) baseTerms.push(normalizedCore);
          // Also add singular of core
          if (core.endsWith('s') && core.length > 4) baseTerms.push(core.slice(0, -1));
          if (core.endsWith('es') && core.length > 5) baseTerms.push(core.slice(0, -2));
        }
        break;
      }
    }

    // For "indústrias de X" also add "fabrica de X" and vice versa
    if (term.includes('industria') || term.includes('indústria')) {
      const indMatch = term.match(/ind[uú]strias?\s+de\s+(.+)/);
      if (indMatch) {
        const product = indMatch[1].trim();
        baseTerms.push(`fabrica de ${product}`);
        baseTerms.push(`fabricante de ${product}`);
      }
    }
    if (term.includes('fabrica') || term.includes('fábrica')) {
      const fabMatch = term.match(/f[aá]bricas?\s+de\s+(.+)/);
      if (fabMatch) {
        const product = fabMatch[1].trim();
        baseTerms.push(`industria de ${product}`);
      }
    }

    // For "distribuidoras/distribuidores de X" also add atacadista/atacado
    if (term.includes('distribuidora') || term.includes('distribuidor') || term.includes('distribuidores')) {
      const distribMatch = term.match(/distribuidora?e?s?\s+de\s+(.+)/);
      if (distribMatch) {
        const product = distribMatch[1].trim();
        baseTerms.push(`atacadista de ${product}`);
        baseTerms.push(`atacado de ${product}`);
        baseTerms.push(`comercio atacadista de ${product}`);
        const normalizedProduct = product.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedProduct !== product) {
          baseTerms.push(`atacadista de ${normalizedProduct}`);
          baseTerms.push(`atacado de ${normalizedProduct}`);
        }
      }
    }

    // For "lojas de X" also add just the core product
    if (term.match(/^lojas?\s+de\s+/)) {
      const lojaMatch = term.match(/^lojas?\s+de\s+(.+)/);
      if (lojaMatch) {
        const product = lojaMatch[1].trim();
        baseTerms.push(`comercio de ${product}`);
        baseTerms.push(`venda de ${product}`);
      }
    }

    // For "empresas de X" also add "servico de X" and "servicos de X"
    if (term.match(/^empresas?\s+de\s+/)) {
      const empMatch = term.match(/^empresas?\s+de\s+(.+)/);
      if (empMatch) {
        const service = empMatch[1].trim();
        baseTerms.push(`servico de ${service}`);
        baseTerms.push(`servicos de ${service}`);
      }
    }

    // For "clínicas de X" also add "consultorio de X"
    if (term.match(/^cl[ií]nicas?\s+de\s+/)) {
      const clinMatch = term.match(/^cl[ií]nicas?\s+de\s+(.+)/);
      if (clinMatch) {
        const specialty = clinMatch[1].trim();
        baseTerms.push(`consultorio de ${specialty}`);
        baseTerms.push(specialty); // just the specialty name
      }
    }

    // For "oficinas especializadas em X" add brand/type variations
    if (term.match(/oficinas?\s+especializadas?\s+em\s+/)) {
      const ofMatch = term.match(/oficinas?\s+especializadas?\s+em\s+(.+)/);
      if (ofMatch) {
        const brand = ofMatch[1].trim();
        baseTerms.push(`oficina ${brand}`);
        baseTerms.push(`mecanica ${brand}`);
        baseTerms.push(brand);
      }
    }

    searchTerms = [...new Set(baseTerms)];
  }

  return searchTerms;
}

// ===== REGION PARSING =====
function parseRegion(region: string): { city: string | null; state: string | null; isStateOnly: boolean } {
  const stateAbbrevs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const stateNameMap: { [key: string]: string } = {
    'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE',
    'distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA',
    'mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG','para':'PA',
    'paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ',
    'rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR',
    'santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO'
  };

  const clean = region.trim();
  const parts = clean.split(/[,\-]+/).map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length >= 2) {
    const cityRaw = parts[0];
    const stateRaw = parts[parts.length - 1].toUpperCase().trim();
    const normalizedState = normalizeText(stateRaw);
    
    let state: string | null = null;
    if (stateAbbrevs.includes(normalizedState)) {
      state = normalizedState;
    } else {
      const normalizedLower = stateRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      state = stateNameMap[normalizedLower] || null;
    }
    
    const city = normalizeText(cityRaw);
    return { city, state, isStateOnly: false };
  }

  // Single value
  const single = clean;
  const singleNorm = normalizeText(single);
  const singleLower = single.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (stateAbbrevs.includes(singleNorm)) {
    return { city: null, state: singleNorm, isStateOnly: true };
  }
  if (stateNameMap[singleLower]) {
    return { city: null, state: stateNameMap[singleLower], isStateOnly: true };
  }
  
  // Assume it's a city
  return { city: singleNorm, state: null, isStateOnly: false };
}

// ===== CITY AUTO-CORRECT =====
// Corrige automaticamente o nome da cidade comparando com as cidades reais
// presentes no banco para o estado informado. Usa unaccent + similarity (trigram).
async function resolveCityName(
  client: any,
  cityInput: string | null,
  state: string | null
): Promise<string | null> {
  if (!cityInput || !state) return cityInput;

  const inputNorm = normalizeText(cityInput);

  // 1) Match exato — já tá certo
  const { data: exact } = await client
    .from('companies')
    .select('cidade')
    .eq('estado', state)
    .eq('cidade', inputNorm)
    .limit(1);
  if (exact && exact.length > 0) return inputNorm;

  // 2) Buscar candidatas distintas do estado e escolher a mais parecida
  // (faixa razoável: cidades que comecem com a primeira letra ou contenham parte do nome)
  const firstLetter = inputNorm.charAt(0);
  const { data: candidates } = await client
    .from('companies')
    .select('cidade')
    .eq('estado', state)
    .not('cidade', 'is', null)
    .ilike('cidade', `${firstLetter}%`)
    .limit(2000);

  if (!candidates || candidates.length === 0) return inputNorm;

  const unique = Array.from(new Set(candidates.map((c: any) => c.cidade).filter(Boolean)));

  // Similaridade simples (Dice) entre bigrams — funciona offline sem RPC
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    const t = s.replace(/\s+/g, '');
    for (let i = 0; i < t.length - 1; i++) set.add(t.substring(i, i + 2));
    return set;
  };
  const dice = (a: string, b: string): number => {
    const A = bigrams(a), B = bigrams(b);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    A.forEach(x => { if (B.has(x)) inter++; });
    return (2 * inter) / (A.size + B.size);
  };

  let best = inputNorm;
  let bestScore = 0;
  for (const c of unique) {
    const score = dice(inputNorm, c as string);
    if (score > bestScore) {
      bestScore = score;
      best = c as string;
    }
  }

  // Aceita se similaridade >= 0.6 (tolera erros de digitação típicos)
  if (bestScore >= 0.6 && best !== inputNorm) {
    console.log(`🔤 City auto-correct: "${inputNorm}" → "${best}" (similarity: ${bestScore.toFixed(2)})`);
    return best;
  }
  return inputNorm;
}

// ===== MATCH SCORING =====
function calculateMatchScore(company: any): number {
  let score = 50;
  if (company.email && company.email.trim() !== '') score += 10;
  if (company.telefone_2 && isPhoneValid(company.telefone_2)) score += 5;
  if (company.nome_fantasia && company.nome_fantasia.trim() !== '') score += 10;
  if (company.capital_social && company.capital_social > 0) {
    if (company.capital_social >= 100000) score += 15;
    else if (company.capital_social >= 50000) score += 10;
    else if (company.capital_social >= 10000) score += 5;
  }
  if (company.porte === 'EMPRESA DE PEQUENO PORTE') score += 5;
  if (company.porte === 'DEMAIS') score += 10;
  if (company.nome_socio && company.nome_socio.trim() !== '') score += 5;
  return Math.min(score, 100);
}

function formatTimeSinceOpening(dataAbertura: string | null): string {
  if (!dataAbertura) return '';
  try {
    const opened = new Date(dataAbertura);
    if (isNaN(opened.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - opened.getTime();
    const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    if (totalMonths < 1) return 'Menos de 1 mês';
    if (totalMonths < 12) return `${totalMonths} ${totalMonths === 1 ? 'mês' : 'meses'}`;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
  } catch { return ''; }
}

function estimateCompanySize(company: any): { employeeCount: string; companySize: string; revenue: string } {
  const porte = (company.porte || '').toUpperCase();
  const capital = company.capital_social || 0;
  
  if (porte.includes('DEMAIS') || capital >= 1000000) {
    return { employeeCount: '50-200', companySize: 'Grande', revenue: 'R$ 5M+' };
  }
  if (porte.includes('PEQUENO PORTE') || capital >= 100000) {
    return { employeeCount: '10-49', companySize: 'Médio', revenue: 'R$ 500K-5M' };
  }
  return { employeeCount: '1-9', companySize: 'Pequeno', revenue: 'R$ 50K-500K' };
}

function generateReasons(company: any, category: string, matchScore: number): string[] {
  const reasons: string[] = [];

  
  if (company.email) reasons.push('Possui e-mail de contato');
  if (company.telefone_2 && isPhoneValid(company.telefone_2)) reasons.push('Possui múltiplos telefones');
  if (company.nome_socio) reasons.push(`Sócio: ${company.nome_socio}`);
  if (company.data_abertura) reasons.push(`Aberta em ${company.data_abertura}`);
  if (company.capital_social && company.capital_social >= 50000) reasons.push('Capital social significativo');
  return reasons;
}

// ===== DB CACHE =====
function generateDbCacheKey(segment: string, region: string): string {
  // Normalize and SORT segments so order doesn't matter for cache hits
  const segments = segment.split(',').map(s => 
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
  ).filter(s => s.length > 0).sort();
  const s = segments.join(',');
  const r = region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return `local|${s}|${r}`;
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Time guard: track when we started so we can bail before Supabase kills us
  const FUNCTION_START = Date.now();
  const MAX_EXECUTION_MS = 395_000; // 395s safety margin (Supabase Pro hard limit ~400s)
  const SOFT_TIMEOUT_MS = 360_000; // start wrapping up at 360s to ensure response is sent
  const isNearTimeout = () => (Date.now() - FUNCTION_START) > MAX_EXECUTION_MS;
  const isNearSoftTimeout = () => (Date.now() - FUNCTION_START) > SOFT_TIMEOUT_MS;

  try {
    const { segment, region, businessType, whatsappOnly, receitaFederalOnly, isTrial } = await req.json();
    console.log('🔍 LOCAL DB SEARCH v1 - Input:', { segment, region, businessType, whatsappOnly, receitaFederalOnly, isTrial: !!isTrial });

    if (!segment || !region) {
      return new Response(JSON.stringify({ error: 'Segmento e região são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const dbCacheKey = generateDbCacheKey(segment, region.trim());
    const bizType = businessType || 'all';
    const filterWhatsappOnly = whatsappOnly || false;

    // ===== PARSE REGION =====
    let { city, state, isStateOnly } = parseRegion(region.trim());
    console.log(`📍 Parsed region: city=${city}, state=${state}, isStateOnly=${isStateOnly}`);

    // ===== CITY AUTO-CORRECT (corrige erros de digitação) =====
    const originalCity: string | null = city;
    let correctedCity: string | null = null;
    if (city && state) {
      const corrected = await resolveCityName(adminClient, city, state);
      if (corrected && corrected !== city) {
        console.log(`✅ Cidade corrigida: "${city}" → "${corrected}"`);
        correctedCity = corrected;
        city = corrected;
      }
    }

    // ===== PARSE SEGMENTS =====
    // Algumas categorias contêm vírgula no nome (ex: "Lojas de Cama, Mesa e Banho").
    // Protegemos essas categorias antes de fazer split por vírgula.
    const COMMA_CATEGORIES = [
      'lojas de cama, mesa e banho',
      'cama, mesa e banho',
    ];
    let segmentToSplit = segment;
    const placeholders: { token: string; original: string }[] = [];
    COMMA_CATEGORIES.forEach((cat, idx) => {
      const re = new RegExp(cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = segmentToSplit.match(re);
      if (matches) {
        matches.forEach((m, i) => {
          const token = `__CAT_${idx}_${i}__`;
          placeholders.push({ token, original: m });
          segmentToSplit = segmentToSplit.replace(m, token);
        });
      }
    });
    const segments = segmentToSplit.split(',')
      .map((s: string) => {
        let v = s.trim();
        placeholders.forEach(p => { v = v.replace(p.token, p.original); });
        return v;
      })
      .filter((s: string) => s.length > 0);
    console.log(`📋 Segments: ${segments.join(' | ')}`);

    // No per-user limits - search all available leads

    // Trial usa o MESMO fluxo da pesquisa normal abaixo.
    // O frontend (TrialSearch.tsx) cuida de mostrar apenas 6 leads + total inflado em 30%.
    if (isTrial) {
      console.log(`🧪 TRIAL MODE: running full search (frontend will limit display)`);
    }

    // No artificial limits - search everything
    const MAX_LEADS = 999999;
    const leadsPerSegment = Math.ceil(MAX_LEADS / segments.length);

    // 🚫 CACHE DESABILITADO: toda pesquisa é executada ao vivo na base local
    // para garantir que melhorias e ajustes (keywords, filtros, etc.) sejam aplicados imediatamente.
    console.log('🔴 CACHE OFF - executando busca ao vivo na base local');

    // ===== QUERY LOCAL DATABASE (PARALLEL) =====
    let allCompanies: any[] = [];

    // Adaptive limits: heavy multi-segment searches (>5 segments) need stricter caps
    // to fit inside the ~400s edge-function window
    const isHeavySearch = segments.length > 5;

    // Fetch a single segment using paginated queries (SDK caps RPC at 1000 rows)
    async function fetchSegment(seg: string): Promise<any[]> {
      const segLower = seg.toLowerCase();
      const isIndustrySearch = segLower.includes('indústria') || segLower.includes('industria') || segLower.includes('fábrica') || segLower.includes('fabrica');
      // Broad categories like "restaurantes" have 25+ terms (including sub-niches like pizzaria, hamburgueria, sushi)
      // We need ALL terms to ensure sub-niches appear in parent category searches
      // For heavy multi-segment searches, cap terms more aggressively to stay within the time budget
      // Sem corte artificial: usamos TODOS os termos gerados para o segmento.
      // Se faltar algum sinônimo/marca importante, ele deve ser adicionado em
      // generateSearchTerms — não cortado aqui.
      const terms = generateSearchTerms(seg);
      console.log(`📤 Segment "${seg}" search terms (${terms.length})${isHeavySearch ? ' [HEAVY MODE]' : ''}:`, terms);

      const targetPerSegment = isIndustrySearch ? 50000 : Math.min(leadsPerSegment * 2, 50000);
      const PAGE_SIZE = 1000;
      const seenIds = new Set<string>();
      let bestResults: any[] = [];

      // ===== OPTIMIZATION =====
      // The RPC `search_companies` builds a combined tsquery with OR over all terms.
      // Sending ALL terms in ONE call is dramatically faster than N calls (1 GIN scan vs N).
      // We paginate this single combined query instead of paginating per-term.

      // Helper: run RPC with retry on timeout/pool errors
      const rpcWithRetry = async (params: any, attempts = 3): Promise<any> => {
        for (let i = 0; i < attempts; i++) {
          const r = await adminClient.rpc('search_companies', params);
          if (!r.error) return r;
          const msg = String(r.error?.message || '').toLowerCase();
          const retriable = msg.includes('timeout') || msg.includes('connection pool') || msg.includes('502') || msg.includes('bad gateway');
          if (!retriable || i === attempts - 1) return r;
          // exponential backoff: 500ms, 1500ms
          await new Promise(res => setTimeout(res, 500 * Math.pow(3, i)));
        }
      };

      // Helper: run promises with concurrency limit
      const runPool = async <T>(items: any[], fn: (item: any) => Promise<T>, concurrency: number): Promise<T[]> => {
        const results: T[] = new Array(items.length);
        let idx = 0;
        const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
          while (true) {
            const myIdx = idx++;
            if (myIdx >= items.length) break;
            results[myIdx] = await fn(items[myIdx]);
          }
        });
        await Promise.all(workers);
        return results;
      };

      // Phase 1: Fetch first batch of pages in parallel using the COMBINED query
      // (all terms OR'd together in a single tsquery — one GIN index scan in Postgres).
      const PAGE_CONCURRENCY = 5;
      const INITIAL_PAGES = isHeavySearch ? 8 : 15; // fetch up to 15 pages (15k rows) up front in parallel
      const initialPageNums = Array.from({ length: INITIAL_PAGES }, (_, i) => i);

      const initialPages = await runPool(initialPageNums, async (p: number) => {
        const r = await rpcWithRetry({
          p_city: city || null,
          p_state: state || null,
          p_search_terms: terms,
          p_biz_type: bizType || 'all',
          p_limit_val: PAGE_SIZE,
          p_offset_val: p * PAGE_SIZE,
        });
        return { ...r, pageIdx: p };
      }, PAGE_CONCURRENCY);

      let lastPageFull = false;
      let highestPageFetched = -1;
      for (const r of initialPages.sort((a, b) => a.pageIdx - b.pageIdx)) {
        if (r.error) {
          console.error(`❌ DB error page ${r.pageIdx} "${seg}":`, r.error.message);
          continue;
        }
        if (r.data && r.data.length > 0) {
          for (const c of r.data) {
            if (!seenIds.has(c.id)) { seenIds.add(c.id); bestResults.push(c); }
          }
          highestPageFetched = Math.max(highestPageFetched, r.pageIdx);
          lastPageFull = r.data.length === PAGE_SIZE;
        }
      }

      console.log(`📊 Phase 1 "${seg}": ${bestResults.length} results (${INITIAL_PAGES} pages, lastFull=${lastPageFull})`);

      // FALLBACK: If tsvector returned 0 (search_vector not populated for this region),
      // retry with ILIKE-based search which doesn't depend on the materialized vector.
      if (bestResults.length === 0) {
        // ILIKE fallback — estado ainda não indexado. Usar todos os termos possíveis.
        const ilikeTerms = Array.from(new Set(
          (terms || [])
            .map((t: string) => (t || '').trim())
            .filter((t: string) => t.length >= 4 && !/[áéíóúâêôãõç]/i.test(t))
        )).slice(0, 12);
        console.log(`🔄 Phase 1 "${seg}" empty — falling back to ILIKE search (${ilikeTerms.length} terms)`);
        
        // Paginar ILIKE com múltiplas páginas para trazer o máximo
        const ilikePageNums = Array.from({ length: 5 }, (_, i) => i); // 5 páginas
        const ilikePages = await runPool(ilikePageNums, async (p: number) => {
          const r = await adminClient.rpc('search_companies_ilike', {
            p_city: city || null,
            p_state: state || null,
            p_search_terms: ilikeTerms,
            p_biz_type: bizType || 'all',
            p_limit_val: PAGE_SIZE,
            p_offset_val: p * PAGE_SIZE,
          });
          return { ...r, pageIdx: p };
        }, 2); // concorrência 2 para não sobrecarregar

        for (const r of ilikePages.sort((a: any, b: any) => a.pageIdx - b.pageIdx)) {
          if (r.error) {
            console.error(`❌ ILIKE fallback error page ${r.pageIdx} "${seg}":`, r.error.message);
            continue;
          }
          if (r.data && r.data.length > 0) {
            for (const c of r.data) {
              if (!seenIds.has(c.id)) { seenIds.add(c.id); bestResults.push(c); }
            }
            lastPageFull = r.data.length === PAGE_SIZE;
            highestPageFetched = Math.max(highestPageFetched, r.pageIdx);
          }
        }
        console.log(`🔄 ILIKE fallback "${seg}": ${bestResults.length} results`);
      }


      // Phase 2: Continue paginating in parallel batches if last page was full
      // (means there's likely more data). Stop on soft-timeout, target reached, or empty page.
      if (lastPageFull && bestResults.length < targetPerSegment) {
        const MAX_EXTRA_BATCHES = isHeavySearch ? 2 : 6; // each batch = PAGE_CONCURRENCY pages
        let nextPage = highestPageFetched + 1;
        let stop = false;

        for (let batch = 0; batch < MAX_EXTRA_BATCHES && !stop; batch++) {
          if (bestResults.length >= targetPerSegment || isNearSoftTimeout()) break;

          const pageNums = Array.from({ length: PAGE_CONCURRENCY }, (_, i) => nextPage + i);
          nextPage += PAGE_CONCURRENCY;

          const pages = await runPool(pageNums, async (p: number) => {
            const r = await rpcWithRetry({
              p_city: city || null,
              p_state: state || null,
              p_search_terms: terms,
              p_biz_type: bizType || 'all',
              p_limit_val: PAGE_SIZE,
              p_offset_val: p * PAGE_SIZE,
            });
            return { ...r, pageIdx: p };
          }, PAGE_CONCURRENCY);

          let batchHadFullPage = false;
          for (const r of pages.sort((a, b) => a.pageIdx - b.pageIdx)) {
            if (r.error) { stop = true; continue; }
            if (!r.data || r.data.length === 0) { stop = true; continue; }
            for (const c of r.data) {
              if (!seenIds.has(c.id)) { seenIds.add(c.id); bestResults.push(c); }
            }
            if (r.data.length === PAGE_SIZE) batchHadFullPage = true;
          }

          if (!batchHadFullPage) stop = true;
        }
      }

      // ===== CNAE-BASED SEARCH (paralelo ao tsquery) =====
      // Para nichos onde o nome da empresa não contém a palavra-chave (ex: DAJU LTDA),
      // buscamos diretamente por CNAEs oficiais. Esses resultados pulam o filtro de relevância.
      const cnaes = getCnaesForSegment(seg);
      if (cnaes.length > 0) {
        console.log(`🏷️ CNAE search "${seg}": ${cnaes.length} CNAEs - ${cnaes.join(', ')}`);
        try {
          // Busca em duas frentes: CNAE PRINCIPAL e CNAE SECUNDÁRIA
          // (muitas redes como DAJU registram o varejo de cama/mesa/banho como secundária).
          const cnaeOrFilter = cnaes
            .map(code => `cnae_principal.eq.${code},cnae_secundaria.ilike.%${code}%`)
            .join(',');
          let q = adminClient
            .from('companies')
            .select('*')
            .or(cnaeOrFilter)
            .eq('situacao_cadastral', 'ATIVA')
            .not('telefone_1', 'is', null);
          if (city) q = q.eq('cidade', city);
          if (state) q = q.eq('estado', state);
          if (bizType === 'matriz') q = q.eq('matriz_filial', 'MATRIZ');
          if (bizType === 'filial') q = q.eq('matriz_filial', 'FILIAL');
          const { data: cnaeData, error: cnaeErr } = await q.limit(10000);
          if (cnaeErr) {
            console.error(`❌ CNAE search error "${seg}":`, cnaeErr.message);
          } else if (cnaeData) {
            let added = 0;
            for (const c of cnaeData) {
              if (!seenIds.has(c.id)) {
                seenIds.add(c.id);
                bestResults.push({ ...c, _viaCnae: true });
                added++;
              }
            }
            console.log(`🏷️ CNAE search "${seg}" (principal+secundária): +${added} novos (total CNAE: ${cnaeData.length})`);
          }
        } catch (e) {
          console.error(`❌ CNAE search exception "${seg}":`, (e as Error).message);
        }
      }

      console.log(`📊 Segment "${seg}": ${bestResults.length} total results`);
      return bestResults.map((c: any) => ({ ...c, _segment: seg }));
    }

    // Run segments in parallel. Each segment now does ONE combined-tsquery RPC per page,
    // so we can safely raise segment concurrency without overloading the DB pool.
    const SEGMENT_CONCURRENCY = 5;
    const segmentResults: any[][] = new Array(segments.length);
    let segIdx = 0;
    const segWorkers = Array.from({ length: Math.min(SEGMENT_CONCURRENCY, segments.length) }, async () => {
      while (true) {
        const myIdx = segIdx++;
        if (myIdx >= segments.length) break;
        segmentResults[myIdx] = await fetchSegment(segments[myIdx]);
      }
    });
    await Promise.all(segWorkers);
    for (const sr of segmentResults) {
      allCompanies.push(...sr);
    }

    console.log(`📊 Total raw companies: ${allCompanies.length} (elapsed: ${Date.now() - FUNCTION_START}ms)`);

    // ===== EMERGENCY EARLY RETURN: if near timeout, return what we have =====
    // This helper transforms raw companies into leads quickly (no heavy filters)
    const buildQuickLeads = (companies: any[]) => {
      // Quick phone filter
      let filtered = companies.filter(c => isPhoneValid(c.telefone_1) || isPhoneValid(c.telefone_2));
      // Quick CNPJ dedup
      const seen = new Set<string>();
      filtered = filtered.filter(c => { if (!c.cnpj) return true; if (seen.has(c.cnpj)) return false; seen.add(c.cnpj); return true; });
      // Transform to lead format
      return filtered.map((c: any, index: number) => {
        const phone1 = isPhoneValid(c.telefone_1) ? c.telefone_1 : (c.telefone_2 || '');
        const phoneValidation = validatePhone(phone1);
        const nfRaw = (c.nome_fantasia || '').trim();
        const isWeirdName = !nfRaw || /^\*+$/.test(nfRaw) || /^[^a-zA-Z0-9À-ÿ\s]{2,}/.test(nfRaw) || !/[a-zA-ZÀ-ÿ]{2,}/.test(nfRaw);
        const hasRazaoSocial = c.razao_social && c.razao_social.trim().length > 3;
        let rawName = isWeirdName ? (c.razao_social || 'Empresa') : nfRaw;
        const name = rawName.replace(/[^\s]+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const addressParts = [c.endereco, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean);
        const address = addressParts.map((p: string) => p.replace(/[^\s]+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(', ');
        const { employeeCount, companySize, revenue } = estimateCompanySize(c);
        return {
          id: `db-${c.id}-${index}`, name, address: address || 'Endereço não disponível',
          phone: phoneValidation.valid ? phoneValidation.normalized : phone1, phoneValid: phoneValidation.valid,
          email: c.email ? c.email.toLowerCase() : '', website: null, instagram: '', facebook: '',
          hasWhatsApp: phoneValidation.isWhatsApp, placeId: c.id, cnpj: c.cnpj || '',
          category: c._segment || segment, rating: 0, reviews: 0,
          matchScore: 70, confidenceScore: 70, source: 'receita_federal',
          responsible: c.nome_socio || 'Gerente', employeeCount, companySize, revenue,
          openedDate: c.data_abertura || '', reasons: ['Encontrado na base da Receita Federal'],
          isMatriz: (c.matriz_filial || '').toUpperCase() === 'MATRIZ',
          digitalPresence: 'unknown', digitalActivity: 'unknown',
          dataQuality: { hasValidPhone: phoneValidation.valid, hasSocialMedia: false, hasWhatsApp: phoneValidation.isWhatsApp, hasWebsite: false, fromGoogleMaps: false, fromReceitaFederal: true },
          needsReview: false, descricaoCnae: c.descricao_cnae || '', porte: c.porte || '',
          capitalSocial: c.capital_social || 0, nomeSocio: c.nome_socio || '',
          razaoSocial: c.razao_social || '', nomeFantasia: c.nome_fantasia || '',
          telefone1: c.telefone_1 || '', telefone2: c.telefone_2 || '',
          cnaePrincipal: c.cnae_principal || '', cnaeSecundaria: c.cnae_secundaria || '',
          naturezaJuridica: c.natureza_juridica || '', situacaoCadastral: c.situacao_cadastral || '',
          dataSituacaoCadastral: c.data_situacao_cadastral || '', motivoSituacao: c.motivo_situacao || '',
          matrizFilial: c.matriz_filial || '', mei: c.mei || '', simples: c.simples || '',
          endereco: c.endereco || '', complemento: c.complemento || '', bairro: c.bairro || '',
          cidade: c.cidade || '', estado: c.estado || '', cep: c.cep || '',
          faixaEtariaSocio: c.faixa_etaria_socio || '', qualificacaoSocio: c.qualificacao_socio || '',
        };
      });
    };

    if (isNearSoftTimeout() && allCompanies.length > 0) {
      console.log(`⚠️ NEAR TIMEOUT — returning ${allCompanies.length} partial results without full filtering`);
      const quickLeads = buildQuickLeads(allCompanies);
      if (quickLeads.length > 0) {
        return new Response(JSON.stringify({ leads: quickLeads, partial: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ===== FILTER: valid phone required (check both telefone_1 and telefone_2) =====
    allCompanies = allCompanies.filter(c => isPhoneValid(c.telefone_1) || isPhoneValid(c.telefone_2));
    console.log(`📞 After phone filter: ${allCompanies.length}`);

    // ===== DEDUPLICATE by CNPJ (exact same record) =====
    const seenCnpj = new Set<string>();
    allCompanies = allCompanies.filter(c => {
      if (!c.cnpj) return true;
      if (seenCnpj.has(c.cnpj)) return false;
      seenCnpj.add(c.cnpj);
      return true;
    });
    console.log(`📊 After CNPJ dedup: ${allCompanies.length}`);



    // ===== STRICT RELEVANCE FILTER FOR DISTRIBUTORS =====
    // When searching for "distribuidores/distribuidoras", ensure companies are:
    // 1) Actually distributors (not retail shops, restaurants, etc.)
    // 2) In the correct product segment (not a construction distributor when searching for food)
    const distributorSegments = segments.filter((s: string) => {
      const lower = s.toLowerCase();
      return lower.includes('distribuidor') || lower.includes('distribuidora');
    });

    if (distributorSegments.length > 0) {
      const distributorKeywords = [
        'distribui', 'distribuidor', 'distribuidora', 'distribuicao', 'distribuição',
        'atacado', 'atacadista', 'atacadão', 'atacadao',
        'representac', 'representante', 'representação',
        'revenda', 'revendedor',
        'importador', 'importadora',
        'exportador', 'exportadora',
        'trading', 'supply',
        'logistic', 'logística',
      ];

      // Build product-specific keywords per distributor segment
      const segmentProductKeywords: { [seg: string]: string[] } = {};
      for (const ds of distributorSegments) {
        const lower = ds.toLowerCase();
        // Extract product from "distribuidores de X" or "distribuidoras de X"
        const match = lower.match(/distribuidora?e?s?\s+de\s+(.+)/);
        if (match) {
          const product = match[1].trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          // Generate product keywords
          const productKws: string[] = [product];
          // Add singular
          if (product.endsWith('s') && product.length > 4) productKws.push(product.slice(0, -1));
          if (product.endsWith('es') && product.length > 5) productKws.push(product.slice(0, -2));
          // Map common product categories to broader terms
          const productMap: { [k: string]: string[] } = {
            'alimentos': ['aliment', 'alimentic', 'comestiv', 'generos alimenticios', 'produtos alimenticios', 'mercearia', 'cereais', 'secos e molhados'],
            'bebidas': ['bebida', 'refrigerante', 'cerveja', 'agua mineral', 'suco', 'drink'],
            'frios': ['frios', 'embutido', 'laticinio', 'queijo', 'presunto', 'salsicha', 'frigorific'],
            'congelados': ['congelado', 'congela', 'frigorifico', 'alimento congelado', 'sorvete', 'polpa'],
            'carnes': ['carne', 'bovina', 'suina', 'frango', 'frigorifico', 'charque', 'proteina animal'],
            'queijos': ['queijo', 'laticinio', 'laticio', 'laticinios'],
            'sorvetes': ['sorvete', 'gelato', 'picole'],
            'acai': ['acai', 'açai'],
            'ovos': ['ovo', 'ovos', 'granja'],
            'polpas de frutas': ['polpa', 'fruta', 'suco'],
            'doces': ['doce', 'bala', 'guloseima', 'chocolate', 'bombom', 'confeito'],
            'embutidos': ['embutido', 'linguica', 'salsicha', 'presunto', 'frios'],
            'food service': ['food service', 'alimentacao', 'refeicao', 'restaurante'],
            'material hospitalar': ['hospitalar', 'medico', 'saude', 'cirurgico'],
            'produtos hospitalares': ['hospitalar', 'medico', 'saude'],
            'embalagens': ['embalagem', 'embalagens', 'descartav'],
            'gases industriais': ['gas', 'gases', 'oxigenio', 'acetileno'],
            'agua': ['agua', 'mineral', 'bebida'],
            'refrigerantes': ['refrigerante', 'bebida', 'suco'],
            'cervejas': ['cerveja', 'bebida', 'chopp'],
            'racao animal': ['racao', 'pet', 'animal', 'nutricao animal'],
            'eletronicos': ['eletronico', 'informatica', 'tecnologia'],
            'autopeças': ['autopeca', 'auto peca', 'automotiv', 'veiculo'],
          };
          const normalizedProduct = product.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const mapped = productMap[normalizedProduct] || productMap[product];
          if (mapped) productKws.push(...mapped);
          segmentProductKeywords[lower] = productKws;
        }
      }

      const beforeDistFilter = allCompanies.length;
      allCompanies = allCompanies.filter(c => {
        const seg = (c._segment || '').toLowerCase();
        // Only apply strict filter to distributor segments
        if (!seg.includes('distribuidor') && !seg.includes('distribuidora')) return true;

        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        const combined = `${nf} ${rs}`;

        // Step 1: Must be a distributor/atacadista
        const isDistributor = distributorKeywords.some(kw => combined.includes(kw));
        if (!isDistributor) return false;

        // Step 2: Must match the product segment in name or razao_social
        const productKws = segmentProductKeywords[seg];
        if (productKws && productKws.length > 0) {
          return productKws.some(pk => combined.includes(pk));
        }

        return true;
      });
      console.log(`🔍 Distributor strict filter: ${allCompanies.length} (removed ${beforeDistFilter - allCompanies.length} non-matching distributors)`);
    }

    // ===== STRICT INDUSTRY RELEVANCE FILTER =====
    // When searching for "indústrias de X" or "fábricas de X", ensure companies are actual factories/industries
    const industrySegments = segments.filter((s: string) => {
      const lower = s.toLowerCase();
      return lower.includes('indústria') || lower.includes('industria') || lower.includes('fábrica') || lower.includes('fabrica');
    });

    if (industrySegments.length > 0) {
      const industryKeywords = [
        'industria', 'indústria', 'industrial', 'fabrica', 'fábrica', 'fabricante', 'fabricação', 'fabricacao',
        'manufatura', 'producao', 'produção', 'transformacao', 'transformação',
        'usina', 'envasador', 'processament', 'beneficiament',
      ];

      const industryProductKeywords: { [seg: string]: string[] } = {};
      for (const is2 of industrySegments) {
        const lower = is2.toLowerCase();
        const match = lower.match(/(?:ind[uú]strias?|f[aá]bricas?|fabricantes?)\s+de\s+(.+)/);
        if (match) {
          const product = match[1].trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const productKws: string[] = [product];
          if (product.endsWith('s') && product.length > 4) productKws.push(product.slice(0, -1));
          if (product.endsWith('es') && product.length > 5) productKws.push(product.slice(0, -2));
          const industryProductMap: { [k: string]: string[] } = {
            'chocolates': ['chocolate', 'cacau', 'bombom', 'trufa', 'achocolatado', 'cobertura', 'confeit'],
            'barrinhas de cereal': ['barrinha', 'barra de cereal', 'barra proteica', 'barra energetica', 'cereal', 'granola', 'snack'],
            'barrinhas': ['barrinha', 'barra', 'cereal', 'proteica', 'energetica'],
            'alimentos': ['aliment', 'alimentic', 'comestiv'],
            'alimentos congelados': ['congelado', 'congela', 'frigorifico'],
            'biscoitos': ['biscoito', 'bolacha', 'wafer'],
            'cosmeticos': ['cosmetico', 'beleza', 'higiene'],
            'bebidas': ['bebida', 'refrigerante', 'cerveja', 'suco', 'agua'],
            'embalagens': ['embalagem', 'embalagens'],
            'moveis': ['movel', 'moveis', 'mobilia'],
            'tintas': ['tinta', 'verniz', 'revestimento'],
            'calcados': ['calcado', 'sapato', 'tenis'],
            'plasticos': ['plastico', 'injecao', 'sopro'],
            'laticinios': ['laticinio', 'leite', 'queijo', 'iogurte'],
            'pao de queijo': ['pao de queijo'],
            'racao animal': ['racao', 'nutricao animal', 'pet'],
            'produtos de limpeza': ['limpeza', 'detergente', 'desinfetante'],
          };
          const mapped = industryProductMap[product];
          if (mapped) productKws.push(...mapped);
          industryProductKeywords[lower] = productKws;
        }
      }

      const beforeIndustryFilter = allCompanies.length;
      allCompanies = allCompanies.filter(c => {
        const seg = (c._segment || '').toLowerCase();
        const isIndustrySeg = seg.includes('industria') || seg.includes('indústria') || seg.includes('fabrica') || seg.includes('fábrica');
        if (!isIndustrySeg) return true;

        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        const combined = `${nf} ${rs}`;

        // Must be an actual industry/factory
        const isIndustry = industryKeywords.some(kw => combined.includes(kw));
        if (!isIndustry) return false;

        // Must match the product segment
        const productKws = industryProductKeywords[seg];
        if (productKws && productKws.length > 0) {
          return productKws.some(pk => combined.includes(pk));
        }

        return true;
      });
      console.log(`🏭 Industry strict filter: ${allCompanies.length} (removed ${beforeIndustryFilter - allCompanies.length} non-matching industries)`);
    }

    // ===== STRICT UNIVERSAL RELEVANCE FILTER FOR ALL SEGMENTS =====
    // Ensures every result actually matches the segment type.
    // IMPORTANT: Only checks nome_fantasia and razao_social (the business NAME).
    // CNAE descriptions are IGNORED because they are too generic and cause false positives
    // (e.g. "comércio varejista" matches almost anything).
    {
      const beforeUniversalFilter = allCompanies.length;

      // Stop-words to ignore when checking term matches
      const stopWords = new Set(['para', 'com', 'das', 'dos', 'que', 'por', 'mais', 'uma', 'uns', 'como', 'nao', 'sem', 'loja', 'casa', 'comercio', 'comercial', 'ltda', 'eireli', 'empresa']);

      // Segments where we allow shorter keywords (3+ chars) like "cama", "lar"
      // because the niche vocabulary is inherently short
      const SHORT_KEYWORD_SEGMENTS = new Set([
        'lojas de cama, mesa e banho',
        'lojas de utilidades domésticas',
        'lojas de utilidades',
        'lojas de decoração',
        'lojas de colchões',
      ]);

      // Parse each search term into its significant words
      function parseTermWords(term: string, seg?: string): string[] {
        const normalized = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const minLen = seg && SHORT_KEYWORD_SEGMENTS.has(seg.toLowerCase()) ? 3 : 4;
        return normalized.split(/\s+/).filter(w => w.length >= minLen && !stopWords.has(w));
      }

      // For each segment, extract "core keywords" from ALL terms
      // so sub-niches (pizzaria, hamburgueria, sushi) are accepted in broad searches (Restaurantes)
      function extractCoreKeywords(seg: string): string[] {
        const terms = generateSearchTerms(seg);
        const minLen = SHORT_KEYWORD_SEGMENTS.has(seg.toLowerCase()) ? 3 : 4;
        const coreWords: string[] = [];
        for (const term of terms) {
          const normalized = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const words = normalized.split(/\s+/).filter(w => w.length >= minLen && !stopWords.has(w));
          for (const w of words) {
            if (!coreWords.includes(w)) coreWords.push(w);
          }
        }
        return coreWords;
      }

      // For each segment, build core keywords and term word-sets
      const segCoreKeywordsMap = new Map<string, string[]>();
      const segTermSetsMap = new Map<string, string[][]>();
      for (const seg of segments) {
        const terms = generateSearchTerms(seg);
        const termSets = terms.map(t => parseTermWords(t, seg)).filter(ws => ws.length > 0);
        segTermSetsMap.set(seg.toLowerCase(), termSets);
        segCoreKeywordsMap.set(seg.toLowerCase(), extractCoreKeywords(seg));
      }

      // Política (100% baseada em NOME, sem CNAE):
      // Aceita o lead apenas se o nome (nome_fantasia/razao_social) contiver
      // termos relevantes ao segmento.
      allCompanies = allCompanies.filter(c => {
        const seg = (c._segment || '').trim().toLowerCase();
        const termSets = segTermSetsMap.get(seg);
        const coreKeywords = segCoreKeywordsMap.get(seg);
        if (!termSets || termSets.length === 0) return true;

        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        const nameText = `${nf} ${rs}`;

        // At least one core keyword must appear in the business name
        if (coreKeywords && coreKeywords.length > 0) {
          const hasAnyCoreKeyword = coreKeywords.some(kw => nameText.includes(kw));
          if (!hasAnyCoreKeyword) return false;
        }

        // Split terms into multi-word (2+ significant words) and single-word
        const multiWordSets = termSets.filter(ws => ws.length >= 2);
        const singleWordSets = termSets.filter(ws => ws.length === 1);

        // If multi-word terms exist, PREFER them: require at least one multi-word match
        if (multiWordSets.length > 0) {
          const hasMultiWordMatch = multiWordSets.some(words => words.every(w => nameText.includes(w)));
          if (hasMultiWordMatch) return true;
          if (multiWordSets.length <= 2 && singleWordSets.length > 0) {
            return singleWordSets.some(words => words.every(w => nameText.includes(w)));
          }
          return false;
        }

        // Only single-word terms: accept any match
        return singleWordSets.some(words => words.every(w => nameText.includes(w)));
      });
      console.log(`🎯 Universal relevance filter (name-only): ${allCompanies.length} (removed ${beforeUniversalFilter - allCompanies.length} irrelevant results)`);
    }

    // ===== TRANSFORM TO LEAD FORMAT =====
    const segmentDisplayNames: { [key: string]: string } = {};
    segments.forEach((seg: string) => {
      const lower = seg.toLowerCase();
      let display = seg;
      if (lower.endsWith('rias')) display = seg.slice(0, -1);
      else if (lower.endsWith('as') && lower.length > 4) display = seg.slice(0, -1);
      segmentDisplayNames[lower] = display.charAt(0).toUpperCase() + display.slice(1);
    });

    let leads = allCompanies.map((c: any, index: number) => {
      const phone1 = isPhoneValid(c.telefone_1) ? c.telefone_1 : (c.telefone_2 || '');
      const phoneValidation = validatePhone(phone1);
      // Format name: use razao_social if nome_fantasia is weird, too short, or too generic
      const nfRaw = (c.nome_fantasia || '').trim();
      const nfWords = nfRaw.split(/\s+/).filter(Boolean);
      const isWeirdName = !nfRaw || /^\*+$/.test(nfRaw) || /^[^a-zA-Z0-9À-ÿ\s]{2,}/.test(nfRaw) || /[@#*]{2,}/.test(nfRaw) || !/[a-zA-ZÀ-ÿ]{2,}/.test(nfRaw);
      const isTooShort = nfRaw.length < 5 || (nfWords.length === 1 && nfRaw.length < 8);
      const hasRazaoSocial = c.razao_social && c.razao_social.trim().length > 3;
      let rawName = (isWeirdName || (isTooShort && hasRazaoSocial)) ? (c.razao_social || 'Empresa') : nfRaw;
      // Convert from ALL CAPS to Title Case
      const name = rawName.replace(/[^\s]+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      const addressParts = [c.endereco, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean);
      const address = addressParts.map((part: string) => part.replace(/[^\s]+/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(', ');
      const category = segmentDisplayNames[c._segment?.toLowerCase()] || c._segment || segment;
      const { employeeCount, companySize, revenue } = estimateCompanySize(c);
      const matchScore = calculateMatchScore(c);
      const reasons = generateReasons(c, category, matchScore);
      const isMatriz = (c.matriz_filial || '').toUpperCase() === 'MATRIZ';

      return {
        id: `db-${c.id}-${index}`,
        name,
        address: address || 'Endereço não disponível',
        phone: phoneValidation.valid ? phoneValidation.normalized : phone1,
        phoneValid: phoneValidation.valid,
        email: c.email ? c.email.toLowerCase() : '',
        website: null,
        instagram: '',
        facebook: '',
        hasWhatsApp: phoneValidation.isWhatsApp,
        placeId: c.id,
        cnpj: c.cnpj || '',
        category,
        rating: 0,
        reviews: 0,
        matchScore,
        confidenceScore: matchScore,
        source: 'receita_federal',
        responsible: c.nome_socio || 'Gerente',
        employeeCount,
        companySize,
        revenue,
        openedDate: c.data_abertura || '',
        reasons,
        isMatriz,
        digitalPresence: 'unknown',
        digitalActivity: 'unknown',
        dataQuality: {
          hasValidPhone: phoneValidation.valid,
          hasSocialMedia: false,
          hasWhatsApp: phoneValidation.isWhatsApp,
          hasWebsite: false,
          fromGoogleMaps: false,
          fromReceitaFederal: true
        },
        needsReview: false,
        descricaoCnae: c.descricao_cnae || '',
        porte: c.porte || '',
        capitalSocial: c.capital_social || 0,
        nomeSocio: c.nome_socio || '',
        // Full Receita Federal raw fields (for advanced export)
        razaoSocial: c.razao_social || '',
        nomeFantasia: c.nome_fantasia || '',
        telefone1: c.telefone_1 || '',
        telefone2: c.telefone_2 || '',
        cnaePrincipal: c.cnae_principal || '',
        cnaeSecundaria: c.cnae_secundaria || '',
        naturezaJuridica: c.natureza_juridica || '',
        situacaoCadastral: c.situacao_cadastral || '',
        dataSituacaoCadastral: c.data_situacao_cadastral || '',
        motivoSituacao: c.motivo_situacao || '',
        matrizFilial: c.matriz_filial || '',
        mei: c.mei || '',
        simples: c.simples || '',
        endereco: c.endereco || '',
        complemento: c.complemento || '',
        bairro: c.bairro || '',
        cidade: c.cidade || '',
        estado: c.estado || '',
        cep: c.cep || '',
        faixaEtariaSocio: c.faixa_etaria_socio || '',
        qualificacaoSocio: c.qualificacao_socio || '',
      };
    });

    // ===== WHATSAPP FILTER =====
    if (filterWhatsappOnly && leads.length > 0) {
      const before = leads.length;
      leads = leads.filter((l: any) => l.hasWhatsApp);
      console.log(`📱 WhatsApp filter: ${leads.length} (removed ${before - leads.length})`);
    }

    // ===== SORT by match score =====
    leads.sort((a: any, b: any) => b.matchScore - a.matchScore);

    // ===== LIMIT =====
    if (leads.length > MAX_LEADS) {
      leads = leads.slice(0, MAX_LEADS);
    }

    console.log(`✅ FINAL: ${leads.length} leads (elapsed: ${Date.now() - FUNCTION_START}ms)`);

    // ===== GET USER ID FOR LOGGING (skip if near timeout) =====
    // Capture auth header EARLY (before request body might be closed by client disconnect)
    let cachedAuthHeader: string | null = null;
    let cachedUserEmail: string | null = null;
    try { cachedAuthHeader = req.headers.get('authorization'); } catch { /* request closed */ }

    let userId: string | null = null;
    if (!isNearTimeout() && cachedAuthHeader) {
      try {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: cachedAuthHeader } }
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) { userId = user.id; cachedUserEmail = user.email || ''; }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Silence "request closed" noise (user closed tab) - not a real error
        if (!msg.includes('request closed') && !msg.includes('connection closed')) {
          console.error("⚠️ Auth error:", msg);
        }
      }
    }

    if (leads.length === 0) {
      return new Response(JSON.stringify({ error: `Nenhum estabelecimento encontrado para "${segment}" em ${region}. Tente outra região ou outro segmento.` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🚫 CACHE DESABILITADO: não gravamos mais resultados em cache
    // Toda pesquisa será sempre executada ao vivo na próxima vez.

    // ===== LOG SEARCH (skip if near timeout) =====
    // Use cached userId/email captured at start - avoids re-reading req.headers after client disconnect
    if (!isNearTimeout() && userId) {
      try {
        await adminClient.from("search_logs").insert({
          user_id: userId,
          user_email: cachedUserEmail || '',
          search_type: 'leads',
          search_config: { segment, region: region.trim(), businessType: bizType },
          results_count: leads.length,
          results: leads,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('request closed') && !msg.includes('connection closed')) {
          console.error("⚠️ Search log error:", msg);
        }
      }
    }

    return new Response(JSON.stringify({ leads, originalCity, correctedCity }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

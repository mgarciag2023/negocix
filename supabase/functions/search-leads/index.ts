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

// ===== CNAE MAPPING POR SEGMENTO =====
// Para nichos onde o nome da empresa raramente contém a palavra-chave (ex: "DAJU LTDA"
// não tem "cama"), buscamos também por CNAE oficial da Receita Federal.
function getCnaesForSegment(segment: string): string[] {
  const seg = segment.toLowerCase().trim();
  const cnaeMap: { [key: string]: string[] } = {
    'lojas de cama, mesa e banho': [
      '4755503', // Comércio varejista de artigos de cama, mesa e banho
      '4755502', // Comércio varejista de artigos de armarinho
      '4755501', // Comércio varejista de tecidos
      '4641902', // Comércio atacadista de artigos de cama, mesa e banho
      '1351100', // Fabricação de artefatos têxteis para uso doméstico
      '1352900', // Fabricação de tecidos especiais
    ],
    'cama, mesa e banho': ['4755503', '4755502', '4755501', '4641902', '1351100'],
    'lojas de tapeçaria, cortinas e persianas': ['4759801'],
    'lojas de colchões': ['4754703'],
    'lojas de móveis': ['4754701', '4754702'],
    'móveis': ['4754701', '4754702', '3101200'],

    // ========================================================================
    // LOTE 1 — ALIMENTAÇÃO & BEBIDAS
    // ========================================================================
    // Restaurantes / lanchonetes / bares
    'restaurantes': ['5611201', '5611203', '5611204', '5611205'],
    'restaurantes self-service': ['5611203'],
    'restaurantes por quilo': ['5611203'],
    'pizzarias': ['5611201', '5611205'],
    'hamburguerias': ['5611201', '5611205'],
    'lanchonetes': ['5611203', '5611205'],
    'pastelarias': ['5611205'],
    'esfiharias': ['5611205'],
    'hot dogs': ['5611205'],
    'food trucks': ['5611205'],
    'churrascarias': ['5611201'],
    'espetarias': ['5611201', '5611205'],
    'marmitarias': ['5620104', '5620101'],
    'rotisseries': ['5620104', '4729699'],
    'restaurantes japoneses': ['5611201'],
    'sushi bars': ['5611201'],
    'restaurantes chineses': ['5611201'],
    'restaurantes italianos': ['5611201'],
    'restaurantes mexicanos': ['5611201'],
    'restaurantes árabes': ['5611201'],
    'restaurantes veganos': ['5611201'],
    'restaurantes vegetarianos': ['5611201'],
    'restaurantes fit': ['5611201', '5620104'],
    'restaurantes orientais': ['5611201'],
    'restaurantes indianos': ['5611201'],
    'restaurantes tailandeses': ['5611201'],
    'restaurantes coreanos': ['5611201'],
    'restaurantes peruanos': ['5611201'],
    'restaurantes portugueses': ['5611201'],
    'restaurantes de frutos do mar': ['5611201'],
    'restaurantes de comida baiana': ['5611201'],
    'restaurantes de comida mineira': ['5611201'],
    'restaurantes de comida nordestina': ['5611201'],
    'restaurantes de comida gaúcha': ['5611201'],
    'marisquerias': ['5611201'],
    'temakerias': ['5611201'],
    'cozinhas industriais': ['5620101'],
    'quentinhas e marmitas': ['5620104', '5620101'],
    'casas de massas': ['5611201', '1094500'],
    'casas de feijoada': ['5611201'],
    'casas de fondue': ['5611201'],
    'catering': ['5620102', '5620101'],

    // Padarias / confeitarias / docerias
    'padarias': ['1091102', '4721102'],
    'panificadoras': ['1091102', '4721102'],
    'confeitarias': ['1091101', '4721102'],
    'docerias': ['1091101', '4721102'],
    'chocolaterias': ['1093701', '1093702', '4721104'],
    'pâtisseries': ['1091101', '4721102'],

    // Sorveterias e bebidas geladas
    'sorveterias': ['5612100', '1053800'],
    'gelatarias': ['5612100', '1053800'],
    'açaiterias': ['5612100', '5611205'],
    'casas de açaí': ['5612100', '5611205'],
    'smoothie bars': ['5611205'],
    'frozen yogurts': ['5612100'],
    'bubble tea': ['5611205'],
    'casas de sucos': ['5611205', '4729699'],

    // Cafeterias e bares
    'cafeterias': ['5611202', '4721104'],
    'bares': ['5611202'],

    // Supermercados / mercados / mercearias
    'supermercados': ['4711301', '4711302'],
    'hipermercados': ['4711301'],
    'mercados': ['4711302', '4712100'],
    'mercearias': ['4712100', '4729699'],

    // Açougues e carnes
    'açougues': ['4722901'],
    'açouguerias': ['4722901'],

    // Hortifruti / produtos naturais (caso existam no catálogo)
    'hortifrutis': ['4724500'],
    'lojas de produtos naturais': ['4729602', '4729601'],

    // Distribuidoras de bebidas / alimentos
    'distribuidoras de bebidas': ['4635499', '4635401', '4635402'],
    'distribuidoras de alimentos': ['4639701', '4639702'],
    'distribuidoras de doces': ['4637107', '4639701'],
    'distribuidoras de congelados': ['4634603', '4639701'],
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
    'restaurantes': ['restaurante', 'self service', 'bistro', 'comida', 'gastronomia', 'bar e restaurante', 'cantina', 'buffet', 'por quilo', 'grelhados', 'cozinha', 'pizzaria', 'pizza', 'hamburgueria', 'burger', 'lanchonete', 'churrascaria', 'rodizio', 'espetaria', 'marmitaria', 'rotisserie', 'sushi', 'temakeria', 'trattoria', 'taqueria'],
    // Subtipos específicos: NÃO incluem restaurantes genéricos
    'pizzarias': ['pizzaria', 'pizza', 'pizzas', 'pizzaiolo', 'rodizio de pizza', 'delivery de pizza'],
    'hamburguerias': ['hamburgueria', 'burger', 'hamburguer', 'hamburger', 'burgers', 'smash burger', 'artesanal burger'],
    'lanchonetes': ['lanchonete', 'lanche', 'fast food', 'lanches'],
    'pastelarias': ['pastelaria', 'pastel', 'pasteis'],
    'esfiharias': ['esfiharia', 'esfiha', 'comida arabe', 'esfihas'],
    'hot dogs': ['hot dog', 'cachorro quente', 'hotdog'],
    'food trucks': ['food truck', 'food park', 'foodtruck'],
    'churrascarias': ['churrascaria', 'churrasco', 'rodizio', 'espetaria', 'rodizio de carnes'],
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
    'cozinhas industriais': ['cozinha industrial', 'refeicao coletiva'],
    'quentinhas e marmitas': ['quentinha', 'marmita', 'marmitex'],
    'casas de massas': ['casa de massas', 'massas', 'macarrao', 'pasta'],
    'casas de feijoada': ['feijoada', 'casa de feijoada'],
    'casas de fondue': ['casa de fondue', 'fondue'],
    'catering': ['catering', 'buffet', 'refeicao coletiva', 'servico de alimentacao'],

    // ===== PADARIAS E CONFEITARIAS =====
    // Padarias e confeitarias são praticamente a mesma coisa - termos compartilhados
    'padarias': ['padaria', 'panificadora', 'panificacao', 'casa de paes', 'confeitaria', 'paes', 'bakery', 'pao', 'padoca'],
    'panificadoras': ['panificadora', 'padaria', 'panificacao', 'paes', 'confeitaria'],
    'confeitarias': ['confeitaria', 'bolos', 'cake', 'patisserie', 'padaria', 'panificadora', 'doces', 'tortas'],
    'docerias': ['doceria', 'doces', 'brigadeiro', 'bombons', 'candy'],
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
    'bares': ['bar', 'boteco', 'pub', 'cervejaria', 'choperia', 'lounge'],

    // ===== SUPERMERCADOS E MERCADOS =====
    'supermercados': ['supermercado', 'mercado', 'minimercado', 'mercearia', 'mercadinho', 'hipermercado', 'atacarejo'],
    'hipermercados': ['hipermercado', 'atacadao', 'atacarejo'],
    'mercados': ['mercado', 'minimercado', 'mercadinho', 'mercearia'],
    'mercearias': ['mercearia', 'armazem', 'secos e molhados'],

    // ===== FARMÁCIAS E DROGARIAS =====
    'farmácias': ['farmacia', 'drogaria', 'farmacia popular', 'farmacia de manipulacao', 'botica'],
    'farmácias e drogarias': ['farmacia', 'drogaria', 'farmacia popular'],
    'drogarias': ['drogaria', 'farmacia'],
    'farmácias de manipulação': ['farmacia de manipulacao', 'manipulacao', 'farmacia magistral'],

    // ===== PET =====
    'pet shop': ['pet shop', 'petshop', 'pet center', 'animais', 'agropet', 'banho e tosa', 'racao'],
    'pet shops': ['pet shop', 'petshop', 'pet center', 'animais', 'agropet', 'banho e tosa', 'racao'],
    'loja de ração pet': ['racao', 'racao pet', 'agropet', 'casa de racao'],
    'banho e tosa': ['banho e tosa', 'tosador', 'pet grooming', 'estetica animal'],
    'hotéis pet': ['hotel pet', 'hotel para caes', 'hospedagem pet'],
    'creches pet': ['creche pet', 'creche para caes', 'day care pet'],
    'clínicas veterinárias': ['clinica veterinaria', 'veterinario', 'hospital veterinario'],
    'adestramento de animais': ['adestramento', 'adestrador', 'treinamento de caes'],
    'fabricantes de ração pet': ['fabrica de racao', 'racao pet', 'nutricao animal'],
    'indústrias de produtos pet': ['industria pet', 'fabrica de racao', 'produtos pet'],

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
    'materiais de construção': ['material de construcao', 'home center', 'deposito de construcao', 'material de construção', 'casa de construcao'],
    'depósitos de materiais de construção': ['deposito de construcao', 'deposito de materiais', 'material de construcao'],
    'construtoras': ['construtora', 'construtoras', 'construcoes', 'construcao civil', 'empreiteira', 'empreiteiras', 'incorporadora', 'incorporadoras', 'engenharia civil', 'engenharia e construcao', 'obras e servicos', 'edificacoes', 'construtora e incorporadora', 'construcao e incorporacao', 'obras civis', 'construcao e engenharia', 'engenharia e empreendimentos', 'empreendimentos imobiliarios', 'empreendimentos e construcoes', 'incorporacao imobiliaria', 'incorporacao e construcao', 'projetos e obras', 'projetos e construcoes', 'obras e edificacoes', 'construtora e empreendimentos', 'engenharia construcao', 'obra civil', 'reformas e construcoes', 'reforma e construcao', 'predial', 'predios', 'edificios', 'urbanismo', 'loteadora', 'loteamentos'],
    'empreiteiras': ['empreiteira', 'construcao civil', 'obra'],
    'incorporadoras': ['incorporadora', 'incorporacao', 'empreendimento imobiliario'],
    'lojas de revestimentos': ['revestimentos', 'porcelanato', 'pisos', 'ceramica'],
    'lojas de pisos e azulejos': ['pisos', 'azulejos', 'ceramica', 'porcelanato'],
    'lojas de tintas': ['tintas', 'loja de tintas', 'tinta', 'verniz'],
    'lojas de portas': ['portas', 'portas e janelas', 'portas de madeira', 'portas de aco'],
    'marmorarias': ['marmoraria', 'marmore', 'granito', 'pedras decorativas'],
    'vidraçarias': ['vidracaria', 'vidros', 'espelhos', 'box de vidro'],
    'empresas de drywall': ['drywall', 'gesso acartonado', 'construcao a seco'],
    'gesseiros': ['gesseiro', 'gesso', 'forro de gesso', 'sanca de gesso'],
    'empresas de steel frame': ['steel frame', 'construcao a seco', 'light steel frame'],
    'construtoras de pré-moldado': ['pre-moldado', 'pre moldado', 'artefatos de concreto', 'lajes'],
    'empresas de contêineres e módulos': ['container', 'modulo habitacional', 'construcao modular'],
    'sistemas de incêndio': ['sistema de incendio', 'extintores', 'bombeiro civil', 'combate a incendio'],
    'engenharias': ['engenharia', 'consultoria em engenharia', 'projeto de engenharia'],

    // ===== FERRAGENS E FERRAMENTAS =====
    'ferramentas': ['ferramentas', 'ferragem', 'loja de ferramentas'],
    'ferragens': ['ferragem', 'ferragens', 'parafusos', 'dobradicas', 'fechaduras', 'cadeados'],
    'lojas de ferragens': ['ferragens', 'parafusos', 'ferragem'],
    'lojas de ferramentas': ['ferramentas', 'ferragem', 'loja de ferramentas'],
    'chaveiros': ['chaveiro', 'chaves', 'carimbos'],

    // ===== ELÉTRICA E ENERGIA =====
    'lojas de materiais elétricos': ['materiais eletricos', 'material eletrico', 'eletrica', 'componentes eletricos'],
    'empresas de energia solar': ['energia solar', 'solar fotovoltaica', 'painel solar', 'placa solar'],
    'instaladores elétricos': ['instalador eletrico', 'eletricista', 'instalacao eletrica'],
    'empresas de manutenção elétrica': ['manutencao eletrica', 'eletricista', 'manutencao eletrica predial'],
    'empresas de engenharia elétrica': ['engenharia eletrica', 'projeto eletrico', 'instalacoes eletricas'],
    'montadores de painel elétrico': ['painel eletrico', 'quadro eletrico', 'montagem de paineis'],
    'lojas de iluminação': ['iluminacao', 'luminarias', 'lustres', 'led'],
    'lojas de lustres e luminárias': ['lustres', 'luminarias', 'iluminacao decorativa'],

    // ===== AUTOMOTIVO =====
    'autopeças': ['autopecas', 'auto pecas', 'pecas automotivas', 'auto center', 'pecas para carros'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'atacado de autopecas', 'pecas automotivas'],
    'autopeças de vans e utilitários': ['autopecas van', 'pecas utilitarios', 'pecas van', 'autopecas utilitarios', 'pecas para van', 'pecas para utilitarios', 'van pecas', 'utilitario pecas'],
    'autopeças de importados': ['autopecas importados', 'pecas importadas', 'pecas carro importado', 'autopecas importadas', 'pecas para importados', 'import car parts'],
    'e-commerce de peças automotivas': ['ecommerce autopecas', 'pecas automotivas online', 'loja virtual autopecas', 'autopecas online', 'pecas online'],
    'oficinas mecânicas': ['oficina mecanica', 'auto center', 'funilaria', 'mecanica automotiva', 'mecanico'],
    'funilarias e pinturas': ['funilaria', 'pintura automotiva', 'lanternagem'],
    'auto elétricas': ['auto eletrica', 'eletrica automotiva', 'eletricista automotivo'],
    'borracharias': ['borracharia', 'pneus', 'borracheiro'],
    'lojas de pneus': ['pneus', 'borracharia', 'recapagem', 'recauchutagem'],
    'lojas de rodas esportivas': ['rodas esportivas', 'rodas automotivas', 'rodas liga leve'],
    'lava-rápidos': ['lava rapido', 'lava jato', 'lavagem de carros'],
    'concessionárias': ['concessionaria', 'revenda de veiculos', 'veiculos novos'],
    'postos de combustível': ['posto de combustivel', 'posto de gasolina', 'combustiveis'],
    'guincho e reboque': ['guincho', 'reboque', 'auto socorro'],
    'lojas de moto': ['moto', 'motocicleta', 'concessionaria de motos'],
    'lojas de carro': ['carro', 'automovel', 'revenda de veiculos'],

    // ===== AGROPECUÁRIA =====
    'agropecuária': ['agropecuaria', 'produtos rurais', 'agropecuaria', 'casa agropecuaria', 'insumos agricolas'],
    'casas agropecuárias': ['agropecuaria', 'casa agropecuaria', 'produtos rurais'],
    'cooperativas agrícolas': ['cooperativa agricola', 'cooperativa rural'],
    'revendas de insumos agrícolas': ['revenda de insumos', 'defensivos agricolas', 'agroquimicos'],
    'revendas de máquinas agrícolas': ['maquinas agricolas', 'tratores'],
    'tratores e implementos agrícolas': ['tratores', 'implementos agricolas', 'maquinas agricolas'],
    'irrigação': ['irrigacao', 'sistema de irrigacao', 'aspersao', 'gotejamento'],
    'silos e armazéns': ['silo', 'armazem', 'armazenagem de graos'],
    'granjas': ['granja', 'avicola', 'avicultura', 'ovos'],

    // ===== MODA E VESTUÁRIO =====
    'lojas de roupas': ['roupas', 'vestuario', 'boutique', 'moda', 'confeccao', 'loja de roupas'],
    'lojas de moda infantil': ['moda infantil', 'moda infanto juvenil', 'roupas infantis', 'roupa infantil', 'roupa de bebe', 'roupas de bebe', 'enxoval infantil', 'enxoval bebe', 'enxoval para bebe', 'bebe', 'baby', 'kids', 'infantil', 'loja infantil', 'loja de bebe', 'artigos infantis', 'artigos para bebe', 'gestante', 'maternidade', 'puericultura', 'baby kids', 'mundo infantil', 'mundo do bebe'],
    'lojas de calçados': ['calcados', 'sapatos', 'tenis', 'sapataria'],
    'lojas de bolsas e acessórios': ['bolsas', 'acessorios', 'malas', 'carteiras'],
    'joalherias': ['joalheria', 'joias', 'relojoaria', 'bijuteria', 'ourivesaria'],
    'óticas': ['otica', 'oculos', 'optica', 'lentes'],
    'confecções': ['confeccao', 'confeccoes', 'fabrica de roupas', 'vestuario'],
    'lojas de tecidos': ['tecidos', 'armarinho', 'malhas'],
    'lojas de tecidos para decoração': ['tecidos para decoracao', 'tecidos decorativos'],
    'ateliês de costura': ['atelie de costura', 'costureira', 'modista'],
    'fábricas de uniformes': ['fabrica de uniformes', 'confeccao de uniformes', 'uniformes'],
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
    'lojas de utilidades domésticas': ['utilidades domesticas', 'artigos para casa', 'utensilios domesticos'],
    'lojas de utilidades': ['utilidades', 'bazar', 'variedades', 'presentes'],
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
    'floriculturas': ['floricultura', 'flores', 'garden center', 'plantas', 'arranjos florais'],
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
    'empórios de queijos': ['emporio de queijo', 'emporio', 'queijaria', 'queijos artesanais', 'casa de queijos', 'queijo', 'laticinios', 'laticinio', 'queijos'],

    // ===== EMPÓRIOS E DELICATESSENS =====
    'delicatessens': ['delicatessen', 'deli', 'emporio', 'frios importados'],
    'empórios': ['emporio', 'emporio', 'delicatessen', 'mercearia gourmet'],
    'empórios gourmet': ['emporio gourmet', 'emporio', 'delicatessen', 'gourmet', 'mercearia gourmet'],
    'empórios naturais': ['emporio natural', 'produtos naturais', 'organicos'],

    // ===== BEBIDAS =====
    'lojas de bebidas': ['loja de bebidas', 'adega', 'distribuidora de bebidas', 'deposito de bebidas'],
    'lojas de vinhos': ['loja de vinhos', 'wine', 'adega', 'enoteca'],
    'cervejarias': ['cervejaria', 'cerveja artesanal', 'brewpub'],
    'vinícolas': ['vinicola', 'vinho', 'vitinica'],
    'destilarias': ['destilaria', 'cachaca', 'destilados'],
    'torrefadoras de café': ['torrefadora', 'cafe torrado', 'torrefacao'],

    // ===== PRODUTOS NATURAIS E SAUDÁVEIS =====
    'lojas de produtos naturais': ['produtos naturais', 'loja natural', 'naturais', 'organicos'],
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
    'academias': ['academia', 'fitness', 'musculacao', 'crossfit', 'pilates', 'box', 'funcional'],
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
    'fábricas de uniformes': ['fabrica de uniformes', 'uniformes', 'confeccao de uniformes', 'uniformes profissionais'],

    // ===== METALURGIA E SIDERURGIA =====
    'metalúrgicas': ['metalurgica', 'metalurgia', 'fundicao', 'usinagem', 'caldeiraria', 'serralheria'],
    'siderúrgicas': ['siderurgica', 'siderurgia', 'aco', 'ferro gusa', 'laminacao'],
    'serralherias': ['serralheria', 'serralheiro', 'portoes', 'grades', 'esquadrias metalicas'],
    'empresas de solda': ['solda', 'soldagem', 'caldeiraria', 'soldador'],
    'caldeirarias': ['caldeiraria', 'caldeireiro', 'vasos de pressao'],
    'usinagens': ['usinagem', 'tornearia', 'fresadora', 'torno cnc', 'retifica'],
    'estruturas metálicas': ['estruturas metalicas', 'galpao metalico', 'serralheria industrial'],

    // ===== ESQUADRIAS =====
    'fabricantes de esquadrias de alumínio': ['esquadrias de aluminio', 'janelas de aluminio', 'portas de aluminio'],
    'fabricantes de esquadrias de madeira': ['esquadrias de madeira', 'janelas de madeira', 'portas de madeira'],

    // ===== INDÚSTRIAS =====
    'indústrias de alimentos': ['industria de alimentos', 'fabrica de alimentos', 'alimenticia', 'alimentos industrializados'],
    'indústrias de alimentos congelados': ['industria de congelados', 'fabrica de congelados'],
    'indústrias de laticínios': ['industria de laticinios', 'fabrica de laticinios', 'laticinio'],
    'indústrias de ração animal': ['industria de racao', 'fabrica de racao', 'nutricao animal'],
    'indústrias de biscoitos': ['industria de biscoitos', 'fabrica de biscoitos', 'biscoitos'],
    'indústrias de pão de queijo': ['pao de queijo', 'fabrica de pao de queijo'],
    'indústrias de cosméticos': ['industria de cosmeticos', 'fabrica de cosmeticos', 'cosmeticos'],
    'indústrias farmacêuticas': ['industria farmaceutica', 'laboratorio farmaceutico', 'fabrica de medicamentos'],
    'indústrias de bebidas': ['industria de bebidas', 'fabrica de bebidas', 'engarrafadora', 'cervejaria'],
    'indústrias de embalagens': ['industria de embalagens', 'fabrica de embalagens'],
    'indústrias de móveis': ['industria de moveis', 'fabrica de moveis', 'marcenaria industrial'],
    'indústrias de tintas': ['industria de tintas', 'fabrica de tintas', 'tintas industriais'],
    'indústrias de produtos de limpeza': ['industria de limpeza', 'fabrica de limpeza', 'fabrica de detergente'],
    'indústrias gráficas': ['industria grafica', 'grafica industrial', 'impressao offset'],
    'indústrias de calçados': ['industria de calcados', 'fabrica de calcados', 'fabrica de sapatos'],
    'indústrias de componentes eletrônicos': ['componentes eletronicos', 'montagem de placas', 'circuito impresso'],
    'indústrias de fios e cabos': ['fios e cabos', 'cabos eletricos', 'fios eletricos'],
    'indústrias de plásticos': ['industria de plasticos', 'plasticos', 'injecao plastica'],
    'indústrias químicas': ['industria quimica', 'quimica', 'produtos quimicos'],
    'indústrias de papel e celulose': ['industria de papel', 'celulose', 'papel'],
    'indústrias de borracha': ['industria de borracha', 'borracha', 'vulcanizacao'],
    'indústrias de vidro': ['industria de vidro', 'vidro', 'cristal'],
    'indústrias de cerâmica': ['industria de ceramica', 'ceramica', 'porcelana'],
    'indústrias de fertilizantes': ['industria de fertilizantes', 'fertilizante', 'adubo'],
    'indústrias de papel higiênico e descartáveis': ['papel higienico', 'descartaveis', 'toalha de papel'],
    'indústrias de mineração': ['mineracao', 'mineradora', 'extracao mineral', 'pedreira', 'britagem'],
    'indústrias sucroalcooleiras': ['usina de acucar', 'usina de etanol', 'sucroalcooleira', 'destilaria'],
    'indústrias têxteis': ['industria textil', 'textil', 'tecelagem', 'fiacao'],
    'indústrias de eletrônica': ['industria de eletronica', 'eletronicos', 'componentes eletronicos'],
    'indústrias automotivas': ['industria automotiva', 'autopecas', 'automoveis'],
    'indústrias de automação': ['industria de automacao', 'automacao industrial', 'automacao'],
    'indústrias de iluminação e led': ['industria de iluminacao', 'led', 'luminarias', 'iluminacao'],
    'indústrias mecânicas': ['industria mecanica', 'mecanica industrial', 'usinagem'],
    'indústrias que montam ou reformam painéis': ['painel eletrico', 'montagem de paineis', 'quadro eletrico'],
    'fabricantes de máquinas e equipamentos': ['fabrica de maquinas', 'equipamentos industriais', 'maquinas industriais'],
    'fábricas de embalagens': ['fabrica de embalagens', 'embalagens', 'industria de embalagens'],
    'abatedouros e frigoríficos': ['abatedouro', 'frigorifico', 'matadouro', 'abate'],
    'abatedouros de aves': ['abatedouro de aves', 'frigorifico de aves', 'abatedouro de frango', 'avicola'],
    'abatedouros de bovinos': ['abatedouro de bovinos', 'frigorifico de bovinos', 'abatedouro de gado'],
    'abatedouros de suínos': ['abatedouro de suinos', 'frigorifico de suinos', 'abatedouro de porco'],
    'frigoríficos': ['frigorifico', 'abatedouro', 'carnes'],

    // ===== DISTRIBUIDORAS =====
    'distribuidoras de embalagens': ['distribuidora de embalagens', 'embalagens', 'descartaveis'],
    'distribuidores de aço e ferro': ['distribuidora de aco', 'ferro e aco', 'deposito de ferro', 'metalon', 'vergalhao'],
    'distribuidores de food service': ['food service', 'distribuidor food service', 'atacado restaurantes', 'atacadista food service'],
    'distribuidores de alimentos': ['distribuidora de alimentos', 'atacadista de alimentos', 'atacado de alimentos', 'comercio atacadista de produtos alimenticios'],
    'distribuidores de bebidas': ['distribuidora de bebidas', 'deposito de bebidas', 'atacadista de bebidas', 'atacado de bebidas'],
    'distribuidores de frios': ['distribuidora de frios', 'frios e laticinios', 'atacadista de frios', 'atacado de frios'],
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
    'distribuidoras de doces': ['distribuidora de doces', 'doces atacado', 'distribuidora de balas'],
    'distribuidoras de material hospitalar': ['material hospitalar', 'material medico', 'produtos hospitalares'],
    'distribuidoras de produtos hospitalares': ['material hospitalar', 'produtos hospitalares'],
    'distribuidoras de gases industriais': ['gases industriais', 'oxigenio', 'acetileno', 'gas'],
    'distribuidores de material médico hospitalar': ['material medico', 'material hospitalar'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'atacado de autopecas'],
    'distribuidores de água': ['distribuidora de agua', 'agua mineral'],
    'distribuidores de refrigerantes': ['distribuidora de refrigerantes', 'refrigerantes'],
    'distribuidores de cervejas': ['distribuidora de cervejas', 'cervejas'],
    'distribuidores de colchões': ['distribuidora de colchoes', 'colchoes atacado'],
    'distribuidores de pêssegos': ['pessego', 'pessegos', 'distribuidor de pessegos', 'fruta'],

    // ===== TRANSPORTES E LOGÍSTICA =====
    'transportadoras': ['transportadora', 'transporte', 'logistica', 'frete', 'mudancas', 'caminhao'],
    'empresas de logística': ['logistica', 'operador logistico', 'armazenagem', 'centro de distribuicao'],
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
    'imobiliárias': ['imobiliaria', 'corretor de imoveis', 'imoveis'],
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
    'empresas de limpeza': ['empresa de limpeza', 'limpeza', 'conservacao'],
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
    'papelarias': ['papelaria', 'livraria', 'material escolar'],
    'livrarias': ['livraria', 'livros', 'livro'],
    'lojas de brinquedos': ['brinquedos', 'brinquedo', 'loja de brinquedos'],
    'lojas de games e videogames': ['games', 'videogames', 'gamer'],
    'lojas de artigos para bebê': ['artigos para bebe', 'loja de bebe', 'enxoval de bebe'],
    'lojas de conveniência': ['conveniencia', 'loja de conveniencia'],
    'lojas de variedades': ['variedades', 'bazar', '1,99', 'loja de utilidades'],
    'lojas de presentes de alto padrão': ['presentes finos', 'presentes de luxo', 'gifts'],
    'lojas de bicicleta': ['bicicleta', 'bike', 'ciclismo', 'bike shop'],
    'lojas de veículos elétricos': ['veiculos eletricos', 'patinete eletrico', 'bicicleta eletrica'],
    'lojas de epi': ['epi', 'equipamento de protecao', 'seguranca do trabalho'],
    'lojas de sinalização': ['sinalizacao', 'placas', 'comunicacao visual'],
    'artigos de caça, pesca e camping': ['caca e pesca', 'camping', 'pesca esportiva', 'artigos de pesca'],
    'lojas de artigos para piscina': ['artigos para piscina', 'artigos para piscinas', 'piscina', 'piscinas', 'piscinaria', 'tratamento de agua', 'tratamento de piscina', 'produtos para piscina', 'produtos quimicos para piscina', 'aquecedor de piscina', 'capa de piscina', 'manutencao de piscinas', 'limpeza de piscinas', 'piscineiro', 'mundo da piscina', 'casa da piscina', 'cloro'],
    'lojas de revestimentos': ['revestimentos', 'porcelanato', 'pisos', 'ceramica'],

    // ===== E-COMMERCE =====
    'e-commerce': ['e-commerce', 'ecommerce', 'loja virtual', 'loja online'],
    'e-commerces de peças automotivas': ['ecommerce autopecas', 'pecas automotivas online', 'loja virtual autopecas', 'autopecas online'],
    'e-commerces de utilidades domésticas': ['ecommerce utilidades', 'utilidades domesticas online'],
    'e-commerces de perfumaria e casa': ['ecommerce perfumaria', 'perfumes online'],
    'e-commerces de sabonetes': ['ecommerce sabonetes', 'sabonetes artesanais'],
    'e-commerces de presentes finos': ['ecommerce presentes', 'presentes online'],

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
    'lojas de aviamentos e armarinhos': ['aviamentos', 'armarinho', 'botoes', 'ziper'],
    'empresas de gulla': ['gulla', 'gulosices', 'doces', 'guloseimas'],
    'lojas de móveis': ['moveis', 'moveis planejados', 'marcenaria', 'loja de moveis'],
    'casas lotéricas': ['casa loterica', 'loterica', 'loteria'],
    'cartórios': ['cartorio', 'registro civil', 'tabelionato', 'notas'],
    'despachantes': ['despachante', 'despachante veicular', 'detran'],
    'estacionamentos': ['estacionamento', 'garagem', 'parking', 'vaga'],
    'funerárias': ['funeraria', 'velorio', 'servicos funerarios', 'cemiterio', 'crematorio'],
    'casas de repouso': ['casa de repouso', 'asilo', 'lar de idosos', 'residencial senior'],
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
    'indústrias de conservas': ['industria de conservas', 'fabrica de conservas', 'conservas'],
    'indústrias de massas': ['industria de massas', 'fabrica de massas', 'macarrao'],
    'indústrias de temperos e condimentos': ['industria de temperos', 'fabrica de temperos', 'condimentos'],
    'indústrias de molhos': ['industria de molhos', 'fabrica de molhos', 'molhos'],
    'indústrias de sorvetes': ['industria de sorvetes', 'fabrica de sorvetes', 'sorvete'],
    'indústrias de chocolates': ['industria de chocolates', 'fabrica de chocolates', 'chocolate', 'chocolateria', 'cacau', 'bombom', 'bombons', 'trufas', 'achocolatado', 'cobertura de chocolate', 'chocolate em barra', 'tabletes de chocolate', 'chocolate artesanal', 'confeitaria de chocolate', 'cacau em po', 'nibs de cacau', 'manteiga de cacau', 'gotas de chocolate'],
    'indústrias de barrinhas de cereal': ['industria de barrinhas', 'fabrica de barrinhas', 'barrinhas de cereal', 'barra de cereal', 'barra de cereais', 'barras de cereal', 'barra proteica', 'barrinhas proteicas', 'barra energetica', 'barrinhas energeticas', 'snack saudavel', 'barra de frutas', 'barra de nuts', 'granola em barra', 'cereal em barra', 'fabrica de barras'],
    'indústrias de balas e guloseimas': ['industria de balas', 'fabrica de balas', 'guloseimas', 'confeitos'],
    'indústrias de salgadinhos': ['industria de salgadinhos', 'fabrica de salgadinhos', 'snacks'],
    'indústrias de café': ['industria de cafe', 'torrefacao', 'fabrica de cafe'],
    'indústrias de sucos e polpas': ['industria de sucos', 'fabrica de sucos', 'fabrica de polpas'],
    'indústrias de água mineral': ['industria de agua mineral', 'envasadora de agua', 'fonte de agua'],
    'indústrias de refrigerantes': ['industria de refrigerantes', 'fabrica de refrigerantes'],
    'indústrias de cervejas': ['industria de cervejas', 'cervejaria', 'fabrica de cerveja'],
    'indústrias de cachaça': ['industria de cachaca', 'destilaria', 'alambique'],
    'indústrias de colchões': ['industria de colchoes', 'fabrica de colchoes'],
    'indústrias de estofados': ['industria de estofados', 'fabrica de estofados', 'sofas'],
    'indústrias de tubos e conexões': ['industria de tubos', 'tubos e conexoes', 'fabrica de tubos'],
    'indústrias de pvc': ['industria de pvc', 'fabrica de pvc', 'perfis de pvc'],
    'indústrias de fibra de vidro': ['industria de fibra de vidro', 'fibra de vidro', 'fiberglass'],
    'indústrias de sacolas plásticas': ['industria de sacolas', 'fabrica de sacolas', 'sacolas plasticas'],
    'indústrias de descartáveis plásticos': ['industria de descartaveis', 'descartaveis plasticos', 'copos plasticos'],
    'indústrias de brinquedos': ['industria de brinquedos', 'fabrica de brinquedos'],
    'indústrias de joias': ['industria de joias', 'fabrica de joias', 'ourivesaria'],
    'indústrias de etiquetas e rótulos': ['industria de etiquetas', 'fabrica de etiquetas', 'rotulos'],
    'indústrias de caixas de papelão': ['industria de caixas', 'fabrica de caixas de papelao', 'cartonagem'],
    'indústrias de paletes': ['industria de paletes', 'fabrica de paletes', 'palete'],
    'indústrias de compensados': ['industria de compensados', 'fabrica de compensados', 'madeira compensada'],
    'indústrias de mdf e mdp': ['industria de mdf', 'fabrica de mdf', 'mdp', 'painel de madeira'],
    'indústrias de portas e janelas': ['industria de portas', 'fabrica de portas', 'portas e janelas'],
    'indústrias de telhas': ['industria de telhas', 'fabrica de telhas', 'ceramica de telhado'],
    'indústrias de blocos e tijolos': ['industria de blocos', 'fabrica de tijolos', 'blocos de concreto', 'olaria'],
    'indústrias de argamassa': ['industria de argamassa', 'fabrica de argamassa'],
    'indústrias de impermeabilizantes': ['industria de impermeabilizantes', 'fabrica de impermeabilizantes'],
    'indústrias de baterias': ['industria de baterias', 'fabrica de baterias', 'acumuladores'],
    'indústrias de transformadores': ['industria de transformadores', 'fabrica de transformadores'],
    'indústrias de motores elétricos': ['industria de motores', 'fabrica de motores eletricos', 'motores'],
    'indústrias de geradores': ['industria de geradores', 'fabrica de geradores', 'grupo gerador'],
    'indústrias de painéis solares': ['industria de paineis solares', 'fabrica de paineis solares'],
    'indústrias de implementos agrícolas': ['industria de implementos', 'fabrica de implementos agricolas'],
    'indústrias de equipamentos hospitalares': ['industria de equipamentos hospitalares', 'fabrica de equipamentos medicos'],
    'indústrias de alumínio': ['industria de aluminio', 'fabrica de aluminio', 'fundicao de aluminio'],
    'indústrias de carrocerias': ['industria de carrocerias', 'fabrica de carrocerias', 'carroceria'],
    'indústrias de casas pré-fabricadas': ['industria de casas pre-fabricadas', 'casas pre-fabricadas', 'pre-fabricado'],
    'indústrias farmoquímicas': ['industria farmoquimica', 'farmoquimica', 'insumo farmaceutico'],
    'indústrias galvânicas': ['industria galvanica', 'galvanoplastia', 'zincagem', 'cromagem'],
    'indústrias madeireiras': ['industria madeireira', 'serraria', 'madeireira'],
    'indústrias moveleiras': ['industria moveleira', 'fabrica de moveis', 'movelaria'],
    'indústrias naval': ['industria naval', 'estaleiro', 'construcao naval'],
    'indústrias petroquímicas': ['industria petroquimica', 'petroquimica', 'refinaria'],

    // ===== EMPRESAS DIVERSAS FALTANTES =====
    'empresas de climatização': ['climatizacao', 'ar condicionado', 'hvac'],
    'empresas de refrigeração industrial': ['refrigeracao industrial', 'camara fria', 'camara frigorifica'],
    'empresas de ventilação industrial': ['ventilacao industrial', 'exaustao', 'ventilador industrial'],
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
    'construtoras de casas de madeira': ['casa de madeira', 'construcao em madeira'],
    'construtoras de casas em container': ['casa container', 'container habitavel'],
    'construtoras de casas modulares': ['casa modular', 'construcao modular'],
    'construtoras de casas pré-fabricadas': ['casa pre-fabricada', 'pre-fabricado'],
    'construtoras de estruturas de aço': ['estrutura de aco', 'galpao metalico', 'estrutura metalica'],
    'construtoras de obras industriais': ['obra industrial', 'construcao industrial'],
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
    'distribuidoras de material de construção': ['distribuidora de material de construcao', 'material de construcao atacado', 'atacadista de construcao'],
    'distribuidoras de ferragens': ['distribuidora de ferragens', 'ferragens atacado', 'parafusos atacado'],
    'distribuidoras de combustíveis': ['distribuidora de combustiveis', 'combustiveis', 'posto de combustivel', 'gasolina atacado'],
    'distribuidoras de epi': ['distribuidora de epi', 'epi atacado', 'equipamento de protecao atacado'],
    'distribuidoras de material de escritório': ['distribuidora de material de escritorio', 'papelaria atacado', 'material de escritorio'],
    'distribuidoras de equipamentos médicos': ['distribuidora de equipamentos medicos', 'equipamentos medicos', 'aparelhos medicos'],
    'distribuidoras de utilidades domésticas': ['distribuidora de utilidades domesticas', 'utilidades domesticas atacado', 'utensilios atacado'],
    'distribuidoras de madeiras': ['distribuidora de madeiras', 'madeireira', 'madeira atacado', 'deposito de madeira'],
    'distribuidoras de material elétrico': ['distribuidora de material eletrico', 'material eletrico atacado', 'eletrica atacado'],
    'distribuidoras de papel': ['distribuidora de papel', 'papel atacado', 'papelao atacado'],
    'empresas de manutenção industrial': ['manutencao industrial', 'manutencao de maquinas', 'manutencao preventiva', 'manutencao corretiva'],
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
  if (matchScore >= 80) reasons.push(`Alta compatibilidade com o segmento ${category}`);
  else if (matchScore >= 60) reasons.push(`Boa compatibilidade com o segmento ${category}`);
  else reasons.push(`Compatível com o segmento ${category}`);
  
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
    const { city, state, isStateOnly } = parseRegion(region.trim());
    console.log(`📍 Parsed region: city=${city}, state=${state}, isStateOnly=${isStateOnly}`);

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

    // For trial searches, use very small limits to return fast
    if (isTrial) {
      const MAX_LEADS = 50;
      console.log(`🧪 TRIAL MODE: limiting to ${MAX_LEADS} leads`);

      // 🚫 CACHE DESABILITADO: toda pesquisa trial também é executada ao vivo
      
      // Quick single query - use only first term and small limit
      let allCompanies: any[] = [];
      for (const seg of segments) {
        if (isNearTimeout()) break;
        const terms = generateSearchTerms(seg).slice(0, 1); // Only 1 term for speed
        console.log(`📤 Trial segment "${seg}" term:`, terms);
        
        const { data, error } = await adminClient.rpc('search_companies', {
          p_city: city,
          p_state: state,
          p_search_terms: terms,
          p_biz_type: bizType,
          p_limit_val: 100,
          p_offset_val: 0,
        });
        
        if (error) {
          console.error(`❌ Trial DB error:`, error.message);
        }
        if (!error && data) {
          allCompanies.push(...data);
        }
      }

      // Quick dedup and filter
      const seenCnpj = new Set<string>();
      const filtered = allCompanies.filter((c: any) => {
        if (!isPhoneValid(c.telefone_1) && !isPhoneValid(c.telefone_2)) return false;
        // Exclude MEIs without meaningful business name
        const nf = (c.nome_fantasia || '').trim();
        if (!nf || nf.length < 3 || /^\*+$/.test(nf)) {
          const rs = (c.razao_social || '').trim();
          if (/^\d/.test(rs)) return false;
        }
        const cnpj = c.cnpj || '';
        if (cnpj && seenCnpj.has(cnpj)) return false;
        if (cnpj) seenCnpj.add(cnpj);
        return true;
      });

      // Apply relevance filter to trial results too (NAME-ONLY, ignore CNAE)
      const stopWords = new Set(['para', 'com', 'das', 'dos', 'que', 'por', 'mais', 'uma', 'uns', 'como', 'nao', 'sem', 'loja', 'casa', 'comercio', 'comercial', 'ltda', 'eireli', 'empresa']);
      const trialRelevant = filtered.filter((c: any) => {
        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        const nameText = `${nf} ${rs}`;
        
        for (const seg of segments) {
          const terms = generateSearchTerms(seg);
          const termSets = terms.map(t => {
            const words = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
              .split(/\s+/).filter((w: string) => w.length >= 4 && !stopWords.has(w));
            return words;
          }).filter(ws => ws.length > 0);

          const multiWordSets = termSets.filter(ws => ws.length >= 2);
          const singleWordSets = termSets.filter(ws => ws.length === 1);

          // Core keyword check
          const coreWords: string[] = [];
          for (const ws of termSets) for (const w of ws) if (!coreWords.includes(w)) coreWords.push(w);
          if (coreWords.length > 0 && !coreWords.some((w: string) => nameText.includes(w))) continue;

          // Prefer multi-word matches for specificity
          if (multiWordSets.length > 0) {
            if (multiWordSets.some(words => words.every(w => nameText.includes(w)))) return true;
            if (multiWordSets.length <= 2 && singleWordSets.some(words => words.every(w => nameText.includes(w)))) return true;
            continue;
          }
          if (singleWordSets.some(words => words.every(w => nameText.includes(w)))) return true;
        }
        return false;
      });

      const leads = trialRelevant.slice(0, MAX_LEADS).map((c: any, i: number) => {
        const nfTrial = (c.nome_fantasia || '').trim();
        const nfTrialWords = nfTrial.split(/\s+/).filter(Boolean);
        const isWeirdTrial = !nfTrial || /^\*+$/.test(nfTrial) || /^[^a-zA-Z0-9À-ÿ\s]{2,}/.test(nfTrial) || /[@#*]{2,}/.test(nfTrial) || !/[a-zA-ZÀ-ÿ]{2,}/.test(nfTrial);
        const isTooShortTrial = nfTrial.length < 5 || (nfTrialWords.length === 1 && nfTrial.length < 8);
        const hasRsTrial = c.razao_social && c.razao_social.trim().length > 3;
        const rawName = (isWeirdTrial || (isTooShortTrial && hasRsTrial)) ? (c.razao_social || 'Empresa') : nfTrial;
        const phone = c.telefone_1 || c.telefone_2 || '';
        const phoneInfo = validatePhone(phone);
        const matchScore = calculateMatchScore(c);
        const sizeInfo = estimateCompanySize(c);
        const addr = [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(', ');
        return {
          id: `lead-${c.cnpj || i}-${Date.now()}`,
          name: rawName,
          address: addr,
          phone: phoneInfo.normalized || phone,
          email: c.email || null,
          website: null,
          category: segments[0] || 'Empresa',
          matchScore,
          reasons: generateReasons(c, segments[0] || 'Empresa', matchScore),
          hasWhatsApp: phoneInfo.isWhatsApp,
          cnpj: c.cnpj || null,
          ...sizeInfo,
          openedDate: c.data_abertura || '',
          responsible: c.nome_socio || 'Gerente',
        };
      });

      console.log(`✅ TRIAL: returning ${leads.length} leads`);
      return new Response(JSON.stringify({ leads }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      const INITIAL_PAGES = isHeavySearch ? 3 : 6; // fetch 3-6 pages (3k-6k rows) up front in parallel
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

    // ===== FILTER: valid phone required (check both telefone_1 and telefone_2) =====
    allCompanies = allCompanies.filter(c => isPhoneValid(c.telefone_1) || isPhoneValid(c.telefone_2));
    console.log(`📞 After phone filter: ${allCompanies.length}`);

    // ===== FILTER: exclude companies without meaningful business name =====
    {
      const beforeNameFilter = allCompanies.length;
      // Blacklisted names (exact normalized matches) - known irrelevant results
      const BLACKLISTED_NAMES = new Set([
        '@amigos@', 'amigos', 'a pizza', 'a pizza x',
      ]);
      allCompanies = allCompanies.filter(c => {
        const nf = (c.nome_fantasia || '').trim();
        const rs = (c.razao_social || '').trim();
        
        // Check blacklist (normalized)
        const nfNorm = nf.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const rsNorm = rs.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (BLACKLISTED_NAMES.has(nfNorm) || BLACKLISTED_NAMES.has(rsNorm)) return false;
        
        // Reject names that are only special characters (e.g. @amigos@, ***) 
        if (nf && /^[^a-zA-Z0-9À-ÿ]*$/.test(nf) && /^[^a-zA-Z0-9À-ÿ]*$/.test(rs)) return false;
        
        if (nf && nf.length >= 3 && !/^\*+$/.test(nf)) return true;
        if (/^\d/.test(rs)) return false;
        const hasBusinessIndicator = /\b(ltda|eireli|epp|s\.?a\.?|s\/a|me\b|micro empresa|industria|comercio|servic|loja|restaurante|bar |padaria|mercado|oficina|clinica|consultorio|distribui|fabrica|hotel|pousada|academia|escola|instituto)/i.test(rs);
        return hasBusinessIndicator;
      });
      console.log(`🏷️ After business name filter: ${allCompanies.length} (removed ${beforeNameFilter - allCompanies.length} without meaningful names)`);
    }

    // ===== DEDUPLICATE by CNPJ =====
    const seenCnpj = new Set<string>();
    allCompanies = allCompanies.filter(c => {
      if (!c.cnpj) return true;
      if (seenCnpj.has(c.cnpj)) return false;
      seenCnpj.add(c.cnpj);
      return true;
    });
    console.log(`📊 After CNPJ dedup: ${allCompanies.length}`);

    // ===== DEDUPLICATE by phone =====
    const seenPhones = new Set<string>();
    allCompanies = allCompanies.filter(c => {
      const phone = isPhoneValid(c.telefone_1) ? c.telefone_1 : (c.telefone_2 || '');
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 8) {
        const key = digits.slice(-8);
        if (seenPhones.has(key)) return false;
        seenPhones.add(key);
      }
      return true;
    });
    console.log(`📊 After phone dedup: ${allCompanies.length}`);

    // ===== DEDUPLICATE by nome_fantasia + cidade (same name in same city AND same segment) =====
    const seenNameCitySeg = new Set<string>();
    allCompanies = allCompanies.filter(c => {
      const nf = (c.nome_fantasia || '').trim().toUpperCase();
      const cid = (c.cidade || '').trim().toUpperCase();
      const seg = (c._segment || '').trim().toUpperCase();
      if (nf && cid) {
        const key = `${nf}|${cid}|${seg}`;
        if (seenNameCitySeg.has(key)) return false;
        seenNameCitySeg.add(key);
      }
      return true;
    });
    console.log(`📊 After name+city+segment dedup: ${allCompanies.length}`);

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

      // Política AMPLA: aceita o lead se:
      //   (a) o CNAE (principal ou secundária) bater com a lista mapeada do segmento, OU
      //   (b) o nome contiver algum termo relevante do segmento.
      // Isso captura tanto marcas que não usam a palavra-chave no nome (DAJU)
      // quanto lojas pequenas que estão fora do CNAE oficial.
      allCompanies = allCompanies.filter(c => {
        const seg = (c._segment || '').trim().toLowerCase();
        const termSets = segTermSetsMap.get(seg);
        const coreKeywords = segCoreKeywordsMap.get(seg);
        if (!termSets || termSets.length === 0) return true;

        // (a) CNAE relacionado → aceita direto
        const segCnaes = getCnaesForSegment(seg);
        if (segCnaes.length > 0) {
          const cnaeP = (c.cnae_principal || '').toString();
          const cnaeS = (c.cnae_secundaria || '').toString();
          const hasRelatedCnae = segCnaes.some(code => cnaeP === code || cnaeS.includes(code));
          if (hasRelatedCnae) return true;
        }

        // (b) nome bate com termo do segmento
        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        // ONLY check the business NAME, not CNAE
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
        // This prevents generic single-word matches (e.g. just "atacado") from passing
        // when the search is specific (e.g. "distribuidores de doces")
        if (multiWordSets.length > 0) {
          const hasMultiWordMatch = multiWordSets.some(words => words.every(w => nameText.includes(w)));
          if (hasMultiWordMatch) return true;
          // Fallback: if no multi-word match, only accept if a single-word term matches
          // AND there are very few multi-word terms (meaning the segment is inherently simple)
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

    return new Response(JSON.stringify({ leads }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

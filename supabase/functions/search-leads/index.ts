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

// ===== CATEGORY SEARCH TERMS MAPPING =====
// Maps user-facing segment names to search terms for matching against nome_fantasia and descricao_cnae
function generateSearchTerms(segment: string): string[] {
  const term = segment.split(',')[0].trim().toLowerCase();
  
  const categoryTerms: { [key: string]: string[] } = {
    'restaurantes': ['restaurante', 'churrascaria', 'self service', 'bistrô', 'bistro'],
    'supermercados': ['supermercado', 'mercado', 'minimercado', 'mercearia', 'mercadinho'],
    'hipermercados': ['hipermercado', 'atacadão', 'atacarejo'],
    'padarias': ['padaria', 'panificadora', 'panificação', 'panificacao'],
    'panificadoras': ['panificadora', 'padaria', 'panificação'],
    'confeitarias': ['confeitaria', 'doceria', 'bolos'],
    'docerias': ['doceria', 'confeitaria', 'doces', 'brigadeiro'],
    'indústrias de alimentos': ['industria de alimentos', 'fabrica de alimentos', 'alimenticia', 'alimentos industrializados'],
    'lojas de pneus': ['pneus', 'borracharia', 'recapagem', 'recauchutagem'],
    'lojas de rodas esportivas': ['rodas esportivas', 'rodas automotivas', 'rodas liga leve'],
    'granjas': ['granja', 'avicola', 'avicultura', 'ovos'],
    'pastelarias': ['pastelaria', 'pastel'],
    'hamburguerias': ['hamburgueria', 'burger', 'hamburguer'],
    'esfiharias': ['esfiharia', 'esfiha', 'comida arabe'],
    'hot dogs': ['hot dog', 'cachorro quente', 'lanchonete'],
    'food trucks': ['food truck', 'food park'],
    'churrascarias': ['churrascaria', 'churrasco', 'rodizio', 'espetaria'],
    'materiais de construção': ['material de construcao', 'home center', 'deposito de construcao', 'material de construção'],
    'ferramentas': ['ferramentas', 'ferragem'],
    'ferragens': ['ferragem', 'ferragens', 'parafusos', 'dobradiças', 'fechaduras', 'cadeados'],
    'agropecuária': ['agropecuaria', 'produtos rurais', 'agropecuária'],
    'farmácias': ['farmacia', 'drogaria', 'farmácia'],
    'farmácias e drogarias': ['farmacia', 'drogaria', 'farmácia popular'],
    'pet shop': ['pet shop', 'petshop', 'pet center', 'animais'],
    'pet shops': ['pet shop', 'petshop', 'pet center', 'animais'],
    'loja de ração pet': ['ração', 'racao', 'ração pet', 'agropet', 'casa de racao'],
    'lojas de cama, mesa e banho': ['cama mesa banho', 'enxoval', 'toalhas', 'lencois'],
    'lojas de utilidades domésticas': ['utilidades domesticas', 'artigos para casa', 'utensilios domesticos'],
    'lojas de utilidades': ['utilidades', 'bazar', 'variedades', 'presentes'],
    'fábricas de uniformes': ['fabrica de uniformes', 'confeccao de uniformes', 'uniformes'],
    'lojas de tecidos': ['tecidos', 'armarinho', 'malhas'],
    'distribuidoras de embalagens': ['distribuidora de embalagens', 'embalagens', 'descartaveis'],
    'metalúrgicas': ['metalurgica', 'metalurgia', 'fundicao', 'usinagem', 'caldeiraria', 'serralheria'],
    'siderúrgicas': ['siderurgica', 'siderurgia', 'aco', 'ferro gusa', 'laminacao'],
    'empresas de solda': ['solda', 'soldagem', 'caldeiraria', 'soldador'],
    'caldeirarias': ['caldeiraria', 'caldeireiro', 'vasos de pressao'],
    'usinagens': ['usinagem', 'tornearia', 'fresadora', 'torno cnc', 'retifica'],
    'estruturas metálicas': ['estruturas metalicas', 'galpao metalico', 'serralheria industrial'],
    'empresas de steel frame': ['steel frame', 'construcao a seco', 'light steel frame'],
    'construtoras de pré-moldado': ['pre-moldado', 'pre moldado', 'artefatos de concreto', 'lajes'],
    'fabricantes de máquinas e equipamentos': ['fabrica de maquinas', 'equipamentos industriais', 'maquinas industriais'],
    'lojas de roupas': ['roupas', 'vestuario', 'boutique', 'moda'],
    'autopeças': ['autopecas', 'auto pecas', 'pecas automotivas', 'auto center'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'atacado de autopecas', 'pecas automotivas'],
    'eletrônicos': ['eletronicos', 'informatica', 'eletronica'],
    'móveis': ['moveis', 'moveis planejados', 'marcenaria'],
    'óticas': ['otica', 'oculos', 'optica'],
    'joalherias': ['joalheria', 'joias', 'relojoaria', 'bijuteria'],
    'academias': ['academia', 'fitness', 'musculacao', 'crossfit'],
    'salões de beleza': ['salao de beleza', 'cabeleireiro', 'barbearia', 'estetica'],
    'hotéis': ['hotel', 'pousada', 'hospedagem', 'resort'],
    'hotéis e pousadas': ['hotel', 'pousada', 'hospedagem'],
    'clínicas': ['clinica', 'consultorio', 'clinica medica'],
    'clínicas médicas e odontológicas': ['clinica medica', 'clinica odontologica', 'consultorio medico', 'consultorio odontologico'],
    'hospitais e pronto-atendimentos': ['hospital', 'pronto atendimento', 'pronto-socorro'],
    'laboratórios e centros de diagnóstico': ['laboratorio', 'analises clinicas', 'diagnostico'],
    'transportadoras': ['transportadora', 'transporte', 'logistica', 'frete', 'mudancas'],
    'empresas de logística': ['logistica', 'operador logistico', 'armazenagem', 'centro de distribuicao'],
    'locadoras de veículos': ['locadora de veiculos', 'aluguel de carros', 'rent a car'],
    'gráficas': ['grafica', 'comunicacao visual', 'impressao'],
    'construtoras': ['construtora', 'construcao civil', 'empreiteira', 'incorporadora', 'engenharia civil'],
    'lojas de materiais elétricos': ['materiais eletricos', 'material eletrico', 'eletrica', 'componentes eletricos'],
    'empresas de energia solar': ['energia solar', 'solar fotovoltaica', 'painel solar', 'placa solar'],
    'distribuidores de aço e ferro': ['distribuidora de aco', 'ferro e aco', 'deposito de ferro', 'metalon', 'vergalhao'],
    'distribuidores de food service': ['food service', 'distribuidor food service', 'atacado restaurantes', 'atacadista food service'],
    'distribuidores de alimentos': ['distribuidora de alimentos', 'alimentos atacado', 'atacadista de alimentos', 'atacado de alimentos'],
    'distribuidores de bebidas': ['distribuidora de bebidas', 'deposito de bebidas', 'bebidas atacado', 'atacadista de bebidas', 'atacado de bebidas'],
    'distribuidores de frios': ['distribuidora de frios', 'frios e laticinios', 'atacadista de frios', 'atacado de frios'],
    'pizzarias': ['pizzaria', 'pizza'],
    'oficinas mecânicas': ['oficina mecanica', 'auto center', 'funilaria', 'mecanica automotiva'],
    'postos de combustível': ['posto de combustivel', 'posto de gasolina', 'combustiveis'],
    'escolas': ['escola', 'colegio', 'ensino', 'centro educacional'],
    'papelarias': ['papelaria', 'livraria', 'material escolar'],
    'distribuidoras': ['distribuidora', 'distribuidor', 'distribuicao', 'atacadista', 'atacado'],
    'serralherias': ['serralheria', 'serralheiro', 'portoes', 'grades', 'esquadrias metalicas'],
    'lanchonetes': ['lanchonete', 'lanche'],
    'açougues': ['acougue', 'casa de carnes', 'carnes e frios', 'boutique de carnes'],
    'açouguerias': ['acougue', 'acougueria', 'casa de carnes', 'frios e embutidos'],
    'casas de carnes': ['casa de carnes', 'acougue', 'boutique de carnes'],
    'distribuidoras de carnes': ['distribuidora de carnes', 'atacado de carnes', 'atacadista de carnes', 'frigorifico'],
    'indústrias de cosméticos': ['industria de cosmeticos', 'fabrica de cosmeticos', 'cosmeticos'],
    'indústrias farmacêuticas': ['industria farmaceutica', 'laboratorio farmaceutico', 'fabrica de medicamentos'],
    'indústrias de bebidas': ['industria de bebidas', 'fabrica de bebidas', 'engarrafadora', 'cervejaria'],
    'indústrias de embalagens': ['industria de embalagens', 'fabrica de embalagens'],
    'indústrias de móveis': ['industria de moveis', 'fabrica de moveis', 'marcenaria industrial'],
    'indústrias de tintas': ['industria de tintas', 'fabrica de tintas', 'tintas industriais'],
    'indústrias de produtos de limpeza': ['industria de limpeza', 'fabrica de limpeza', 'fabrica de detergente'],
    'indústrias gráficas': ['industria grafica', 'grafica industrial', 'impressao offset'],
    'agência de eventos': ['agencia de eventos', 'organizadora de eventos', 'produtora de eventos', 'buffet e eventos'],
    'cestas básicas': ['cestas basicas', 'cesta basica'],
    'lojas de bebidas': ['loja de bebidas', 'adega', 'distribuidora de bebidas'],
    'lojas de vinhos': ['loja de vinhos', 'wine', 'adega', 'enoteca'],
    'lojas de conveniência': ['conveniencia', 'loja de conveniencia'],
    'lojas de games e videogames': ['games', 'videogames', 'gamer'],
    'lojas de artigos para bebê': ['artigos para bebe', 'loja de bebe', 'enxoval de bebe'],
    'empresas de drywall': ['drywall', 'gesso acartonado', 'construcao a seco'],
    'gesseiros': ['gesseiro', 'gesso', 'forro de gesso', 'sanca de gesso'],
    'escritórios de arquitetura': ['escritorio de arquitetura', 'arquiteto', 'arquitetura'],
    'importadoras': ['importadora', 'importacao', 'produtos importados', 'trading'],
    'exportadoras': ['exportadora', 'exportacao', 'comercio exterior'],
    'provedores de internet': ['provedor de internet', 'internet', 'fibra optica'],
    'montadores de painel elétrico': ['painel eletrico', 'quadro eletrico', 'montagem de paineis'],
    'empresas de automação industrial': ['automacao industrial', 'automacao', 'instrumentacao industrial'],
    'perfumarias': ['perfumaria', 'perfume', 'cosmeticos e perfumes'],
    'marmitarias': ['marmitaria', 'marmita', 'marmitex', 'quentinha'],
    'espetarias': ['espetaria', 'espeto', 'espetinho'],
    'chocolaterias': ['chocolateria', 'chocolate artesanal', 'bombons'],
    'sorveterias': ['sorveteria', 'sorvete', 'gelato'],
    'cafeterias': ['cafeteria', 'cafe', 'coffee'],
    'lojas de colchões': ['colchoes', 'colchao', 'cama e colchao'],
    'floriculturas': ['floricultura', 'flores', 'garden center'],
    'garden center': ['garden center', 'jardinagem', 'plantas', 'floricultura'],
    'indústrias de alimentos congelados': ['industria de congelados', 'fabrica de congelados'],
    'indústrias de laticínios': ['industria de laticinios', 'fabrica de laticinios', 'laticinio'],
    'indústrias de ração animal': ['industria de racao', 'fabrica de racao', 'nutricao animal'],
    'abatedouros e frigoríficos': ['abatedouro', 'frigorifico', 'matadouro', 'abate'],
    'abatedouros de aves': ['abatedouro de aves', 'frigorifico de aves', 'abatedouro de frango', 'avicola'],
    'abatedouros de bovinos': ['abatedouro de bovinos', 'frigorifico de bovinos', 'abatedouro de gado'],
    'abatedouros de suínos': ['abatedouro de suinos', 'frigorifico de suinos', 'abatedouro de porco'],
    'banho e tosa': ['banho e tosa', 'tosador', 'pet grooming', 'estetica animal'],
    'hotéis pet': ['hotel pet', 'hotel para caes', 'hospedagem pet'],
    'creches pet': ['creche pet', 'creche para caes', 'day care pet'],
    'buffets de festas': ['buffet de festas', 'buffet infantil', 'espaco para eventos', 'salao de festas'],
    'indústrias de mineração': ['mineracao', 'mineradora', 'extracao mineral', 'pedreira', 'britagem'],
    'indústrias sucroalcooleiras': ['usina de acucar', 'usina de etanol', 'sucroalcooleira', 'destilaria'],
    'restaurantes japoneses': ['restaurante japones', 'comida japonesa', 'sushi', 'sashimi'],
    'sushi bars': ['sushi', 'sushi bar', 'sushiman'],
    'restaurantes chineses': ['restaurante chines', 'comida chinesa'],
    'restaurantes italianos': ['restaurante italiano', 'cantina italiana', 'trattoria'],
    'restaurantes mexicanos': ['restaurante mexicano', 'comida mexicana', 'taqueria'],
    'restaurantes árabes': ['restaurante arabe', 'comida arabe', 'esfiha', 'shawarma'],
    'restaurantes veganos': ['restaurante vegano', 'comida vegana', 'vegan'],
    'restaurantes vegetarianos': ['restaurante vegetariano', 'comida vegetariana'],
    'restaurantes fit': ['restaurante fit', 'comida fit', 'alimentacao saudavel'],
    'restaurantes self-service': ['self service', 'por quilo'],
    'cozinhas industriais': ['cozinha industrial', 'refeicao coletiva'],
    'empresas de motoboy': ['motoboy', 'motofrete', 'entrega moto'],
    'guincho e reboque': ['guincho', 'reboque', 'auto socorro'],
    'clínicas de fisioterapia e reabilitação': ['fisioterapia', 'reabilitacao', 'fisioterapeuta'],
    'farmácias de manipulação': ['farmacia de manipulacao', 'manipulacao', 'farmacia magistral'],
    'empresas de cftv': ['cftv', 'cameras de seguranca', 'vigilancia'],
    'empresas de engenharia elétrica': ['engenharia eletrica', 'projeto eletrico', 'instalacoes eletricas'],
    'distribuidoras de ovos': ['distribuidora de ovos', 'ovos atacado', 'granja distribuidora', 'atacadista de ovos'],
    'distribuidoras de queijos': ['distribuidora de queijos', 'queijos atacado', 'laticinios', 'atacadista de queijos'],
    'distribuidoras de congelados': ['distribuidora de congelados', 'congelados atacado', 'atacadista de congelados'],
    'distribuidoras de sorvetes': ['distribuidora de sorvetes', 'sorvetes atacado', 'atacadista de sorvetes'],
    'distribuidoras de açaí': ['distribuidora de acai', 'acai atacado', 'atacadista de acai'],
    'distribuidoras de polpas de frutas': ['distribuidora de polpas', 'polpa de fruta', 'atacadista de polpas'],
    'açaiterias': ['acaiteria', 'acai'],
    'casas de açaí': ['casa de acai', 'acai'],
    'creperies': ['creperie', 'crepe'],
    'tapiocarias': ['tapiocaria', 'tapioca'],
    'casas de sucos': ['casa de sucos', 'sucos naturais'],
    'rotisseries': ['rotisserie', 'rotisseria', 'frango assado', 'assados'],
    'delicatessens': ['delicatessen', 'deli', 'emporio', 'frios importados'],
    'empórios': ['emporio', 'empório', 'delicatessen', 'mercearia gourmet'],
    'empórios de queijos': ['emporio de queijo', 'emporio', 'queijaria', 'queijos artesanais', 'casa de queijos', 'queijo', 'laticinios', 'laticinio', 'queijos'],
    'empórios gourmet': ['emporio gourmet', 'emporio', 'delicatessen', 'gourmet', 'mercearia gourmet'],
    'açougues gourmet': ['acougue gourmet', 'boutique de carnes', 'carnes nobres', 'carnes premium'],
    'lojas de revestimentos': ['revestimentos', 'porcelanato', 'pisos', 'ceramica'],
    'lojas de portas': ['portas', 'portas e janelas', 'portas de madeira', 'portas de aco'],
    'fabricantes de esquadrias de alumínio': ['esquadrias de aluminio', 'janelas de aluminio', 'portas de aluminio'],
    'fabricantes de esquadrias de madeira': ['esquadrias de madeira', 'janelas de madeira', 'portas de madeira'],
    'lojas de tapeçaria, cortinas e persianas': ['tapecaria', 'cortinas', 'persianas', 'blackout'],
    'distribuidoras de material hospitalar': ['material hospitalar', 'material medico', 'produtos hospitalares'],
    'ortopedias e lojas de produtos ortopédicos': ['ortopedia', 'produtos ortopedicos', 'orteses e proteses'],
    'cartonagem': ['cartonagem', 'caixas de papelao', 'embalagens de papelao'],
    'indústrias de calçados': ['industria de calcados', 'fabrica de calcados', 'fabrica de sapatos'],
    'indústrias de componentes eletrônicos': ['componentes eletronicos', 'montagem de placas', 'circuito impresso'],
    'indústrias de fios e cabos': ['fios e cabos', 'cabos eletricos', 'fios eletricos'],
    'agências de marketing digital': ['agencia de marketing', 'marketing digital', 'agencia digital'],
    'empresas de desenvolvimento de software': ['desenvolvimento de software', 'software house', 'fabrica de software'],
    'empresas de rh e terceirização': ['recursos humanos', 'terceirizacao', 'trabalho temporario'],
    // === Additional categories that smart fallback won't handle well ===
    'bares': ['bar', 'boteco', 'pub', 'cervejaria'],
    'mercados': ['mercado', 'minimercado', 'mercadinho', 'mercearia'],
    'mercearias': ['mercearia', 'armazem', 'secos e molhados'],
    'atacadistas de alimentos': ['atacadista de alimentos', 'atacado de alimentos', 'atacadao'],
    'salgadeiros': ['salgadeiro', 'salgados', 'fabrica de salgados'],
    'empresas de gulla': ['gulla', 'gulosices', 'doces', 'guloseimas'],
    'catering': ['catering', 'buffet', 'refeicao coletiva', 'servico de alimentacao'],
    'casas de massas': ['casa de massas', 'massas', 'macarrao', 'pasta'],
    'indústrias de biscoitos': ['industria de biscoitos', 'fabrica de biscoitos', 'biscoitos'],
    'distribuidoras de doces': ['distribuidora de doces', 'doces atacado', 'distribuidora de balas'],
    'indústrias de produtos pet': ['industria pet', 'fabrica de racao', 'produtos pet'],
    'escritórios': ['escritorio', 'coworking', 'sala comercial'],
    'lojas de ferramentas': ['ferramentas', 'ferragem', 'loja de ferramentas'],
    'chaveiros': ['chaveiro', 'chaves', 'carimbos'],
    'indústrias de pão de queijo': ['pao de queijo', 'fabrica de pao de queijo'],
    'escolinhas de futebol': ['escolinha de futebol', 'escola de futebol', 'futebol'],
    'escolinhas de basquete': ['escolinha de basquete', 'escola de basquete', 'basquete'],
    'escolinhas de natação': ['escolinha de natacao', 'escola de natacao', 'natacao', 'piscina'],
    'escolinhas de artes marciais': ['artes marciais', 'academia de luta', 'jiu jitsu', 'karate', 'judo'],
    'arenas de beach tennis': ['beach tennis', 'arena de beach', 'quadra de beach'],
    'quadras de tênis': ['quadra de tenis', 'tenis', 'clube de tenis'],
    'clubes esportivos': ['clube esportivo', 'clube recreativo', 'clube social', 'associacao esportiva'],
    'confecções': ['confeccao', 'confeccoes', 'fabrica de roupas', 'vestuario'],
    'lojas de tecidos para decoração': ['tecidos para decoracao', 'tecidos decorativos'],
    'ateliês de costura': ['atelie de costura', 'costureira', 'modista'],
    'indústrias têxteis': ['industria textil', 'textil', 'tecelagem', 'fiacao'],
    'bordados': ['bordado', 'bordados', 'bordadeira'],
    'malharias': ['malharia', 'malhas', 'tricot'],
    'frotistas': ['frotista', 'frota', 'gestao de frota'],
    'empresas com frota própria': ['frota propria', 'frota corporativa'],
    'vans escolares': ['van escolar', 'transporte escolar'],
    'táxis e cooperativas': ['taxi', 'cooperativa de taxi', 'radiotaxi'],
    'motoristas de aplicativo': ['motorista de aplicativo', 'uber', 'transporte por aplicativo'],
    'empresas de turismo': ['turismo', 'agencia de turismo', 'receptivo'],
    'clínicas médicas': ['clinica medica', 'consultorio medico'],
    'clínicas odontológicas': ['clinica odontologica', 'consultorio odontologico', 'dentista'],
    'hospitais': ['hospital', 'pronto socorro', 'pronto atendimento'],
    'laboratórios': ['laboratorio', 'analises clinicas', 'diagnostico'],
    'clínicas de fisioterapia': ['fisioterapia', 'clinica de fisioterapia', 'reabilitacao'],
    'ortopedias': ['ortopedia', 'produtos ortopedicos', 'orteses'],
    'distribuidoras de produtos hospitalares': ['material hospitalar', 'produtos hospitalares'],
    'planos de saúde': ['plano de saude', 'operadora de saude', 'convenio medico'],
    'home care': ['home care', 'atendimento domiciliar', 'enfermagem domiciliar'],
    'clínicas de psicologia': ['clinica de psicologia', 'psicologo', 'psicoterapia'],
    'nutricionistas': ['nutricionista', 'nutricao', 'consultorio de nutricao'],
    'fonoaudiólogos': ['fonoaudiologo', 'fonoaudiologia'],
    'comunicação visual': ['comunicacao visual', 'letreiro', 'placa', 'fachada'],
    'impressão digital': ['impressao digital', 'plotagem', 'banner'],
    'agências de publicidade': ['agencia de publicidade', 'propaganda', 'publicidade'],
    'estúdios de design': ['estudio de design', 'design grafico', 'designer'],
    'produtoras de conteúdo': ['produtora de conteudo', 'producao de video', 'audiovisual'],
    'lojas de sinalização': ['sinalizacao', 'placas', 'comunicacao visual'],
    'serigrafias': ['serigrafia', 'silk screen', 'estamparia'],
    'estamparias': ['estamparia', 'sublimacao', 'transfer'],
    'fábricas de embalagens': ['fabrica de embalagens', 'embalagens', 'industria de embalagens'],
    'editoras': ['editora', 'editorial', 'publicacao'],
    'empreiteiras': ['empreiteira', 'construcao civil', 'obra'],
    'incorporadoras': ['incorporadora', 'incorporacao', 'empreendimento imobiliario'],
    'arquitetos': ['arquiteto', 'arquitetura', 'projeto arquitetonico'],
    'marmorarias': ['marmoraria', 'marmore', 'granito', 'pedras decorativas'],
    'vidraçarias': ['vidracaria', 'vidros', 'espelhos', 'box de vidro'],
    'imobiliárias': ['imobiliaria', 'corretor de imoveis', 'imoveis'],
    'indústrias de eletrônica': ['industria de eletronica', 'eletronicos', 'componentes eletronicos'],
    'indústrias automotivas': ['industria automotiva', 'autopecas', 'automoveis'],
    'indústrias de automação': ['industria de automacao', 'automacao industrial', 'automacao'],
    'indústrias de iluminação e led': ['industria de iluminacao', 'led', 'luminarias', 'iluminacao'],
    'instaladores elétricos': ['instalador eletrico', 'eletricista', 'instalacao eletrica'],
    'empresas de manutenção elétrica': ['manutencao eletrica', 'eletricista', 'manutencao eletrica predial'],
    'indústrias que montam ou reformam painéis': ['painel eletrico', 'montagem de paineis', 'quadro eletrico'],
    'indústrias mecânicas': ['industria mecanica', 'mecanica industrial', 'usinagem'],
    'indústrias de plásticos': ['industria de plasticos', 'plasticos', 'injecao plastica'],
    'indústrias químicas': ['industria quimica', 'quimica', 'produtos quimicos'],
    'indústrias de papel e celulose': ['industria de papel', 'celulose', 'papel'],
    'indústrias de borracha': ['industria de borracha', 'borracha', 'vulcanizacao'],
    'indústrias de vidro': ['industria de vidro', 'vidro', 'cristal'],
    'indústrias de cerâmica': ['industria de ceramica', 'ceramica', 'porcelana'],
    'indústrias de fertilizantes': ['industria de fertilizantes', 'fertilizante', 'adubo'],
    'indústrias de papel higiênico e descartáveis': ['papel higienico', 'descartaveis', 'toalha de papel'],
    'lojas de produtos naturais': ['produtos naturais', 'loja natural', 'naturais'],
    'empórios naturais': ['emporio natural', 'produtos naturais', 'organicos'],
    'lojas de suplementos': ['suplementos', 'whey', 'suplemento alimentar'],
    'hortifrútis': ['hortifruti', 'hortifrutigranjeiro', 'frutas', 'verduras', 'sacolao'],
    'lojas veganas': ['vegano', 'vegana', 'produtos veganos'],
    'clínicas de estética': ['clinica de estetica', 'estetica', 'estetica facial', 'estetica corporal'],
    'spas': ['spa', 'day spa', 'spa urbano'],
    'pet shops': ['pet shop', 'petshop', 'pet center', 'animais'],
    'fabricantes de ração pet': ['fabrica de racao', 'racao pet', 'nutricao animal'],
    'adestramento de animais': ['adestramento', 'adestrador', 'treinamento de caes'],
    'clínicas veterinárias': ['clinica veterinaria', 'veterinario', 'hospital veterinario'],
    'distribuidores de autopeças': ['distribuidora de autopecas', 'atacado de autopecas'],
    'escolas e cursos': ['escola', 'curso', 'centro educacional', 'ensino'],
    'distribuidores de água': ['distribuidora de agua', 'agua mineral'],
    'distribuidores de refrigerantes': ['distribuidora de refrigerantes', 'refrigerantes'],
    'distribuidores de cervejas': ['distribuidora de cervejas', 'cervejas'],
    'artigos de caça, pesca e camping': ['caca e pesca', 'camping', 'pesca esportiva', 'artigos de pesca'],
    'restaurantes orientais': ['restaurante oriental', 'comida oriental', 'culinaria asiatica'],
    'temakerias': ['temakeria', 'temaki'],
    'lojas de presentes de alto padrão': ['presentes finos', 'presentes de luxo', 'gifts'],
    'empresas de locação de materiais para eventos': ['locacao de materiais', 'mesas e cadeiras', 'toalhas para eventos'],
    'autopeças de vans e utilitários': ['autopecas van', 'pecas utilitarios', 'pecas van', 'autopecas utilitarios', 'pecas para van', 'pecas para utilitarios', 'van pecas', 'utilitario pecas'],
    'autopeças de importados': ['autopecas importados', 'pecas importadas', 'pecas carro importado', 'autopecas importadas', 'pecas para importados', 'import car parts'],
    'e-commerce de peças automotivas': ['ecommerce autopecas', 'pecas automotivas online', 'loja virtual autopecas', 'autopecas online', 'pecas online'],
    'smoothie bars': ['smoothie', 'vitaminas', 'sucos'],
    'frozen yogurts': ['frozen yogurt', 'iogurte', 'sorvete iogurte'],
    'bubble tea': ['bubble tea', 'cha', 'boba'],
    'poké bowls': ['poke', 'poke bowl', 'comida havaiana'],
    'pâtisseries': ['patisserie', 'confeitaria fina', 'doces finos'],
    'gelatarias': ['gelataria', 'gelato', 'sorvete artesanal'],
    'casas de frangos': ['casa de frangos', 'frango assado', 'grelhados'],
    'distribuidoras de peixes': ['distribuidora de peixes', 'pescado', 'frutos do mar'],
    'distribuidoras de embutidos': ['distribuidora de embutidos', 'embutidos', 'frios'],
    'peixarias': ['peixaria', 'pescado', 'frutos do mar'],
    'barbearias': ['barbearia', 'barbeiro', 'barber shop'],
    'estúdios de tatuagem': ['estudio de tatuagem', 'tatuagem', 'tattoo', 'piercing'],
    'tabacarias': ['tabacaria', 'tabaco', 'charutos', 'cachimbos'],
    'corretoras de seguros': ['corretora de seguros', 'seguros', 'seguradora'],
    'escritórios de contabilidade': ['escritorio de contabilidade', 'contabilidade', 'contador'],
    'escritórios de advocacia': ['escritorio de advocacia', 'advocacia', 'advogado'],
    'escolas de idiomas': ['escola de idiomas', 'curso de ingles', 'idiomas'],
    'escolas de música': ['escola de musica', 'aula de musica', 'conservatorio'],
    'autoescolas': ['autoescola', 'auto escola', 'centro de formacao de condutores'],
    'lava-rápidos': ['lava rapido', 'lava jato', 'lavagem de carros'],
    'funilarias e pinturas': ['funilaria', 'pintura automotiva', 'lanternagem'],
    'auto elétricas': ['auto eletrica', 'eletrica automotiva', 'eletricista automotivo'],
    'borracharias': ['borracharia', 'pneus', 'borracheiro'],
    'empresas de segurança': ['empresa de seguranca', 'vigilancia', 'seguranca patrimonial'],
    'empresas de limpeza': ['empresa de limpeza', 'limpeza', 'conservacao'],
    'dedetizadoras': ['dedetizadora', 'controle de pragas', 'desinsetizacao'],
    'coworkings': ['coworking', 'espaco compartilhado', 'escritorio compartilhado'],
    'casas de festas': ['casa de festas', 'salao de festas', 'espaco para eventos'],
    'lojas de artigos para piscina': ['artigos para piscina', 'piscinas', 'tratamento de agua'],
    'farmácias e drogarias': ['farmacia', 'drogaria', 'farmácia popular'],
    'drogarias': ['drogaria', 'farmacia'],
    'lojas de produtos de limpeza': ['produtos de limpeza', 'limpeza', 'material de limpeza'],
    'e-commerce': ['e-commerce', 'ecommerce', 'loja virtual', 'loja online'],
    'e-commerces de peças automotivas': ['ecommerce autopecas', 'pecas automotivas online', 'loja virtual autopecas', 'autopecas online'],
    'e-commerces de utilidades domésticas': ['ecommerce utilidades', 'utilidades domesticas online'],
    'e-commerces de perfumaria e casa': ['ecommerce perfumaria', 'perfumes online'],
    'e-commerces de sabonetes': ['ecommerce sabonetes', 'sabonetes artesanais'],
    'e-commerces de presentes finos': ['ecommerce presentes', 'presentes online'],
    'concessionárias': ['concessionaria', 'revenda de veiculos', 'veiculos novos'],
    'revendedores de colchões': ['revenda de colchoes', 'colchao', 'colchoes'],
    'colchoarias': ['colchoaria', 'colchoes', 'cama e colchao'],
    'distribuidores de colchões': ['distribuidora de colchoes', 'colchoes atacado'],
    'lojas de colchões terapêuticos': ['colchao terapeutico', 'colchao ortopedico', 'colchao magnetico'],
    'garden centers': ['garden center', 'jardinagem', 'plantas', 'floricultura'],
    'casas agropecuárias': ['agropecuaria', 'casa agropecuaria', 'produtos rurais'],
    'cooperativas agrícolas': ['cooperativa agricola', 'cooperativa rural'],
    'revendas de insumos agrícolas': ['revenda de insumos', 'defensivos agricolas', 'agroquimicos'],
    'revendas de máquinas agrícolas': ['maquinas agricolas', 'tratores'],
    'tratores e implementos agrícolas': ['tratores', 'implementos agricolas', 'maquinas agricolas'],
    'irrigação': ['irrigacao', 'sistema de irrigacao', 'aspersao', 'gotejamento'],
    'silos e armazéns': ['silo', 'armazem', 'armazenagem de graos'],
    'frigoríficos': ['frigorifico', 'abatedouro', 'carnes'],
    'laticínios': ['laticinios', 'laticinio', 'leite', 'queijo'],
    'queijarias': ['queijaria', 'queijos', 'queijo artesanal'],
    'cervejarias': ['cervejaria', 'cerveja artesanal', 'brewpub'],
    'vinícolas': ['vinicola', 'vinho', 'vitinica'],
    'destilarias': ['destilaria', 'cachaca', 'destilados'],
    'torrefadoras de café': ['torrefadora', 'cafe torrado', 'torrefacao'],
    'empresas de drywall': ['drywall', 'gesso acartonado', 'construcao a seco'],
    'empresas de motoboy': ['motoboy', 'motofrete', 'entrega moto'],
    'guincho e reboque': ['guincho', 'reboque', 'auto socorro'],
    'restaurantes veganos': ['restaurante vegano', 'comida vegana', 'vegan'],
    'restaurantes indianos': ['restaurante indiano', 'comida indiana', 'curry'],
    'restaurantes tailandeses': ['restaurante tailandes', 'comida tailandesa', 'thai'],
    'restaurantes coreanos': ['restaurante coreano', 'comida coreana', 'korean bbq'],
    'restaurantes peruanos': ['restaurante peruano', 'comida peruana', 'ceviche'],
    'restaurantes portugueses': ['restaurante portugues', 'comida portuguesa', 'bacalhau'],
    'restaurantes de frutos do mar': ['frutos do mar', 'marisqueira', 'pescado'],
    'marisquerias': ['marisqueria', 'frutos do mar', 'camarao'],
    'casas de crepe': ['casa de crepe', 'crepe', 'creperie'],
    'casas de waffle': ['casa de waffle', 'waffle'],
    'casas de fondue': ['casa de fondue', 'fondue'],
    'casas de feijoada': ['feijoada', 'casa de feijoada'],
    'restaurantes por quilo': ['restaurante por quilo', 'por quilo', 'self service'],
    'quentinhas e marmitas': ['quentinha', 'marmita', 'marmitex'],
    'restaurantes de comida baiana': ['comida baiana', 'acaraje', 'culinaria baiana'],
    'restaurantes de comida mineira': ['comida mineira', 'culinaria mineira', 'comida de minas'],
    'restaurantes de comida nordestina': ['comida nordestina', 'culinaria nordestina'],
    'restaurantes de comida gaúcha': ['comida gaucha', 'culinaria gaucha', 'churrasco gaucho'],
    'lojas de moda infantil': ['moda infantil', 'roupas infantis', 'roupa de bebe'],
    'lojas de variedades': ['variedades', 'bazar', '1,99', 'loja de utilidades'],
    'lojas de material esportivo': ['material esportivo', 'artigos esportivos', 'esportes'],
    'lojas de celular': ['celular', 'smartphone', 'acessorios celular', 'telefonia'],
    'lojas de bicicleta': ['bicicleta', 'bike', 'ciclismo', 'bike shop'],
    'lojas de veículos elétricos': ['veiculos eletricos', 'patinete eletrico', 'bicicleta eletrica'],
    'lojas de moto': ['moto', 'motocicleta', 'concessionaria de motos'],
    'lojas de carro': ['carro', 'automovel', 'revenda de veiculos'],
    'lojas de informática': ['informatica', 'computadores', 'notebook', 'hardware'],
    'lojas de calçados': ['calcados', 'sapatos', 'tenis', 'sapataria'],
    'lojas de bolsas e acessórios': ['bolsas', 'acessorios', 'malas', 'carteiras'],
    'lojas de brinquedos': ['brinquedos', 'brinquedo', 'loja de brinquedos'],
    'lojas de eletrodomésticos': ['eletrodomesticos', 'eletro', 'magazine'],
    'lojas de cosméticos': ['cosmeticos', 'maquiagem', 'beleza'],
    'livrarias': ['livraria', 'livros', 'livro'],
    'lavanderias': ['lavanderia', 'lavagem', 'tinturaria'],
    'lojas de artigos para festas': ['artigos para festas', 'festas', 'decoracao de festas'],
    'lojas de ferragens': ['ferragens', 'parafusos', 'ferragem'],
    'distribuidores de material médico hospitalar': ['material medico', 'material hospitalar'],
    'distribuidores de pêssegos': ['pessego', 'pessegos', 'distribuidor de pessegos', 'fruta'],
    'empresas de contêineres e módulos': ['container', 'modulo habitacional', 'construcao modular'],
    'empresas de steel frame': ['steel frame', 'construcao a seco', 'light steel frame'],
    'sistemas de incêndio': ['sistema de incendio', 'extintores', 'bombeiro civil', 'combate a incendio'],
    'engenharias': ['engenharia', 'consultoria em engenharia', 'projeto de engenharia'],
    'lojas de tintas': ['tintas', 'loja de tintas', 'tinta', 'verniz'],
    'lojas de pisos e azulejos': ['pisos', 'azulejos', 'ceramica', 'porcelanato'],
    'lojas de iluminação': ['iluminacao', 'luminarias', 'lustres', 'led'],
    'lojas de lustres e luminárias': ['lustres', 'luminarias', 'iluminacao decorativa'],
    'lojas de decoração': ['decoracao', 'loja de decoracao', 'artigos decorativos'],
    'design de interiores': ['design de interiores', 'decoracao de interiores', 'interiores'],
    'paisagismo e jardinagem': ['paisagismo', 'jardinagem', 'jardim'],
    'viveiros de plantas': ['viveiro de plantas', 'mudas', 'viveiro'],
    'açougues gourmet': ['acougue gourmet', 'boutique de carnes', 'carnes nobres', 'carnes premium'],
    'lojas de epi': ['epi', 'equipamento de protecao', 'seguranca do trabalho'],
    'distribuidoras de gases industriais': ['gases industriais', 'oxigenio', 'acetileno', 'gas'],
    'empresas de ar condicionado': ['ar condicionado', 'climatizacao', 'split'],
    'empresas de paisagismo e jardinagem': ['paisagismo', 'jardinagem', 'manutencao de jardim'],
    'depósitos de materiais de construção': ['deposito de construcao', 'deposito de materiais', 'material de construcao'],
    'agências de marketing digital': ['agencia de marketing', 'marketing digital', 'agencia digital'],
    'agências de seo': ['agencia de seo', 'seo', 'otimizacao para buscadores'],
    'agências de mídias sociais': ['midias sociais', 'redes sociais', 'social media'],
    'agências de branding': ['branding', 'marca', 'identidade visual'],
    'agências de comunicação': ['agencia de comunicacao', 'comunicacao', 'assessoria de imprensa'],
    'agências de relações públicas': ['relacoes publicas', 'rp', 'assessoria de comunicacao'],
    'agências de recrutamento': ['recrutamento', 'selecao', 'headhunter', 'rh'],
    'empresas de treinamento corporativo': ['treinamento corporativo', 'capacitacao', 'treinamento empresarial'],
    'empresas de consultoria em ti': ['consultoria em ti', 'consultoria de tecnologia'],
    'empresas de infraestrutura de ti': ['infraestrutura de ti', 'datacenter', 'rede'],
    'empresas de suporte técnico': ['suporte tecnico', 'assistencia tecnica', 'help desk'],
    'empresas de telecomunicações': ['telecomunicacoes', 'telecom', 'telefonia'],
    'provedores de internet': ['provedor de internet', 'internet', 'fibra optica'],
    'empresas de data center': ['data center', 'datacenter', 'hospedagem'],
    'empresas de cloud computing': ['cloud computing', 'nuvem', 'computacao em nuvem'],
    'empresas de cibersegurança': ['ciberseguranca', 'seguranca da informacao', 'cyber security'],
    'empresas de automação comercial': ['automacao comercial', 'pdv', 'sistema para comercio'],
    'empresas de controle de acesso': ['controle de acesso', 'catraca', 'biometria'],
    'empresas de alarmes': ['alarmes', 'sistema de alarme', 'monitoramento'],
    'empresas de monitoramento': ['monitoramento', 'central de monitoramento', 'vigilancia'],
    'empresas de portaria remota': ['portaria remota', 'portaria virtual'],
    'empresas de engenharia mecânica': ['engenharia mecanica', 'projeto mecanico'],
    'empresas de engenharia ambiental': ['engenharia ambiental', 'meio ambiente', 'licenciamento ambiental'],
    'empresas de topografia': ['topografia', 'levantamento topografico', 'agrimensura'],
    'empresas de demolição': ['demolicao', 'demolidora'],
    'empresas de fundações': ['fundacoes', 'estacas', 'fundacao profunda'],
    'empresas de perfuração de poços': ['perfuracao de pocos', 'poco artesiano', 'poco'],
    'empresas de energia eólica': ['energia eolica', 'aerogerador', 'turbina eolica'],
    'despachantes aduaneiros': ['despachante aduaneiro', 'desembaraco aduaneiro', 'importacao'],
    'empresas de comércio exterior': ['comercio exterior', 'importacao', 'exportacao'],
    'trading companies': ['trading', 'trading company', 'comercio internacional'],
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
    // Smart fallback: generate terms from the segment name itself
    const baseTerms: string[] = [term];
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedTerm !== term) baseTerms.push(normalizedTerm);
    
    // Singular/plural variations
    if (term.endsWith('s') && term.length > 4) baseTerms.push(term.slice(0, -1));
    if (term.endsWith('es') && term.length > 5) baseTerms.push(term.slice(0, -2));
    if (term.endsWith('ões') || term.endsWith('oes')) baseTerms.push(term.replace(/ões$|oes$/, 'ão'));
    if (term.endsWith('ais') && term.length > 5) baseTerms.push(term.replace(/ais$/, 'al'));

    // Remove common prefixes to get the core term
    const prefixes = [
      /^lojas?\s+de\s+/, /^distribuidoras?\s+de\s+/, /^indústrias?\s+de\s+/,
      /^industrias?\s+de\s+/, /^fábricas?\s+de\s+/, /^fabricas?\s+de\s+/,
      /^empresas?\s+de\s+/, /^clínicas?\s+de\s+/, /^clinicas?\s+de\s+/,
    ];
    for (const prefix of prefixes) {
      const match = term.match(prefix);
      if (match) {
        const core = term.replace(prefix, '').trim();
        if (core.length >= 3) {
          baseTerms.push(core);
          const normalizedCore = core.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (normalizedCore !== core) baseTerms.push(normalizedCore);
        }
        break;
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
  const s = segment.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const r = region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return `local|${s}|${r}`;
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segment, region, businessType, whatsappOnly, receitaFederalOnly } = await req.json();
    console.log('🔍 LOCAL DB SEARCH v1 - Input:', { segment, region, businessType, whatsappOnly, receitaFederalOnly });

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

    // ===== CHECK DB CACHE =====
    const { data: cachedData } = await adminClient
      .from("cached_search_results")
      .select("results, results_count, created_at, expires_at")
      .eq("cache_key", dbCacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cachedData && cachedData.results_count > 0) {
      console.log(`✅ DB CACHE HIT: ${cachedData.results_count} leads`);
      const cachedLeads = cachedData.results as any[];

      return new Response(JSON.stringify({ leads: cachedLeads, fromCache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('💾 DB CACHE MISS - searching local database');

    // ===== PARSE REGION =====
    const { city, state, isStateOnly } = parseRegion(region.trim());
    console.log(`📍 Parsed region: city=${city}, state=${state}, isStateOnly=${isStateOnly}`);

    // ===== PARSE SEGMENTS =====
    const segments = segment.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    console.log(`📋 Segments: ${segments.join(', ')}`);

    // ===== USER LEAD LIMITS =====
    let userMaxLeads: number | null = null;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) {
          const { data: limitData } = await supabaseAuth
            .from("user_lead_limits")
            .select("leads_per_search")
            .eq("user_id", user.id)
            .maybeSingle();
          if (limitData?.leads_per_search) {
            userMaxLeads = limitData.leads_per_search;
            console.log(`👤 User lead limit: ${userMaxLeads}`);
          }
        }
      }
    } catch (e) { console.error("⚠️ Error fetching user limits:", e); }

    const MAX_LEADS = userMaxLeads || (isStateOnly ? 6000 : 3000);
    const leadsPerSegment = Math.ceil(MAX_LEADS / segments.length);

    // ===== QUERY LOCAL DATABASE =====
    let allCompanies: any[] = [];

    for (const seg of segments) {
      const terms = generateSearchTerms(seg).slice(0, 10);
      console.log(`📤 Segment "${seg}" search terms:`, terms);

      // Use optimized RPC function
      const targetPerSegment = Math.min(leadsPerSegment * 2, 5000);
      let segResults: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (segResults.length < targetPerSegment && page < 10) {
        const { data, error } = await adminClient.rpc('search_companies', {
          p_city: city || null,
          p_state: state || null,
          p_search_terms: terms,
          p_biz_type: bizType || 'all',
          p_limit_val: pageSize,
          p_offset_val: page * pageSize,
        });

        if (error) {
          console.error(`❌ DB query error for segment "${seg}" page ${page}:`, error.message);
          break;
        }

        if (!data || data.length === 0) break;
        segResults.push(...data);
        page++;
        if (data.length < pageSize) break;
      }

      console.log(`📊 Segment "${seg}": ${segResults.length} results from DB (${page} pages)`);
      allCompanies.push(...segResults.map((c: any) => ({ ...c, _segment: seg })));
    }

    console.log(`📊 Total raw companies: ${allCompanies.length}`);

    // ===== FILTER: valid phone required (check both telefone_1 and telefone_2) =====
    allCompanies = allCompanies.filter(c => isPhoneValid(c.telefone_1) || isPhoneValid(c.telefone_2));
    console.log(`📞 After phone filter: ${allCompanies.length}`);

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

    // ===== DEDUPLICATE by nome_fantasia + cidade (same name in same city) =====
    const seenNameCity = new Set<string>();
    allCompanies = allCompanies.filter(c => {
      const nf = (c.nome_fantasia || '').trim().toUpperCase();
      const cid = (c.cidade || '').trim().toUpperCase();
      if (nf && cid) {
        const key = `${nf}|${cid}`;
        if (seenNameCity.has(key)) return false;
        seenNameCity.add(key);
      }
      return true;
    });
    console.log(`📊 After name+city dedup: ${allCompanies.length}`);

    // ===== STRICT RELEVANCE FILTER FOR DISTRIBUTORS =====
    // When searching for "distribuidores/distribuidoras", filter out companies that are NOT distributors
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

      const beforeDistFilter = allCompanies.length;
      allCompanies = allCompanies.filter(c => {
        const seg = (c._segment || '').toLowerCase();
        // Only apply strict filter to distributor segments
        if (!seg.includes('distribuidor') && !seg.includes('distribuidora')) return true;

        const nf = normalizeText(c.nome_fantasia || '').toLowerCase();
        const cnae = normalizeText(c.descricao_cnae || '').toLowerCase();
        const rs = normalizeText(c.razao_social || '').toLowerCase();
        const combined = `${nf} ${cnae} ${rs}`;

        return distributorKeywords.some(kw => combined.includes(kw));
      });
      console.log(`🔍 Distributor strict filter: ${allCompanies.length} (removed ${beforeDistFilter - allCompanies.length} non-distributors)`);
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
      // Format name: title case, filter out asterisks-only names
      let rawName = c.nome_fantasia && c.nome_fantasia.trim() !== '' && !(/^\*+$/.test(c.nome_fantasia.trim())) ? c.nome_fantasia : c.razao_social || 'Empresa';
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

    console.log(`✅ FINAL: ${leads.length} leads`);

    // ===== GET USER ID FOR LOGGING =====
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) userId = user.id;
      }
    } catch (e) { console.error("⚠️ Auth error:", e); }

    if (leads.length === 0) {
      return new Response(JSON.stringify({ error: `Nenhum estabelecimento encontrado para "${segment}" em ${region}. Tente outra região ou outro segmento.` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== SAVE TO DB CACHE =====
    try {
      await adminClient.from("cached_search_results").upsert({
        cache_key: dbCacheKey,
        search_type: 'leads',
        search_config: { segment, region: region.trim(), businessType: bizType, whatsappOnly: filterWhatsappOnly },
        results: leads,
        results_count: leads.length,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'cache_key' });
      console.log(`💾 Cached ${leads.length} leads`);
    } catch (e) { console.error("⚠️ Cache save error:", e); }

    // ===== LOG SEARCH =====
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader && userId) {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) {
          await adminClient.from("search_logs").insert({
            user_id: user.id,
            user_email: user.email || '',
            search_type: 'leads',
            search_config: { segment, region: region.trim(), businessType: bizType },
            results_count: leads.length,
            results: leads.slice(0, 10),
          });
        }
      }
    } catch (e) { console.error("⚠️ Search log error:", e); }

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

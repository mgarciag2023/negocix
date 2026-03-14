import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";

import { useToast } from "@/hooks/use-toast";

const Configuration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState("");
  const [country, setCountry] = useState("BR");
  const [customCountry, setCustomCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [ecommerceType, setEcommerceType] = useState("");
  const [businessType, setBusinessType] = useState("all"); // all, matriz, filial
  const [digitalPresence, setDigitalPresence] = useState("all"); // all, no-site, basic-site, structured-site
  const [digitalActivity, setDigitalActivity] = useState("all"); // all, low, basic, active
  const [customerSearch, setCustomerSearch] = useState(""); // Search filter for customer types
  // whatsappOnly removed - was filtering out too many leads
  // receitaFederalOnly removed

  const countries = [
    { code: "BR", name: "Brasil" },
    { code: "US", name: "Estados Unidos" },
    { code: "PT", name: "Portugal" },
    { code: "ES", name: "Espanha" },
    { code: "AR", name: "Argentina" },
    { code: "CL", name: "Chile" },
    { code: "CO", name: "Colômbia" },
    { code: "MX", name: "México" },
    { code: "PE", name: "Peru" },
    { code: "UY", name: "Uruguai" },
    { code: "PY", name: "Paraguai" },
    { code: "BO", name: "Bolívia" },
    { code: "EC", name: "Equador" },
    { code: "VE", name: "Venezuela" },
    { code: "IT", name: "Itália" },
    { code: "FR", name: "França" },
    { code: "DE", name: "Alemanha" },
    { code: "UK", name: "Reino Unido" },
    { code: "CA", name: "Canadá" },
    { code: "JP", name: "Japão" },
    { code: "CN", name: "China" },
    { code: "OTHER", name: "Outro país" },
  ];

  const brazilianStates = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const customerTypes = [
    "Restaurantes",
    "Pizzarias",
    "Padarias",
    "Bares",
    "Lanchonetes",
    "Supermercados",
    "Hipermercados",
    "Mercados",
    "Mercearias",
    "Atacadistas de Alimentos",
    "Distribuidores de Alimentos",
    "Distribuidores de Food Service",
    "Cestas Básicas",
    "Confeitarias",
    "Docerias",
    "Salgadeiros",
    "Empresas de Gulla",
    "Pastelarias",
    "Hamburguerias",
    "Esfiharias",
    "Hot Dogs",
    "Food Trucks",
    "Churrascarias",
    "Catering",
    "Casas de Massas",
    "Indústrias de Alimentos",
    "Granjas",
    "Lojas de Pneus",
    "Lojas de Rodas Esportivas",
    "Cozinhas Industriais",
    "Indústrias de Biscoitos",
    "Distribuidoras de Doces",
    "Indústrias de Produtos Pet",
    "Agência de Eventos",
    "Distribuidores de Frios",
    "Farmácias",
    "Lojas de Roupas",
    "Salões de Beleza",
    "Escritórios",
    "Materiais de Construção",
    "Lojas de Materiais Elétricos",
    "Agropecuária",
    "E-commerce",
    "Lojas de Ferramentas",
    "Chaveiros",
    "Indústrias de Pão de Queijo",
    "Escolinhas de Futebol",
    "Escolinhas de Basquete",
    "Escolinhas de Natação",
    "Escolinhas de Artes Marciais",
    "Arenas de Beach Tennis",
    "Quadras de Tênis",
    "Clubes Esportivos",
    "Confecções",
    "Lojas de Tecidos",
    "Lojas de Tecidos para Decoração",
    "Ateliês de Costura",
    "Indústrias Têxteis",
    "Bordados",
    "Lojas de Aviamentos",
    "Malharias",
    "Fábricas de Uniformes",
    "Lojas de Tapeçaria, Cortinas e Persianas",
    "Transportadoras",
    "Frotistas",
    "Empresas com Frota Própria",
    "Vans Escolares",
    "Táxis e Cooperativas",
    "Motoristas de Aplicativo",
    "Empresas de Logística",
    "Locadoras de Veículos",
    "Empresas de Turismo",
    "Clínicas Médicas",
    "Clínicas Odontológicas",
    "Hospitais",
    "Laboratórios",
    "Clínicas de Fisioterapia",
    "Ortopedias",
    "Distribuidoras de Produtos Hospitalares",
    "Planos de Saúde",
    "Home Care",
    "Clínicas de Psicologia",
    "Nutricionistas",
    "Fonoaudiólogos",
    "Gráficas",
    "Comunicação Visual",
    "Impressão Digital",
    "Agências de Publicidade",
    "Estúdios de Design",
    "Produtoras de Conteúdo",
    "Lojas de Sinalização",
    "Serigrafias",
    "Estamparias",
    "Fábricas de Embalagens",
    "Distribuidoras de Embalagens",
    "Editoras",
    "Construtoras",
    "Empreiteiras",
    "Incorporadoras",
    "Arquitetos",
    "Escritórios de Arquitetura",
    "Marmorarias",
    "Vidraçarias",
    "Serralherias",
    "Imobiliárias",
    "Gesseiros",
    "Fabricantes de Esquadrias de Alumínio",
    "Fabricantes de Esquadrias de Madeira",
    "Lojas de Revestimentos",
    "Lojas de Portas",
    "Indústrias de Eletrônica",
    "Indústrias Automotivas",
    "Indústrias de Automação",
    "Indústrias de Iluminação e LED",
    "Montadores de Painel Elétrico",
    "Empresas de Automação Industrial",
    "Instaladores Elétricos",
    "Empresas de Manutenção Elétrica",
    "Empresas de Energia Solar",
    "Indústrias que Montam ou Reformam Painéis",
    "Metalúrgicas",
    "Siderúrgicas",
    "Empresas de Solda",
    "Caldeirarias",
    "Usinagens",
    "Estruturas Metálicas",
    "Fabricantes de Máquinas e Equipamentos",
    "Distribuidores de Aço e Ferro",
    "Distribuidores de Material Médico Hospitalar",
    "Distribuidores de Pêssegos",
    "Indústrias Mecânicas",
    "Indústrias de Plásticos",
    "Indústrias Químicas",
    "Indústrias de Papel e Celulose",
    "Indústrias de Borracha",
    "Indústrias de Vidro",
    "Indústrias de Cerâmica",
    "Indústrias de Cosméticos",
    "Indústrias Farmacêuticas",
    "Indústrias de Bebidas",
    "Indústrias de Embalagens",
    "Indústrias de Móveis",
    "Indústrias de Calçados",
    "Indústrias de Tintas",
    "Indústrias de Fertilizantes",
    "Indústrias de Ração Animal",
    "Indústrias de Produtos de Limpeza",
    "Indústrias de Papel Higiênico e Descartáveis",
    "Indústrias Gráficas",
    "Indústrias de Componentes Eletrônicos",
    "Indústrias de Fios e Cabos",
    "Lojas de Produtos Naturais",
    "Empórios Naturais",
    "Lojas de Suplementos",
    "Hortifrútis",
    "Lojas Veganas",
    "Academias",
    "Clínicas de Estética",
    "Spas",
    "Pet Shops",
    "Loja de Ração Pet",
    "Fabricantes de Ração Pet",
    "Banho e Tosa",
    "Hotéis Pet",
    "Creches Pet",
    "Adestramento de Animais",
    "Clínicas Veterinárias",
    "Abatedouros de Aves",
    "Abatedouros de Bovinos",
    "Abatedouros de Suínos",
    "Abatedouros e Frigoríficos",
    "Oficinas Mecânicas",
    "Autopeças",
    "Distribuidores de Autopeças",
    "Postos de Combustível",
    "Hotéis e Pousadas",
    "Escolas e Cursos",
    "Papelarias",
    "Óticas",
    "Joalherias",
    "Lojas de Cama, Mesa e Banho",
    "Lojas de Utilidades Domésticas",
    "Distribuidores de Água",
    "Distribuidores de Refrigerantes",
    "Distribuidores de Cervejas",
    "Artigos de Caça, Pesca e Camping",
    "Cartonagem",
    "Restaurantes Japoneses",
    "Sushi Bars",
    "Restaurantes Orientais",
    "Restaurantes Chineses",
    "Temakerias",
    "Lojas de Presentes de Alto Padrão",
    "Perfumarias",
    "Restaurantes Premium",
    "Buffets de Festas",
    "Empresas de Locação de Materiais para Eventos",
    "Indústrias de Mineração",
    "Indústrias Sucroalcooleiras",
    "Autopeças de Vans e Utilitários",
    "E-commerces de Peças Automotivas",
    "E-commerces de Utilidades Domésticas",
    "E-commerces de Perfumaria e Casa",
    "E-commerces de Sabonetes",
    "E-commerces de Presentes Finos",
    "Lojas de Moda Infantil",
    "Lojas de Móveis",
    "Lojas de Variedades",
    "Lojas de Material Esportivo",
    "Lojas de Celular",
    "Lojas de Bicicleta",
    "Lojas de Veículos Elétricos",
    "Lojas de Autopropelidos",
    "Lojas de Moto",
    "Lojas de Carro",
    "Concessionárias",
    "Lojas de Informática",
    "Lojas de Calçados",
    "Lojas de Bolsas e Acessórios",
    "Lojas de Brinquedos",
    "Lojas de Colchões",
    "Lojas de Eletrodomésticos",
    "Lojas de Cosméticos",
    // 30 novos segmentos
    "Floriculturas",
    "Livrarias",
    "Lavanderias",
    "Açougues",
    "Peixarias",
    "Barbearias",
    "Estúdios de Tatuagem",
    "Sorveterias",
    "Cafeterias",
    "Cervejarias Artesanais",
    "Tabacarias",
    "Lojas de Artigos para Festas",
    "Corretoras de Seguros",
    "Escritórios de Contabilidade",
    "Escritórios de Advocacia",
    "Escolas de Idiomas",
    "Escolas de Música",
    "Autoescolas",
    "Lava-Rápidos",
    "Funilarias e Pinturas",
    "Auto Elétricas",
    "Borracharias",
    "Empresas de Segurança",
    "Empresas de Limpeza",
    "Dedetizadoras",
    "Coworkings",
    "Casas de Festas",
    "Lojas de Artigos para Piscina",
    "Lojas de Artigos Religiosos",
    "Adegas e Distribuidoras de Vinhos",
    // 30 novos segmentos (lote 2)
    "Casas Lotéricas",
    "Cartórios",
    "Despachantes",
    "Estacionamentos",
    "Funerárias",
    "Casas de Repouso",
    "Creches e Berçários",
    "Escolas Particulares",
    "Faculdades e Universidades",
    "Cursos Técnicos e Profissionalizantes",
    "Consultorias Empresariais",
    "Agências de Viagens",
    "Casas de Câmbio",
    "Financeiras e Crédito",
    "Cooperativas de Crédito",
    "Seguradoras",
    "Lotéricas e Correspondentes Bancários",
    "Empresas de Contêineres e Módulos",
    "Empresas de Mudanças",
    "Guardas-Móveis",
    "Empresas de Reciclagem",
    "Sucateiros",
    "Ferro-Velhos",
    "Lojas de EPI",
    "Distribuidoras de Gases Industriais",
    "Empresas de Ar Condicionado",
    "Empresas de Elevadores",
    "Empresas de Impermeabilização",
    "Empresas de Desentupimento",
    "Empresas de Paisagismo e Jardinagem",
    "Empresas de Steel Frame",
    "Construtoras de Pré-Moldado",
    "Sistemas de Incêndio",
    "Engenharias",
    // 80 novos segmentos
    "Clínicas de Dermatologia",
    "Clínicas de Oftalmologia",
    "Clínicas de Cardiologia",
    "Clínicas de Pediatria",
    "Clínicas de Ginecologia",
    "Clínicas de Urologia",
    "Clínicas de Ortopedia",
    "Clínicas de Neurologia",
    "Dentistas e Consultórios Odontológicos",
    "Próteses Dentárias",
    "Laboratórios de Prótese Dentária",
    "Distribuidoras de Produtos Odontológicos",
    "Depósitos de Materiais de Construção",
    "Lojas de Tintas",
    "Lojas de Pisos e Azulejos",
    "Lojas de Iluminação",
    "Lojas de Lustres e Luminárias",
    "Lojas de Decoração",
    "Design de Interiores",
    "Paisagismo e Jardinagem",
    "Viveiros de Plantas",
    "Garden Centers",
    "Casas Agropecuárias",
    "Cooperativas Agrícolas",
    "Revendas de Insumos Agrícolas",
    "Revendas de Máquinas Agrícolas",
    "Tratores e Implementos Agrícolas",
    "Irrigação",
    "Silos e Armazéns",
    "Frigoríficos",
    "Laticínios",
    "Queijarias",
    "Cervejarias",
    "Vinícolas",
    "Destilarias",
    "Torrefadoras de Café",
    "Empresas de Climatização",
    "Empresas de Refrigeração Industrial",
    "Empresas de Ventilação Industrial",
    "Empresas de Caldeiras e Vapor",
    "Empresas de Compressores",
    "Empresas de Bombas Hidráulicas",
    "Empresas de Tratamento de Água",
    "Empresas de Saneamento",
    "Empresas de Gestão de Resíduos",
    "Empresas de Coleta de Lixo",
    "Empresas de Terraplanagem",
    "Empresas de Pavimentação",
    "Concreteiras",
    "Usinas de Asfalto",
    "Pedras e Mármores",
    "Granitos",
    "Lojas de Artigos de Pesca",
    "Casas de Armas e Munições",
    "Estandes de Tiro",
    "Casas de Câmbio e Remessas",
    "Seguros de Vida e Previdência",
    "Corretoras de Imóveis",
    "Administradoras de Condomínios",
    "Empresas de Portaria e Zeladoria",
    "Academias de Dança",
    "Escolas de Teatro",
    "Estúdios de Pilates",
    "Estúdios de Yoga",
    "Estúdios de Fotografia",
    "Produtoras de Vídeo",
    "Estúdios de Gravação",
    "Gráficas Rápidas",
    "Copiadora e Impressão",
    "Lojas de Artesanato",
    "Lojas de Aviamentos e Armarinhos",
    "Antiquários",
    "Brechós",
    "Lojas de Instrumentos Musicais",
    "Lojas de Som e Acessórios Automotivos",
    "Empresas de Rastreamento Veicular",
    "Empresas de Blindagem",
    "Retíficas de Motores",
    "Autovidros",
    // ===== LOTE 1: ~250 novos segmentos =====
    // --- Comércio e Varejo ---
    "Lojas de Perfumes Importados",
    "Lojas de Produtos de Limpeza",
    "Lojas de Produtos para Cabelo",
    "Lojas de Maquiagem",
    "Lojas de Suplementos Esportivos",
    "Lojas de Produtos Orgânicos",
    "Lojas de Produtos sem Glúten",
    "Lojas de Bebidas",
    "Lojas de Vinhos",
    "Lojas de Cervejas Artesanais",
    "Lojas de Café Gourmet",
    "Lojas de Chás e Especiarias",
    "Lojas de Produtos Árabes",
    "Lojas de Produtos Orientais",
    "Lojas de Conveniência",
    "Lojas de Produtos para Piscina",
    "Lojas de Produtos de Segurança",
    "Lojas de Câmeras e Alarmes",
    "Lojas de Equipamentos de Proteção",
    "Lojas de Equipamentos de Ginástica",
    "Lojas de Produtos para Camping",
    "Lojas de Malas e Mochilas",
    "Lojas de Artigos Militares",
    "Lojas de Óculos de Sol",
    "Lojas de Relógios",
    "Lojas de Semijoias",
    "Lojas de Bijuterias",
    "Lojas de Artigos para Bebê",
    "Lojas de Fraldas",
    "Lojas de Produtos para Gestantes",
    "Lojas de Artigos para Aniversário",
    "Lojas de Balões",
    "Lojas de Embalagens para Presentes",
    "Lojas de Artigos de Papelaria Fina",
    "Lojas de Material de Escritório",
    "Lojas de Móveis para Escritório",
    "Lojas de Informática e Periféricos",
    "Lojas de Games e Videogames",
    "Lojas de Drones",
    "Lojas de Aeromodelismo",
    "Lojas de Som Profissional",
    "Lojas de Equipamentos de DJ",
    "Lojas de Artigos para Churrasco",
    "Lojas de Lareiras e Aquecedores",
    "Lojas de Ar Condicionado",
    "Lojas de Geradores",
    "Lojas de Ferragens",
    "Lojas de Parafusos",
    "Lojas de Rolamentos",
    "Lojas de Correias e Mangueiras",
    // --- Alimentação e Gastronomia ---
    "Açaiterias",
    "Casas de Açaí",
    "Creperies",
    "Tapiocarias",
    "Casas de Sucos",
    "Smoothie Bars",
    "Restaurantes Veganos",
    "Restaurantes Vegetarianos",
    "Restaurantes Fit",
    "Restaurantes Self-Service",
    "Restaurantes Italianos",
    "Restaurantes Mexicanos",
    "Restaurantes Indianos",
    "Restaurantes Tailandeses",
    "Restaurantes Coreanos",
    "Restaurantes Peruanos",
    "Restaurantes Árabes",
    "Restaurantes Portugueses",
    "Restaurantes de Frutos do Mar",
    "Marisquerias",
    "Casas de Crepe",
    "Casas de Waffle",
    "Casas de Fondue",
    "Espetarias",
    "Casas de Feijoada",
    "Restaurantes por Quilo",
    "Marmitarias",
    "Quentinhas e Marmitas",
    "Restaurantes de Comida Baiana",
    "Restaurantes de Comida Mineira",
    "Restaurantes de Comida Nordestina",
    "Restaurantes de Comida Gaúcha",
    "Padarias Artesanais",
    "Pâtisseries",
    "Chocolaterias",
    "Gelatarias",
    "Frozen Yogurts",
    "Bubble Tea",
    "Poké Bowls",
    "Açougues Gourmet",
    "Empórios Gourmet",
    "Delicatessens",
    "Rotisseries",
    "Casas de Carnes",
    "Casas de Frangos",
    "Distribuidoras de Carnes",
    "Distribuidoras de Peixes",
    "Distribuidoras de Congelados",
    "Distribuidoras de Sorvetes",
    "Distribuidoras de Açaí",
    "Distribuidoras de Polpas de Frutas",
    "Distribuidoras de Ovos",
    "Distribuidoras de Queijos",
    "Distribuidoras de Embutidos",
    // --- Indústria e Manufatura ---
    "Indústrias de Alimentos Congelados",
    "Indústrias de Conservas",
    "Indústrias de Massas",
    "Indústrias de Temperos e Condimentos",
    "Indústrias de Molhos",
    "Indústrias de Laticínios",
    "Indústrias de Sorvetes",
    "Indústrias de Chocolates",
    "Indústrias de Balas e Guloseimas",
    "Indústrias de Salgadinhos",
    "Indústrias de Café",
    "Indústrias de Chá e Ervas",
    "Indústrias de Sucos e Polpas",
    "Indústrias de Água Mineral",
    "Indústrias de Refrigerantes",
    "Indústrias de Cervejas",
    "Indústrias de Cachaça",
    "Indústrias de Vinagres",
    "Indústrias de Óleos e Azeites",
    "Indústrias de Farinhas",
    "Indústrias de Açúcar",
    "Indústrias de Arroz",
    "Indústrias de Feijão",
    "Indústrias de Carvão",
    "Indústrias de Gelo",
    "Indústrias de Velas",
    "Indústrias de Sabão e Sabonetes",
    "Indústrias de Detergentes",
    "Indústrias de Perfumes",
    "Indústrias de Fraldas Descartáveis",
    "Indústrias de Colchões",
    "Indústrias de Estofados",
    "Indústrias de Espumas",
    "Indústrias de Travesseiros",
    "Indústrias de Vassouras e Escovas",
    "Indústrias de Cordas e Barbantes",
    "Indústrias de Redes e Telas",
    "Indústrias de Arames",
    "Indústrias de Pregos e Parafusos",
    "Indústrias de Tubos e Conexões",
    "Indústrias de PVC",
    "Indústrias de Fibra de Vidro",
    "Indústrias de Acrílico",
    "Indústrias de Isopor",
    "Indústrias de Sacolas Plásticas",
    "Indústrias de Sacos de Lixo",
    "Indústrias de Descartáveis Plásticos",
    "Indústrias de Brinquedos",
    "Indústrias de Joias",
    "Indústrias de Bijuterias",
    "Indústrias de Botões e Zíperes",
    "Indústrias de Etiquetas e Rótulos",
    "Indústrias de Fitas Adesivas",
    "Indústrias de Caixas de Papelão",
    "Indústrias de Paletes",
    "Indústrias de Compensados",
    "Indústrias de MDF e MDP",
    "Indústrias de Portas e Janelas",
    "Indústrias de Telhas",
    "Indústrias de Blocos e Tijolos",
    "Indústrias de Argamassa",
    "Indústrias de Impermeabilizantes",
    "Indústrias de Resinas",
    "Indústrias de Adesivos e Colas",
    "Indústrias de Tintas Automotivas",
    "Indústrias de Vernizes e Solventes",
    "Indústrias de Lubrificantes",
    "Indústrias de Baterias",
    "Indústrias de Transformadores",
    "Indústrias de Motores Elétricos",
    "Indústrias de Geradores",
    "Indústrias de Painéis Solares",
    "Indústrias de Implementos Agrícolas",
    "Indústrias de Silos",
    "Indústrias de Tanques",
    "Indústrias de Equipamentos de Laboratório",
    "Indústrias de Instrumentos de Medição",
    "Indústrias de Equipamentos Hospitalares",
    "Indústrias de Próteses",
    // --- Saúde e Bem-estar ---
    "Clínicas de Endocrinologia",
    "Clínicas de Gastroenterologia",
    "Clínicas de Pneumologia",
    "Clínicas de Reumatologia",
    "Clínicas de Oncologia",
    "Clínicas de Hematologia",
    "Clínicas de Nefrologia",
    "Clínicas de Otorrinolaringologia",
    "Clínicas de Proctologia",
    "Clínicas de Geriatria",
    "Clínicas de Medicina do Trabalho",
    "Clínicas de Medicina Esportiva",
    "Clínicas de Acupuntura",
    "Clínicas de Quiropraxia",
    "Clínicas de Osteopatia",
    "Clínicas de Podologia",
    "Clínicas de Fonoaudiologia",
    "Clínicas de Terapia Ocupacional",
    "Clínicas de Reprodução Humana",
    "Clínicas de Cirurgia Plástica",
    "Clínicas de Implantes Dentários",
    "Clínicas de Ortodontia",
    "Centros de Reabilitação",
    "Centros de Hemodiálise",
    "Centros de Diagnóstico por Imagem",
    "Centros de Medicina Nuclear",
    "Centros de Radioterapia",
    "Farmácias de Manipulação",
    "Drogarias",
    "Óticas e Lentes de Contato",
    "Aparelhos Auditivos",
    "Casas de Saúde",
    "Centros Médicos",
    "Policlínicas",
    "UBS e Postos de Saúde",
    // --- Serviços e B2B ---
    "Agências de Marketing Digital",
    "Agências de SEO",
    "Agências de Mídias Sociais",
    "Agências de Branding",
    "Agências de Comunicação",
    "Agências de Relações Públicas",
    "Agências de Recrutamento",
    "Empresas de RH e Terceirização",
    "Empresas de Treinamento Corporativo",
    "Empresas de Consultoria em TI",
    "Empresas de Desenvolvimento de Software",
    "Empresas de Infraestrutura de TI",
    "Empresas de Suporte Técnico",
    "Empresas de Telecomunicações",
    "Provedores de Internet",
    "Empresas de Data Center",
    "Empresas de Cloud Computing",
    "Empresas de Cibersegurança",
    "Empresas de Automação Comercial",
    "Empresas de Controle de Acesso",
    "Empresas de CFTV",
    "Empresas de Alarmes",
    "Empresas de Monitoramento",
    "Empresas de Portaria Remota",
    "Empresas de Engenharia Elétrica",
    "Empresas de Engenharia Mecânica",
    "Empresas de Engenharia Ambiental",
    "Empresas de Topografia",
    "Empresas de Sondagem",
    "Empresas de Demolição",
    "Empresas de Escavação",
    "Empresas de Drenagem",
    "Empresas de Fundações",
    "Empresas de Perfuração de Poços",
    "Empresas de Energia Eólica",
    "Empresas de Biomassa",
    "Empresas de Biodigestores",
    "Despachantes Aduaneiros",
    "Empresas de Comércio Exterior",
    "Importadoras",
    "Exportadoras",
    "Trading Companies",
    "Empresas de Assessoria Contábil",
    "Empresas de Auditoria",
    "Empresas de Perícia",
    "Empresas de Laudos Técnicos",
    "Empresas de Certificação",
    "Empresas de Metrologia",
    "Empresas de Calibração",
    "Empresas de Inspeção Veicular",
    "Empresas de Vistoria",
    "Guincho e Reboque",
    "Empresas de Socorro Mecânico",
    "Empresas de Transporte de Cargas Pesadas",
    "Empresas de Transporte Refrigerado",
    "Empresas de Transporte de Valores",
    "Empresas de Motoboy",
    "Empresas de Courier",
    "Empresas de Entrega Expressa",
    // ===== MEGA LOTE: +2000 novos segmentos =====
    // --- COMÉRCIO VAREJISTA ESPECIALIZADO ---
    "Lojas de Artigos de Couro",
    "Lojas de Artigos de Viagem",
    "Lojas de Artigos Esotéricos",
    "Lojas de Artigos Náuticos",
    "Lojas de Artigos para Animais Exóticos",
    "Lojas de Artigos para Aquário",
    "Lojas de Artigos para Artesanato",
    "Lojas de Artigos para Cavalos",
    "Lojas de Artigos para Costura",
    "Lojas de Artigos para Jardinagem",
    "Lojas de Artigos para Panificação",
    "Lojas de Artigos para Pintura Artística",
    "Lojas de Artigos para Yoga",
    "Lojas de Artigos Promocionais",
    "Lojas de Artigos Religiosos e Umbanda",
    "Lojas de Artigos Vintage",
    "Lojas de Atacado de Roupas",
    "Lojas de Atacado de Calçados",
    "Lojas de Aviação",
    "Lojas de Baterias",
    "Lojas de Bicicletas Elétricas",
    "Lojas de Bolsas de Grife",
    "Lojas de Bombas de Água",
    "Lojas de Bordados e Estampas",
    "Lojas de Box para Banheiro",
    "Lojas de Brindes Corporativos",
    "Lojas de Brinquedos Educativos",
    "Lojas de Cabos e Fios",
    "Lojas de Calhas e Rufos",
    "Lojas de Capacetes e Acessórios para Moto",
    "Lojas de Capotas e Toldos",
    "Lojas de Carimbos",
    "Lojas de Cartuchos e Toners",
    "Lojas de Cercas e Alambrados",
    "Lojas de Chapéus e Bonés",
    "Lojas de Churrasqueiras e Acessórios",
    "Lojas de Cimento e Argamassa",
    "Lojas de Climatização",
    "Lojas de Cofres",
    "Lojas de Cola e Adesivos",
    "Lojas de Comunicação Visual",
    "Lojas de Cortinas de Aço",
    "Lojas de Descartáveis",
    "Lojas de Discos e Vinil",
    "Lojas de Doces Finos",
    "Lojas de Eletroportáteis",
    "Lojas de Elevadores e Plataformas",
    "Lojas de Embalagens Alimentícias",
    "Lojas de Embalagens Industriais",
    "Lojas de Enxoval de Noiva",
    "Lojas de Equipamentos Agrícolas",
    "Lojas de Equipamentos de Cozinha Industrial",
    "Lojas de Equipamentos de Laboratório",
    "Lojas de Equipamentos de Solda",
    "Lojas de Equipamentos Fotográficos",
    "Lojas de Equipamentos Hospitalares",
    "Lojas de Equipamentos para Padaria",
    "Lojas de Equipamentos para Restaurante",
    "Lojas de Essências e Aromas",
    "Lojas de Estofados",
    "Lojas de Etiquetas",
    "Lojas de Extintores",
    "Lojas de Fardamentos",
    "Lojas de Fibra Óptica",
    "Lojas de Filtros de Água",
    "Lojas de Filtros Industriais",
    "Lojas de Flores Artificiais",
    "Lojas de Fogões e Cooktops",
    "Lojas de Fontes e Cascatas",
    "Lojas de Fósseis e Minerais",
    "Lojas de Fotocélulas e Sensores",
    "Lojas de Frios e Laticínios",
    "Lojas de Frutas Secas e Castanhas",
    "Lojas de GPS e Rastreadores",
    "Lojas de Grades e Portões",
    "Lojas de Gramados Sintéticos",
    "Lojas de Hidráulica",
    "Lojas de Instrumentos de Medição",
    "Lojas de Instrumentos Cirúrgicos",
    "Lojas de Isolamento Térmico",
    "Lojas de Isqueiros e Acessórios",
    "Lojas de Jardinagem Vertical",
    "Lojas de Kit GNV",
    "Lojas de Laminados",
    "Lojas de Lanternas e Iluminação",
    "Lojas de Lareira a Gás",
    "Lojas de Letreiros e Luminosos",
    "Lojas de Lingerie",
    "Lojas de Lixeiras e Contentores",
    "Lojas de Louças e Porcelanas",
    "Lojas de Lubrificantes",
    "Lojas de Luminárias Solares",
    "Lojas de Madeiras Nobres",
    "Lojas de Mangueiras",
    "Lojas de Máquinas de Café",
    "Lojas de Máquinas de Costura",
    "Lojas de Máquinas de Lavar",
    "Lojas de Materiais Hidráulicos",
    "Lojas de Materiais Refratários",
    "Lojas de Meias e Pijamas",
    "Lojas de Mesa Posta",
    "Lojas de Metais Sanitários",
    "Lojas de Molduras e Quadros",
    "Lojas de Molas e Amortecedores",
    "Lojas de Motos Usadas",
    "Lojas de Motopeças",
    "Lojas de Mourões e Estacas",
    "Lojas de Óculos de Grau",
    "Lojas de Orgânicos",
    "Lojas de Panelas de Pressão",
    "Lojas de Papéis de Parede",
    "Lojas de Peças para Caminhão",
    "Lojas de Peças para Máquinas Agrícolas",
    "Lojas de Peças para Tratores",
    "Lojas de Pedras Decorativas",
    "Lojas de Pelúcias e Ursos",
    "Lojas de Perfilados",
    "Lojas de Persianas Motorizadas",
    "Lojas de Pilhas e Baterias",
    "Lojas de Placas de Sinalização",
    "Lojas de Placas Solares",
    "Lojas de Plantas e Mudas",
    "Lojas de Plásticos Industriais",
    "Lojas de Playground",
    "Lojas de Pneus para Caminhão",
    "Lojas de Portas Automáticas",
    "Lojas de Portões Automáticos",
    "Lojas de Presentes Corporativos",
    "Lojas de Produtos Apícolas",
    "Lojas de Produtos de Beleza Profissional",
    "Lojas de Produtos Eróticos",
    "Lojas de Produtos Escolares",
    "Lojas de Produtos Hospitalares",
    "Lojas de Produtos Indianos",
    "Lojas de Produtos Japoneses",
    "Lojas de Produtos para Confeitaria",
    "Lojas de Produtos para Sorvete",
    "Lojas de Produtos Químicos",
    "Lojas de Produtos Veterinários",
    "Lojas de Rações para Aves",
    "Lojas de Rações para Cavalos",
    "Lojas de Rações para Peixes",
    "Lojas de Redes de Descanso",
    "Lojas de Redes de Proteção",
    "Lojas de Refrigeradores Comerciais",
    "Lojas de Relojoaria",
    "Lojas de Roupas de Cama",
    "Lojas de Roupas de Couro",
    "Lojas de Roupas Fitness",
    "Lojas de Roupas Plus Size",
    "Lojas de Roupas Profissionais",
    "Lojas de Selas e Artigos de Montaria",
    "Lojas de Sementes",
    "Lojas de Sistemas de Irrigação",
    "Lojas de Tapetes e Carpetes",
    "Lojas de Telas e Grades",
    "Lojas de Telhados e Coberturas",
    "Lojas de Temperos e Ervas",
    "Lojas de Tolhas e Roupões",
    "Lojas de Toldos e Coberturas",
    "Lojas de Torneiras e Registros",
    "Lojas de Uniformes Escolares",
    "Lojas de Uniformes Profissionais",
    "Lojas de Vasos e Cachepots",
    "Lojas de Ventiladores e Circuladores",
    "Lojas de Vidros e Espelhos",
    "Lojas de Vidros Temperados",

    // --- DISTRIBUIDORES E ATACADISTAS ---
    "Distribuidoras de Água Mineral",
    "Distribuidoras de Balas e Chocolates",
    "Distribuidoras de Biscoitos",
    "Distribuidoras de Café",
    "Distribuidoras de Cigarros",
    "Distribuidoras de Descartáveis",
    "Distribuidoras de Frutas",
    "Distribuidoras de GLP",
    "Distribuidoras de Hortaliças",
    "Distribuidoras de Iogurtes",
    "Distribuidoras de Leite",
    "Distribuidoras de Massas",
    "Distribuidoras de Materiais Elétricos",
    "Distribuidoras de Materiais Hidráulicos",
    "Distribuidoras de Materiais de Limpeza",
    "Distribuidoras de Medicamentos",
    "Distribuidoras de Pães",
    "Distribuidoras de Parafusos",
    "Distribuidoras de Peças para Caminhão",
    "Distribuidoras de Peixes e Frutos do Mar",
    "Distribuidoras de Perfumaria",
    "Distribuidoras de Petróleo e Derivados",
    "Distribuidoras de Plásticos",
    "Distribuidoras de Produtos Agrícolas",
    "Distribuidoras de Produtos de Beleza",
    "Distribuidoras de Produtos de Limpeza",
    "Distribuidoras de Produtos Naturais",
    "Distribuidoras de Produtos Pet",
    "Distribuidoras de Produtos Químicos",
    "Distribuidoras de Produtos Veterinários",
    "Distribuidoras de Ração Animal",
    "Distribuidoras de Sementes",
    "Distribuidoras de Suplementos",
    "Distribuidoras de Temperos",
    "Distribuidoras de Tintas",
    "Distribuidoras de Tubos e Conexões",
    "Atacadistas de Bebidas",
    "Atacadistas de Cosméticos",
    "Atacadistas de Doces e Chocolates",
    "Atacadistas de EPI",
    "Atacadistas de Ferramentas",
    "Atacadistas de Material de Construção",
    "Atacadistas de Material de Escritório",
    "Atacadistas de Material de Limpeza",
    "Atacadistas de Material Elétrico",
    "Atacadistas de Material Hidráulico",
    "Atacadistas de Produtos de Beleza",
    "Atacadistas de Roupas",
    "Atacadistas de Calçados",
    "Atacadistas de Brinquedos",
    "Atacadistas de Embalagens",
    "Atacadistas de Papelaria",
    "Atacadistas de Utilidades Domésticas",

    // --- INDÚSTRIAS ---
    "Indústrias de Absorventes",
    "Indústrias de Acessórios Automotivos",
    "Indústrias de Adubos Orgânicos",
    "Indústrias de Água de Coco",
    "Indústrias de Álcool",
    "Indústrias de Alimentos para Animais",
    "Indústrias de Alumínio",
    "Indústrias de Andaimes",
    "Indústrias de Aquecedores",
    "Indústrias de Aquecedores Solares",
    "Indústrias de Arames Farpados",
    "Indústrias de Areia",
    "Indústrias de Argila",
    "Indústrias de Artigos de Cama",
    "Indústrias de Artigos de Copa",
    "Indústrias de Artigos de Metal",
    "Indústrias de Artigos Esportivos",
    "Indústrias de Artigos para Festas",
    "Indústrias de Assentos Sanitários",
    "Indústrias de Baldes e Lixeiras",
    "Indústrias de Balões",
    "Indústrias de Bandejas",
    "Indústrias de Bebedouros",
    "Indústrias de Blocos de Concreto",
    "Indústrias de Bobinas",
    "Indústrias de Bolsas e Carteiras",
    "Indústrias de Bombas",
    "Indústrias de Borra de Café",
    "Indústrias de Brindes",
    "Indústrias de Cabides",
    "Indústrias de Cabos de Aço",
    "Indústrias de Cadeiras",
    "Indústrias de Cal",
    "Indústrias de Calçados de Segurança",
    "Indústrias de Câmaras Frigoríficas",
    "Indústrias de Capacitores",
    "Indústrias de Canos de PVC",
    "Indústrias de Capas de Chuva",
    "Indústrias de Carrocerias",
    "Indústrias de Casas Pré-Fabricadas",
    "Indústrias de Catalisadores",
    "Indústrias de Chapas de Aço",
    "Indústrias de Cintos e Acessórios",
    "Indústrias de Cloro",
    "Indústrias de Cofres",
    "Indústrias de Compressores",
    "Indústrias de Conectores",
    "Indústrias de Correntes",
    "Indústrias de Cortiça",
    "Indústrias de Cosméticos Capilares",
    "Indústrias de Cosméticos Naturais",
    "Indústrias de Desinfetantes",
    "Indústrias de Disjuntores",
    "Indústrias de Displays e Expositores",
    "Indústrias de Dobradiças",
    "Indústrias de Elastômeros",
    "Indústrias de Eletrodutos",
    "Indústrias de Elevadores",
    "Indústrias de Emulsões",
    "Indústrias de Engrenagens",
    "Indústrias de Envelopes",
    "Indústrias de Equipamentos de Limpeza",
    "Indústrias de Equipamentos de Segurança",
    "Indústrias de Equipamentos Odontológicos",
    "Indústrias de Equipamentos Óticos",
    "Indústrias de Escadas",
    "Indústrias de Esquadrias de PVC",
    "Indústrias de Estantes e Prateleiras",
    "Indústrias de Estruturas de Concreto",
    "Indústrias de Estruturas para Eventos",
    "Indústrias de Etiquetas Adesivas",
    "Indústrias de Fechaduras",
    "Indústrias de Feltros",
    "Indústrias de Ferramentas de Corte",
    "Indústrias de Ferramentas Elétricas",
    "Indústrias de Ferramentas Manuais",
    "Indústrias de Filmes Plásticos",
    "Indústrias de Fios de Algodão",
    "Indústrias de Fitas Isolantes",
    "Indústrias de Flanges",
    "Indústrias de Fogões Industriais",
    "Indústrias de Fôrmas para Construção",
    "Indústrias de Frascos e Ampolas",
    "Indústrias de Freios",
    "Indústrias de Fundidos",
    "Indústrias de Gelo Seco",
    "Indústrias de Gesso",
    "Indústrias de Gôndolas",
    "Indústrias de Grampos e Clipes",
    "Indústrias de Graxas",
    "Indústrias de Guarda-Corpos",
    "Indústrias de Hastes e Barras",
    "Indústrias de Impermeabilizantes Asfálticos",
    "Indústrias de Injetados Plásticos",
    "Indústrias de Instrumentos de Precisão",
    "Indústrias de Isolantes Elétricos",
    "Indústrias de Isolantes Térmicos",
    "Indústrias de Juntas e Gaxetas",
    "Indústrias de Lã de Vidro",
    "Indústrias de Lacres",
    "Indústrias de Lajes",
    "Indústrias de Lâmpadas",
    "Indústrias de Lâminas de Aço",
    "Indústrias de Lápis e Canetas",
    "Indústrias de Latão",
    "Indústrias de Latas e Baldes",
    "Indústrias de Lavadoras de Alta Pressão",
    "Indústrias de Letreiros",
    "Indústrias de Lixas",
    "Indústrias de Lixeiras",
    "Indústrias de Lonarias",
    "Indústrias de Lonas",
    "Indústrias de Luvas",
    "Indústrias de Madeiras",
    "Indústrias de Malhas",
    "Indústrias de Manômetros",
    "Indústrias de Matrizes e Moldes",
    "Indústrias de Medidores",
    "Indústrias de Meias",
    "Indústrias de Mesas e Cadeiras",
    "Indústrias de Metais Não Ferrosos",
    "Indústrias de Molas",
    "Indústrias de Montagem Eletrônica",
    "Indústrias de Motocicletas",
    "Indústrias de Motoserras",
    "Indústrias de Óleos Essenciais",
    "Indústrias de Óleos Lubrificantes",
    "Indústrias de Óleos Vegetais",
    "Indústrias de Oxigênio",
    "Indústrias de Pás e Enxadas",
    "Indústrias de Painéis de Madeira",
    "Indústrias de Painéis Elétricos",
    "Indústrias de Pallets de Madeira",
    "Indústrias de Panelas",
    "Indústrias de Papel Kraft",
    "Indústrias de Papéis Especiais",
    "Indústrias de Pastilhas de Freio",
    "Indústrias de Peças Fundidas",
    "Indústrias de Peças Plásticas",
    "Indústrias de Pedras Britadas",
    "Indústrias de Perfilados de Alumínio",
    "Indústrias de Pigmentos",
    "Indústrias de Pilhas",
    "Indústrias de Pincéis e Rolos",
    "Indústrias de Pisos de Borracha",
    "Indústrias de Pisos de Madeira",
    "Indústrias de Pisos Industriais",
    "Indústrias de Placas de Circuito",
    "Indústrias de Placas de Sinalização",
    "Indústrias de Plásticos Reforçados",
    "Indústrias de Polias",
    "Indústrias de Polietileno",
    "Indústrias de Polipropileno",
    "Indústrias de Poliuretano",
    "Indústrias de Porcas e Parafusos",
    "Indústrias de Portas de Aço",
    "Indústrias de Presilhas e Abraçadeiras",
    "Indústrias de Produtos de Borracha",
    "Indústrias de Produtos de Fibra",
    "Indústrias de Produtos de Silicone",
    "Indústrias de Produtos de Solda",
    "Indústrias de Produtos Hospitalares",
    "Indústrias de Produtos Siderúrgicos",
    "Indústrias de Quadros e Molduras",
    "Indústrias de Reagentes Químicos",
    "Indústrias de Reboques e Carretas",
    "Indústrias de Recobrimentos",
    "Indústrias de Refratários",
    "Indústrias de Registros e Válvulas",
    "Indústrias de Relés",
    "Indústrias de Roldanas",
    "Indústrias de Roupas de Cama",
    "Indústrias de Sacolas de TNT",
    "Indústrias de Sais Minerais",
    "Indústrias de Sanitários",
    "Indústrias de Selantes",
    "Indústrias de Sensores",
    "Indústrias de Sistemas de Alarme",
    "Indústrias de Sistemas de Exaustão",
    "Indústrias de Sistemas de Filtragem",
    "Indústrias de Sistemas Hidráulicos",
    "Indústrias de Sistemas Pneumáticos",
    "Indústrias de Soldas",
    "Indústrias de Solventes",
    "Indústrias de Suportes e Fixadores",
    "Indústrias de Talheres",
    "Indústrias de Tampas e Rolhas",
    "Indústrias de Tecidos Técnicos",
    "Indústrias de Telhas Metálicas",
    "Indústrias de Termômetros",
    "Indústrias de Termoplásticos",
    "Indústrias de Tintas em Pó",
    "Indústrias de Toalhas",
    "Indústrias de Toldos",
    "Indústrias de Tornos",
    "Indústrias de Tratores",
    "Indústrias de Trefilados",
    "Indústrias de Válvulas Industriais",
    "Indústrias de Ventiladores Industriais",
    "Indústrias de Vidros Automotivos",
    "Indústrias de Vidros Temperados",
    "Indústrias de Vinagre",
    "Indústrias de Zinco",
    "Indústrias Farmoquímicas",
    "Indústrias Galvânicas",
    "Indústrias Madeireiras",
    "Indústrias Moveleiras",
    "Indústrias Naval",
    "Indústrias Petroquímicas",

    // --- SAÚDE, BEM-ESTAR E BELEZA ---
    "Casas de Repouso e Asilos",
    "Centros de Atendimento Psicossocial",
    "Centros de Convivência para Idosos",
    "Centros de Especialidades Médicas",
    "Centros de Estética Avançada",
    "Centros de Estética Corporal",
    "Centros de Estética Facial",
    "Centros de Medicina Integrativa",
    "Centros de Odontologia",
    "Centros de Saúde Mental",
    "Centros de Terapias Alternativas",
    "Centros de Vacinação",
    "Clínicas de Alergia e Imunologia",
    "Clínicas de Angiologia",
    "Clínicas de Audiologia",
    "Clínicas de Biomedicina",
    "Clínicas de Capilar",
    "Clínicas de Colonoscopia",
    "Clínicas de Densitometria",
    "Clínicas de Dor",
    "Clínicas de Ecocardiografia",
    "Clínicas de Eletrocardiograma",
    "Clínicas de Endoscopia",
    "Clínicas de Estética Dental",
    "Clínicas de Estética e Laser",
    "Clínicas de Fertilidade",
    "Clínicas de Harmonização Facial",
    "Clínicas de Hepatologia",
    "Clínicas de Infectologia",
    "Clínicas de Mastologia",
    "Clínicas de Medicina Preventiva",
    "Clínicas de Microcirurgia",
    "Clínicas de Neonatologia",
    "Clínicas de Neurocirurgia",
    "Clínicas de Nutrição Esportiva",
    "Clínicas de Ozonioterapia",
    "Clínicas de Patologia",
    "Clínicas de Periodontia",
    "Clínicas de Pneumologia",
    "Clínicas de Radiologia",
    "Clínicas de Sexologia",
    "Clínicas de Sono",
    "Clínicas de Terapia por Ondas de Choque",
    "Clínicas de Tricologia",
    "Clínicas de Urologia Feminina",
    "Clínicas Geriátricas",
    "Clínicas Multidisciplinares",
    "Consultórios de Homeopatia",
    "Consultórios de Naturopatia",
    "Consultórios de Nutrição",
    "Consultórios de Psiquiatria",
    "Consultórios de Terapia de Casal",
    "Consultórios de Terapia Infantil",
    "Distribuidoras de Materiais de Laboratório",
    "Distribuidoras de Órteses e Próteses",
    "Empresas de Ambulância",
    "Empresas de Home Care",
    "Empresas de Oxigenoterapia",
    "Empresas de Telemedicina",
    "Laboratórios de Análises Ambientais",
    "Laboratórios de Análises de Água",
    "Laboratórios de Análises de Alimentos",
    "Laboratórios de Biologia Molecular",
    "Laboratórios de Calibração",
    "Laboratórios de Controle de Qualidade",
    "Laboratórios de Ensaios",
    "Laboratórios de Farmácia",
    "Laboratórios de Genética",
    "Laboratórios de Microbiologia",
    "Laboratórios de Patologia",
    "Salões de Beleza Infantil",
    "Salões de Beleza Masculinos",
    "Spas Day",
    "Spas de Relaxamento",
    "Spas Médicos",
    "Studios de Bronzeamento",
    "Studios de Depilação",
    "Studios de Design de Sobrancelhas",
    "Studios de Extensão de Cílios",
    "Studios de Microblading",
    "Studios de Micropigmentação",
    "Studios de Nail Design",
    "Studios de Podologia",
    "Studios de Reflexologia",
    "Studios de Sobrancelhas",
    "Studios de Unhas",

    // --- SERVIÇOS PROFISSIONAIS E B2B ---
    "Agências de Adoção",
    "Agências de Emprego",
    "Agências de Intercâmbio",
    "Agências de Modelos",
    "Agências de Notícias",
    "Agências de Trade Marketing",
    "Agências de Turismo Receptivo",
    "Assessorias de Imprensa",
    "Assessorias Esportivas",
    "Assessorias Jurídicas",
    "Assessorias Parlamentares",
    "Birôs de Crédito",
    "Bureaus de Tradução",
    "Cartórios de Notas",
    "Cartórios de Registro de Imóveis",
    "Centrais de Atendimento",
    "Centros de Formação de Condutores",
    "Centros de Treinamento",
    "Consultorias Agrícolas",
    "Consultorias Ambientais",
    "Consultorias de Compliance",
    "Consultorias de E-commerce",
    "Consultorias de Exportação",
    "Consultorias de Franquias",
    "Consultorias de Gestão de Qualidade",
    "Consultorias de Gestão de Riscos",
    "Consultorias de Inovação",
    "Consultorias de Logística",
    "Consultorias de Marketing",
    "Consultorias de Negócios",
    "Consultorias de Planejamento Estratégico",
    "Consultorias de Processos",
    "Consultorias de RH",
    "Consultorias de Segurança Alimentar",
    "Consultorias de Segurança do Trabalho",
    "Consultorias de Sustentabilidade",
    "Consultorias de TI",
    "Consultorias em ISO",
    "Consultorias Financeiras",
    "Consultorias Imobiliárias",
    "Consultorias Tributárias",
    "Cooperativas Agrícolas de Café",
    "Cooperativas Agrícolas de Grãos",
    "Cooperativas Agrícolas de Leite",
    "Cooperativas de Catadores",
    "Cooperativas de Produtores",
    "Cooperativas de Táxi",
    "Cooperativas de Trabalho",
    "Cooperativas de Transporte",
    "Cooperativas Habitacionais",
    "Cooperativas Médicas",
    "Empresas de Análise de Solo",
    "Empresas de Armazenagem",
    "Empresas de Assistência 24 Horas",
    "Empresas de Assistência Técnica em Celular",
    "Empresas de Assistência Técnica em Eletrodomésticos",
    "Empresas de Assistência Técnica em Informática",
    "Empresas de Assistência Técnica em Refrigeração",
    "Empresas de Atuária",
    "Empresas de Cabeamento Estruturado",
    "Empresas de Cadastro e Documentação",
    "Empresas de Call Center",
    "Empresas de Certificação Digital",
    "Empresas de Cobrança",
    "Empresas de Consultoria em Alimentos",
    "Empresas de Consultoria em Segurança",
    "Empresas de Contabilidade Rural",
    "Empresas de Controle de Pragas",
    "Empresas de Conversão de Veículos",
    "Empresas de Decoração de Eventos",
    "Empresas de Design Gráfico",
    "Empresas de Design Industrial",
    "Empresas de Detailing Automotivo",
    "Empresas de Digitalização de Documentos",
    "Empresas de Documentação de Veículos",
    "Empresas de Drenagem Pluvial",
    "Empresas de Elétrica Automotiva",
    "Empresas de Elétrica Predial",
    "Empresas de Encanamento",
    "Empresas de Engenharia de Alimentos",
    "Empresas de Engenharia de Produção",
    "Empresas de Engenharia de Segurança",
    "Empresas de Engenharia de Software",
    "Empresas de Engenharia Estrutural",
    "Empresas de Engenharia Geotécnica",
    "Empresas de Engenharia Sanitária",
    "Empresas de Envelopamento Veicular",
    "Empresas de Estamparia",
    "Empresas de Estética Automotiva",
    "Empresas de Eventos Corporativos",
    "Empresas de Facilities",
    "Empresas de Factoring",
    "Empresas de Filmagem de Drone",
    "Empresas de Fotografia Aérea",
    "Empresas de Fotografia de Produtos",
    "Empresas de Geoprocessamento",
    "Empresas de Georadar",
    "Empresas de Gestão Condominial",
    "Empresas de Gestão de Documentos",
    "Empresas de Gestão de Estoque",
    "Empresas de Gestão de Frotas",
    "Empresas de Gestão de Projetos",
    "Empresas de Gestão de TI",
    "Empresas de Higienização de Estofados",
    "Empresas de Higienização de Reservatórios",
    "Empresas de Iluminação de Eventos",
    "Empresas de Impressão 3D",
    "Empresas de Inspeção de Equipamentos",
    "Empresas de Instalação de GNV",
    "Empresas de Instalação de Vidros",
    "Empresas de Inteligência Artificial",
    "Empresas de Internet das Coisas (IoT)",
    "Empresas de Inventário Florestal",
    "Empresas de Irrigação",
    "Empresas de Jateamento",
    "Empresas de Lavagem de Fachadas",
    "Empresas de Limpeza de Caixa D'Água",
    "Empresas de Limpeza de Fossa",
    "Empresas de Limpeza Industrial",
    "Empresas de Limpeza Pós-Obra",
    "Empresas de Locação de Andaimes",
    "Empresas de Locação de Caçambas",
    "Empresas de Locação de Compactadores",
    "Empresas de Locação de Equipamentos",
    "Empresas de Locação de Geradores",
    "Empresas de Locação de Máquinas",
    "Empresas de Locação de Plataformas",
    "Empresas de Logística Reversa",
    "Empresas de Manutenção de Ar Condicionado",
    "Empresas de Manutenção de Elevadores",
    "Empresas de Manutenção de Equipamentos",
    "Empresas de Manutenção de Piscinas",
    "Empresas de Manutenção Industrial",
    "Empresas de Manutenção Predial",
    "Empresas de Marketing de Conteúdo",
    "Empresas de Marketing de Influência",
    "Empresas de Marketing Político",
    "Empresas de Montagem Industrial",
    "Empresas de Montagem e Desmontagem de Móveis",
    "Empresas de Obras Marítimas",
    "Empresas de Outsourcing de Impressão",
    "Empresas de Paisagismo Corporativo",
    "Empresas de Patenteamento",
    "Empresas de Pavimentação Intertravada",
    "Empresas de Perícia Ambiental",
    "Empresas de Pintura de Fachadas",
    "Empresas de Pintura Eletrostática",
    "Empresas de Pintura Industrial",
    "Empresas de Pintura Predial",
    "Empresas de Polimento de Pisos",
    "Empresas de Projetos Elétricos",
    "Empresas de Projetos Hidráulicos",
    "Empresas de Projetos Mecânicos",
    "Empresas de Proteção Catódica",
    "Empresas de Proteção Radiológica",
    "Empresas de Prototipagem",
    "Empresas de Publicidade em Outdoor",
    "Empresas de Rastreamento de Cargas",
    "Empresas de Reciclagem de Eletrônicos",
    "Empresas de Reciclagem de Metais",
    "Empresas de Reciclagem de Papel",
    "Empresas de Reciclagem de Plástico",
    "Empresas de Reciclagem de Pneus",
    "Empresas de Recuperação de Dados",
    "Empresas de Reforma de Motores",
    "Empresas de Reforma de Pneus",
    "Empresas de Regularização Ambiental",
    "Empresas de Regularização de Imóveis",
    "Empresas de Remoção de Entulho",
    "Empresas de Reparo de Celulares",
    "Empresas de Restauração de Obras de Arte",
    "Empresas de Restauração de Pisos",
    "Empresas de Restauro de Fachadas",
    "Empresas de Robótica",
    "Empresas de Segurança Patrimonial",
    "Empresas de Segurança Privada",
    "Empresas de Serviço Social",
    "Empresas de Sinalização Viária",
    "Empresas de Soluções em Energia",
    "Empresas de Sonorização de Ambientes",
    "Empresas de Tratamento de Efluentes",
    "Empresas de Tratamento de Superfícies",
    "Empresas de Uniformes e EPIs",
    "Empresas de Vistorias Veiculares",
    "Escritórios de Assessoria Financeira",
    "Escritórios de Cobrança",
    "Escritórios de Despachante",
    "Escritórios de Design",
    "Escritórios de Engenharia",
    "Escritórios de Marcas e Patentes",
    "Escritórios de Perícia Judicial",
    "Escritórios de Projetos",
    "Escritórios de Tradução",

    // --- EDUCAÇÃO E CULTURA ---
    "Academias de Boxe",
    "Academias de Capoeira",
    "Academias de Crossfit",
    "Academias de Funcional",
    "Academias de Ginástica",
    "Academias de Jiu-Jitsu",
    "Academias de Judô",
    "Academias de Karatê",
    "Academias de Luta",
    "Academias de MMA",
    "Academias de Muay Thai",
    "Academias de Musculação",
    "Academias de Pilates",
    "Academias de Taekwondo",
    "Academias de Yoga",
    "Auto Escolas para Motos",
    "Bibliotecas",
    "Centros Culturais",
    "Centros de Educação Infantil",
    "Centros de Ensino a Distância",
    "Centros de Estudos",
    "Centros de Idiomas",
    "Centros de Informática",
    "Centros de Meditação",
    "Centros de Reforço Escolar",
    "Colégios Internos",
    "Conservatórios de Música",
    "Cursos de Administração",
    "Cursos de Aviação",
    "Cursos de Barbeiro",
    "Cursos de Bartender",
    "Cursos de Cabeleireiro",
    "Cursos de Confeitaria",
    "Cursos de Costura",
    "Cursos de Culinária",
    "Cursos de Design",
    "Cursos de Elétrica",
    "Cursos de Enfermagem",
    "Cursos de Estética",
    "Cursos de Fotografia",
    "Cursos de Gastronomia",
    "Cursos de Gestão",
    "Cursos de Informática",
    "Cursos de Maquiagem",
    "Cursos de Marcenaria",
    "Cursos de Mecânica",
    "Cursos de Mergulho",
    "Cursos de Oratória",
    "Cursos de Panificação",
    "Cursos de Programação",
    "Cursos de Robótica",
    "Cursos de Segurança do Trabalho",
    "Cursos de Solda",
    "Cursos de Vinhos e Sommelier",
    "Cursos Online",
    "Cursos Preparatórios",
    "Cursos Profissionalizantes",
    "Escolas Bilíngues",
    "Escolas de Ballet",
    "Escolas de Circo",
    "Escolas de Culinária Japonesa",
    "Escolas de Kart",
    "Escolas de Montessori",
    "Escolas de Patinação",
    "Escolas de Surfe",
    "Escolas de Vela",
    "Escolas de Voo",
    "Escolas Militares",
    "Escolas Técnicas",
    "Estúdios de Animação",
    "Estúdios de Arte",
    "Estúdios de Cerâmica",
    "Estúdios de Dança",
    "Estúdios de Dublagem",
    "Estúdios de Ilustração",
    "Estúdios de Música",
    "Estúdios de Podcast",
    "Faculdades de Direito",
    "Faculdades de Engenharia",
    "Faculdades de Medicina",
    "Faculdades de Odontologia",
    "Institutos de Pesquisa",
    "Museus",
    "Oficinas de Arte",
    "Planetários",
    "Teatros",

    // --- ENTRETENIMENTO E LAZER ---
    "Arenas de Airsoft",
    "Arenas de Futebol Society",
    "Arenas de Paintball",
    "Baladas e Casas Noturnas",
    "Bares de Karaokê",
    "Bares Temáticos",
    "Boates",
    "Boleiras",
    "Bowling",
    "Campos de Golfe",
    "Campos de Paintball",
    "Campos de Tiro",
    "Casas de Bingo",
    "Casas de Jogos",
    "Casas de Show",
    "Centros de Escalada",
    "Centros de Eventos",
    "Centros de Lazer",
    "Cinemas",
    "Circos",
    "Clubes de Campo",
    "Clubes de Pesca",
    "Clubes de Tiro",
    "Clubes Náuticos",
    "Clubes Recreativos",
    "Clubes Sociais",
    "Escape Rooms",
    "Estádios",
    "Haras",
    "Hipódromos",
    "Karting",
    "Lan Houses",
    "Marinas",
    "Parques Aquáticos",
    "Parques de Diversões",
    "Parques Ecológicos",
    "Parques Temáticos",
    "Parques de Trampolim",
    "Pesque e Pague",
    "Pistas de Corrida",
    "Pistas de Gelo",
    "Pistas de Kart",
    "Pistas de Skate",
    "Salões de Jogos",
    "Saunas",
    "Quadras de Futebol Society",
    "Quadras de Padel",
    "Quadras de Squash",
    "Quadras de Vôlei de Praia",
    "Quadras Poliesportivas",

    // --- AGRONEGÓCIO ---
    "Armazéns Gerais",
    "Beneficiadoras de Arroz",
    "Beneficiadoras de Café",
    "Beneficiadoras de Cereais",
    "Casas Agropecuárias Especializadas",
    "Cerealistas",
    "Confinamentos de Gado",
    "Cooperativas de Algodão",
    "Cooperativas de Cacau",
    "Cooperativas de Café",
    "Cooperativas de Cana-de-Açúcar",
    "Cooperativas de Frutas",
    "Cooperativas de Grãos",
    "Cooperativas de Leite",
    "Cooperativas de Soja",
    "Cooperativas de Tabaco",
    "Cooperativas de Vinicultura",
    "Cooperativas Florestais",
    "Criadores de Bovinos",
    "Criadores de Caprinos",
    "Criadores de Cavalos",
    "Criadores de Ovinos",
    "Criadores de Peixes",
    "Criadores de Suínos",
    "Distribuidoras de Defensivos Agrícolas",
    "Distribuidoras de Fertilizantes",
    "Distribuidoras de Mudas",
    "Distribuidoras de Sementes",
    "Empresas de Agricultura de Precisão",
    "Empresas de Apicultura",
    "Empresas de Aquicultura",
    "Empresas de Assistência Técnica Rural",
    "Empresas de Avicultura",
    "Empresas de Bovinocultura",
    "Empresas de Carcinicultura",
    "Empresas de Compostagem",
    "Empresas de Fertirrigação",
    "Empresas de Floricultura Comercial",
    "Empresas de Fruticultura",
    "Empresas de Hidroponia",
    "Empresas de Inseminação Artificial",
    "Empresas de Mecanização Agrícola",
    "Empresas de Olericultura",
    "Empresas de Piscicultura",
    "Empresas de Pulverização Aérea",
    "Empresas de Reflorestamento",
    "Empresas de Silvicultura",
    "Empresas de Suinocultura",
    "Empresas de Vinificação",
    "Empresas de Zootecnia",
    "Estufas e Viveiros",
    "Fazendas de Café",
    "Fazendas de Gado",
    "Fazendas de Soja",
    "Fazendas Orgânicas",
    "Floricultura de Produção",
    "Granjas de Ovos Orgânicos",
    "Laticínios Artesanais",
    "Matrizeiros",
    "Pecuárias",
    "Pesqueiros",
    "Produtores de Cachaça Artesanal",
    "Produtores de Mel",
    "Produtores de Queijo Artesanal",
    "Produtores de Vinho Artesanal",
    "Sementes e Mudas",
    "Silos para Grãos",
    "Trapiches",
    "Usinas de Açúcar",
    "Usinas de Álcool",
    "Usinas de Biodiesel",
    "Usinas de Compostagem",

    // --- TECNOLOGIA E INOVAÇÃO ---
    "Aceleradoras de Startups",
    "Centros de Inovação",
    "Coworkings de Tecnologia",
    "Empresas de Analytics",
    "Empresas de Aplicativos Móveis",
    "Empresas de Automação de Marketing",
    "Empresas de Automação de Processos",
    "Empresas de Automação Residencial",
    "Empresas de Big Data",
    "Empresas de Blockchain",
    "Empresas de Business Intelligence",
    "Empresas de Chatbot",
    "Empresas de Cloud",
    "Empresas de CRM",
    "Empresas de Design de UX/UI",
    "Empresas de DevOps",
    "Empresas de E-commerce",
    "Empresas de ERP",
    "Empresas de Fintechs",
    "Empresas de Games",
    "Empresas de Gestão de Dados",
    "Empresas de Hardware",
    "Empresas de Hospedagem de Sites",
    "Empresas de Integração de Sistemas",
    "Empresas de Machine Learning",
    "Empresas de Marketplace",
    "Empresas de Pagamentos Digitais",
    "Empresas de Plataformas Digitais",
    "Empresas de QR Code",
    "Empresas de Rastreamento por GPS",
    "Empresas de Realidade Aumentada",
    "Empresas de Realidade Virtual",
    "Empresas de SaaS",
    "Empresas de Segurança Digital",
    "Empresas de SEO e SEM",
    "Empresas de Sistemas Embarcados",
    "Empresas de Software de Gestão",
    "Empresas de Startups",
    "Empresas de Tecnologia Educacional",
    "Empresas de Tecnologia para Saúde",
    "Empresas de Telecom",
    "Empresas de Testes de Software",
    "Empresas de Web Design",
    "Fábricas de Hardware",
    "Hubs de Inovação",
    "Incubadoras de Empresas",
    "Laboratórios de Tecnologia",
    "Parques Tecnológicos",
    "Software Houses",
    "Startups de Agritech",
    "Startups de Edtech",
    "Startups de Foodtech",
    "Startups de Healthtech",
    "Startups de Logtech",
    "Startups de Proptech",

    // --- CONSTRUÇÃO E INFRAESTRUTURA ---
    "Construtoras de Alto Padrão",
    "Construtoras de Galpões",
    "Construtoras de Obras Públicas",
    "Construtoras de Obras Rodoviárias",
    "Construtoras Especializadas em Reformas",
    "Construtoras Residenciais",
    "Empresas de Acabamento",
    "Empresas de Alvenaria",
    "Empresas de Alvenaria Estrutural",
    "Empresas de Aplicação de Epóxi",
    "Empresas de Assoalhos",
    "Empresas de Contenção de Encostas",
    "Empresas de Cortina de Contenção",
    "Empresas de Decoração de Ambientes",
    "Empresas de Drywall",
    "Empresas de Esquadrias",
    "Empresas de Forro e Divisórias",
    "Empresas de Fundação Profunda",
    "Empresas de Georreferenciamento",
    "Empresas de Impermeabilização de Lajes",
    "Empresas de Infraestrutura Urbana",
    "Empresas de Instalação de Pisos",
    "Empresas de Isolamento Acústico",
    "Empresas de Manutenção de Fachadas",
    "Empresas de Manutenção de Telhados",
    "Empresas de Marmoraria",
    "Empresas de Obras de Arte Especiais",
    "Empresas de Obras Subterrâneas",
    "Empresas de Pintura Decorativa",
    "Empresas de Piso Industrial",
    "Empresas de Recuperação Estrutural",
    "Empresas de Reforma Comercial",
    "Empresas de Reforma Residencial",
    "Empresas de Regularização Fundiária",
    "Empresas de Retrofit",
    "Empresas de Terraplenagem e Movimentação de Terra",
    "Empresas de Vidraçaria",
    "Instaladoras de Gesso",
    "Instaladoras de Granito e Mármore",
    "Instaladoras de Piso Vinílico",
    "Instaladoras de Porcelanato",
    "Marmorarias Artísticas",
    "Pedras Decorativas e Revestimentos",
    "Vidraçarias Especializadas",

    // --- TRANSPORTE E LOGÍSTICA ---
    "Agências de Carga",
    "Agências Marítimas",
    "Armazéns Frigoríficos",
    "Centros de Distribuição",
    "Despachantes de Trânsito",
    "Empresas de Armazenagem Alfandegada",
    "Empresas de Cabotagem",
    "Empresas de Cargas Fracionadas",
    "Empresas de Cargas Líquidas",
    "Empresas de Container",
    "Empresas de Cross Docking",
    "Empresas de Despacho Aduaneiro",
    "Empresas de Frete Aéreo",
    "Empresas de Frete Internacional",
    "Empresas de Frete Marítimo",
    "Empresas de Last Mile",
    "Empresas de Locação de Ônibus",
    "Empresas de Locação de Vans",
    "Empresas de Logística de E-commerce",
    "Empresas de Logística Farmacêutica",
    "Empresas de Logística Hospitalar",
    "Empresas de Mudanças Internacionais",
    "Empresas de Operação Portuária",
    "Empresas de Transporte de Animais",
    "Empresas de Transporte de Combustível",
    "Empresas de Transporte de Contêineres",
    "Empresas de Transporte de Grãos",
    "Empresas de Transporte de Máquinas",
    "Empresas de Transporte de Mudanças",
    "Empresas de Transporte de Veículos",
    "Empresas de Transporte Escolar",
    "Empresas de Transporte Executivo",
    "Empresas de Transporte Rodoviário",
    "Empresas de Transporte Urbano",
    "Operadores Logísticos",
    "Portos Secos",
    "Terminais de Carga",
    "Terminais Portuários",
    "Terminais Rodoviários",
    "Transportadoras de Cargas Perigosas",
    "Transportadoras de Encomendas",
    "Transportadoras de Veículos",

    // --- AUTOMOTIVO ---
    "Acessórios para Caminhões",
    "Acessórios para Motos",
    "Acessórios para Pick-ups",
    "Auto Centers",
    "Autoescolas para Caminhão",
    "Centros Automotivos",
    "Concessionárias de Caminhões",
    "Concessionárias de Motos",
    "Concessionárias de Usados",
    "Desmanches de Veículos",
    "Elétricas Automotivas",
    "Envelopamento de Veículos",
    "Estúdios de Som Automotivo",
    "Funilarias",
    "Garagens e Estacionamentos",
    "Insulfilm e Películas",
    "Lavagem Ecológica",
    "Locadoras de Caminhões",
    "Locadoras de Motos",
    "Lojas de Acessórios para Carros",
    "Lojas de Alarmes Automotivos",
    "Lojas de Escapamentos Esportivos",
    "Lojas de GNV",
    "Lojas de Multimídia Automotiva",
    "Lojas de Peças para Motos",
    "Lojas de Pneus Recapados",
    "Lojas de Rebaixamento",
    "Lojas de Retrovisores",
    "Lojas de Suspensão",
    "Martelinho de Ouro",
    "Mecânicas de Caminhões",
    "Mecânicas de Motos",
    "Mecânicas Diesel",
    "Mecânicas Especializadas",
    "Oficinas de Alinhamento e Balanceamento",
    "Oficinas de Câmbio Automático",
    "Oficinas de Injeção Eletrônica",
    "Oficinas de Lanternagem",
    "Oficinas de Pintura Automotiva",
    "Oficinas de Suspensão",
    "Oficinas de Turbo",
    "Oficinas Elétricas",
    "Polimento e Cristalização",
    "Preparação de Motores",
    "Rebaixamento de Veículos",
    "Recuperação de Para-choques",
    "Retíficas de Freios",
    "Seguradoras de Veículos",
    "Tapeçarias Automotivas",

    // --- ALIMENTOS E BEBIDAS (PRODUÇÃO E COMÉRCIO) ---
    "Adegas",
    "Bistrôs",
    "Boulangeries",
    "Brunchs e Cafés da Manhã",
    "Cafeterias Especiais",
    "Casas de Chá",
    "Casas de Comida Caseira",
    "Casas de Comida Japonesa",
    "Casas de Espetos",
    "Casas de Lanches Gourmet",
    "Casas de Poke",
    "Casas de Salgados",
    "Casas de Smoothie",
    "Casas de Sopas",
    "Casas de Yakisoba",
    "Cervejarias de Produção",
    "Chácaras para Eventos",
    "Choperias",
    "Comidas Congeladas Delivery",
    "Confeitarias de Luxo",
    "Dark Kitchens",
    "Delivery de Marmitas Fitness",
    "Delivery de Pizzas",
    "Delivery de Sushi",
    "Destilarias Artesanais",
    "Distribuidoras de Cervejas Artesanais",
    "Distribuidoras de Destilados",
    "Distribuidoras de Energéticos",
    "Distribuidoras de Gelo",
    "Distribuidoras de Pão de Queijo",
    "Distribuidoras de Salgados",
    "Distribuidoras de Sucos",
    "Distribuidoras de Temperos",
    "Empórios de Chá",
    "Empórios de Especiarias",
    "Empórios de Queijos",
    "Fábricas de Cerveja Artesanal",
    "Fábricas de Gelo",
    "Fábricas de Pão de Queijo",
    "Fábricas de Pão Francês",
    "Fábricas de Polpas",
    "Fábricas de Salgados Congelados",
    "Fábricas de Tortas",
    "Fish and Chips",
    "Food Parks",
    "Feiras Gastronômicas",
    "Feiras Orgânicas",
    "Gastropubs",
    "Grills",
    "Hamburguerias Gourmet",
    "Ice Cream Shops",
    "Juice Bars",
    "Kombucha Bars",
    "Lanchonetes Gourmet",
    "Lojas de Bolos Caseiros",
    "Lojas de Brigadeiros",
    "Lojas de Cervejas Especiais",
    "Lojas de Chocolate Belga",
    "Lojas de Comidas Típicas",
    "Lojas de Doces Regionais",
    "Lojas de Produtos Italianos",
    "Lojas de Produtos sem Lactose",
    "Lojas de Sucos Detox",
    "Milk Shakes",
    "Noodle Bars",
    "Panificadoras Industriais",
    "Pastelarias Gourmet",
    "Pizzarias Delivery",
    "Pizzarias Gourmet",
    "Pubs",
    "Queijarias Artesanais",
    "Restaurantes a La Carte",
    "Restaurantes Bistrô",
    "Restaurantes Buffet",
    "Restaurantes com Delivery",
    "Restaurantes Corporativos",
    "Restaurantes de Bairro",
    "Restaurantes de Comida Caseira",
    "Restaurantes de Comida Internacional",
    "Restaurantes de Comida Orgânica",
    "Restaurantes de Hotel",
    "Restaurantes Executivos",
    "Restaurantes Gourmet",
    "Restaurantes Populares",
    "Restaurantes Regionais",
    "Restaurantes Temáticos",
    "Rooftop Bars",
    "Salgaderias",
    "Steakhouses",
    "Wine Bars",
    "Wok Restaurants",

    // --- MODA E TÊXTIL ---
    "Ateliês de Alta Costura",
    "Ateliês de Moda",
    "Ateliês de Noiva",
    "Confecções de Jeans",
    "Confecções de Lingerie",
    "Confecções de Moda Feminina",
    "Confecções de Moda Infantil",
    "Confecções de Moda Masculina",
    "Confecções de Moda Plus Size",
    "Confecções de Moda Praia",
    "Confecções de Roupas de Ginástica",
    "Confecções de Roupas Esportivas",
    "Confecções de Roupas Íntimas",
    "Confecções de Roupas para Gestantes",
    "Confecções de Roupas Sociais",
    "Consultorias de Moda",
    "Estilistas",
    "Estúdios de Moda",
    "Facções Têxteis",
    "Fast Fashion",
    "Lojas de Acessórios Femininos",
    "Lojas de Acessórios Masculinos",
    "Lojas de Alfaiataria",
    "Lojas de Calçados Esportivos",
    "Lojas de Calçados Femininos",
    "Lojas de Calçados Infantis",
    "Lojas de Calçados Masculinos",
    "Lojas de Cintos e Carteiras",
    "Lojas de Gravatas",
    "Lojas de Jeans",
    "Lojas de Moda Country",
    "Lojas de Moda Evangélica",
    "Lojas de Moda Feminina",
    "Lojas de Moda Gestante",
    "Lojas de Moda Masculina",
    "Lojas de Moda Praia",
    "Lojas de Moda Sustentável",
    "Lojas de Multimarcas",
    "Lojas de Roupas de Dormir",
    "Lojas de Roupas de Grife",
    "Lojas de Roupas Esportivas",
    "Lojas de Roupas Infantis",
    "Lojas de Roupas Sociais",
    "Lojas de Roupas Usadas",
    "Lojas de Sapatos",
    "Lojas de Tênis",
    "Marcas de Moda",
    "Modelistas",
    "Moulages",
    "Outlets de Roupas",
    "Personal Shoppers",
    "Showrooms de Moda",
    "Tinturarias Têxteis",

    // --- IMOBILIÁRIO E MORADIA ---
    "Administradoras de Aluguéis",
    "Administradoras de Condomínios Comerciais",
    "Administradoras de Imóveis",
    "Construtoras de Condomínios",
    "Construtoras de Loteamentos",
    "Empresas de Avaliação de Imóveis",
    "Empresas de Decoração de Interiores",
    "Empresas de Divisórias e Forros",
    "Empresas de Home Staging",
    "Empresas de Mudanças Residenciais",
    "Empresas de Reformas Residenciais",
    "Empresas de Segurança Residencial",
    "Empresas de Smart Home",
    "Empresas de Vistoria de Imóveis",
    "Imobiliárias Comerciais",
    "Imobiliárias de Alto Padrão",
    "Imobiliárias de Lançamentos",
    "Imobiliárias de Locação",
    "Imobiliárias Rurais",
    "Loteadoras",
    "Portarias de Condomínios",

    // --- ENERGIA E MEIO AMBIENTE ---
    "Empresas de Biogás",
    "Empresas de Carbono Neutro",
    "Empresas de Certificação Ambiental",
    "Empresas de Coleta Seletiva",
    "Empresas de Compostagem Industrial",
    "Empresas de Crédito de Carbono",
    "Empresas de Eficiência Energética",
    "Empresas de Energia Hidrelétrica",
    "Empresas de Energia Renovável",
    "Empresas de Geração Distribuída",
    "Empresas de Gestão Ambiental",
    "Empresas de Licenciamento Ambiental",
    "Empresas de Monitoramento Ambiental",
    "Empresas de Recuperação de Áreas Degradadas",
    "Empresas de Remediação Ambiental",
    "Empresas de Resíduos Industriais",
    "Empresas de Tratamento de Água Industrial",
    "Empresas de Tratamento de Esgoto",
    "Empresas de Tratamento de Lixo",
    "Usinas Fotovoltaicas",
    "Usinas Termelétricas",
    "Usinas de Biomassa",
    "Usinas Hidrelétricas",

    // --- FINANCEIRO E JURÍDICO ---
    "Administradoras de Cartões",
    "Agências Bancárias",
    "Assessorias de Investimentos",
    "Bancos Digitais",
    "Bureaus de Informação de Crédito",
    "Câmaras de Mediação e Arbitragem",
    "Centrais de Registros",
    "Consórcios",
    "Correspondentes Bancários",
    "Empresas de Análise de Crédito",
    "Empresas de Antecipação de Recebíveis",
    "Empresas de Capital de Giro",
    "Empresas de Certificação ISO",
    "Empresas de Consignado",
    "Empresas de Crédito Imobiliário",
    "Empresas de Câmbio",
    "Empresas de Empréstimo",
    "Empresas de Financiamento",
    "Empresas de Leasing",
    "Empresas de Recuperação de Crédito",
    "Empresas de Seguros",
    "Escritórios de Advocacia Criminal",
    "Escritórios de Advocacia Empresarial",
    "Escritórios de Advocacia Imobiliária",
    "Escritórios de Advocacia Trabalhista",
    "Escritórios de Advocacia Tributária",
    "Escritórios de Direito Ambiental",
    "Escritórios de Direito Digital",
    "Escritórios de Direito do Consumidor",
    "Escritórios de Direito Previdenciário",
    "Fintechs",
    "Gestoras de Fundos",
    "Operadoras de Crédito",
    "Previdência Privada",
    "Registradoras de Imóveis",
    "Seguradoras de Saúde",
    "Tabelionatos",

    // --- COMUNICAÇÃO E MÍDIA ---
    "Agências de Audiovisual",
    "Agências de Conteúdo",
    "Agências de Criação",
    "Agências de Design Gráfico",
    "Agências de Endomarketing",
    "Agências de Live Marketing",
    "Agências de Produção de Vídeo",
    "Agências de Propaganda",
    "Blogs e Portais de Notícias",
    "Canais de TV",
    "Editoras de Livros",
    "Editoras de Revistas",
    "Emissoras de Rádio",
    "Empresas de Animação",
    "Empresas de Assessoria Digital",
    "Empresas de Fotojornalismo",
    "Empresas de Legendagem",
    "Empresas de Locução",
    "Empresas de Motion Graphics",
    "Empresas de Narração",
    "Empresas de Podcast",
    "Empresas de Pós-Produção",
    "Empresas de Produção de Áudio",
    "Empresas de Produção Musical",
    "Empresas de Streaming",
    "Empresas de Transmissão ao Vivo",
    "Empresas de Vídeo Institucional",
    "Estúdios de Fotografia de Casamento",
    "Estúdios de Fotografia Publicitária",
    "Estúdios de Gravação Musical",
    "Estúdios de Produção",
    "Gráficas de Grande Formato",
    "Gráficas Digitais",
    "Jornais",
    "Produtoras Audiovisuais",
    "Produtoras de Cinema",
    "Produtoras de Eventos",
    "Produtoras de TV",
    "Rádios Comunitárias",
    "Rádios Online",
    "Revistas Digitais",
    "Studios de Animação 3D",

    // --- RELIGIOSO E SOCIAL ---
    "Associações Beneficentes",
    "Associações Comerciais",
    "Associações Comunitárias",
    "Associações de Bairro",
    "Casas de Repouso Particular",
    "Centros de Apoio ao Idoso",
    "Centros de Apoio Social",
    "Centros de Recuperação",
    "Centros Espíritas",
    "Comunidades Terapêuticas",
    "Fundações",
    "Igrejas",
    "Instituições de Caridade",
    "Lares de Idosos",
    "Maçonarias",
    "Mosteiros",
    "ONGs",
    "Organizações Filantrópicas",
    "Paróquias",
    "Rotary Clubs",
    "Sinagogas",
    "Sindicatos",
    "Templos",

    // --- SEGURANÇA E DEFESA ---
    "Academias de Segurança",
    "Centrais de Monitoramento",
    "Empresas de Blindagem Arquitetônica",
    "Empresas de Blindagem Automotiva",
    "Empresas de Cofres e Blindados",
    "Empresas de Consultoria em Segurança",
    "Empresas de Controle de Acesso Biométrico",
    "Empresas de Escolta Armada",
    "Empresas de Guarda-Costas",
    "Empresas de Investigação Particular",
    "Empresas de Prevenção de Perdas",
    "Empresas de Raio-X e Detecção",
    "Empresas de Segurança Contra Incêndio",
    "Empresas de Segurança Eletrônica",
    "Empresas de Segurança em Eventos",
    "Empresas de Vigilância",
    "Empresas de Vigilância Armada",
    "Empresas de Vigilância Eletrônica",
    "Escolas de Formação de Vigilantes",
    "Lojas de Artigos de Defesa",
    "Lojas de Equipamentos de Segurança",

    // --- PETS E ANIMAIS ---
    "Agropets",
    "Casas de Ração",
    "Clínicas Veterinárias 24 Horas",
    "Clínicas Veterinárias de Animais Exóticos",
    "Clínicas Veterinárias de Grandes Animais",
    "Criadores de Aves",
    "Criadores de Cães",
    "Criadores de Gatos",
    "Criadores de Peixes Ornamentais",
    "Criadores de Répteis",
    "Distribuidoras de Ração",
    "Empresas de Aquarismo",
    "Empresas de Cremação de Animais",
    "Empresas de Fotografia Pet",
    "Empresas de Transporte de Animais",
    "Farmácias Veterinárias",
    "Funerárias Pet",
    "Hospitais Veterinários",
    "Laboratórios Veterinários",
    "Lojas de Aquarismo",
    "Lojas de Artigos para Aves",
    "Lojas de Artigos para Cães",
    "Lojas de Artigos para Gatos",
    "Lojas de Artigos para Répteis",
    "Lojas de Artigos Pet Premium",
    "Lojas de Camas e Casinhas para Pets",
    "Lojas de Roupinhas para Pets",
    "Pet Shops de Bairro",
    "Pet Shops Premium",
    "Spas para Pets",
    "Veterinários Homeopatas",

    // --- SERVIÇOS DOMÉSTICOS E RESIDENCIAIS ---
    "Chaveiros 24 Horas",
    "Diaristas e Faxineiras",
    "Eletricistas Residenciais",
    "Empresas de Caça-Vazamentos",
    "Empresas de Desinsetização",
    "Empresas de Limpeza de Ar Condicionado",
    "Empresas de Limpeza de Estofados",
    "Empresas de Limpeza de Vidros",
    "Empresas de Mudanças Locais",
    "Empresas de Organização de Ambientes",
    "Empresas de Personal Organizer",
    "Empresas de Reparos Domésticos",
    "Encanadores",
    "Gesseiros Residenciais",
    "Instaladores de Antenas",
    "Instaladores de Ar Condicionado",
    "Instaladores de Box de Banheiro",
    "Instaladores de Câmeras",
    "Instaladores de Cercas Elétricas",
    "Instaladores de Cortinas",
    "Instaladores de Interfone",
    "Instaladores de Papel de Parede",
    "Instaladores de Pisos",
    "Instaladores de Portão Automático",
    "Instaladores de Redes de Proteção",
    "Marceneiros",
    "Montadores de Móveis",
    "Pedreiros",
    "Pintores Residenciais",
    "Serralheiros",
    "Vidraceiros",

    // --- TURISMO E HOSPITALIDADE ---
    "Acampamentos",
    "Agências de Ecoturismo",
    "Agências de Turismo de Aventura",
    "Agências de Turismo de Luxo",
    "Agências de Turismo de Negócios",
    "Agências de Turismo Religioso",
    "Agências de Turismo Rural",
    "Albergues",
    "Apart-hotéis",
    "Bed and Breakfast",
    "Camping e Glamping",
    "Casas de Temporada",
    "Chalés e Cabanas",
    "Flat e Residence",
    "Hostels",
    "Hotéis Boutique",
    "Hotéis de Luxo",
    "Hotéis Fazenda",
    "Motéis",
    "Operadoras de Turismo",
    "Parques de Campismo",
    "Pousadas de Charme",
    "Receptivos Turísticos",
    "Resorts",
    "Spas e Resorts",
  ].sort(); // Ordenação alfabética

  const handleCustomerToggle = (customer: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customer)
        ? prev.filter(c => c !== customer)
        : [...prev, customer]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine final country
    const finalCountry = country === "OTHER" ? customCountry : country;
    
    // Build region string based on filled fields
    let region = "";
    if (country === "BR") {
      if (city && state) {
        region = `${city}, ${state}`;
      } else if (state) {
        region = state;
      } else if (city) {
        region = city;
      }
    } else {
      region = city || state || "";
    }
    
    if (!category || !products || selectedCustomers.length === 0 || (!state && !city) || (country === "OTHER" && !customCountry)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha pelo menos país e estado ou cidade",
        variant: "destructive",
      });
      return;
    }

    // Check if search config actually changed
    const previousConfigStr = localStorage.getItem('leadSearchConfig');
    const newSearchConfig = {
      category,
      products,
      selectedCustomers,
      region,
      state,
      city,
      country: finalCountry,
      companySizes: companySizes.length > 0 ? companySizes : ['all'],
      revenueRange,
      businessType,
      digitalPresence,
      digitalActivity,
      ecommerceType: selectedCustomers.includes("E-commerce") ? ecommerceType : "",
      whatsappOnly: false,
      receitaFederalOnly: false,
    };
    
    const newConfigStr = JSON.stringify(newSearchConfig);
    
    // Only clear cached leads if the search configuration actually changed
    if (previousConfigStr !== newConfigStr) {
      console.log('🔄 Search config changed, clearing cache');
      localStorage.removeItem('cachedLeads');
      localStorage.removeItem('cacheTimestamp');
    } else {
      console.log('✅ Same search config, keeping cache');
    }
    
    // Save search configuration to localStorage
    localStorage.setItem('leadSearchConfig', newConfigStr);

    toast({
      title: "Busca configurada!",
      description: "Procurando leads compatíveis...",
    });

    setTimeout(() => {
      navigate("/resultados");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background" lang="pt-BR">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Configure Sua Busca</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Preencha os dados abaixo para encontrar os leads perfeitos para seu negócio
            </p>
          </div>

          <form onSubmit={handleSubmit} translate="no">
            <Card className="p-4 md:p-8 shadow-card">
              <div className="space-y-6 md:space-y-8">
                {/* Category */}
                <div>
                  <Label htmlFor="category" className="text-base font-semibold" translate="no">
                    Eu sou representante de: *
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-2" id="category" translate="no">
                      <SelectValue placeholder="Selecione uma categoria" translate="no" />
                    </SelectTrigger>
                    <SelectContent sideOffset={5} translate="no">
                      <SelectItem value="bebidas">Bebidas</SelectItem>
                      <SelectItem value="alimentos">Alimentos</SelectItem>
                      <SelectItem value="limpeza">Material de Limpeza</SelectItem>
                      <SelectItem value="equipamentos">Equipamentos</SelectItem>
                      <SelectItem value="tecnologia">Tecnologia</SelectItem>
                      <SelectItem value="roupas">Roupas/Moda</SelectItem>
                      <SelectItem value="cosmeticos">Cosméticos</SelectItem>
                      <SelectItem value="materiais-construcao">Materiais de Construção</SelectItem>
                      <SelectItem value="ferramentas">Ferramentas</SelectItem>
                      <SelectItem value="ferragens">Ferragens</SelectItem>
                      <SelectItem value="materiais-eletricos">Materiais Elétricos</SelectItem>
                      <SelectItem value="tecidos">Tecidos</SelectItem>
                      <SelectItem value="aviamentos">Aviamentos</SelectItem>
                      <SelectItem value="fios-linhas">Fios e Linhas</SelectItem>
                      <SelectItem value="cama-mesa-banho">Cama, Mesa e Banho</SelectItem>
                      <SelectItem value="utilidade-domestica">Utilidade Doméstica</SelectItem>
                      <SelectItem value="protecao-veicular">Proteção Veicular</SelectItem>
                      <SelectItem value="telemedicina">Telemedicina / Saúde</SelectItem>
                      <SelectItem value="grafica">Gráfica / Comunicação Visual</SelectItem>
                      <SelectItem value="produtos-naturais">Produtos Naturais / Orgânicos</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Products */}
                <div>
                  <Label htmlFor="products" className="text-base font-semibold" translate="no">
                    Produtos específicos que vendo: *
                  </Label>
                    <Input
                      id="products"
                      value={products}
                      onChange={(e) => setProducts(e.target.value)}
                      placeholder='Ex: "Refrigerantes, sucos, energéticos"'
                      className="mt-2"
                      translate="no"
                    />
                </div>

                {/* Customer Types - Com campo de pesquisa */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Clientes que quero encontrar: *
                  </Label>
                  
                  {/* Search field */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Pesquisar tipo de estabelecimento..."
                      className="pl-10"
                      translate="no"
                    />
                  </div>
                  
                  {/* Selected count */}
                  {selectedCustomers.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedCustomers.length} selecionado{selectedCustomers.length > 1 ? 's' : ''}
                      {customerSearch && ` (mostrando resultados para "${customerSearch}")`}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-h-[400px] overflow-y-auto pr-2" translate="no">
                    {customerTypes
                      .filter(customer => 
                        customerSearch === "" || 
                        customer.toLowerCase().includes(customerSearch.toLowerCase())
                      )
                      .map((customer) => (
                      <div key={customer} className="flex flex-col" translate="no">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={customer}
                            checked={selectedCustomers.includes(customer)}
                            onCheckedChange={() => handleCustomerToggle(customer)}
                            translate="no"
                          />
                          <label
                            htmlFor={customer}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            translate="no"
                          >
                            {customer}
                          </label>
                        </div>
                        {customer === "E-commerce" && selectedCustomers.includes("E-commerce") && (
                          <Input
                            value={ecommerceType}
                            onChange={(e) => setEcommerceType(e.target.value)}
                            placeholder="Especifique o tipo (ex: Moda, Eletrônicos...)"
                            className="mt-2 ml-6 max-w-[200px]"
                            translate="no"
                          />
                        )}
                      </div>
                    ))}
                    
                    {customerTypes.filter(customer => 
                      customerSearch === "" || 
                      customer.toLowerCase().includes(customerSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="text-muted-foreground text-sm col-span-full py-4 text-center">
                        Nenhum tipo de estabelecimento encontrado para "{customerSearch}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Tipo de Empresa (Matriz/Filial) */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Tipo de estabelecimento:
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={businessType === "all" ? "default" : "outline"}
                      onClick={() => setBusinessType("all")}
                      className="gap-2"
                    >
                      <Building className="h-4 w-4" />
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant={businessType === "matriz" ? "default" : "outline"}
                      onClick={() => setBusinessType("matriz")}
                      className="gap-2"
                    >
                      <Building2 className="h-4 w-4" />
                      Apenas Matriz
                    </Button>
                    <Button
                      type="button"
                      variant={businessType === "filial" ? "default" : "outline"}
                      onClick={() => setBusinessType("filial")}
                      className="gap-2"
                    >
                      <Building className="h-4 w-4" />
                      Apenas Filiais
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selecione se deseja ver matriz, filiais ou ambos
                  </p>
                </div>

                {/* WhatsApp Filter */}


                {/* Country */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="country" className="text-base font-semibold" translate="no">
                      País: *
                    </Label>
                    <Select value={country} onValueChange={(val) => { setCountry(val); if (val !== "OTHER") setCustomCountry(""); setState(""); setCity(""); }}>
                      <SelectTrigger className="mt-2" id="country" translate="no">
                        <SelectValue placeholder="Selecione o país" translate="no" />
                      </SelectTrigger>
                      <SelectContent sideOffset={5} translate="no">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {country === "OTHER" && (
                    <div>
                      <Label htmlFor="customCountry" className="text-base font-semibold" translate="no">
                        Nome do País: *
                      </Label>
                      <Input
                        id="customCountry"
                        value={customCountry}
                        onChange={(e) => setCustomCountry(e.target.value)}
                        placeholder="Ex: Austrália"
                        className="mt-2"
                        translate="no"
                      />
                    </div>
                  )}

                  {/* Estado */}
                  <div>
                    <Label htmlFor="state" className="text-base font-semibold" translate="no">
                      Estado: {country === "BR" ? "*" : "(opcional)"}
                    </Label>
                    {country === "BR" ? (
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="mt-2" id="state" translate="no">
                          <SelectValue placeholder="Selecione o estado" translate="no" />
                        </SelectTrigger>
                        <SelectContent sideOffset={5} translate="no">
                          {brazilianStates.map((st) => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Ex: California, Ontario..."
                        className="mt-2"
                        translate="no"
                      />
                    )}
                  </div>

                  {/* Cidade com Autocomplete */}
                  <div>
                    <Label htmlFor="city" className="text-base font-semibold" translate="no">
                      Cidade: (opcional)
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: São Paulo, Blumenau..."
                      className="mt-2"
                      translate="no"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deixe em branco para buscar em todo o estado
                    </p>
                  </div>
                </div>

                {/* Company Size - Multiple Selection */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Tamanho do cliente:
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-all" 
                        checked={companySizes.length === 0 || companySizes.includes('all')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes([]);
                          }
                        }}
                      />
                      <Label htmlFor="size-all" className="font-normal cursor-pointer" translate="no">
                        Todos os tamanhos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-small" 
                        checked={companySizes.includes('small')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'small']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'small'));
                          }
                        }}
                      />
                      <Label htmlFor="size-small" className="font-normal cursor-pointer" translate="no">
                        Pequeno (até 10 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-medium" 
                        checked={companySizes.includes('medium')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'medium']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'medium'));
                          }
                        }}
                      />
                      <Label htmlFor="size-medium" className="font-normal cursor-pointer" translate="no">
                        Médio (11-50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-large" 
                        checked={companySizes.includes('large')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'large']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'large'));
                          }
                        }}
                      />
                      <Label htmlFor="size-large" className="font-normal cursor-pointer" translate="no">
                        Grande (+50 funcionários)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Faixa de faturamento:
                  </Label>
                  <RadioGroup value={revenueRange} onValueChange={setRevenueRange}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="micro" id="micro" />
                      <Label htmlFor="micro" className="font-normal cursor-pointer" translate="no">
                        Microempresa (até R$ 360 mil/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="small-business" id="small-business" />
                      <Label htmlFor="small-business" className="font-normal cursor-pointer" translate="no">
                        Pequena empresa (R$ 360 mil - R$ 4,8 milhões/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="medium-business" id="medium-business" />
                      <Label htmlFor="medium-business" className="font-normal cursor-pointer" translate="no">
                        Média empresa (R$ 4,8M - R$ 300M/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="large-business" id="large-business" />
                      <Label htmlFor="large-business" className="font-normal cursor-pointer" translate="no">
                        Grande empresa (+R$ 300M/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-revenue" />
                      <Label htmlFor="all-revenue" className="font-normal cursor-pointer" translate="no">
                        Todas as faixas
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Digital Presence (Website) */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Presença Digital (Site):
                  </Label>
                  <RadioGroup value={digitalPresence} onValueChange={setDigitalPresence}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="no-site" id="no-site" />
                      <Label htmlFor="no-site" className="font-normal cursor-pointer" translate="no">
                        Não possui site
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="basic-site" id="basic-site" />
                      <Label htmlFor="basic-site" className="font-normal cursor-pointer" translate="no">
                        Possui site básico / institucional
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="structured-site" id="structured-site" />
                      <Label htmlFor="structured-site" className="font-normal cursor-pointer" translate="no">
                        Possui site estruturado
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-presence" />
                      <Label htmlFor="all-presence" className="font-normal cursor-pointer" translate="no">
                        Todos
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    Filtre empresas pela presença de site institucional
                  </p>
                </div>

                {/* Digital Activity Level */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Nível de Atividade Digital:
                  </Label>
                  <RadioGroup value={digitalActivity} onValueChange={setDigitalActivity}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="low" id="low-activity" />
                      <Label htmlFor="low-activity" className="font-normal cursor-pointer" translate="no">
                        Baixa ou inexistente
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="basic" id="basic-activity" />
                      <Label htmlFor="basic-activity" className="font-normal cursor-pointer" translate="no">
                        Básica
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="active" id="active-activity" />
                      <Label htmlFor="active-activity" className="font-normal cursor-pointer" translate="no">
                        Ativa
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-activity" />
                      <Label htmlFor="all-activity" className="font-normal cursor-pointer" translate="no">
                        Todos os níveis
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    Filtre pelo nível de engajamento digital da empresa
                  </p>
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full gap-2 text-base py-6" size="lg">
                  <Search className="h-5 w-5" />
                  Buscar Leads
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Configuration;

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

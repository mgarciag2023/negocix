import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

const Configuration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState("");
  const [country, setCountry] = useState("BR");
  const [customCountry, setCustomCountry] = useState("");
  const [region, setRegion] = useState("");
  const [companySize, setCompanySize] = useState("all");
  const [revenueRange, setRevenueRange] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

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
    "Cestas Básicas",
    "Cestas Natalinas",
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
    "Ateliês de Costura",
    "Indústrias Têxteis",
    "Bordados",
    "Lojas de Aviamentos",
    "Malharias",
    "Transportadoras",
    "Frotistas",
    "Empresas com Frota Própria",
    "Vans Escolares",
    "Táxis e Cooperativas de Táxi",
    "Motoristas de Aplicativo",
    "Empresas de Logística",
    "Empresas de Entrega",
    "Locadoras de Veículos",
    "Empresas de Turismo",
    // Setor Saúde - Telemedicina
    "Telemedicina",
    "Clínicas de Telemedicina",
    "Plataformas de Atendimento Online",
    "Clínicas Populares",
    "Laboratórios de Análises Clínicas",
    "Consultórios Médicos",
    "Clínicas de Especialidades",
    "Planos de Saúde",
    "Home Care",
    "Clínicas de Fisioterapia",
    "Clínicas de Psicologia",
    "Psicólogos",
    "Nutricionistas",
    "Fonoaudiólogos",
    "Clínicas de Odontologia",
    // Indústria Gráfica & Comunicação Visual
    "Gráficas",
    "Gráficas Rápidas",
    "Gráficas Online",
    "Comunicação Visual",
    "Impressão Digital",
    "Impressoras de Grande Formato",
    "Agências de Publicidade",
    "Estúdios de Design",
    "Produtoras de Conteúdo",
    "Lojas de Sinalização",
    "Serigrafias",
    "Estamparias",
    "Fábricas de Embalagens",
    "Empresas de Adesivos e Banners",
    "Impressão de Rótulos e Etiquetas",
    "Editoras",
    // Setor Construção Civil
    "Construtoras",
    "Empreiteiras",
    "Incorporadoras",
    "Engenheiros Civis",
    "Arquitetos",
    "Escritórios de Arquitetura",
    "Pedreiros",
    "Pintores",
    "Encanadores",
    "Eletricistas",
    "Marmorarias",
    "Vidraçarias",
    "Serralherias",
    "Imobiliárias",
    "Obras e Reformas",
    "Instaladores de Pisos",
    "Gesseiros",
    "Telhadistas",
    // Setor Industrial / Eletrônica
    "Indústrias que utilizam eletrônica",
    "Indústrias automotivas",
    "Indústrias de equipamentos hospitalares e de segurança",
    "Indústrias de automação e tecnologia",
    "Indústrias de iluminação e LED",
  ];

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
    
    if (!category || !products || selectedCustomers.length === 0 || !region || (country === "OTHER" && !customCountry)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios",
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
      country: finalCountry,
      companySize,
      revenueRange,
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
                      <SelectItem value="protecao-veicular">Proteção Veicular</SelectItem>
                      <SelectItem value="telemedicina">Telemedicina / Saúde</SelectItem>
                      <SelectItem value="grafica">Gráfica / Comunicação Visual</SelectItem>
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

                {/* Customer Types */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Clientes que quero encontrar: *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4" translate="no">
                    {customerTypes.map((customer) => (
                      <div key={customer} className="flex items-center space-x-2" translate="no">
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
                    ))}
                  </div>
                </div>

                {/* Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country" className="text-base font-semibold" translate="no">
                      País: *
                    </Label>
                    <Select value={country} onValueChange={(val) => { setCountry(val); if (val !== "OTHER") setCustomCountry(""); }}>
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
                        placeholder="Ex: Austrália, Nova Zelândia, Índia"
                        className="mt-2"
                        translate="no"
                      />
                    </div>
                  )}
                </div>

                {/* Region */}
                <div>
                  <Label htmlFor="region" className="text-base font-semibold" translate="no">
                    Região: *
                  </Label>
                  <Input
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Ex: Vale do Itajaí, Grande São Paulo, Região Serrana, Miami FL"
                    className="mt-2"
                    translate="no"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Digite cidade, região ou área geográfica (ex: Vale do Itajaí, Litoral Norte, Grande Florianópolis)
                  </p>
                </div>

                {/* Company Size */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Tamanho do cliente:
                  </Label>
                  <RadioGroup value={companySize} onValueChange={setCompanySize}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="small" id="small" />
                      <Label htmlFor="small" className="font-normal cursor-pointer" translate="no">
                        Pequeno (até 10 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="font-normal cursor-pointer" translate="no">
                        Médio (11-50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="large" id="large" />
                      <Label htmlFor="large" className="font-normal cursor-pointer" translate="no">
                        Grande (+50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="font-normal cursor-pointer" translate="no">
                        Todos os tamanhos
                      </Label>
                    </div>
                  </RadioGroup>
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
                        Pequena empresa (R$ 360 mil a R$ 4,8 milhões/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="medium-business" id="medium-business" />
                      <Label htmlFor="medium-business" className="font-normal cursor-pointer" translate="no">
                        Média empresa (R$ 4,8 milhões a R$ 300 milhões/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="large-business" id="large-business" />
                      <Label htmlFor="large-business" className="font-normal cursor-pointer" translate="no">
                        Grande empresa (+R$ 300 milhões/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="revenue-all" />
                      <Label htmlFor="revenue-all" className="font-normal cursor-pointer" translate="no">
                        Todas as faixas
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="mt-6 md:mt-8 flex justify-end">
                <Button type="submit" size="lg" className="bg-success hover:bg-success-hover shadow-success w-full sm:w-auto">
                  <Search className="mr-2 h-5 w-5" />
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

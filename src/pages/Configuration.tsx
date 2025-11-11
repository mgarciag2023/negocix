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
  const [location, setLocation] = useState("");
  const [state, setState] = useState("SP");
  const [companySize, setCompanySize] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const customerTypes = [
    "Restaurantes",
    "Pizzarias",
    "Padarias",
    "Bares",
    "Lanchonetes",
    "Mercados",
    "Mercearias",
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
    
    if (!category || !products || selectedCustomers.length === 0 || !location || !state) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Clear both cached leads and previous search config to force completely new search
    localStorage.removeItem('cachedLeads');
    localStorage.removeItem('leadSearchConfig');

    // Save search configuration to localStorage
    const searchConfig = {
      category,
      products,
      selectedCustomers,
      location,
      state,
      companySize,
    };
    localStorage.setItem('leadSearchConfig', JSON.stringify(searchConfig));

    toast({
      title: "Busca configurada!",
      description: "Procurando leads compatíveis...",
    });

    setTimeout(() => {
      navigate("/resultados");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Configure Sua Busca</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Preencha os dados abaixo para encontrar os leads perfeitos para seu negócio
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Card className="p-4 md:p-8 shadow-card">
              <div className="space-y-6 md:space-y-8">
                {/* Category */}
                <div>
                  <Label htmlFor="category" className="text-base font-semibold">
                    Eu sou representante de: *
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bebidas">Bebidas</SelectItem>
                      <SelectItem value="alimentos">Alimentos</SelectItem>
                      <SelectItem value="limpeza">Material de Limpeza</SelectItem>
                      <SelectItem value="equipamentos">Equipamentos</SelectItem>
                      <SelectItem value="tecnologia">Tecnologia</SelectItem>
                      <SelectItem value="roupas">Roupas/Moda</SelectItem>
                      <SelectItem value="cosmeticos">Cosméticos</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Products */}
                <div>
                  <Label htmlFor="products" className="text-base font-semibold">
                    Produtos específicos que vendo: *
                  </Label>
                  <Input
                    id="products"
                    value={products}
                    onChange={(e) => setProducts(e.target.value)}
                    placeholder='Ex: "Refrigerantes, sucos, energéticos"'
                    className="mt-2"
                  />
                </div>

                {/* Customer Types */}
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    Clientes que quero encontrar: *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {customerTypes.map((customer) => (
                      <div key={customer} className="flex items-center space-x-2">
                        <Checkbox
                          id={customer}
                          checked={selectedCustomers.includes(customer)}
                          onCheckedChange={() => handleCustomerToggle(customer)}
                        />
                        <label
                          htmlFor={customer}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {customer}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="location" className="text-base font-semibold">
                      Cidade: *
                    </Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: São Paulo, Blumenau, Porto Alegre"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state" className="text-base font-semibold">
                      Estado: *
                    </Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AC">AC - Acre</SelectItem>
                        <SelectItem value="AL">AL - Alagoas</SelectItem>
                        <SelectItem value="AP">AP - Amapá</SelectItem>
                        <SelectItem value="AM">AM - Amazonas</SelectItem>
                        <SelectItem value="BA">BA - Bahia</SelectItem>
                        <SelectItem value="CE">CE - Ceará</SelectItem>
                        <SelectItem value="DF">DF - Distrito Federal</SelectItem>
                        <SelectItem value="ES">ES - Espírito Santo</SelectItem>
                        <SelectItem value="GO">GO - Goiás</SelectItem>
                        <SelectItem value="MA">MA - Maranhão</SelectItem>
                        <SelectItem value="MT">MT - Mato Grosso</SelectItem>
                        <SelectItem value="MS">MS - Mato Grosso do Sul</SelectItem>
                        <SelectItem value="MG">MG - Minas Gerais</SelectItem>
                        <SelectItem value="PA">PA - Pará</SelectItem>
                        <SelectItem value="PB">PB - Paraíba</SelectItem>
                        <SelectItem value="PR">PR - Paraná</SelectItem>
                        <SelectItem value="PE">PE - Pernambuco</SelectItem>
                        <SelectItem value="PI">PI - Piauí</SelectItem>
                        <SelectItem value="RJ">RJ - Rio de Janeiro</SelectItem>
                        <SelectItem value="RN">RN - Rio Grande do Norte</SelectItem>
                        <SelectItem value="RS">RS - Rio Grande do Sul</SelectItem>
                        <SelectItem value="RO">RO - Rondônia</SelectItem>
                        <SelectItem value="RR">RR - Roraima</SelectItem>
                        <SelectItem value="SC">SC - Santa Catarina</SelectItem>
                        <SelectItem value="SP">SP - São Paulo</SelectItem>
                        <SelectItem value="SE">SE - Sergipe</SelectItem>
                        <SelectItem value="TO">TO - Tocantins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Company Size */}
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    Tamanho do cliente:
                  </Label>
                  <RadioGroup value={companySize} onValueChange={setCompanySize}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="small" id="small" />
                      <Label htmlFor="small" className="font-normal cursor-pointer">
                        Pequeno (até 10 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="font-normal cursor-pointer">
                        Médio (11-50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="large" id="large" />
                      <Label htmlFor="large" className="font-normal cursor-pointer">
                        Grande (+50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="font-normal cursor-pointer">
                        Todos os tamanhos
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

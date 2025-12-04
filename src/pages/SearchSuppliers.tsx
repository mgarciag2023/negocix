import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Search } from "lucide-react";

const SearchSuppliers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [location, setLocation] = useState("");
  const [state, setState] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const productCategories = [
    // Alimentos e Bebidas
    "Alimentos em Geral",
    "Bebidas",
    "Laticínios",
    "Carnes e Frigoríficos",
    "Frutas e Verduras",
    "Cereais e Grãos",
    "Congelados",
    "Embalagens para Alimentos",
    // Construção Civil
    "Materiais de Construção",
    "Cimento e Argamassa",
    "Tintas e Vernizes",
    "Ferragens",
    "Madeiras",
    "Tubos e Conexões",
    "Pisos e Revestimentos",
    "Materiais Elétricos",
    "Materiais Hidráulicos",
    // Têxtil e Vestuário
    "Tecidos",
    "Aviamentos",
    "Fios e Linhas",
    "Malhas",
    "Uniformes",
    "Roupas em Geral",
    // Industrial
    "Máquinas e Equipamentos",
    "Ferramentas Industriais",
    "Peças e Componentes",
    "Produtos Químicos",
    "Lubrificantes",
    "EPIs",
    // Agropecuária
    "Insumos Agrícolas",
    "Fertilizantes",
    "Sementes",
    "Rações Animais",
    "Medicamentos Veterinários",
    // Embalagens
    "Embalagens Plásticas",
    "Embalagens de Papelão",
    "Sacolas e Sacos",
    "Fitas e Lacres",
    // Papelaria e Escritório
    "Papelaria",
    "Material de Escritório",
    "Informática e Tecnologia",
    // Higiene e Limpeza
    "Produtos de Limpeza",
    "Descartáveis",
    "Produtos de Higiene",
    // Automotivo
    "Peças Automotivas",
    "Pneus",
    "Óleos e Lubrificantes",
    "Acessórios Automotivos",
    // Outros
    "Móveis",
    "Eletrodomésticos",
    "Brinquedos",
    "Cosméticos",
    "Produtos Farmacêuticos",
    "Bijuterias e Acessórios",
    "Utilidades Domésticas",
  ];

  const brazilianStates = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const handleProductToggle = (product: string) => {
    setSelectedProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedProducts.length === 0) {
      toast({
        title: "Selecione pelo menos um produto",
        description: "Escolha os tipos de produtos que você procura.",
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: "Cidade obrigatória",
        description: "Informe a cidade onde deseja buscar fornecedores.",
        variant: "destructive",
      });
      return;
    }

    if (!state) {
      toast({
        title: "Estado obrigatório",
        description: "Selecione o estado onde deseja buscar.",
        variant: "destructive",
      });
      return;
    }

    // Save search config
    const supplierSearchConfig = {
      products: selectedProducts,
      location: location.trim(),
      state,
      timestamp: Date.now(),
    };
    
    localStorage.setItem("supplierSearchConfig", JSON.stringify(supplierSearchConfig));
    localStorage.removeItem("suppliersCache");
    
    navigate("/suppliers-results");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Buscar Fornecedores
            </h1>
            <p className="text-muted-foreground">
              Encontre os melhores fornecedores para o seu negócio
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configurar Busca</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Products Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Que tipo de produtos você procura? *
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {productCategories.map((product) => (
                      <div key={product} className="flex items-center space-x-2">
                        <Checkbox
                          id={product}
                          checked={selectedProducts.includes(product)}
                          onCheckedChange={() => handleProductToggle(product)}
                        />
                        <label
                          htmlFor={product}
                          className="text-sm cursor-pointer leading-tight"
                        >
                          {product}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedProducts.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedProducts.length} produto(s) selecionado(s)
                    </p>
                  )}
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Cidade *</Label>
                    <Input
                      id="location"
                      placeholder="Ex: São Paulo"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">Estado *</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <Search className="mr-2 h-5 w-5" />
                  Buscar Fornecedores
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SearchSuppliers;

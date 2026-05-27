import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Package, Search, MapPin, CheckCircle2, ArrowRight, Sparkles, Building2 } from "lucide-react";
import RegisterSupplierDialog from "@/components/RegisterSupplierDialog";

const SearchSuppliers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [location, setLocation] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [state, setState] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [esquadriasMaterials, setEsquadriasMaterials] = useState<string[]>([]);

  const esquadriasOptions = ["Alumínio", "PVC", "Madeira", "Ferro"];
  const esquadriasMap: Record<string, string> = {
    "Alumínio": "Esquadrias de Alumínio",
    "PVC": "Esquadrias de PVC",
    "Madeira": "Esquadrias de Madeira",
    "Ferro": "Esquadrias de Ferro",
  };

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
    "Pré-Moldados",
    "Steel Frame",
    "Esquadrias",
    "Vidros e Vidraçaria",
    "Portas e Janelas",
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
    "Produtos pet",
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
    // Festas e Eventos
    "Artigos para Festas",
    "Balões e Decoração",
    // Outros
    "Móveis",
    "Eletrodomésticos",
    "Brinquedos",
    "Cosméticos",
    "Produtos Farmacêuticos",
    "Bijuterias e Acessórios",
    "Utilidades Domésticas",
    "Materiais para Artesanato",
    "Produtos Naturais e Suplementos",
    "Produtos de Beleza e Cabelo",
    "Material Fotográfico",
    "Instrumentos Musicais",
    "Equipamentos para Restaurantes",
    "Produtos para Confeitaria e Panificação",
    "Materiais para Serigrafia e Estamparia",
    "Produtos de Jardinagem e Paisagismo",
    "Equipamentos para Academia",
    "Materiais Odontológicos",
    "Suprimentos para Impressão",
    "Equipamentos de Segurança Eletrônica",
    "Produtos para Piscinas",
    "Moda Infantil",
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
        description: "Marque os tipos de produtos que você deseja encontrar fornecedores.",
        variant: "destructive",
      });
      return;
    }

    if (!state) {
      toast({
        title: "Selecione o estado",
        description: "Escolha o estado onde deseja buscar fornecedores.",
        variant: "destructive",
      });
      return;
    }

    // Expand "Esquadrias" into specific material categories
    let expandedProducts = [...selectedProducts];
    if (expandedProducts.includes("Esquadrias")) {
      expandedProducts = expandedProducts.filter(p => p !== "Esquadrias");
      const materials = esquadriasMaterials.length > 0
        ? esquadriasMaterials.map(m => esquadriasMap[m])
        : Object.values(esquadriasMap);
      expandedProducts = Array.from(new Set([...expandedProducts, ...materials]));
    }

    // Save search config
    const supplierSearchConfig = {
      products: expandedProducts,
      location: location.trim() || '',
      neighborhood: neighborhood.trim() || '',
      state,
      timestamp: Date.now(),
    };
    
    localStorage.setItem("supplierSearchConfig", JSON.stringify(supplierSearchConfig));
    localStorage.removeItem("suppliersCache");
    sessionStorage.removeItem('results_scroll_position');
    
    navigate("/suppliers-results");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-8 text-center opacity-0 animate-fade-in-up">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-primary shadow-primary">
              <Package className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Buscar Fornecedores
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Encontre os melhores fornecedores para o seu negócio
            </p>
          </div>

          {/* Main Card */}
          <Card className="shadow-card-hover border-border/50 overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="bg-gradient-subtle border-b border-border/50 pb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Configurar Busca</CardTitle>
                  <CardDescription>Preencha os campos abaixo para encontrar fornecedores</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Products Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Que tipo de produtos você procura?
                    </Label>
                    {selectedProducts.length > 0 && (
                      <span className="text-sm text-primary font-medium bg-primary-light px-3 py-1 rounded-full">
                        {selectedProducts.length} selecionado(s)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto border border-border/50 rounded-xl p-4 bg-muted/30">
                    {productCategories.map((product) => {
                      const isSelected = selectedProducts.includes(product);
                      return (
                        <div 
                          key={product} 
                          onClick={() => handleProductToggle(product)}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            isSelected 
                              ? 'bg-primary/10 border-2 border-primary shadow-sm' 
                              : 'bg-card hover:bg-primary/5 border-2 border-transparent hover:border-primary/20'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary' : 'border-2 border-muted-foreground/30'
                          }`}>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                          </div>
                          <span className={`text-sm leading-tight ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {product}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Esquadrias material sub-selector */}
                  {selectedProducts.includes("Esquadrias") && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <Label className="text-sm font-semibold text-foreground">
                        Materiais de esquadrias (opcional — vazio busca todos)
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {esquadriasOptions.map((mat) => {
                          const active = esquadriasMaterials.includes(mat);
                          return (
                            <button
                              type="button"
                              key={mat}
                              onClick={() =>
                                setEsquadriasMaterials(prev =>
                                  prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
                                )
                              }
                              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                                active
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                              }`}
                            >
                              {mat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-success" />
                    Localização
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm text-muted-foreground">Cidade (opcional)</Label>
                      <Input
                        id="location"
                        placeholder="Ex: São Paulo"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="h-12 rounded-xl border-border/50 focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm text-muted-foreground">Estado</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="h-12 rounded-xl border-border/50">
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
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg rounded-xl bg-gradient-primary hover:opacity-90 shadow-primary hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 group"
                  size="lg"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Buscar Fornecedores
                  <ArrowRight className="ml-2 h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info Card */}
          <div className="mt-6 p-4 bg-success-light/50 rounded-xl border border-success/20 flex items-start gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Dica:</span> Você pode selecionar múltiplos tipos de produtos para ampliar sua busca. Os resultados mostrarão fornecedores de todas as categorias selecionadas.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SearchSuppliers;

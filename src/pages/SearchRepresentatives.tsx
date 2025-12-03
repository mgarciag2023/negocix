import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, MapPin, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const segments = [
  "Alimentos",
  "Bebidas",
  "Cosméticos",
  "Vestuário",
  "Automotivo",
  "Construção Civil",
  "Farmacêutico",
  "Eletrônicos",
  "Materiais Elétricos",
  "Agropecuária",
  "Têxtil",
  "Químico",
  "Embalagens",
  "Máquinas e Equipamentos",
  "Móveis",
  "Papelaria",
  "Brinquedos",
  "Pet",
  "Higiene e Limpeza",
  "Suplementos",
  "Energia Solar",
  "Tecnologia",
  "Saúde",
  "Ferramentas",
  "Material de Escritório",
  "Segurança",
  "Descartáveis",
  "Plásticos",
  "EPIs",
  "Utilidades Domésticas",
  "Engenheiros",
  "Arquitetos",
  "Contadores",
  "Eletricistas",
  "Advogados",
  "Médicos",
  "Dentistas",
  "Nutricionistas",
  "Psicólogos",
  "Fisioterapeutas",
];

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function SearchRepresentatives() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSegmentToggle = (segment: string) => {
    setSelectedSegments(prev =>
      prev.includes(segment)
        ? prev.filter(s => s !== segment)
        : [...prev, segment]
    );
  };

  const handleSearch = async () => {
    if (selectedSegments.length === 0) {
      toast({
        title: "Selecione pelo menos um segmento",
        description: "Escolha os segmentos de representação que deseja buscar.",
        variant: "destructive",
      });
      return;
    }

    if (!state) {
      toast({
        title: "Selecione um estado",
        description: "Informe a localização desejada para a busca.",
        variant: "destructive",
      });
      return;
    }

    const searchConfig = {
      segments: selectedSegments,
      city,
      state,
    };

    localStorage.setItem("representativeSearchConfig", JSON.stringify(searchConfig));
    navigate("/representatives-results");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Buscar Profissionais
            </h1>
            <p className="text-muted-foreground">
              Encontre representantes comerciais e profissionais liberais para sua empresa
            </p>
          </div>

          <div className="space-y-6">
            {/* Segmentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Segmentos de Representação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione os segmentos em que deseja encontrar representantes
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {segments.map((segment) => (
                    <div
                      key={segment}
                      onClick={() => handleSegmentToggle(segment)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSegments.includes(segment)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-accent border-border"
                      }`}
                    >
                      <span className="text-sm font-medium">{segment}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Localização */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado *</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade (opcional)</Label>
                    <Input
                      id="city"
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão de Busca */}
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full py-6 text-lg"
              size="lg"
            >
              <Search className="w-5 h-5 mr-2" />
              {isLoading ? "Buscando..." : "Buscar Representantes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

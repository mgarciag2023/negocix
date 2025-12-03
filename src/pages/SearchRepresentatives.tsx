import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, MapPin, Briefcase, Award } from "lucide-react";
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
];

const actuationTypes = [
  { id: "autonomo", label: "Representante Autônomo" },
  { id: "agencia", label: "Agência de Representação" },
  { id: "regional", label: "Representante Regional" },
  { id: "varejo", label: "Representante para Varejo" },
  { id: "atacado", label: "Representante para Atacado" },
  { id: "industria", label: "Representante para Indústria" },
];

const experienceLevels = [
  { value: "iniciante", label: "Iniciante (até 2 anos)" },
  { value: "intermediario", label: "Intermediário (2-5 anos)" },
  { value: "experiente", label: "Experiente (5+ anos)" },
  { value: "qualquer", label: "Qualquer nível" },
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
  const [selectedActuationTypes, setSelectedActuationTypes] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState("qualquer");
  const [isLoading, setIsLoading] = useState(false);

  const handleSegmentToggle = (segment: string) => {
    setSelectedSegments(prev =>
      prev.includes(segment)
        ? prev.filter(s => s !== segment)
        : [...prev, segment]
    );
  };

  const handleActuationToggle = (typeId: string) => {
    setSelectedActuationTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
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
      actuationTypes: selectedActuationTypes,
      experienceLevel,
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
              Buscar Representantes
            </h1>
            <p className="text-muted-foreground">
              Encontre representantes comerciais para trabalharem com sua empresa
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

            {/* Tipo de Atuação */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Tipo de Atuação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione os tipos de representante que procura (opcional)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {actuationTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={type.id}
                        checked={selectedActuationTypes.includes(type.id)}
                        onCheckedChange={() => handleActuationToggle(type.id)}
                      />
                      <Label htmlFor={type.id} className="cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Nível de Experiência */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Nível de Experiência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

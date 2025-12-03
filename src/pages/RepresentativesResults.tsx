import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Users, 
  Phone, 
  MapPin, 
  Briefcase, 
  MessageCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Representative {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  region: string;
  segments: string[];
  description?: string;
  source?: string;
  sourceUrl?: string;
  actuationType?: string;
  experience?: string;
}

export default function RepresentativesResults() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchConfig, setSearchConfig] = useState<any>(null);

  useEffect(() => {
    const config = localStorage.getItem("representativeSearchConfig");
    if (!config) {
      toast({
        title: "Configuração não encontrada",
        description: "Por favor, configure a busca novamente.",
        variant: "destructive",
      });
      navigate("/search-representatives");
      return;
    }

    const parsedConfig = JSON.parse(config);
    setSearchConfig(parsedConfig);
    searchRepresentatives(parsedConfig);
  }, []);

  const searchRepresentatives = async (config: any) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("search-representatives", {
        body: config,
      });

      if (error) {
        console.error("Error searching representatives:", error);
        toast({
          title: "Erro na busca",
          description: "Não foi possível buscar representantes. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      if (data?.representatives) {
        setRepresentatives(data.representatives);
        
        if (data.representatives.length === 0) {
          toast({
            title: "Nenhum representante encontrado",
            description: "Tente ajustar os filtros da busca.",
          });
        } else {
          toast({
            title: "Busca concluída",
            description: `${data.representatives.length} representante(s) encontrado(s).`,
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar representantes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppClick = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá ${name}, encontrei seu contato através de uma busca por representantes comerciais. Gostaria de conversar sobre uma possível parceria.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const handleCallClick = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`tel:+55${cleanPhone}`, "_self");
  };

  const handleRefresh = () => {
    if (searchConfig) {
      searchRepresentatives(searchConfig);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/search-representatives")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Representantes Encontrados
            </h1>
            {searchConfig && (
              <p className="text-muted-foreground">
                {searchConfig.segments?.join(", ")} em {searchConfig.city ? `${searchConfig.city} - ` : ""}{searchConfig.state}
              </p>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results */}
          {!isLoading && representatives.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                {representatives.length} representante(s) encontrado(s)
              </p>
              
              {representatives.map((rep) => (
                <Card key={rep.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Name and Source */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {rep.name}
                          </h3>
                          {rep.source && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              Encontrado em: {rep.source}
                              {rep.sourceUrl && (
                                <a
                                  href={rep.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                        {rep.experience && (
                          <Badge variant="secondary">{rep.experience}</Badge>
                        )}
                      </div>

                      {/* Region */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{rep.region}</span>
                      </div>

                      {/* Segments */}
                      {rep.segments && rep.segments.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          {rep.segments.map((segment, idx) => (
                            <Badge key={idx} variant="outline">
                              {segment}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Actuation Type */}
                      {rep.actuationType && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{rep.actuationType}</span>
                        </div>
                      )}

                      {/* Description */}
                      {rep.description && (
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/20 pl-3">
                          {rep.description}
                        </p>
                      )}

                      {/* Contact Buttons */}
                      <div className="flex gap-2 pt-2">
                        {(rep.whatsapp || rep.phone) && (
                          <Button
                            size="sm"
                            onClick={() => handleWhatsAppClick(rep.whatsapp || rep.phone!, rep.name)}
                            className="gap-2 bg-green-600 hover:bg-green-700"
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </Button>
                        )}
                        {rep.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCallClick(rep.phone!)}
                            className="gap-2"
                          >
                            <Phone className="w-4 h-4" />
                            Ligar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && representatives.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Nenhum representante encontrado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Tente ajustar os filtros da busca ou selecionar outros segmentos.
                </p>
                <Button onClick={() => navigate("/search-representatives")}>
                  Ajustar Filtros
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

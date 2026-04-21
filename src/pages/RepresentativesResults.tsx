import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Users, 
  Phone, 
  MapPin, 
  Briefcase, 
  MessageCircle,
  RefreshCw,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Representative {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  address: string;
  website?: string;
  rating?: number;
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
      const { data: { user } } = await supabase.auth.getUser();
      const bodyConfig = { ...config, user_id: user?.id };
      
      console.log("Calling search-representatives with:", bodyConfig);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/search-representatives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify(bodyConfig),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      console.log("Response:", data);

      if (!response.ok || data?.error) {
        console.error("Error searching representatives:", data);
        toast({
          title: "Erro na busca",
          description: data?.error || "Não foi possível buscar representantes. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      if (data?.representatives) {
        setRepresentatives(data.representatives);
        
        // Log the search
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("search_logs").insert({
              user_id: user.id,
              user_email: user.email || "",
              search_type: "representatives",
              search_config: config,
              results_count: data.representatives.length,
            });
          }
        } catch (logErr) {
          console.error("Error logging search:", logErr);
        }

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
    // Phone already comes with country code 55 from backend
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá ${name}, encontrei seu contato através de uma busca por representantes comerciais. Gostaria de conversar sobre uma possível parceria.`
    );
    window.open(`https://wa.me/${finalPhone}?text=${message}`, "_blank");
  };

  const handleCallClick = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    // Avoid double country code - check if already starts with 55
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`tel:+${finalPhone}`, "_self");
  };

  const handleRefresh = () => {
    if (searchConfig) {
      searchRepresentatives(searchConfig);
    }
  };

  const exportToExcel = () => {
    if (representatives.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }
    const excelData = representatives.map((r) => ({
      'Nome': r.name,
      'Telefone': r.phone || '',
      'WhatsApp': r.whatsapp || '',
      'Endereço': r.address,
      'Website': r.website || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Representantes');
    worksheet['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 30 }];
    const timestamp = new Date().toISOString().split('T')[0];
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `representantes-negocix-${timestamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exportação concluída", description: `${representatives.length} representante(s) exportados` });
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
            
            <div className="flex gap-2">
              {representatives.length > 0 && (
                <Button variant="outline" onClick={exportToExcel} className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </Button>
              )}
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
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Representantes Encontrados
            </h1>
            {searchConfig && (
              <p className="text-muted-foreground">
                {searchConfig.city ? `${searchConfig.city} - ` : ""}{searchConfig.state}
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
                    <div className="space-y-3">
                      {/* Name with Contact */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground">
                            {rep.name}
                          </h3>
                          {rep.phone && (
                            <p className="text-sm text-primary font-medium mt-1">
                              {rep.phone}
                            </p>
                          )}
                        </div>
                        
                        {/* Contact Buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                          {rep.whatsapp && (
                            <Button
                              size="sm"
                              onClick={() => handleWhatsAppClick(rep.whatsapp!, rep.name)}
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

                      {/* Address */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{rep.address}</span>
                      </div>

                      {/* Website */}
                      {rep.website && (
                        <a 
                          href={rep.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate block"
                        >
                          {rep.website}
                        </a>
                      )}
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

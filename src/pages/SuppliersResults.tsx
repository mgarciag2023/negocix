import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, Phone, Globe, ArrowLeft, Loader2, MessageCircle, RefreshCw, Building2, Star, ExternalLink, Download } from "lucide-react";
import * as XLSX from 'xlsx';

interface Supplier {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  category: string;
  hasWhatsApp: boolean;
}

const SuppliersResults = () => {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchConfig, setSearchConfig] = useState<any>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      const configStr = localStorage.getItem("supplierSearchConfig");
      if (!configStr) {
        toast({
          title: "Configuração não encontrada",
          description: "Por favor, configure a busca novamente.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const config = JSON.parse(configStr);
      setSearchConfig(config);

      // Check cache
      const cacheStr = localStorage.getItem("suppliersCache");
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          const cacheAge = Date.now() - cache.timestamp;
          if (cacheAge < 30 * 60 * 1000) {
            setSuppliers(cache.suppliers || []);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Error parsing cache:", e);
        }
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        
        let data: any = null;
        const response = await fetch(`${supabaseUrl}/functions/v1/search-suppliers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            products: config.products,
            location: config.location,
            state: config.state,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        data = await response.json();
        const error = !response.ok && !data?.suppliers ? data : null;

        if (error) throw new Error(error?.error || 'Erro na busca');
          toast({
            title: "Erro na busca",
            description: data.error,
            variant: "destructive",
          });
          setSuppliers([]);
        } else {
          const suppliersData = data?.suppliers || [];
          setSuppliers(suppliersData);
          
          // Cache results
          localStorage.setItem("suppliersCache", JSON.stringify({
            suppliers: suppliersData,
            timestamp: Date.now(),
          }));

          if (suppliersData.length === 0) {
            toast({
              title: "Nenhum fornecedor encontrado",
              description: "Tente ajustar os filtros ou buscar em outra região.",
            });
          } else {
            toast({
              title: "Busca concluída!",
              description: `Encontramos ${suppliersData.length} fornecedor(es).`,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        toast({
          title: "Erro ao buscar fornecedores",
          description: "Verifique sua conexão e tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [toast]);

  const handleRefresh = () => {
    localStorage.removeItem("suppliersCache");
    setLoading(true);
    window.location.reload();
  };

  const exportToExcel = () => {
    if (suppliers.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const excelData = suppliers.map((s) => ({
      Nome: s.name,
      Categoria: s.category,
      Endereço: s.address,
      Telefone: s.phone,
      Website: s.website || "",
      WhatsApp: s.hasWhatsApp ? "Sim" : "Não",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fornecedores");

    worksheet["!cols"] = [
      { wch: 35 }, { wch: 20 }, { wch: 40 },
      { wch: 18 }, { wch: 30 }, { wch: 10 },
    ];

    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `fornecedores-negocix-${timestamp}.xlsx`;
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: `${suppliers.length} fornecedor(es) exportados com sucesso`,
    });
  };

  const formatPhoneForCall = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }
    return cleaned;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center space-y-6 opacity-0 animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary">
                <Loader2 className="h-10 w-10 animate-spin text-primary-foreground" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-2">Buscando fornecedores...</h3>
              <p className="text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-3 h-3 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-fade-in-down">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <Button 
              variant="ghost" 
              asChild 
              className="w-fit -ml-2 hover:bg-primary/5 group"
            >
              <Link to="/search-suppliers">
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Nova Busca
              </Link>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="w-fit rounded-xl hover:bg-primary/5 border-border/50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {suppliers.length > 0 && (
              <Button 
                onClick={exportToExcel}
                className="w-fit rounded-xl bg-gradient-primary hover:opacity-90"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary flex-shrink-0">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {suppliers.length} Fornecedor{suppliers.length !== 1 ? 'es' : ''} Encontrado{suppliers.length !== 1 ? 's' : ''}
              </h1>
              {searchConfig && (
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4" />
                  {searchConfig.location ? `${searchConfig.location}, ${searchConfig.state}` : `Estado: ${searchConfig.state}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <Card className="shadow-card border-border/50 overflow-hidden opacity-0 animate-scale-in">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Nenhum fornecedor encontrado
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Não encontramos fornecedores com os filtros selecionados. Tente ajustar os filtros ou buscar em outra região.
              </p>
              <Button asChild className="rounded-xl bg-gradient-primary hover:opacity-90">
                <Link to="/search-suppliers">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Fazer Nova Busca
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier, index) => (
              <Card 
                key={supplier.id} 
                className="group shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-1 border-border/50 overflow-hidden opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <CardHeader className="pb-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {supplier.name}
                      </CardTitle>
                    </div>
                    <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full w-fit mt-2 font-medium">
                    <Star className="h-3 w-3" />
                    {supplier.category}
                  </span>
                </CardHeader>
                
                <CardContent className="space-y-3 p-5 pt-0">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground p-3 bg-muted/50 rounded-xl">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-success-light flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-success" />
                    </div>
                    <a
                      href={`tel:${formatPhoneForCall(supplier.phone)}`}
                      className="text-foreground hover:text-primary transition-colors font-medium"
                    >
                      {supplier.phone}
                    </a>
                  </div>

                  {supplier.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
                        <Globe className="h-4 w-4 text-accent" />
                      </div>
                      <a
                        href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                      >
                        {supplier.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="flex gap-3 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-11 rounded-xl border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
                      asChild
                    >
                      <a href={`tel:${formatPhoneForCall(supplier.phone)}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Ligar
                      </a>
                    </Button>
                    {supplier.hasWhatsApp && (
                      <Button
                        size="sm"
                        className="flex-1 h-11 rounded-xl bg-[#25D366] hover:bg-[#128C7E] shadow-sm hover:shadow-md transition-all"
                        asChild
                      >
                        <a
                          href={`https://wa.me/${formatPhoneForWhatsApp(supplier.phone)}?text=Olá! Vi sua empresa e gostaria de saber mais sobre seus produtos.`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SuppliersResults;

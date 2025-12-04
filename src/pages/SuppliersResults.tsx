import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, Phone, Globe, ArrowLeft, Loader2, MessageCircle } from "lucide-react";

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

      // Check cache
      const cacheStr = localStorage.getItem("suppliersCache");
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const cacheAge = Date.now() - cache.timestamp;
        if (cacheAge < 30 * 60 * 1000) {
          setSuppliers(cache.suppliers);
          setLoading(false);
          return;
        }
      }

      const config = JSON.parse(configStr);

      try {
        const { data, error } = await supabase.functions.invoke("search-suppliers", {
          body: {
            products: config.products,
            location: config.location,
            state: config.state,
          },
        });

        if (error) throw error;

        if (data.error) {
          toast({
            title: "Erro na busca",
            description: data.error,
            variant: "destructive",
          });
          setSuppliers([]);
        } else {
          const suppliersData = data.suppliers || [];
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
          }
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        toast({
          title: "Erro ao buscar fornecedores",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [toast]);

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
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">
              Buscando fornecedores...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Button variant="ghost" asChild className="mb-2 -ml-2">
              <Link to="/search-suppliers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Nova Busca
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {suppliers.length} Fornecedor(es) Encontrado(s)
            </h1>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum fornecedor encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                Tente ajustar os filtros ou buscar em outra região.
              </p>
              <Button asChild>
                <Link to="/search-suppliers">Nova Busca</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-base sm:text-lg line-clamp-2">
                    {supplier.name}
                  </CardTitle>
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full w-fit">
                    {supplier.category}
                  </span>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 p-4 pt-0">
                  <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`tel:${formatPhoneForCall(supplier.phone)}`}
                      className="text-primary hover:underline"
                    >
                      {supplier.phone}
                    </a>
                  </div>

                  {supplier.website && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {supplier.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs sm:text-sm h-9"
                      asChild
                    >
                      <a href={`tel:${formatPhoneForCall(supplier.phone)}`}>
                        <Phone className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        Ligar
                      </a>
                    </Button>
                    {supplier.hasWhatsApp && (
                      <Button
                        size="sm"
                        className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-xs sm:text-sm h-9"
                        asChild
                      >
                        <a
                          href={`https://wa.me/${formatPhoneForWhatsApp(supplier.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
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

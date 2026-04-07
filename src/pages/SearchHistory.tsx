import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Eye, MapPin, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchLog {
  id: string;
  search_type: string;
  search_config: any;
  results_count: number | null;
  results: any[];
  created_at: string;
}

export default function SearchHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase
        .from("search_logs") as any)
        .select("id, search_type, search_config, results_count, results, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data as any[]) || []);
    } catch (err) {
      console.error("Error fetching history:", err);
      toast({
        title: "Erro ao carregar histórico",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLeads = (log: SearchLog) => {
    const results = log.results as any[];
    
    if (results && results.length > 0) {
      // Results saved in the log - use directly
      localStorage.setItem("cachedLeads", JSON.stringify(results));
      const configStr = JSON.stringify(log.search_config);
      localStorage.setItem("cachedSearchConfig", configStr);
      localStorage.setItem("leadSearchConfig", configStr);
      navigate("/resultados");
      return;
    }

    toast({
      title: "Sem resultados salvos",
      description: "Os leads desta pesquisa não foram salvos. Faça uma nova busca.",
      variant: "destructive",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSearchDescription = (config: any) => {
    const segments = config?.selectedCustomers?.join(", ") || config?.segment || "—";
    const region = config?.region || "";
    return { segments, region };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <History className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Histórico de Pesquisas</h1>
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && logs.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma pesquisa encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Faça sua primeira pesquisa para ver o histórico aqui.
                </p>
                <Button onClick={() => navigate("/configuracao")}>Buscar Leads</Button>
              </CardContent>
            </Card>
          )}

          {!isLoading && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => {
                const { segments, region } = getSearchDescription(log.search_config);
                const hasResults = (log.results && (log.results as any[]).length > 0) || (log.results_count ?? 0) > 0;

                return (
                  <Card key={log.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={log.search_type === "leads" ? "default" : "secondary"} className="text-xs">
                              {log.search_type === "leads" ? "Leads" : log.search_type === "representatives" ? "Representantes" : log.search_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(log.created_at)}
                            </span>
                          </div>

                          <p className="font-medium text-foreground truncate">{segments}</p>

                          {region && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {region}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            {log.results_count ?? 0} resultado(s)
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant={hasResults ? "default" : "outline"}
                          disabled={!hasResults}
                          onClick={() => handleViewLeads(log)}
                          className="gap-1 flex-shrink-0"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Leads
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

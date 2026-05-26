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
  const [openingLogId, setOpeningLogId] = useState<string | null>(null);

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

  const normalizeCacheKeyPart = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const generateDbCacheKey = (segment: string, region: string) =>
    `local|${normalizeCacheKeyPart(segment)}|${normalizeCacheKeyPart(region)}`;

  const openResults = (results: any[], configStr: string, type: string = "leads") => {
    if (type === "suppliers") {
      localStorage.setItem("supplierSearchConfig", configStr);
      localStorage.setItem("suppliersCache", JSON.stringify({
        suppliers: results,
        timestamp: Date.now(),
      }));
      navigate("/suppliers-results");
      return;
    }

    try {
      localStorage.setItem("cachedLeads", JSON.stringify(results));
      localStorage.setItem("cachedSearchConfig", configStr);
    } catch (cacheErr) {
      console.warn("⚠️ Cache pulado (quota excedida):", results.length, "leads");
      try {
        localStorage.removeItem("cachedLeads");
        localStorage.removeItem("cachedSearchConfig");
      } catch {}
    }
    localStorage.setItem("leadSearchConfig", configStr);
    sessionStorage.removeItem('results_scroll_position');
    navigate("/resultados");
  };

  const handleViewLeads = async (log: SearchLog) => {
    setOpeningLogId(log.id);

    try {
      const results = Array.isArray(log.results) ? log.results : [];
      const config = log.search_config || {};
      const configStr = JSON.stringify(config);
      const segment = Array.isArray(config.selectedCustomers)
        ? config.selectedCustomers.join(", ")
        : config.segment || "";
      const region = config.region || "";
      const hasFullSavedResults = results.length > 0 && (!log.results_count || results.length >= log.results_count);

      if (hasFullSavedResults) {
        openResults(results, configStr, log.search_type);
        return;
      }

      if (log.search_type === "leads" && segment && region) {
        const cacheKey = generateDbCacheKey(segment, region);
        const { data: cacheData, error: cacheError } = await (supabase
          .from("cached_search_results") as any)
          .select("results, results_count")
          .eq("cache_key", cacheKey)
          .maybeSingle();

        if (!cacheError) {
          const cachedResults = Array.isArray(cacheData?.results) ? cacheData.results : [];
          if (cachedResults.length > results.length) {
            openResults(cachedResults, configStr, log.search_type);
            return;
          }
        }

        localStorage.removeItem("cachedLeads");
        localStorage.removeItem("cachedSearchConfig");
        localStorage.setItem("leadSearchConfig", configStr);

        toast({
          title: "Recarregando resultados",
          description: "Essa busca antiga será reprocessada para abrir todos os leads disponíveis.",
        });

        navigate("/resultados");
        return;
      }

      if (results.length > 0) {
        openResults(results, configStr, log.search_type);
        return;
      }

      toast({
        title: "Sem resultados salvos",
        description: "Os leads desta pesquisa não foram salvos. Faça uma nova busca.",
        variant: "destructive",
      });
    } finally {
      setOpeningLogId(null);
    }
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
    const segments = config?.products?.join(", ") || config?.selectedCustomers?.join(", ") || config?.segment || "—";
    const region = config?.region || "";
    return { segments, region };
  };

  const getSearchTypeLabel = (type: string) => {
    if (type === "leads") return "Leads";
    if (type === "representatives") return "Representantes";
    if (type === "suppliers") return "Fornecedores";
    return type;
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
                              {getSearchTypeLabel(log.search_type)}
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
                          disabled={!hasResults || openingLogId === log.id}
                          onClick={() => void handleViewLeads(log)}
                          className="gap-1 flex-shrink-0"
                        >
                          <Eye className="w-4 h-4" />
                          {openingLogId === log.id ? "Abrindo..." : log.search_type === "suppliers" ? "Ver Fornecedores" : "Ver Leads"}
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

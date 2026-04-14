import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Search, MousePointerClick, Calendar, TrendingUp } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface TrialEvent {
  id: string;
  event_type: string;
  search_config: Record<string, any>;
  results_count: number;
  device_id: string | null;
  created_at: string;
}

export default function TrialAdminPanel() {
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("trial_analytics" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setEvents(data as unknown as TrialEvent[]);
      }
    } catch (e) {
      console.error("Error fetching trial analytics:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const totalSearches = events.filter(e => e.event_type === "search").length;
  const todaySearches = events.filter(e => e.event_type === "search" && e.created_at.slice(0, 10) === today).length;
  const totalCheckoutClicks = events.filter(e => e.event_type === "checkout_click").length;
  const todayCheckoutClicks = events.filter(e => e.event_type === "checkout_click" && e.created_at.slice(0, 10) === today).length;

  // Segment stats
  const segmentCounts: Record<string, number> = {};
  events.filter(e => e.event_type === "search").forEach(e => {
    const seg = e.search_config?.segment || "N/A";
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
  });
  const topSegments = Object.entries(segmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Search className="h-3.5 w-3.5" /> Pesquisas Hoje
          </div>
          <p className="text-2xl font-bold">{todaySearches}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> Total Pesquisas
          </div>
          <p className="text-2xl font-bold">{totalSearches}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <MousePointerClick className="h-3.5 w-3.5" /> Cliques Checkout Hoje
          </div>
          <p className="text-2xl font-bold">{todayCheckoutClicks}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <MousePointerClick className="h-3.5 w-3.5" /> Total Cliques Checkout
          </div>
          <p className="text-2xl font-bold">{totalCheckoutClicks}</p>
        </Card>
      </div>

      {/* Top Segments */}
      {topSegments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Segmentos Mais Pesquisados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topSegments.map(([seg, count]) => (
                <Badge key={seg} variant="secondary" className="text-xs">
                  {seg} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Últimos Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Resultados</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>
                      <Badge variant={ev.event_type === "checkout_click" ? "default" : "secondary"} className="text-xs">
                        {ev.event_type === "search" ? "Pesquisa" : "Checkout"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {ev.search_config?.segment || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {ev.search_config?.region || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ev.results_count > 0 ? "outline" : "destructive"} className="text-xs">
                        {ev.results_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum evento registrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Search, MousePointerClick, Calendar, TrendingUp, MapPin, Globe, Users, Clock, Percent } from "lucide-react";
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
        .limit(500);

      if (error) {
        console.error("Error fetching trial analytics:", error);
        setEvents([]);
        return;
      }

      setEvents((data ?? []) as unknown as TrialEvent[]);
    } catch (e) {
      console.error("Error fetching trial analytics:", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const last7days = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const searches = events.filter(e => e.event_type === "search");
  const checkoutClicks = events.filter(e => e.event_type === "checkout_click");

  const todaySearches = searches.filter(e => e.created_at.slice(0, 10) === today).length;
  const yesterdaySearches = searches.filter(e => e.created_at.slice(0, 10) === yesterday).length;
  const weekSearches = searches.filter(e => e.created_at.slice(0, 10) >= last7days).length;
  const todayCheckouts = checkoutClicks.filter(e => e.created_at.slice(0, 10) === today).length;
  const weekCheckouts = checkoutClicks.filter(e => e.created_at.slice(0, 10) >= last7days).length;

  // Unique devices
  const uniqueDevices = new Set(events.map(e => e.device_id).filter(Boolean)).size;
  const todayDevices = new Set(events.filter(e => e.created_at.slice(0, 10) === today).map(e => e.device_id).filter(Boolean)).size;

  // Conversion rate
  const conversionRate = searches.length > 0 ? ((checkoutClicks.length / searches.length) * 100).toFixed(1) : "0";

  // Average results
  const avgResults = searches.length > 0 ? Math.round(searches.reduce((a, e) => a + (e.results_count || 0), 0) / searches.length) : 0;

  // Segment stats
  const segmentCounts: Record<string, number> = {};
  searches.forEach(e => {
    const seg = e.search_config?.segment || "N/A";
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
  });
  const topSegments = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // Region stats
  const regionCounts: Record<string, number> = {};
  searches.forEach(e => {
    const region = e.search_config?.region || "N/A";
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Product stats
  const productCounts: Record<string, number> = {};
  searches.forEach(e => {
    const product = e.search_config?.products || "N/A";
    productCounts[product] = (productCounts[product] || 0) + 1;
  });
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Daily breakdown (last 7 days)
  const dailyBreakdown: { date: string; searches: number; checkouts: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    dailyBreakdown.push({
      date: d,
      searches: searches.filter(e => e.created_at.slice(0, 10) === d).length,
      checkouts: checkoutClicks.filter(e => e.created_at.slice(0, 10) === d).length,
    });
  }

  // Hourly distribution today
  const hourlyToday = Array.from({ length: 24 }, (_, h) => {
    const count = events.filter(e => {
      const ed = new Date(e.created_at);
      return ed.toISOString().slice(0, 10) === today && ed.getHours() === h;
    }).length;
    return { hour: `${h}h`, count };
  }).filter(h => h.count > 0);

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Search className="h-3 w-3" /> Pesquisas Hoje
          </div>
          <p className="text-2xl font-bold">{todaySearches}</p>
          <p className="text-[10px] text-muted-foreground">Ontem: {yesterdaySearches}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <TrendingUp className="h-3 w-3" /> Total Pesquisas
          </div>
          <p className="text-2xl font-bold">{searches.length}</p>
          <p className="text-[10px] text-muted-foreground">Últimos 7d: {weekSearches}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <MousePointerClick className="h-3 w-3" /> Cliques Checkout
          </div>
          <p className="text-2xl font-bold">{checkoutClicks.length}</p>
          <p className="text-[10px] text-muted-foreground">Hoje: {todayCheckouts} | 7d: {weekCheckouts}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Percent className="h-3 w-3" /> Taxa Conversão
          </div>
          <p className="text-2xl font-bold">{conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground">Checkout / Pesquisas</p>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Users className="h-3 w-3" /> Visitantes Únicos
          </div>
          <p className="text-xl font-bold">{uniqueDevices}</p>
          <p className="text-[10px] text-muted-foreground">Hoje: {todayDevices}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <BarChart3 className="h-3 w-3" /> Média Resultados
          </div>
          <p className="text-xl font-bold">{avgResults}</p>
          <p className="text-[10px] text-muted-foreground">Por pesquisa</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Calendar className="h-3 w-3" /> Total Eventos
          </div>
          <p className="text-xl font-bold">{events.length}</p>
          <p className="text-[10px] text-muted-foreground">Pesquisas + Cliques</p>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Últimos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Pesquisas</TableHead>
                  <TableHead className="text-xs">Checkouts</TableHead>
                  <TableHead className="text-xs">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyBreakdown.map(d => (
                  <TableRow key={d.date}>
                    <TableCell className="text-xs font-medium">
                      {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-xs">{d.searches}</TableCell>
                    <TableCell className="text-xs">{d.checkouts}</TableCell>
                    <TableCell className="text-xs">
                      {d.searches > 0 ? `${((d.checkouts / d.searches) * 100).toFixed(0)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Today */}
      {hourlyToday.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Atividade por Hora (Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {hourlyToday.map(h => {
                const max = Math.max(...hourlyToday.map(x => x.count));
                const height = max > 0 ? (h.count / max) * 100 : 0;
                return (
                  <div key={h.hour} className="flex flex-col items-center flex-1 min-w-0">
                    <div className="bg-primary/80 rounded-t w-full" style={{ height: `${height}%`, minHeight: h.count > 0 ? 4 : 0 }} />
                    <span className="text-[8px] text-muted-foreground mt-1">{h.hour}</span>
                    <span className="text-[8px] font-medium">{h.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Segments & Regions side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topSegments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Segmentos Pesquisados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topSegments.map(([seg, count]) => {
                  const pct = searches.length > 0 ? (count / searches.length) * 100 : 0;
                  return (
                    <div key={seg}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="truncate max-w-[200px]">{seg}</span>
                        <span className="text-muted-foreground font-medium">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {topRegions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Regiões Pesquisadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topRegions.map(([region, count]) => {
                  const pct = searches.length > 0 ? (count / searches.length) * 100 : 0;
                  return (
                    <div key={region}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="truncate max-w-[200px]">{region}</span>
                        <span className="text-muted-foreground font-medium">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" /> Produtos Pesquisados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topProducts.map(([prod, count]) => (
                <Badge key={prod} variant="secondary" className="text-xs">
                  {prod} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Todos os Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Segmento</TableHead>
                  <TableHead className="text-xs">Região</TableHead>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs">Resultados</TableHead>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>
                      <Badge variant={ev.event_type === "checkout_click" ? "default" : "secondary"} className="text-[10px]">
                        {ev.event_type === "search" ? "Pesquisa" : "Checkout"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] max-w-[120px] truncate">
                      {ev.search_config?.segment || "—"}
                    </TableCell>
                    <TableCell className="text-[11px]">
                      {ev.search_config?.region || "—"}
                    </TableCell>
                    <TableCell className="text-[11px] max-w-[100px] truncate">
                      {ev.search_config?.products || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ev.results_count > 0 ? "outline" : "destructive"} className="text-[10px]">
                        {ev.results_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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

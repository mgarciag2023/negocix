import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MousePointerClick, TrendingUp, MapPin, Users, Clock, Percent, Eye, Timer, Unlock, PointerIcon, ChevronDown, ChevronUp, RefreshCw, BarChart3 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TrialEvent {
  id: string;
  event_type: string;
  search_config: Record<string, any>;
  results_count: number;
  device_id: string | null;
  created_at: string;
}

interface DeviceSession {
  device_id: string;
  events: TrialEvent[];
  firstSeen: string;
  lastSeen: string;
  searches: number;
  checkouts: number;
  unlockClicks: number;
  cardClicks: number;
  pageViews: number;
  timeOnPage: number; // total seconds
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
};

const eventLabel: Record<string, string> = {
  search: "Pesquisa",
  checkout_click: "Checkout",
  unlock_click: "Desbloquear",
  card_click: "Clique Card",
  page_view: "Visita",
  time_on_page: "Tempo",
};

const eventColor: Record<string, string> = {
  search: "bg-blue-500/10 text-blue-700 border-blue-200",
  checkout_click: "bg-green-500/10 text-green-700 border-green-200",
  unlock_click: "bg-amber-500/10 text-amber-700 border-amber-200",
  card_click: "bg-purple-500/10 text-purple-700 border-purple-200",
  page_view: "bg-gray-500/10 text-gray-700 border-gray-200",
  time_on_page: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
};

function DeviceRow({ session }: { session: DeviceSession }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-mono text-[11px]">
            {session.device_id?.slice(0, 8)}…
          </TableCell>
          <TableCell className="text-[11px]">{formatDate(session.firstSeen)}</TableCell>
          <TableCell className="text-[11px]">{formatDate(session.lastSeen)}</TableCell>
          <TableCell className="text-center">
            <Badge variant="secondary" className="text-[10px]">{session.pageViews}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant="secondary" className="text-[10px]">{session.searches}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={session.unlockClicks > 0 ? "default" : "secondary"} className="text-[10px]">
              {session.unlockClicks}
            </Badge>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={session.checkouts > 0 ? "default" : "secondary"} className="text-[10px]">
              {session.checkouts}
            </Badge>
          </TableCell>
          <TableCell className="text-[11px] text-right">
            {session.timeOnPage > 0 ? formatDuration(session.timeOnPage) : "—"}
          </TableCell>
          <TableCell>
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={9} className="p-0">
            <div className="bg-muted/30 border-y p-3 space-y-1.5">
              {session.events.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-[11px]">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${eventColor[ev.event_type] || "bg-muted"}`}>
                    {eventLabel[ev.event_type] || ev.event_type}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </span>
                  {ev.event_type === "search" && (
                    <div className="flex flex-col gap-0.5 ml-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{ev.search_config?.products || "—"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{ev.search_config?.segment || "—"}</span>
                        <span className="text-muted-foreground">em</span>
                        <span className="font-semibold">{ev.search_config?.region || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <Badge variant="outline" className="text-[9px]">
                          🔍 {ev.search_config?.realCount ?? ev.results_count ?? "?"} encontrados
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          📊 {ev.search_config?.inflatedCount ?? "?"} exibido como total
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          👁 {ev.search_config?.previewCount ?? 6} mostrados
                        </Badge>
                      </div>
                    </div>
                  )}
                  {ev.event_type === "time_on_page" && (
                    <span className="font-medium">{formatDuration(ev.search_config?.seconds || 0)}</span>
                  )}
                  {ev.event_type === "card_click" && ev.search_config?.lead_name && (
                    <span className="text-muted-foreground truncate max-w-[150px]">{ev.search_config.lead_name}</span>
                  )}
                  {ev.event_type === "checkout_click" && (
                    <span className="text-green-600 font-semibold">💰 Foi pro checkout!</span>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function TrialAdminPanel() {
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trial_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Error fetching trial analytics:", error);
        setEvents([]);
        return;
      }
      setEvents((data ?? []) as unknown as TrialEvent[]);
    } catch (e) {
      console.error("Error:", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

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
  const checkouts = events.filter(e => e.event_type === "checkout_click");
  const unlocks = events.filter(e => e.event_type === "unlock_click");
  const pageViews = events.filter(e => e.event_type === "page_view");
  const cardClicks = events.filter(e => e.event_type === "card_click");
  const timeEvents = events.filter(e => e.event_type === "time_on_page");

  const todaySearches = searches.filter(e => e.created_at.slice(0, 10) === today).length;
  const yesterdaySearches = searches.filter(e => e.created_at.slice(0, 10) === yesterday).length;
  const weekSearches = searches.filter(e => e.created_at.slice(0, 10) >= last7days).length;
  const todayCheckouts = checkouts.filter(e => e.created_at.slice(0, 10) === today).length;
  const todayPageViews = pageViews.filter(e => e.created_at.slice(0, 10) === today).length;

  // Unique devices
  const uniqueDevices = new Set(events.map(e => e.device_id).filter(Boolean)).size;
  const todayDevices = new Set(events.filter(e => e.created_at.slice(0, 10) === today).map(e => e.device_id).filter(Boolean)).size;

  // Conversion rate
  const conversionRate = searches.length > 0 ? ((checkouts.length / searches.length) * 100).toFixed(1) : "0";

  // Average time on page
  const totalTime = timeEvents.reduce((a, e) => a + (e.search_config?.seconds || 0), 0);
  const avgTime = timeEvents.length > 0 ? Math.round(totalTime / timeEvents.length) : 0;

  // Average results
  const avgResults = searches.length > 0 ? Math.round(searches.reduce((a, e) => a + (e.results_count || 0), 0) / searches.length) : 0;

  // Build device sessions
  const deviceMap: Record<string, DeviceSession> = {};
  events.forEach(ev => {
    const did = ev.device_id || "unknown";
    if (!deviceMap[did]) {
      deviceMap[did] = {
        device_id: did,
        events: [],
        firstSeen: ev.created_at,
        lastSeen: ev.created_at,
        searches: 0, checkouts: 0, unlockClicks: 0, cardClicks: 0, pageViews: 0, timeOnPage: 0,
      };
    }
    const s = deviceMap[did];
    s.events.push(ev);
    if (ev.created_at < s.firstSeen) s.firstSeen = ev.created_at;
    if (ev.created_at > s.lastSeen) s.lastSeen = ev.created_at;
    if (ev.event_type === "search") s.searches++;
    if (ev.event_type === "checkout_click") s.checkouts++;
    if (ev.event_type === "unlock_click") s.unlockClicks++;
    if (ev.event_type === "card_click") s.cardClicks++;
    if (ev.event_type === "page_view") s.pageViews++;
    if (ev.event_type === "time_on_page") s.timeOnPage += (ev.search_config?.seconds || 0);
  });

  // Sort sessions: most recent first, prioritize those with checkouts
  const sessions = Object.values(deviceMap).sort((a, b) => {
    if (a.checkouts > 0 && b.checkouts === 0) return -1;
    if (b.checkouts > 0 && a.checkouts === 0) return 1;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });

  // Segment stats
  const segmentCounts: Record<string, number> = {};
  searches.forEach(e => {
    const seg = e.search_config?.segment || "N/A";
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
  });
  const topSegments = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Region stats
  const regionCounts: Record<string, number> = {};
  searches.forEach(e => {
    const region = e.search_config?.region || "N/A";
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Daily breakdown
  const dailyBreakdown: { date: string; views: number; searches: number; unlocks: number; checkouts: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    dailyBreakdown.push({
      date: d,
      views: pageViews.filter(e => e.created_at.slice(0, 10) === d).length,
      searches: searches.filter(e => e.created_at.slice(0, 10) === d).length,
      unlocks: unlocks.filter(e => e.created_at.slice(0, 10) === d).length,
      checkouts: checkouts.filter(e => e.created_at.slice(0, 10) === d).length,
    });
  }

  return (
    <div className="space-y-6">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-2">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Eye className="h-3 w-3" /> Visitas Hoje
          </div>
          <p className="text-2xl font-bold">{todayPageViews}</p>
          <p className="text-[10px] text-muted-foreground">Total: {pageViews.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Search className="h-3 w-3" /> Pesquisas Hoje
          </div>
          <p className="text-2xl font-bold">{todaySearches}</p>
          <p className="text-[10px] text-muted-foreground">Ontem: {yesterdaySearches} | 7d: {weekSearches}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <MousePointerClick className="h-3 w-3" /> Checkouts
          </div>
          <p className="text-2xl font-bold">{checkouts.length}</p>
          <p className="text-[10px] text-muted-foreground">Hoje: {todayCheckouts}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Percent className="h-3 w-3" /> Conversão
          </div>
          <p className="text-2xl font-bold">{conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground">Checkout / Pesquisas</p>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Users className="h-3 w-3" /> Visitantes
          </div>
          <p className="text-xl font-bold">{uniqueDevices}</p>
          <p className="text-[10px] text-muted-foreground">Hoje: {todayDevices}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Timer className="h-3 w-3" /> Tempo Médio
          </div>
          <p className="text-xl font-bold">{formatDuration(avgTime)}</p>
          <p className="text-[10px] text-muted-foreground">Na página</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <Unlock className="h-3 w-3" /> Cliques Desbloquear
          </div>
          <p className="text-xl font-bold">{unlocks.length}</p>
          <p className="text-[10px] text-muted-foreground">Cards: {cardClicks.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
            <BarChart3 className="h-3 w-3" /> Média Resultados
          </div>
          <p className="text-xl font-bold">{avgResults}</p>
          <p className="text-[10px] text-muted-foreground">Por pesquisa</p>
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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs text-center">Visitas</TableHead>
                  <TableHead className="text-xs text-center">Pesquisas</TableHead>
                  <TableHead className="text-xs text-center">Desbloquear</TableHead>
                  <TableHead className="text-xs text-center">Checkouts</TableHead>
                  <TableHead className="text-xs text-center">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyBreakdown.map(d => (
                  <TableRow key={d.date}>
                    <TableCell className="text-xs font-medium">
                      {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-xs text-center">{d.views}</TableCell>
                    <TableCell className="text-xs text-center">{d.searches}</TableCell>
                    <TableCell className="text-xs text-center">{d.unlocks}</TableCell>
                    <TableCell className="text-xs text-center">{d.checkouts}</TableCell>
                    <TableCell className="text-xs text-center">
                      {d.searches > 0 ? `${((d.checkouts / d.searches) * 100).toFixed(0)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Device Sessions - THE MAIN VIEW */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Sessões por Dispositivo ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Primeira visita</TableHead>
                  <TableHead className="text-xs">Última visita</TableHead>
                  <TableHead className="text-xs text-center">Visitas</TableHead>
                  <TableHead className="text-xs text-center">Pesquisas</TableHead>
                  <TableHead className="text-xs text-center">Desbloquear</TableHead>
                  <TableHead className="text-xs text-center">Checkout</TableHead>
                  <TableHead className="text-xs text-right">Tempo</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => (
                  <DeviceRow key={s.device_id} session={s} />
                ))}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhuma sessão registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Segments & Regions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topSegments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Segmentos Pesquisados
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
                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

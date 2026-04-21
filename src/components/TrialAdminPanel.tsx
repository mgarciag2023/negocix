import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Search, MousePointerClick, TrendingUp, MapPin, Users, Clock,
  Percent, Eye, Timer, Unlock, ChevronDown, ChevronUp, RefreshCw, BarChart3,
} from "lucide-react";
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
  timeOnPage: number;
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatDateFull = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const eventLabel: Record<string, string> = {
  search: "Pesquisa",
  checkout_click: "Checkout",
  unlock_click: "Desbloquear",
  card_click: "Clique Card",
  page_view: "Visita",
  time_on_page: "Tempo",
};

const eventIcon: Record<string, typeof Search> = {
  search: Search,
  checkout_click: MousePointerClick,
  unlock_click: Unlock,
  card_click: Eye,
  page_view: Eye,
  time_on_page: Timer,
};

const eventBadgeClass: Record<string, string> = {
  search: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  checkout_click: "bg-green-500/15 text-green-400 border-green-500/30",
  unlock_click: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  card_click: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  page_view: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  time_on_page: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

// ─── Stat Card ───
function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Event Timeline Item ───
function EventItem({ ev }: { ev: TrialEvent }) {
  const Icon = eventIcon[ev.event_type] || Eye;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <div className={`mt-0.5 flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${eventBadgeClass[ev.event_type] || "bg-muted"}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${eventBadgeClass[ev.event_type] || ""}`}>
            {eventLabel[ev.event_type] || ev.event_type}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{formatDateFull(ev.created_at)}</span>
        </div>
        {ev.event_type === "search" && (
          <div className="mt-1 space-y-0.5">
            <p className="text-xs">
              <span className="font-medium">{ev.search_config?.products || "—"}</span>
              <span className="text-muted-foreground mx-1">→</span>
              <span className="font-medium">{ev.search_config?.segment || "—"}</span>
              <span className="text-muted-foreground mx-1">em</span>
              <span className="font-semibold">{ev.search_config?.region || "—"}</span>
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9px]">🔍 {ev.search_config?.realCount ?? ev.results_count ?? "?"} reais</Badge>
              <Badge variant="outline" className="text-[9px]">📊 {ev.search_config?.inflatedCount ?? "?"} exibido</Badge>
              <Badge variant="outline" className="text-[9px]">👁 {ev.search_config?.previewCount ?? 6} mostrados</Badge>
            </div>
          </div>
        )}
        {ev.event_type === "time_on_page" && (
          <p className="text-xs mt-0.5 font-medium">{formatDuration(ev.search_config?.seconds || 0)}</p>
        )}
        {ev.event_type === "card_click" && ev.search_config?.lead_name && (
          <p className="text-xs mt-0.5 text-muted-foreground truncate">{ev.search_config.lead_name}</p>
        )}
        {ev.event_type === "checkout_click" && (
          <p className="text-xs mt-0.5 text-green-400 font-semibold">💰 Foi pro checkout!</p>
        )}
      </div>
    </div>
  );
}

// ─── Device Session Row ───
function DeviceRow({ session }: { session: DeviceSession }) {
  const [open, setOpen] = useState(false);
  const hasConversion = session.checkouts > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className={`cursor-pointer hover:bg-muted/50 ${hasConversion ? "bg-green-500/5" : ""}`}>
          <TableCell className="font-mono text-[11px]">{session.device_id?.slice(0, 8)}…</TableCell>
          <TableCell className="text-[11px]">{formatDate(session.firstSeen)}</TableCell>
          <TableCell className="text-[11px]">{formatDate(session.lastSeen)}</TableCell>
          <TableCell className="text-center"><Badge variant="secondary" className="text-[10px]">{session.pageViews}</Badge></TableCell>
          <TableCell className="text-center"><Badge variant="secondary" className="text-[10px]">{session.searches}</Badge></TableCell>
          <TableCell className="text-center">
            <Badge variant={session.unlockClicks > 0 ? "default" : "secondary"} className="text-[10px]">{session.unlockClicks}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={session.checkouts > 0 ? "default" : "secondary"} className={`text-[10px] ${hasConversion ? "bg-green-600" : ""}`}>
              {session.checkouts}
            </Badge>
          </TableCell>
          <TableCell className="text-[11px] text-right">{session.timeOnPage > 0 ? formatDuration(session.timeOnPage) : "—"}</TableCell>
          <TableCell>{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={9} className="p-0">
            <div className="bg-muted/20 border-y px-4 py-3">
              {session.events
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map(ev => <EventItem key={ev.id} ev={ev} />)}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Bar visualization ───
function BarStat({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="truncate max-w-[200px]">{label}</span>
        <span className="text-muted-foreground font-medium shrink-0 ml-2">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

// ─── Main Panel ───
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
      if (error) { console.error("Error:", error); setEvents([]); return; }
      setEvents((data ?? []) as unknown as TrialEvent[]);
    } catch (e) { console.error("Error:", e); setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
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

  const uniqueDevices = new Set(events.map(e => e.device_id).filter(Boolean)).size;
  const todayDevices = new Set(events.filter(e => e.created_at.slice(0, 10) === today).map(e => e.device_id).filter(Boolean)).size;
  const conversionRate = searches.length > 0 ? ((checkouts.length / searches.length) * 100).toFixed(1) : "0";
  const totalTime = timeEvents.reduce((a, e) => a + (e.search_config?.seconds || 0), 0);
  const avgTime = timeEvents.length > 0 ? Math.round(totalTime / timeEvents.length) : 0;
  const avgResults = searches.length > 0 ? Math.round(searches.reduce((a, e) => a + (e.results_count || 0), 0) / searches.length) : 0;

  // Device sessions
  const deviceMap: Record<string, DeviceSession> = {};
  events.forEach(ev => {
    const did = ev.device_id || "unknown";
    if (!deviceMap[did]) {
      deviceMap[did] = { device_id: did, events: [], firstSeen: ev.created_at, lastSeen: ev.created_at, searches: 0, checkouts: 0, unlockClicks: 0, cardClicks: 0, pageViews: 0, timeOnPage: 0 };
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

  const sessions = Object.values(deviceMap).sort((a, b) => {
    if (a.checkouts > 0 && b.checkouts === 0) return -1;
    if (b.checkouts > 0 && a.checkouts === 0) return 1;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });

  // Segments & regions
  const segmentCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  searches.forEach(e => {
    const seg = e.search_config?.segment || "N/A";
    const region = e.search_config?.region || "N/A";
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });
  const topSegments = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Daily breakdown (7 days)
  const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    return {
      date: d,
      views: pageViews.filter(e => e.created_at.slice(0, 10) === d).length,
      searches: searches.filter(e => e.created_at.slice(0, 10) === d).length,
      unlocks: unlocks.filter(e => e.created_at.slice(0, 10) === d).length,
      checkouts: checkouts.filter(e => e.created_at.slice(0, 10) === d).length,
    };
  });

  // Recent events sorted by newest first
  const recentEvents = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);

  return (
    <div className="space-y-6">
      {/* ── Header Actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {events.length} eventos • {uniqueDevices} dispositivos
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            localStorage.removeItem("negocix_trial_results_v2");
            localStorage.removeItem("negocix_trial_total");
            localStorage.removeItem("negocix_trial_inflated");
            localStorage.removeItem("negocix_trial_used");
            window.location.href = "/teste";
          }}>
            <Search className="h-3 w-3" /> Testar Demo
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchEvents}>
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Visitas" value={todayPageViews} sub={`Total: ${pageViews.length}`} />
        <StatCard icon={Search} label="Pesquisas" value={todaySearches} sub={`Ontem: ${yesterdaySearches} · 7d: ${weekSearches}`} />
        <StatCard icon={MousePointerClick} label="Checkouts" value={checkouts.length} sub={`Hoje: ${todayCheckouts}`} />
        <StatCard icon={Percent} label="Conversão" value={`${conversionRate}%`} sub="Checkout / Pesquisas" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Visitantes" value={uniqueDevices} sub={`Hoje: ${todayDevices}`} />
        <StatCard icon={Timer} label="Tempo Médio" value={formatDuration(avgTime)} sub="Na página" />
        <StatCard icon={Unlock} label="Desbloquear" value={unlocks.length} sub={`Cards: ${cardClicks.length}`} />
        <StatCard icon={BarChart3} label="Média Resultados" value={avgResults} sub="Por pesquisa" />
      </div>

      {/* ── Tabs: Sessões / Timeline / Análise / Diário ── */}
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="sessions" className="text-xs">Sessões</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs">Análise</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs">Diário</TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-4">
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
                      <TableHead className="text-xs">Entrada</TableHead>
                      <TableHead className="text-xs">Última</TableHead>
                      <TableHead className="text-xs text-center">👁</TableHead>
                      <TableHead className="text-xs text-center">🔍</TableHead>
                      <TableHead className="text-xs text-center">🔓</TableHead>
                      <TableHead className="text-xs text-center">💰</TableHead>
                      <TableHead className="text-xs text-right">⏱</TableHead>
                      <TableHead className="text-xs w-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map(s => <DeviceRow key={s.device_id} session={s} />)}
                    {sessions.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma sessão</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab - all events sorted chronologically */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Últimos 50 Eventos (mais recentes primeiro)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                {recentEvents.map(ev => <EventItem key={ev.id} ev={ev} />)}
                {recentEvents.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">Nenhum evento</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topSegments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Top Segmentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {topSegments.map(([seg, count]) => (
                    <BarStat key={seg} label={seg} count={count} total={searches.length} />
                  ))}
                </CardContent>
              </Card>
            )}
            {topRegions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Top Regiões
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {topRegions.map(([region, count]) => (
                    <BarStat key={region} label={region} count={count} total={searches.length} />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Daily Tab */}
        <TabsContent value="daily" className="mt-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

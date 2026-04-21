import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, MousePointerClick, TrendingUp, MapPin, Users, Clock,
  Percent, Eye, Timer, Unlock, RefreshCw, BarChart3, Loader2,
  ChevronDown, ChevronUp, ShoppingCart,
} from "lucide-react";
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

// ─── Helpers ───

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days}d atrás`;
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatWeekday = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Hoje";
  if (dateStr === yesterday) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
};

const eventLabels: Record<string, string> = {
  search: "Pesquisa",
  checkout_click: "Checkout",
  unlock_click: "Desbloquear",
  card_click: "Clique",
  page_view: "Visita",
  time_on_page: "Tempo",
};

const eventColors: Record<string, string> = {
  search: "text-blue-400 bg-blue-500/15",
  checkout_click: "text-green-400 bg-green-500/15",
  unlock_click: "text-amber-400 bg-amber-500/15",
  card_click: "text-purple-400 bg-purple-500/15",
  page_view: "text-slate-400 bg-slate-500/15",
  time_on_page: "text-cyan-400 bg-cyan-500/15",
};

// ─── Stat Card ───
function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Visitor Card (mobile-friendly session view) ───
function VisitorCard({ session, index }: { session: DeviceSession; index: number }) {
  const [open, setOpen] = useState(false);
  const hasCheckout = session.checkouts > 0;
  const hasUnlock = session.unlockClicks > 0;

  const searchEvents = session.events.filter(e => e.event_type === "search");

  return (
    <Card className={`border-border/50 ${hasCheckout ? "ring-1 ring-green-500/30" : ""}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${hasCheckout ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {index + 1}
                </div>
                <div>
                  <p className="text-xs font-medium">
                    Visitante #{index + 1}
                    {hasCheckout && <span className="ml-1.5 text-green-400">💰</span>}
                    {hasUnlock && !hasCheckout && <span className="ml-1.5 text-amber-400">🔓</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(session.lastSeen)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-[10px]">
                  <span title="Pesquisas" className="flex items-center gap-0.5">🔍 {session.searches}</span>
                  <span title="Tempo" className="flex items-center gap-0.5">⏱ {session.timeOnPage > 0 ? formatDuration(session.timeOnPage) : "—"}</span>
                </div>
                {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </div>

            {/* Quick stats row */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[9px] gap-1"><Eye className="h-2.5 w-2.5" />{session.pageViews} visitas</Badge>
              <Badge variant="secondary" className="text-[9px] gap-1"><Search className="h-2.5 w-2.5" />{session.searches} pesquisas</Badge>
              {session.unlockClicks > 0 && <Badge className="text-[9px] gap-1 bg-amber-500/15 text-amber-400 border-amber-500/30"><Unlock className="h-2.5 w-2.5" />{session.unlockClicks}</Badge>}
              {session.checkouts > 0 && <Badge className="text-[9px] gap-1 bg-green-600"><ShoppingCart className="h-2.5 w-2.5" />{session.checkouts} checkout</Badge>}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/30 px-3 py-2 space-y-1.5 bg-muted/10">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">
              Entrada: {formatDateShort(session.firstSeen)} · Última ação: {formatDateShort(session.lastSeen)}
            </p>
            {session.events
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map(ev => (
                <div key={ev.id} className="flex items-start gap-2 py-1 border-b border-border/20 last:border-0">
                  <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${eventColors[ev.event_type] || "bg-muted"}`}>
                    <span className="text-[8px]">
                      {ev.event_type === "search" ? "🔍" : ev.event_type === "checkout_click" ? "💰" : ev.event_type === "unlock_click" ? "🔓" : ev.event_type === "card_click" ? "👁" : ev.event_type === "time_on_page" ? "⏱" : "📄"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium">{eventLabels[ev.event_type] || ev.event_type}</span>
                      <span className="text-[9px] text-muted-foreground">{timeAgo(ev.created_at)}</span>
                    </div>
                    {ev.event_type === "search" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {ev.search_config?.segment || "—"} em {ev.search_config?.region || "—"}
                        {" · "}{ev.search_config?.realCount ?? ev.results_count ?? "?"} resultados
                      </p>
                    )}
                    {ev.event_type === "time_on_page" && (
                      <p className="text-[10px] text-muted-foreground">{formatDuration(ev.search_config?.seconds || 0)}</p>
                    )}
                    {ev.event_type === "card_click" && ev.search_config?.lead_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{ev.search_config.lead_name}</p>
                    )}
                    {ev.event_type === "checkout_click" && (
                      <p className="text-[10px] text-green-400 font-semibold">Foi pro checkout!</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Bar Stat ───
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{uniqueDevices} visitantes · {events.length} eventos</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => {
            localStorage.removeItem("negocix_trial_results_v2");
            localStorage.removeItem("negocix_trial_total");
            localStorage.removeItem("negocix_trial_inflated");
            localStorage.removeItem("negocix_trial_used");
            window.location.href = "/teste";
          }}>
            Testar
          </Button>
          <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 gap-1" onClick={fetchEvents}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Eye} label="Visitas Hoje" value={todayPageViews} sub={`Total: ${pageViews.length}`} />
        <StatCard icon={Search} label="Pesquisas Hoje" value={todaySearches} sub={`Ontem: ${yesterdaySearches} · 7d: ${weekSearches}`} />
        <StatCard icon={ShoppingCart} label="Checkouts" value={checkouts.length} sub={`Hoje: ${todayCheckouts}`} />
        <StatCard icon={Percent} label="Conversão" value={`${conversionRate}%`} sub="Checkout / Pesquisas" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Users} label="Visitantes Únicos" value={uniqueDevices} sub={`Hoje: ${todayDevices}`} />
        <StatCard icon={Timer} label="Tempo Médio" value={formatDuration(avgTime)} />
        <StatCard icon={Unlock} label="Desbloquear" value={unlocks.length} sub={`Cliques card: ${cardClicks.length}`} />
        <StatCard icon={BarChart3} label="Média Resultados" value={avgResults} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visitors" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="visitors" className="text-[11px]">Visitantes</TabsTrigger>
          <TabsTrigger value="analytics" className="text-[11px]">Análise</TabsTrigger>
          <TabsTrigger value="daily" className="text-[11px]">Diário</TabsTrigger>
        </TabsList>

        {/* Visitors Tab - card-based, mobile friendly */}
        <TabsContent value="visitors" className="mt-3 space-y-2">
          {sessions.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum visitante</p>
          )}
          {sessions.map((s, i) => (
            <VisitorCard key={s.device_id} session={s} index={i} />
          ))}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-3 space-y-3">
          {topSegments.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Top Segmentos Pesquisados
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {topSegments.map(([seg, count]) => (
                  <BarStat key={seg} label={seg} count={count} total={searches.length} />
                ))}
              </CardContent>
            </Card>
          )}
          {topRegions.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Top Regiões
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {topRegions.map(([region, count]) => (
                  <BarStat key={region} label={region} count={count} total={searches.length} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Daily Tab */}
        <TabsContent value="daily" className="mt-3">
          <div className="space-y-2">
            {dailyBreakdown.map(d => (
              <Card key={d.date} className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold mb-2">{formatWeekday(d.date)}</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{d.views}</p>
                      <p className="text-[9px] text-muted-foreground">Visitas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{d.searches}</p>
                      <p className="text-[9px] text-muted-foreground">Pesquisas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{d.unlocks}</p>
                      <p className="text-[9px] text-muted-foreground">Desbloq.</p>
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${d.checkouts > 0 ? "text-green-400" : ""}`}>{d.checkouts}</p>
                      <p className="text-[9px] text-muted-foreground">Checkout</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

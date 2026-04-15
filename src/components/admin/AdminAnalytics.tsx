import { useEffect, useState } from "react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, CalendarIcon, BarChart3, Users, Search, MapPin, TrendingUp, Clock, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface SearchLog {
  id: string;
  user_email: string;
  user_id: string;
  search_type: string;
  search_config: Record<string, any>;
  results_count: number;
  created_at: string;
}

interface DayMetrics {
  totalSearches: number;
  uniqueUsers: number;
  totalLeads: number;
  avgLeadsPerSearch: number;
  searchesByUser: Record<string, { count: number; totalLeads: number }>;
  searchesByType: Record<string, number>;
  cities: Record<string, number>;
  segments: Record<string, number>;
  logs: SearchLog[];
}

export default function AdminAnalytics() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<DayMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginsByDay, setLoginsByDay] = useState<number>(0);
  const [activeNow, setActiveNow] = useState<string[]>([]);

  useEffect(() => {
    fetchMetrics(selectedDate);
  }, [selectedDate]);

  // Poll active users every 30s
  useEffect(() => {
    fetchActiveUsers();
    const interval = setInterval(fetchActiveUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveUsers = async () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("search_logs")
      .select("user_email")
      .gte("created_at", fifteenMinAgo);
    if (data) {
      const unique = [...new Set(data.map((d) => d.user_email))];
      setActiveNow(unique);
    }
  };

  const fetchMetrics = async (date: Date) => {
    setLoading(true);
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = endOfDay(date).toISOString();

    // Fetch search logs for the day
    const { data: logs, error } = await supabase
      .from("search_logs")
      .select("*")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: false });

    // Fetch profiles created on this day (new signups)
    const { data: newProfiles } = await supabase
      .from("profiles")
      .select("id")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);

    setLoginsByDay(newProfiles?.length || 0);

    if (error || !logs) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    const typedLogs = logs as SearchLog[];

    const searchesByUser: Record<string, { count: number; totalLeads: number }> = {};
    const searchesByType: Record<string, number> = {};
    const cities: Record<string, number> = {};
    const segments: Record<string, number> = {};
    let totalLeads = 0;

    for (const log of typedLogs) {
      // By user
      if (!searchesByUser[log.user_email]) {
        searchesByUser[log.user_email] = { count: 0, totalLeads: 0 };
      }
      searchesByUser[log.user_email].count++;
      searchesByUser[log.user_email].totalLeads += log.results_count || 0;

      // By type
      const type = log.search_type || "leads";
      searchesByType[type] = (searchesByType[type] || 0) + 1;

      // Total leads
      totalLeads += log.results_count || 0;

      // Cities
      const config = log.search_config || {};
      const city = config.city || config.region || config.estado || "—";
      if (city && city !== "—") {
        cities[city] = (cities[city] || 0) + 1;
      }

      // Segments
      const segment = config.segment || config.category || "";
      if (segment) {
        segments[segment] = (segments[segment] || 0) + 1;
      }
    }

    const uniqueUsers = Object.keys(searchesByUser).length;

    setMetrics({
      totalSearches: typedLogs.length,
      uniqueUsers,
      totalLeads,
      avgLeadsPerSearch: typedLogs.length > 0 ? Math.round(totalLeads / typedLogs.length) : 0,
      searchesByUser,
      searchesByType,
      cities,
      segments,
      logs: typedLogs,
    });

    setLoading(false);
  };

  const sortedEntries = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  const dateLabel = format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Card>
      {/* Active Now Banner */}
      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3 mb-4">
        <div className="relative">
          <Wifi className="h-5 w-5 text-primary" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div>
          <p className="font-semibold text-sm">
            {activeNow.length} usuário{activeNow.length !== 1 ? "s" : ""} ativo{activeNow.length !== 1 ? "s" : ""} agora
          </p>
          <p className="text-xs text-muted-foreground">
            {activeNow.length > 0 ? activeNow.join(", ") : "Nenhuma atividade nos últimos 15 min"}
          </p>
        </div>
      </div>

      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Diário
        </CardTitle>
        <CardDescription>Selecione um dia para ver métricas detalhadas</CardDescription>

        <div className="pt-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !metrics || metrics.totalSearches === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma atividade registrada em {dateLabel}
          </p>
        ) : (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{metrics.uniqueUsers}</p>
                <p className="text-xs text-muted-foreground">Usuários ativos</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Search className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{metrics.totalSearches}</p>
                <p className="text-xs text-muted-foreground">Pesquisas</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{metrics.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Leads gerados</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <BarChart3 className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{metrics.avgLeadsPerSearch}</p>
                <p className="text-xs text-muted-foreground">Média leads/pesquisa</p>
              </div>
            </div>

            {/* Extra KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-green-400">{loginsByDay}</p>
                <p className="text-xs text-muted-foreground">Novos cadastros no dia</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">
                  {metrics.uniqueUsers > 0 ? (metrics.totalSearches / metrics.uniqueUsers).toFixed(1) : 0}
                </p>
                <p className="text-xs text-muted-foreground">Pesquisas/usuário</p>
              </div>
            </div>

            {/* Accordion sections */}
            <Accordion type="multiple" className="space-y-2">
              {/* By User */}
              <AccordionItem value="users" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Pesquisas por Usuário ({Object.keys(metrics.searchesByUser).length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Pesquisas</TableHead>
                          <TableHead className="text-center">Leads</TableHead>
                          <TableHead className="text-center">Média</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(metrics.searchesByUser)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([email, data]) => (
                            <TableRow key={email}>
                              <TableCell className="text-sm">{email}</TableCell>
                              <TableCell className="text-center">{data.count}</TableCell>
                              <TableCell className="text-center">{data.totalLeads}</TableCell>
                              <TableCell className="text-center">
                                {data.count > 0 ? Math.round(data.totalLeads / data.count) : 0}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* By City */}
              <AccordionItem value="cities" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Cidades ({Object.keys(metrics.cities).length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {sortedEntries(metrics.cities).map(([city, count]) => (
                      <Badge key={city} variant="secondary" className="gap-1">
                        {city} <span className="font-bold">{count}</span>
                      </Badge>
                    ))}
                    {Object.keys(metrics.cities).length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma cidade registrada</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* By Segment */}
              <AccordionItem value="segments" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Segmentos ({Object.keys(metrics.segments).length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {sortedEntries(metrics.segments).map(([seg, count]) => (
                      <Badge key={seg} variant="outline" className="gap-1">
                        {seg} <span className="font-bold">{count}</span>
                      </Badge>
                    ))}
                    {Object.keys(metrics.segments).length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum segmento registrado</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* All searches */}
              <AccordionItem value="all-searches" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Todas as Pesquisas ({metrics.totalSearches})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Config</TableHead>
                          <TableHead className="text-center">Leads</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.logs.map((log) => {
                          const config = log.search_config || {};
                          const configStr = [
                            config.segment || config.category,
                            config.city || config.region,
                            config.state || config.estado,
                          ].filter(Boolean).join(" · ") || "—";

                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm whitespace-nowrap">
                                {new Date(log.created_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </TableCell>
                              <TableCell className="text-sm">{log.user_email}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {log.search_type === "representatives" ? "Reps" : "Leads"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">{configStr}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={log.results_count > 0 ? "default" : "destructive"}>
                                  {log.results_count}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

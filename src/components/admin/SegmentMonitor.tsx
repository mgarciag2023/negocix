import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Search as SearchIcon, Loader2, ChevronDown, ChevronUp, Sparkles, Pencil } from "lucide-react";
import SegmentEditDialog from "./SegmentEditDialog";
import { customerTypes } from "@/data/searchConstants";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SegmentStat {
  segment_key: string;
  segment_label: string;
  terms_count: number;
  companies_count: number;
  quality_score: number;
  status: string;
  alerts_count: number;
  last_computed_at: string;
  searches_count?: number;
  last_search_at?: string | null;
  total_leads_returned?: number;
  zero_result_searches?: number;
  avg_relevance?: number;
  suspicious_pct?: number;
}

interface SegmentAlert {
  id: string;
  segment_key: string;
  alert_type: string;
  priority: string;
  reason: string;
  impact: string | null;
  recommended_action: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  healthy: { label: "Saudável", cls: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
  warning: { label: "Atenção", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  critical: { label: "Crítico", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle },
  unknown: { label: "Sem dados", cls: "bg-muted text-muted-foreground border-border", icon: Activity },
};

const PRIORITY_CLS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/40",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

export default function SegmentMonitor() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SegmentStat[]>([]);
  const [alerts, setAlerts] = useState<SegmentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlyWithAlerts, setOnlyWithAlerts] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("segment_stats").select("*").order("quality_score", { ascending: true }),
      supabase.from("segment_alerts").select("*").eq("resolved", false),
    ]);
    setStats((s as any) || []);
    setAlerts((a as any) || []);
    setLoading(false);
  };

  const refresh = async (batchAll: boolean) => {
    setRefreshing(true);
    try {
      const body = batchAll
        ? { segments: customerTypes, limitSegments: customerTypes.length }
        : { segments: customerTypes.slice(0, 30), limitSegments: 30 };
      const { data, error } = await supabase.functions.invoke("compute-segment-stats", { body });
      if (error) throw error;
      toast({ title: "Recalculado", description: `${data?.processed || 0} segmentos atualizados` });
      await load();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao recalcular", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats.filter(s => {
      if (q && !s.segment_label.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (onlyWithAlerts && s.alerts_count === 0) return false;
      return true;
    });
  }, [stats, query, statusFilter, onlyWithAlerts]);

  const kpis = useMemo(() => {
    const total = stats.length;
    const totalCatalog = customerTypes.length;
    const totalTerms = stats.reduce((a, s) => a + s.terms_count, 0);
    const avgTerms = total ? Math.round(totalTerms / total) : 0;
    const healthy = stats.filter(s => s.status === "healthy").length;
    const warning = stats.filter(s => s.status === "warning").length;
    const critical = stats.filter(s => s.status === "critical").length;
    const zeroResults = stats.filter(s => s.companies_count === 0).length;
    const withAlerts = stats.filter(s => s.alerts_count > 0).length;
    return { total, totalCatalog, totalTerms, avgTerms, healthy, warning, critical, zeroResults, withAlerts };
  }, [stats]);

  const alertsByKey = useMemo(() => {
    const m: Record<string, SegmentAlert[]> = {};
    for (const a of alerts) (m[a.segment_key] ||= []).push(a);
    return m;
  }, [alerts]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Monitoramento de Segmentos
            </CardTitle>
            <CardDescription>Saúde, score e alertas inteligentes por segmento</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh(false)} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar (30)</span>
            </Button>
            <Button size="sm" onClick={() => refresh(true)} disabled={refreshing}>
              <Sparkles className="h-4 w-4" />
              <span className="ml-2">Recalcular todos</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Cadastrados" value={`${kpis.total}/${kpis.totalCatalog}`} hint="Calculados / catálogo" />
          <Kpi label="Termos totais" value={kpis.totalTerms.toLocaleString("pt-BR")} hint={`Média ${kpis.avgTerms}/segmento`} />
          <Kpi label="Saudáveis" value={kpis.healthy} cls="text-green-400" />
          <Kpi label="Críticos" value={kpis.critical} cls="text-red-400" />
          <Kpi label="Em atenção" value={kpis.warning} cls="text-amber-400" />
          <Kpi label="Sem resultados" value={kpis.zeroResults} cls="text-red-400" />
          <Kpi label="Com alertas ativos" value={kpis.withAlerts} cls="text-orange-400" />
          <Kpi label="Alertas totais" value={alerts.length} />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar segmento..." className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          {["all", "healthy", "warning", "critical"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "Todos" : STATUS_META[s].label}
            </Button>
          ))}
          <Button variant={onlyWithAlerts ? "default" : "outline"} size="sm" onClick={() => setOnlyWithAlerts(v => !v)}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Só com alertas
          </Button>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {stats.length === 0
              ? "Nenhum segmento calculado ainda. Clique em \"Recalcular todos\" para começar."
              : "Nenhum segmento corresponde aos filtros."}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-center">Termos</TableHead>
                  <TableHead className="text-center">Pesquisas (30d)</TableHead>
                  <TableHead className="text-center">Sem result.</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Relev.</TableHead>
                  <TableHead className="text-center">Susp.</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Alertas</TableHead>
                  <TableHead className="text-right">Últ. pesquisa</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const meta = STATUS_META[s.status] || STATUS_META.unknown;
                  const isOpen = expandedKey === s.segment_key;
                  const segAlerts = alertsByKey[s.segment_key] || [];
                  return (
                    <>
                      <TableRow key={s.segment_key} className="cursor-pointer" onClick={() => setExpandedKey(isOpen ? null : s.segment_key)}>
                        <TableCell className="font-medium">{s.segment_label}</TableCell>
                        <TableCell className="text-center">{s.terms_count}</TableCell>
                        <TableCell className="text-center">{(s.searches_count ?? 0).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-center">
                          {(s.zero_result_searches ?? 0) > 0 ? (
                            <span className="text-red-400 font-medium">{s.zero_result_searches}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">{(s.total_leads_returned ?? s.companies_count).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-center">
                          <span className={(s.avg_relevance ?? 0) >= 60 ? "text-green-400" : (s.avg_relevance ?? 0) >= 35 ? "text-amber-400" : "text-red-400"}>
                            {s.avg_relevance ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={(s.suspicious_pct ?? 0) <= 15 ? "text-green-400" : (s.suspicious_pct ?? 0) <= 35 ? "text-amber-400" : "text-red-400"}>
                            {s.suspicious_pct ?? 0}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${s.quality_score >= 75 ? "text-green-400" : s.quality_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {s.quality_score}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {s.alerts_count > 0 ? (
                            <Badge variant="outline" className="bg-orange-500/15 text-orange-400 border-orange-500/30">{s.alerts_count}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {s.last_search_at
                            ? formatDistanceToNow(new Date(s.last_search_at), { addSuffix: true, locale: ptBR })
                            : <span className="text-muted-foreground">nunca</span>}
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => setEditLabel(s.segment_label)}>
                            <Pencil className="h-3 w-3 mr-1" /> Editar
                          </Button>
                        </TableCell>
                        <TableCell>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={14} className="bg-muted/30">
                            {segAlerts.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">Sem alertas ativos para este segmento.</p>
                            ) : (
                              <div className="space-y-2 py-2">
                                {segAlerts.map(a => (
                                  <div key={a.id} className="flex gap-3 p-3 rounded-md bg-background border">
                                    <Badge variant="outline" className={PRIORITY_CLS[a.priority] || ""}>{a.priority}</Badge>
                                    <div className="flex-1 text-sm">
                                      <p className="font-medium">{a.reason}</p>
                                      {a.impact && <p className="text-muted-foreground mt-1"><strong>Impacto:</strong> {a.impact}</p>}
                                      {a.recommended_action && <p className="text-muted-foreground mt-1"><strong>Ação:</strong> {a.recommended_action}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <SegmentEditDialog
          open={!!editLabel}
          label={editLabel || ""}
          onClose={() => setEditLabel(null)}
          onChanged={() => void load()}
        />
      </CardContent>
    </Card>
  );
}


function Kpi({ label, value, hint, cls }: { label: string; value: any; hint?: string; cls?: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <p className={`text-2xl font-bold ${cls || ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}

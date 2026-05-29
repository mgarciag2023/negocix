import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, History, Search, Users, Eye, Package, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeadSample {
  name?: string;
  address?: string;
  phone?: string;
  category?: string;
  website?: string;
  instagram?: string;
  email?: string;
}

interface SearchLog {
  id: string;
  user_id?: string;
  user_email: string;
  user_full_name?: string;
  search_type: string;
  search_config: Record<string, unknown>;
  results_count: number;
  results?: LeadSample[];
  created_at: string;
}

export default function SearchLogsTable() {
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SearchLog | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("search_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      const userIds = Array.from(new Set((data as SearchLog[]).map((l) => l.user_id).filter(Boolean))) as string[];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name || ""]));
      }
      setLogs((data as SearchLog[]).map((l) => ({ ...l, user_full_name: l.user_id ? profileMap.get(l.user_id) : "" })));
    }
    setLoading(false);
  };

  const formatConfig = (config: Record<string, unknown>, type: string): string => {
    const state = typeof config.state === "string" ? config.state : "";
    const city = typeof config.city === "string" ? config.city : "";
    const region = typeof config.region === "string" ? config.region : "";
    const segment = typeof config.segment === "string" ? config.segment : "";

    if (type === "representatives") {
      return [state, city].filter(Boolean).join(" - ");
    }
    if (type === "suppliers") {
      return [Array.isArray(config.products) ? config.products.join(", ") : "", region || state].filter(Boolean).join(" | ") || "—";
    }
    const parts: string[] = [];
    if (segment) parts.push(segment);
    if (region) parts.push(region);
    return parts.join(" | ") || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const sample = selected?.results || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Pesquisas dos Usuários
        </CardTitle>
        <CardDescription>Últimas 100 pesquisas realizadas — clique em "Ver" para auditar os leads retornados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Configuração</TableHead>
                <TableHead>Resultados</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium text-sm">{log.user_email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      {log.search_type === "representatives" ? (
                        <><Users className="h-3 w-3" /> Representantes</>
                      ) : log.search_type === "suppliers" ? (
                        <><Package className="h-3 w-3" /> Fornecedores</>
                      ) : (
                        <><Search className="h-3 w-3" /> Leads</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">
                    {formatConfig(log.search_config, log.search_type)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.results_count > 0 ? "default" : "destructive"}>
                      {log.results_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(log)}>
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma pesquisa registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Pesquisa</DialogTitle>
            <DialogDescription>
              {selected?.user_email} — {selected && new Date(selected.created_at).toLocaleString("pt-BR")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {/* Config completa */}
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-sm">Configuração da pesquisa</h3>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                {selected && Object.entries(selected.search_config).map(([key, value]) => {
                  if (value === null || value === undefined || value === "") return null;
                  const display = Array.isArray(value)
                    ? value.join(", ")
                    : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:gap-3">
                      <span className="font-medium text-muted-foreground min-w-[140px]">{key}:</span>
                      <span className="break-words whitespace-pre-wrap flex-1">{display}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leads retornados */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">
                Leads retornados ({sample.length}
                {selected && selected.results_count > sample.length && ` de ${selected.results_count} — amostra`})
              </h3>
              {sample.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Sem amostra de leads salva (pesquisas anteriores à atualização não armazenavam os resultados).
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Endereço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sample.map((lead, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{lead.name || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.category || "—"}</TableCell>
                          <TableCell className="text-xs">{lead.phone || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                            {lead.address || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

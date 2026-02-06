import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Search, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SearchLog {
  id: string;
  user_email: string;
  search_type: string;
  search_config: Record<string, any>;
  results_count: number;
  created_at: string;
}

export default function SearchLogsTable() {
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("search_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data as SearchLog[]);
    }
    setLoading(false);
  };

  const formatConfig = (config: Record<string, any>, type: string): string => {
    if (type === "representatives") {
      return [config.state, config.city].filter(Boolean).join(" - ");
    }
    // leads
    const parts: string[] = [];
    if (config.segment) parts.push(config.segment);
    if (config.region) parts.push(config.region);
    return parts.join(" | ") || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Pesquisas dos Usuários
        </CardTitle>
        <CardDescription>Últimas 100 pesquisas realizadas</CardDescription>
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
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma pesquisa registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

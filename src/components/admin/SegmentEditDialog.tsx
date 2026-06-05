import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, RotateCcw, Sparkles, Trash2, Check, X, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Suggestion {
  id: string; segment_key: string; segment_label: string;
  suggestion_type: "add" | "remove"; term: string; rationale: string | null; status: string;
}
interface Change {
  id: string; change_type: string; term: string | null; changed_by_email: string | null; created_at: string;
}
interface DataState {
  key: string; label: string; base: string[];
  override: { added_terms: string[]; removed_terms: string[] } | null;
  effective: string[]; history: Change[]; suggestions: Suggestion[];
}

export default function SegmentEditDialog({ open, onClose, label, onChanged }: {
  open: boolean; onClose: () => void; label: string; onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<DataState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTerm, setNewTerm] = useState("");

  const load = async () => {
    if (!label) return;
    setLoading(true);
    try {
      const { data: r, error } = await supabase.functions.invoke("manage-segment", { body: { action: "get", label } });
      if (error) throw error;
      setData(r as DataState);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao carregar", variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open, label]);

  const call = async (body: any, successMsg?: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("manage-segment", { body: { label, ...body } });
      if (error) throw error;
      if (successMsg) toast({ title: successMsg });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const addTerm = async () => {
    const t = newTerm.trim();
    if (!t) return;
    await call({ action: "add_term", term: t }, "Termo adicionado");
    setNewTerm("");
  };

  const isRemoved = (t: string) =>
    !!data?.override?.removed_terms?.some(x => x.toLowerCase() === t.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar segmento</DialogTitle>
          <DialogDescription className="truncate">{label}</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="terms" className="flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="terms">Termos ({data.effective.length})</TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-3 w-3 mr-1" /> IA ({data.suggestions.filter(s => s.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3 w-3 mr-1" /> Histórico ({data.history.length})
              </TabsTrigger>
            </TabsList>

            {/* TERMOS */}
            <TabsContent value="terms" className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar novo termo (ex: pizzaria artesanal)"
                  value={newTerm}
                  onChange={e => setNewTerm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTerm()}
                  disabled={busy}
                />
                <Button onClick={addTerm} disabled={busy || !newTerm.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
                {data.override && (
                  <Button variant="outline" onClick={() => call({ action: "reset" }, "Restaurado para o catálogo")} disabled={busy}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Resetar
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-md p-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">CATÁLOGO BASE ({data.base.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {data.base.map(t => {
                        const removed = isRemoved(t);
                        return (
                          <Badge key={t} variant="outline" className={removed ? "line-through opacity-50" : ""}>
                            {t}
                            {removed ? (
                              <button className="ml-1 hover:text-green-400" onClick={() => call({ action: "restore_term", term: t })} disabled={busy} title="Restaurar">
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            ) : (
                              <button className="ml-1 hover:text-red-400" onClick={() => call({ action: "remove_term", term: t })} disabled={busy} title="Remover">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {(data.override?.added_terms?.length || 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">ADICIONADOS PELO ADMIN ({data.override!.added_terms.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {data.override!.added_terms.map(t => (
                          <Badge key={t} className="bg-green-500/15 text-green-400 border-green-500/30">
                            {t}
                            <button className="ml-1 hover:text-red-400" onClick={() => call({ action: "remove_term", term: t })} disabled={busy}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* IA */}
            <TabsContent value="ai" className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">A IA analisa o segmento e sugere termos para adicionar ou remover.</p>
                <Button onClick={() => call({ action: "suggest" }, "Sugestões geradas")} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Gerar sugestões
                </Button>
              </div>
              <ScrollArea className="flex-1 border rounded-md p-3">
                {data.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sugestão ainda. Clique em "Gerar sugestões".</p>
                ) : (
                  <div className="space-y-2">
                    {data.suggestions.map(s => (
                      <div key={s.id} className="flex gap-3 items-start p-3 rounded-md bg-muted/30 border">
                        <Badge variant="outline" className={s.suggestion_type === "add" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"}>
                          {s.suggestion_type === "add" ? "+ Adicionar" : "− Remover"}
                        </Badge>
                        <div className="flex-1 text-sm">
                          <p className="font-semibold">{s.term}</p>
                          {s.rationale && <p className="text-muted-foreground text-xs mt-1">{s.rationale}</p>}
                          {s.status !== "pending" && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {s.status === "accepted" ? "Aceito" : "Rejeitado"}
                            </Badge>
                          )}
                        </div>
                        {s.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => call({ action: "decide_suggestion", id: s.id, decision: "accepted" })} disabled={busy}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => call({ action: "decide_suggestion", id: s.id, decision: "rejected" })} disabled={busy}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full border rounded-md p-3">
                {data.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem alterações registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {data.history.map(h => (
                      <div key={h.id} className="flex justify-between items-start text-sm p-2 border-b">
                        <div>
                          <Badge variant="outline" className="mr-2">{h.change_type}</Badge>
                          {h.term && <span className="font-mono">{h.term}</span>}
                          {h.changed_by_email && <p className="text-xs text-muted-foreground mt-1">{h.changed_by_email}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

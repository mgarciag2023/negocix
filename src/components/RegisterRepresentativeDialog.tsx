import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { brazilianStates } from "@/data/searchConstants";

export default function RegisterRepresentativeDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [cities, setCities] = useState("");
  const [segments, setSegments] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("registered_representatives")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setWhatsapp(data.whatsapp || "");
        setEmail(data.email || "");
        setState(data.state || "");
        setCities((data.cities || []).join(", "));
        setSegments((data.segments || []).join(", "));
        setNotes(data.notes || "");
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) {
          setFullName(profile.full_name || "");
          setPhone(profile.phone || "");
          setEmail(profile.email || "");
        }
      }
    })();
  }, [open]);

  const handleSave = async () => {
    if (!fullName.trim() || !phone.trim() || !state) {
      toast({ title: "Preencha nome, telefone e estado", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        user_id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        email: email.trim() || null,
        state,
        cities: cities.split(",").map(c => c.trim()).filter(Boolean),
        segments: segments.split(",").map(s => s.trim()).filter(Boolean),
        notes: notes.trim() || null,
        is_active: true,
      };

      const { error } = existingId
        ? await supabase.from("registered_representatives").update(payload).eq("id", existingId)
        : await supabase.from("registered_representatives").insert(payload);

      if (error) throw error;
      toast({ title: existingId ? "Cadastro atualizado!" : "Cadastro realizado!", description: "Você já aparece nas buscas por representantes." });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    if (!confirm("Remover seu cadastro de representante?")) return;
    setLoading(true);
    const { error } = await supabase.from("registered_representatives").delete().eq("id", existingId);
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cadastro removido" });
    setExistingId(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <UserPlus className="w-4 h-4" />
          Sou representante — quero aparecer nas buscas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro de Representante</DialogTitle>
          <DialogDescription>
            Preencha seus dados e regiões de atuação. Você aparecerá nas buscas de quem procurar representantes nessas regiões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome completo *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estado de atuação *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {brazilianStates.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cidades (separe por vírgula)</Label>
              <Input value={cities} onChange={e => setCities(e.target.value)} placeholder="São Paulo, Campinas" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Segmentos que representa (separe por vírgula)</Label>
            <Input value={segments} onChange={e => setSegments(e.target.value)} placeholder="Alimentos, Bebidas, Cosméticos" />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {existingId && (
            <Button variant="outline" onClick={handleDelete} disabled={loading} className="gap-2">
              <Trash2 className="w-4 h-4" /> Remover
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {existingId ? "Atualizar cadastro" : "Cadastrar-me"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

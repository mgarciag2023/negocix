import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { brazilianStates } from "@/data/searchConstants";
import { productCategories } from "@/data/productCategories";

export default function RegisterSupplierDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState("");
  const [cities, setCities] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [deliversNationwide, setDeliversNationwide] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("registered_suppliers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        setCompanyName(data.company_name || "");
        setResponsibleName(data.responsible_name || "");
        setPhone(data.phone || "");
        setWhatsapp(data.whatsapp || "");
        setEmail(data.email || "");
        setWebsite(data.website || "");
        setState(data.state || "");
        setCities((data.cities || []).join(", "));
        setProducts(data.products || []);
        setDeliversNationwide(!!data.delivers_nationwide);
        setDescription(data.description || "");
        setNotes(data.notes || "");
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) {
          setResponsibleName(profile.full_name || "");
          setPhone(profile.phone || "");
          setEmail(profile.email || "");
        }
      }
    })();
  }, [open]);

  const toggleProduct = (p: string) => {
    setProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleSave = async () => {
    if (!companyName.trim() || !phone.trim() || !state || products.length === 0) {
      toast({ title: "Preencha nome da empresa, telefone, estado e ao menos 1 produto", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        user_id: user.id,
        company_name: companyName.trim(),
        responsible_name: responsibleName.trim() || null,
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        email: email.trim() || null,
        website: website.trim() || null,
        state,
        cities: cities.split(",").map(c => c.trim()).filter(Boolean),
        products,
        delivers_nationwide: deliversNationwide,
        description: description.trim() || null,
        notes: notes.trim() || null,
        is_active: true,
      };

      const { error } = existingId
        ? await supabase.from("registered_suppliers").update(payload).eq("id", existingId)
        : await supabase.from("registered_suppliers").insert(payload);

      if (error) throw error;
      toast({ title: existingId ? "Cadastro atualizado!" : "Cadastro realizado!", description: "Sua empresa já aparece nas buscas por fornecedores." });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    if (!confirm("Remover seu cadastro de fornecedor?")) return;
    setLoading(true);
    const { error } = await supabase.from("registered_suppliers").delete().eq("id", existingId);
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
        <Button variant="outline" className="w-full gap-2 h-auto py-3 whitespace-normal text-center leading-tight">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">Sou fornecedor — quero aparecer nas buscas</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Cadastro de Fornecedor</DialogTitle>
          <DialogDescription>
            Preencha os dados da sua empresa. Você aparecerá nas buscas por fornecedores que correspondam aos produtos e regiões cadastrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da empresa *</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1">
            <Label>Responsável (opcional)</Label>
            <Input value={responsibleName} onChange={e => setResponsibleName(e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Site</Label>
              <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estado (sede) *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {brazilianStates.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cidades atendidas (vírgula)</Label>
              <Input value={cities} onChange={e => setCities(e.target.value)} placeholder="São Paulo, Campinas" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
            <Checkbox id="nationwide" checked={deliversNationwide} onCheckedChange={(v) => setDeliversNationwide(!!v)} />
            <Label htmlFor="nationwide" className="text-sm font-normal cursor-pointer">
              Entrego para todo o Brasil
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Produtos que fornece * ({products.length} selecionado{products.length === 1 ? "" : "s"})</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border rounded-md p-2 bg-muted/20">
              {productCategories.map(p => {
                const checked = products.includes(p);
                return (
                  <label key={p} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${checked ? 'bg-primary/10 text-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleProduct(p)} />
                    <span className="leading-tight">{p}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição da empresa</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Conte rapidamente sobre sua empresa, diferenciais, prazos, etc." />
          </div>
          <div className="space-y-1">
            <Label>Observações internas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} rows={2} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {existingId && (
            <Button variant="outline" onClick={handleDelete} disabled={loading} className="gap-2">
              <Trash2 className="w-4 h-4" /> Remover
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {existingId ? "Atualizar cadastro" : "Cadastrar minha empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

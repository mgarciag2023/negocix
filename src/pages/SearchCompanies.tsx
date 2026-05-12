import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brazilianStates } from "@/data/searchConstants";
import { useToast } from "@/hooks/use-toast";
import LeadCard from "@/components/LeadCard";

type Company = {
  id: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  telefone_1: string | null;
  telefone_2: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  descricao_cnae: string | null;
  porte: string | null;
  matriz_filial: string | null;
  situacao_cadastral: string | null;
};

const titleCase = (s: string | null | undefined) =>
  !s ? "" : s.replace(/[^\s]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const formatCnpj = (cnpj: string | null) => {
  if (!cnpj) return "";
  const d = cnpj.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

const SearchCompanies = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"name" | "cnpj" | "location">("name");
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Company[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      let data: Company[] = [];

      if (mode === "cnpj") {
        const digits = cnpj.replace(/\D/g, "");
        if (digits.length < 8) {
          toast({ title: "CNPJ inválido", description: "Digite ao menos 8 dígitos.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { data: rows, error } = await supabase
          .from("companies")
          .select("*")
          .ilike("cnpj", `%${digits}%`)
          .limit(200);
        if (error) throw error;
        data = (rows || []) as Company[];
      } else if (mode === "name") {
        if (!name.trim()) {
          toast({ title: "Digite um nome", variant: "destructive" });
          setLoading(false);
          return;
        }
        const terms = name.trim().split(/\s+/).slice(0, 5).map((t) => {
          const lower = t.toLowerCase();
          // strip plural 's' to match both singular and plural (e.g. "pizzarias" -> "pizzaria")
          if (lower.length > 4 && lower.endsWith("s")) return lower.slice(0, -1);
          return lower;
        });
        const effectiveState = stateUf && stateUf !== "all" ? stateUf : null;
        const { data: rows, error } = await supabase.rpc("search_companies_ilike", {
          p_city: city.trim() ? city.trim().toUpperCase() : null,
          p_state: effectiveState,
          p_search_terms: terms,
          p_biz_type: "all",
          p_limit_val: 300,
          p_offset_val: 0,
        });
        if (error) throw error;
        data = (rows || []) as Company[];
      } else {
        // location only
        const effState = stateUf && stateUf !== "all" ? stateUf : null;
        if (!effState && !city.trim()) {
          toast({ title: "Informe estado ou cidade", variant: "destructive" });
          setLoading(false);
          return;
        }
        let q = supabase.from("companies").select("*").eq("situacao_cadastral", "ATIVA").limit(300);
        if (effState) q = q.eq("estado", effState);
        if (city.trim()) q = q.eq("cidade", city.trim().toUpperCase());
        const { data: rows, error } = await q;
        if (error) throw error;
        data = (rows || []) as Company[];
      }

      setResults(data);
      toast({ title: `${data.length} empresa(s) encontrada(s)` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na busca", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Procurar Empresas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Busque empresas por nome, CNPJ ou localização na nossa base de mais de 35 milhões de registros.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="name">Por Nome</TabsTrigger>
                <TabsTrigger value="cnpj">Por CNPJ</TabsTrigger>
                <TabsTrigger value="location">Por Localização</TabsTrigger>
              </TabsList>

              <TabsContent value="name" className="space-y-4 pt-4">
                <div>
                  <Label>Nome da empresa</Label>
                  <Input
                    placeholder="Ex: McDonald's"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estado (opcional)</Label>
                    <Select value={stateUf} onValueChange={setStateUf}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {brazilianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cidade (opcional)</Label>
                    <Input placeholder="Ex: São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cnpj" className="space-y-4 pt-4">
                <div>
                  <Label>CNPJ (completo ou parcial)</Label>
                  <Input
                    placeholder="Ex: 12.345.678/0001-90"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </TabsContent>

              <TabsContent value="location" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estado</Label>
                    <Select value={stateUf} onValueChange={setStateUf}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input placeholder="Ex: Blumenau" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSearch} disabled={loading} className="w-full mt-6 h-12">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {loading ? "Buscando..." : "Buscar Empresas"}
            </Button>
          </CardContent>
        </Card>

        {searched && !loading && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              {results.length} resultado(s)
            </h2>
            {results.length === 0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma empresa encontrada. Tente outros termos.
              </CardContent></Card>
            )}
            {results.map((c) => {
              const displayName = titleCase(c.nome_fantasia || c.razao_social || "Empresa");
              const phone = (c.telefone_1 || c.telefone_2 || "").trim();
              const addr = titleCase([c.endereco, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean).join(", "));
              const reasons: string[] = [];
              if (c.situacao_cadastral) reasons.push(`Situação cadastral: ${titleCase(c.situacao_cadastral)}`);
              if (c.matriz_filial) reasons.push(`Tipo de unidade: ${titleCase(c.matriz_filial)}`);
              if (c.descricao_cnae) reasons.push(`Atividade: ${titleCase(c.descricao_cnae)}`);
              if (c.porte) reasons.push(`Porte: ${titleCase(c.porte)}`);
              if (!reasons.length) reasons.push("Empresa encontrada na base nacional");
              return (
                <LeadCard
                  key={c.id}
                  id={c.id}
                  name={displayName}
                  address={addr || "Endereço não disponível"}
                  phone={phone || "Não disponível"}
                  email={c.email || undefined}
                  matchScore={70}
                  reasons={reasons}
                  category={titleCase(c.descricao_cnae || "Empresa")}
                  companySize={c.porte ? titleCase(c.porte) : undefined}
                  cnpj={formatCnpj(c.cnpj)}
                  razaoSocial={titleCase(c.razao_social || "")}
                  nomeFantasia={titleCase(c.nome_fantasia || "")}
                  hasWhatsApp={!!phone}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchCompanies;

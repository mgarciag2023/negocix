import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Lock, Building2, Star, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_URL = "https://compraseguraonline.org.ua/c/d8cd080117";
const TRIAL_KEY = "negocix_trial_used";
const TRIAL_RESULTS_KEY = "negocix_trial_results";

interface Lead {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  instagram?: string;
  website?: string | null;
  responsible: string;
  matchScore: number;
  category: string;
  revenue: string;
  openedDate: string;
  reasons: string[];
  employeeCount?: string;
  companySize?: string;
  hasWhatsApp?: boolean;
}

const customerTypes = [
  "Restaurantes", "Pizzarias", "Padarias", "Bares", "Lanchonetes",
  "Supermercados", "Mercados", "Mercearias", "Confeitarias", "Docerias",
  "Hamburguerias", "Churrascarias", "Cafeterias", "Sorveterias",
  "Farmácias", "Lojas de Roupas", "Salões de Beleza", "Academias",
  "Clínicas Médicas", "Clínicas Odontológicas", "Pet Shops",
  "Oficinas Mecânicas", "Autopeças", "Materiais de Construção",
  "Lojas de Móveis", "Papelarias", "Óticas", "Barbearias",
  "Escritórios de Contabilidade", "Escritórios de Advocacia",
  "Construtoras", "Imobiliárias", "Hotéis e Pousadas",
  "Escolas e Cursos", "Distribuidores de Alimentos",
  "Lojas de Celular", "Lojas de Informática",
  "Lojas de Calçados", "Floriculturas",
  "Agências de Viagens", "Gráficas",
];

const brazilianStates = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
];

const TrialSearch = () => {
  const { toast } = useToast();
  const [step, setStep] = useState<"config" | "loading" | "results">(() => {
    const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
    if (saved) return "results";
    if (localStorage.getItem(TRIAL_KEY)) return "results";
    return "config";
  });

  const [segment, setSegment] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [totalFound, setTotalFound] = useState(() => {
    try {
      const saved = localStorage.getItem("negocix_trial_total");
      return saved ? parseInt(saved) : 0;
    } catch { return 0; }
  });
  const [searchFilter, setSearchFilter] = useState("");

  const alreadyUsed = localStorage.getItem(TRIAL_KEY) === "true";

  const normalizeText = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredCustomerTypes = useMemo(() => {
    if (!searchFilter) return customerTypes;
    return customerTypes.filter(c => normalizeText(c).includes(normalizeText(searchFilter)));
  }, [searchFilter]);

  const handleSearch = async () => {
    if (!segment || !state) {
      toast({ title: "Preencha todos os campos", description: "Selecione o segmento e o estado", variant: "destructive" });
      return;
    }

    if (alreadyUsed) {
      toast({ title: "Teste já utilizado", description: "Você já realizou sua pesquisa gratuita neste dispositivo.", variant: "destructive" });
      return;
    }

    setStep("loading");

    try {
      const region = city ? `${city}, ${state}` : state;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/search-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          segment,
          products: segment,
          region,
          country: 'BR',
          ecommerceType: '',
          businessType: 'all',
          digitalPresence: 'all',
          digitalActivity: 'all',
          whatsappOnly: false,
          receitaFederalOnly: false,
          isTrial: true,
          filters: {
            category: '',
            companySizes: ['all'],
            revenueRange: 'all',
          }
        }),
      });

      const data = await response.json();

      if (data?.leads && data.leads.length > 0) {
        const total = data.leads.length;
        const preview = data.leads.slice(0, 15);
        setLeads(preview);
        setTotalFound(total);
        localStorage.setItem(TRIAL_KEY, "true");
        localStorage.setItem(TRIAL_RESULTS_KEY, JSON.stringify(preview));
        localStorage.setItem("negocix_trial_total", String(total));
        setStep("results");
      } else {
        toast({ title: "Nenhum resultado", description: "Tente outro segmento ou localização", variant: "destructive" });
        setStep("config");
      }
    } catch (error) {
      console.error("Trial search error:", error);
      toast({ title: "Erro na busca", description: "Tente novamente", variant: "destructive" });
      setStep("config");
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium text-foreground">Buscando empresas...</p>
          <p className="text-sm text-muted-foreground mt-2">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  if (step === "results") {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-gradient-hero py-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary-foreground" />
              <span className="text-xl font-bold text-primary-foreground">Negocix</span>
              <span className="ml-2 px-2 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground text-xs font-semibold">TESTE GRÁTIS</span>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          {/* Stats banner */}
          <div className="bg-gradient-to-r from-success/10 to-primary/10 rounded-2xl p-6 mb-8 border border-success/20">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Empresas encontradas para o seu segmento</p>
              <p className="text-5xl font-bold text-foreground">{totalFound.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-2">Exibindo 15 de {totalFound.toLocaleString('pt-BR')} resultados</p>
            </div>
          </div>

          {/* Visible leads */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {leads.map((lead, i) => (
              <Card key={lead.id || i} className="p-4 border border-border/50">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-1">{lead.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium whitespace-nowrap ml-2">
                    {lead.matchScore}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{lead.address}</p>
                <p className="text-xs text-muted-foreground">{lead.phone}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{lead.category}</span>
                  {lead.companySize && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{lead.companySize}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Blurred/locked section */}
          <div className="relative">
            {/* Fake blurred cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 blur-md select-none pointer-events-none" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 border border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-10"></div>
                  </div>
                  <div className="h-3 bg-muted rounded w-full mb-1"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </Card>
              ))}
            </div>

            {/* CTA overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-card/95 backdrop-blur-sm rounded-2xl p-8 max-w-md text-center shadow-2xl border border-border">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  +{(totalFound - 15).toLocaleString('pt-BR')} empresas disponíveis
                </h3>
                <p className="text-muted-foreground mb-6">
                  Desbloqueie o acesso completo para ver todas as {totalFound.toLocaleString('pt-BR')} empresas com telefone, email, responsável e mais.
                </p>
                <Button
                  size="lg"
                  className="w-full bg-gradient-primary hover:opacity-90 text-base h-14 rounded-xl shadow-primary"
                  onClick={() => window.open(PAYMENT_URL, "_blank")}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Desbloquear Acesso Completo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span>Acesso imediato</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span>Exportar Excel</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Config step
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-hero py-8 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
            <span className="text-2xl font-bold text-primary-foreground">Negocix</span>
          </div>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
            <Star className="h-4 w-4 text-warning" fill="currentColor" />
            <span className="text-sm text-primary-foreground/90 font-medium">Pesquisa Gratuita</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
            Teste Grátis — Encontre Clientes
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto">
            Faça uma pesquisa gratuita e veja quantas empresas podemos encontrar para o seu negócio.
          </p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Card className="p-6 md:p-8 shadow-card">
            <div className="space-y-6">
              {/* Segment */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Qual segmento você atende?</Label>
                <Input
                  placeholder="Buscar segmento..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="mb-2"
                />
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredCustomerTypes.map(ct => (
                      <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* State */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Estado</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilianStates.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* City (optional) */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Cidade <span className="text-muted-foreground font-normal text-sm">(opcional)</span></Label>
                <Input
                  placeholder="Ex: São Paulo, Curitiba..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSearch} 
                className="w-full gap-2 text-base py-6 bg-gradient-primary hover:opacity-90" 
                size="lg"
                disabled={alreadyUsed}
              >
                <Search className="h-5 w-5" />
                {alreadyUsed ? "Teste já utilizado" : "Buscar Empresas Grátis"}
              </Button>

              {alreadyUsed && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Você já realizou sua pesquisa gratuita.</p>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(PAYMENT_URL, "_blank")}
                  >
                    <Lock className="h-4 w-4" />
                    Desbloquear Acesso Completo
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TrialSearch;

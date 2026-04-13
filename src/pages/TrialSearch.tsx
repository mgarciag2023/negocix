import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Lock, Building, Building2, Target, TrendingUp, Zap, Users, Package, ArrowRight, Star, CheckCircle2, Sparkles, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TrialNavbar from "@/components/TrialNavbar";
import TrialLeadCard from "@/components/TrialLeadCard";
import { customerTypes, countries, brazilianStates } from "@/data/searchConstants";
import StatsCard from "@/components/StatsCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

type TrialStep = "home" | "config" | "loading" | "results";

const TrialSearch = () => {
  const { toast } = useToast();
  const [step, setStep] = useState<TrialStep>(() => {
    const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
    if (saved) return "results";
    if (localStorage.getItem(TRIAL_KEY)) return "results";
    return "home";
  });

  // Config state
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState("");
  const [country, setCountry] = useState("BR");
  const [customCountry, setCustomCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [ecommerceType, setEcommerceType] = useState("");
  const [businessType, setBusinessType] = useState("all");
  const [digitalPresence, setDigitalPresence] = useState("all");
  const [digitalActivity, setDigitalActivity] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);

  // Results state
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

  const [showLockDialog, setShowLockDialog] = useState(false);
  const alreadyUsed = localStorage.getItem(TRIAL_KEY) === "true";

  // Prevent back button from navigating to the main app
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Push state again to prevent leaving /teste
      window.history.pushState(null, "", "/teste");
    };
    
    // Replace current state and push a new one so back button stays on /teste
    window.history.replaceState(null, "", "/teste");
    window.history.pushState(null, "", "/teste");
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const normalizeText = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const matchesSearch = (customer: string, search: string) => {
    if (!search) return true;
    const normalized = normalizeText(customer);
    const words = normalizeText(search).split(/\s+/).filter(Boolean);
    return words.every(word => normalized.includes(word));
  };

  const handleCustomerToggle = (customer: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customer)
        ? prev.filter(c => c !== customer)
        : [...prev, customer]
    );
  };

  const handleLockedClick = () => {
    setShowLockDialog(true);
  };

  const handleSearch = async () => {
    if (!products || selectedCustomers.length === 0 || (!state && !city)) {
      toast({ title: "Campos obrigatórios", description: "Preencha pelo menos produto, segmento e estado ou cidade", variant: "destructive" });
      return;
    }

    if (alreadyUsed) {
      toast({ title: "Teste já utilizado", description: "Você já realizou sua pesquisa gratuita neste dispositivo.", variant: "destructive" });
      return;
    }

    setStep("loading");

    try {
      const finalCountry = country === "OTHER" ? customCountry : country;
      let region = "";
      if (country === "BR") {
        if (city && state) region = `${city}, ${state}`;
        else if (state) region = state;
        else if (city) region = city;
      } else {
        region = city || state || "";
      }

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
          segment: selectedCustomers.join(', '),
          products,
          region,
          country: finalCountry,
          ecommerceType: selectedCustomers.includes("E-commerce") ? ecommerceType : "",
          businessType,
          digitalPresence,
          digitalActivity,
          whatsappOnly: false,
          receitaFederalOnly: false,
          isTrial: true,
          filters: {
            category,
            companySizes: companySizes.length > 0 ? companySizes : ['all'],
            revenueRange,
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

  // ==================== HOME STEP ====================
  if (step === "home") {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw]">
        <TrialNavbar />
        {/* Lock Dialog */}
        <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
          <DialogContent className="max-w-md text-center">
            <DialogHeader className="items-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-xl">Desbloqueie o Acesso Completo</DialogTitle>
              <DialogDescription className="text-base">
                Busca de fornecedores e representantes estão disponíveis apenas na versão completa da plataforma.
              </DialogDescription>
            </DialogHeader>
            <Button
              size="lg"
              className="w-full bg-gradient-primary hover:opacity-90 text-base h-14 rounded-xl shadow-primary mt-2"
              onClick={() => window.open(PAYMENT_URL, "_blank")}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Desbloquear Agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Acesso imediato</span></div>
              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Todos os recursos</span></div>
            </div>
          </DialogContent>
        </Dialog>
        <main>
          {/* Hero Section - mirrors Index.tsx */}
          <section className="relative overflow-hidden py-16 md:py-28">
            <div className="absolute inset-0 bg-gradient-hero" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-glow/20 rounded-full blur-3xl animate-float" />
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-success-glow/10 rounded-full blur-3xl animate-pulse-soft" />
            </div>
            
            <div className="absolute top-20 left-10 w-2 h-2 bg-primary-foreground/40 rounded-full animate-bounce-gentle" />
            <div className="absolute top-40 right-20 w-3 h-3 bg-success-glow/60 rounded-full animate-bounce-gentle" style={{ animationDelay: "0.5s" }} />
            <div className="absolute bottom-32 left-1/4 w-2 h-2 bg-accent/50 rounded-full animate-bounce-gentle" style={{ animationDelay: "1s" }} />
            
            <div className="container mx-auto px-4 relative z-10">
              <div className="mx-auto max-w-4xl text-center">
                <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 animate-fade-in-down">
                  <Star className="h-4 w-4 text-warning" fill="currentColor" />
                  <span className="text-sm text-primary-foreground/90 font-medium">Pesquisa Gratuita</span>
                </div>
                
                <h1 className="mb-6 text-4xl md:text-6xl font-bold leading-tight text-primary-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                  Encontre Clientes e{" "}
                  <span className="relative">
                    <span className="relative z-10">Fornecedores Qualificados</span>
                    <span className="absolute bottom-2 left-0 right-0 h-3 bg-success-glow/40 -rotate-1 rounded" />
                  </span>
                </h1>
                
                <p className="mb-10 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                  Plataforma inteligente que encontra leads qualificados e fornecedores para o seu negócio.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                  <Button 
                    size="lg" 
                    className="bg-success hover:bg-success-hover text-success-foreground shadow-success hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group text-base h-14 px-8 rounded-xl"
                    onClick={() => {
                      if (alreadyUsed) {
                        const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
                        if (saved) { setStep("results"); return; }
                      }
                      setStep("config");
                    }}
                  >
                    <Target className="mr-2 h-5 w-5" />
                    Buscar Leads
                    <ArrowRight className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/20 hover:-translate-y-1 transition-all duration-300 text-base h-14 px-8 rounded-xl backdrop-blur-sm relative"
                    onClick={handleLockedClick}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    <Package className="mr-2 h-5 w-5" />
                    Buscar Fornecedores
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/20 hover:-translate-y-1 transition-all duration-300 text-base h-14 px-8 rounded-xl backdrop-blur-sm relative"
                    onClick={handleLockedClick}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    <Users className="mr-2 h-5 w-5" />
                    Buscar Representantes
                  </Button>
                </div>
                
                {/* Stats */}
                <div className="mt-16 grid grid-cols-2 gap-8 max-w-xs mx-auto opacity-0 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-primary-foreground">90+</div>
                    <div className="text-sm text-primary-foreground/60">Leads/busca</div>
                  </div>
                  <div className="text-center border-l border-primary-foreground/20">
                    <div className="text-2xl md:text-3xl font-bold text-primary-foreground">22</div>
                    <div className="text-sm text-primary-foreground/60">Países</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                <path d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="hsl(var(--background))"/>
              </svg>
            </div>
          </section>

          {/* Features */}
          <section className="py-20 md:py-28 relative">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <span className="inline-block px-4 py-1.5 rounded-full bg-primary-light text-primary text-sm font-semibold mb-4">
                  Por que escolher nossa plataforma
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Ferramentas Poderosas para{" "}
                  <span className="text-gradient">Vender Mais</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Tudo que você precisa para encontrar clientes e fechar negócios
                </p>
              </div>
              
              <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: Zap, title: "Busca Inteligente", description: "Leads reais do Google Maps com dados verificados e atualizados em tempo real", color: "primary", delay: "0.1s" },
                  { icon: Target, title: "Alta Precisão", description: "Score de confiança e filtros avançados para encontrar o cliente ideal", color: "success", delay: "0.2s" },
                  { icon: MessageSquare, title: "Abordagens IA", description: "Mensagens personalizadas e profissionais geradas por inteligência artificial", color: "accent", delay: "0.3s" },
                  { icon: TrendingUp, title: "Mais Conversões", description: "Aborde os clientes certos com a mensagem certa e aumente suas vendas", color: "success", delay: "0.4s" }
                ].map((feature, index) => (
                  <div 
                    key={index} 
                    className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-2 opacity-0 animate-fade-in-up border border-border/50"
                    style={{ animationDelay: feature.delay }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className={`relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${
                      feature.color === 'primary' ? 'bg-primary-light' : 
                      feature.color === 'success' ? 'bg-success-light' : 'bg-accent-light'
                    } group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className={`h-7 w-7 ${
                        feature.color === 'primary' ? 'text-primary' : 
                        feature.color === 'success' ? 'text-success' : 'text-accent'
                      }`} />
                    </div>
                    <h3 className="relative mb-2 text-xl font-bold text-foreground group-hover:text-primary transition-colors">{feature.title}</h3>
                    <p className="relative text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="py-20 bg-gradient-subtle relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.05),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--success)/0.05),transparent_50%)]" />
            <div className="container mx-auto px-4 relative">
              <div className="text-center mb-16">
                <span className="inline-block px-4 py-1.5 rounded-full bg-success-light text-success text-sm font-semibold mb-4">Simples e Rápido</span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Como Funciona</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                {[
                  { step: "01", title: "Configure", desc: "Escolha o segmento e localização dos leads" },
                  { step: "02", title: "Busque", desc: "Nossa IA encontra os melhores clientes" },
                  { step: "03", title: "Venda", desc: "Use abordagens personalizadas para converter" },
                ].map((item, index) => (
                  <div key={index} className="relative text-center opacity-0 animate-fade-in-up" style={{ animationDelay: `${0.1 + index * 0.15}s` }}>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary text-primary-foreground text-2xl font-bold mb-4 shadow-primary">{item.step}</div>
                    {index < 2 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-primary/30" />}
                    <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 md:py-28 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-[0.03]" />
            <div className="container mx-auto px-4 relative">
              <div className="max-w-4xl mx-auto bg-gradient-card rounded-3xl p-8 md:p-12 shadow-xl border border-border/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-success/10 to-transparent rounded-full blur-3xl" />
                <div className="relative text-center">
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Pronto para Revolucionar Suas Vendas?</h2>
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">Encontre clientes em segundos e crie abordagens que realmente convertem.</p>
                  <Button 
                    size="lg" 
                    className="bg-gradient-primary hover:opacity-90 shadow-primary hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-base h-14 px-8 rounded-xl"
                    onClick={() => {
                      if (alreadyUsed) {
                        const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
                        if (saved) { setStep("results"); return; }
                      }
                      setStep("config");
                    }}
                  >
                    <Building2 className="mr-2 h-5 w-5" />
                    Começar Agora
                  </Button>
                  <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span>Sem cadastro</span></div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span>Resultados reais</span></div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span>IA avançada</span></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ==================== LOADING STEP ====================
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw]">
        <TrialNavbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-medium text-foreground">Buscando leads...</p>
              <p className="text-sm text-muted-foreground mt-2">Isso pode levar alguns segundos</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==================== RESULTS STEP ====================
  if (step === "results") {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw]">
        <TrialNavbar />
        <main className="container mx-auto px-4 py-6 md:py-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2">Leads Encontrados</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Encontramos {totalFound.toLocaleString('pt-BR')} leads compatíveis com seu perfil
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-4 mb-6 md:mb-8">
            <StatsCard title="Total de Leads" value={totalFound} icon={Building2} trend="Encontrados" trendUp={true} />
            <StatsCard title="Alta Prioridade" value={leads.filter(l => l.matchScore >= 85).length} icon={Zap} trend={`${Math.round(leads.filter(l => l.matchScore >= 85).length / Math.max(leads.length, 1) * 100)}% do total`} trendUp={true} />
            <StatsCard title="Match Médio" value={leads.length > 0 ? `${Math.round(leads.reduce((acc, l) => acc + l.matchScore, 0) / leads.length)}%` : "0%"} icon={TrendingUp} />
            <StatsCard title="Exibidos" value={leads.length} icon={Users} trend={`de ${totalFound.toLocaleString('pt-BR')}`} />
          </div>

          {/* Visible leads - using real LeadCard layout */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {leads.map((lead, i) => (
              <TrialLeadCard
                key={lead.id || i}
                id={lead.id}
                name={lead.name}
                address={lead.address}
                phone={lead.phone}
                email={lead.email}
                instagram={lead.instagram}
                website={lead.website}
                responsible={lead.responsible}
                matchScore={lead.matchScore}
                reasons={lead.reasons}
                revenue={lead.revenue}
                openedDate={lead.openedDate}
                category={lead.category}
                employeeCount={lead.employeeCount}
                companySize={lead.companySize}
                hasWhatsApp={lead.hasWhatsApp}
                cnpj={(lead as any).cnpj}
                index={i}
              />
            ))}
          </div>

          {/* Blurred/locked section */}
          <div className="relative">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 blur-md select-none pointer-events-none" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 md:p-6 border border-border/50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-muted rounded w-16 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                    </div>
                    <div className="h-16 w-16 bg-muted rounded-full"></div>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 mb-4 space-y-2">
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-4/5"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="h-8 bg-muted rounded"></div>
                    <div className="h-8 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-2 p-3 border rounded-lg">
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                </Card>
              ))}
            </div>

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
                  <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Acesso imediato</span></div>
                  <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Exportar Excel</span></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==================== CONFIG STEP ====================
  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw]" lang="pt-BR">
      <TrialNavbar />
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Configure Sua Busca</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Preencha os dados abaixo para encontrar os leads perfeitos para seu negócio
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} translate="no">
            <Card className="p-4 md:p-8 shadow-card">
              <div className="space-y-6 md:space-y-8">

                {/* Products */}
                <div>
                  <Label htmlFor="products" className="text-base font-semibold" translate="no">Produtos específicos que vendo: *</Label>
                  <Input
                    id="products"
                    value={products}
                    onChange={(e) => setProducts(e.target.value)}
                    placeholder='Ex: "Refrigerantes, sucos, energéticos"'
                    className="mt-2"
                    translate="no"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Descreva os produtos ou serviços que você oferece</p>
                </div>

                {/* Customer Types (Segments) */}
                <div>
                  <Label className="text-base font-semibold mb-2 block" translate="no">
                    Para quem você vende: * <span className="text-sm font-normal text-muted-foreground">({selectedCustomers.length} selecionados)</span>
                  </Label>
                  <Input
                    placeholder="Buscar segmento..."
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setVisibleCount(100); }}
                    className="mb-3"
                    translate="no"
                  />
                  {(() => {
                    const filtered = customerTypes.filter(c => matchesSearch(c, customerSearch));
                    const displayItems = filtered.slice(0, visibleCount);
                    const hasMore = filtered.length > visibleCount;
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-2 border rounded-lg">
                          {displayItems.map((customer) => (
                            <div key={customer} className="flex items-center space-x-2" translate="no">
                              <Checkbox
                                id={`trial-customer-${customer}`}
                                checked={selectedCustomers.includes(customer)}
                                onCheckedChange={() => handleCustomerToggle(customer)}
                              />
                              <Label htmlFor={`trial-customer-${customer}`} className="font-normal cursor-pointer text-sm" translate="no">
                                {customer}
                              </Label>
                            </div>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-sm text-muted-foreground p-2 col-span-2">Nenhum segmento encontrado</p>
                          )}
                        </div>
                        {hasMore && !customerSearch && (
                          <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setVisibleCount(prev => prev + 200)}>
                            Mostrar mais ({filtered.length - displayItems.length} restantes)
                          </Button>
                        )}
                        {hasMore && customerSearch && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Mostrando {displayItems.length} de {filtered.length} resultados. Refine sua busca para ver mais.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Tipo de Empresa (Matriz/Filial) */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">Tipo de estabelecimento:</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant={businessType === "all" ? "default" : "outline"} onClick={() => setBusinessType("all")} className="gap-2">
                      <Building className="h-4 w-4" />Todos
                    </Button>
                    <Button type="button" variant={businessType === "matriz" ? "default" : "outline"} onClick={() => setBusinessType("matriz")} className="gap-2">
                      <Building2 className="h-4 w-4" />Apenas Matriz
                    </Button>
                    <Button type="button" variant={businessType === "filial" ? "default" : "outline"} onClick={() => setBusinessType("filial")} className="gap-2">
                      <Building className="h-4 w-4" />Apenas Filiais
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Selecione se deseja ver matriz, filiais ou ambos</p>
                </div>

                {/* Country / State / City */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="trial-country" className="text-base font-semibold" translate="no">País: *</Label>
                    <Select value={country} onValueChange={(val) => { setCountry(val); if (val !== "OTHER") setCustomCountry(""); setState(""); setCity(""); }}>
                      <SelectTrigger className="mt-2" id="trial-country" translate="no">
                        <SelectValue placeholder="Selecione o país" translate="no" />
                      </SelectTrigger>
                      <SelectContent sideOffset={5} translate="no">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {country === "OTHER" && (
                    <div>
                      <Label htmlFor="trial-customCountry" className="text-base font-semibold" translate="no">Nome do País: *</Label>
                      <Input id="trial-customCountry" value={customCountry} onChange={(e) => setCustomCountry(e.target.value)} placeholder="Ex: Austrália" className="mt-2" translate="no" />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="trial-state" className="text-base font-semibold" translate="no">
                      Estado: {country === "BR" ? "*" : "(opcional)"}
                    </Label>
                    {country === "BR" ? (
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="mt-2" id="trial-state" translate="no">
                          <SelectValue placeholder="Selecione o estado" translate="no" />
                        </SelectTrigger>
                        <SelectContent sideOffset={5} translate="no">
                          {brazilianStates.map((st) => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="trial-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Ex: California, Ontario..." className="mt-2" translate="no" />
                    )}
                  </div>

                  <div>
                    <Label htmlFor="trial-city" className="text-base font-semibold" translate="no">Cidade: (opcional)</Label>
                    <Input id="trial-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo, Blumenau..." className="mt-2" translate="no" />
                    <p className="text-xs text-muted-foreground mt-1">Deixe em branco para buscar em todo o estado</p>
                  </div>
                </div>

                {/* Company Size */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">Tamanho do cliente:</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox id="trial-size-all" checked={companySizes.length === 0 || companySizes.includes('all')} onCheckedChange={(checked) => { if (checked) setCompanySizes([]); }} />
                      <Label htmlFor="trial-size-all" className="font-normal cursor-pointer" translate="no">Todos os tamanhos</Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox id="trial-size-small" checked={companySizes.includes('small')} onCheckedChange={(checked) => { if (checked) setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'small']); else setCompanySizes(prev => prev.filter(s => s !== 'small')); }} />
                      <Label htmlFor="trial-size-small" className="font-normal cursor-pointer" translate="no">Pequeno (até 10 funcionários)</Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox id="trial-size-medium" checked={companySizes.includes('medium')} onCheckedChange={(checked) => { if (checked) setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'medium']); else setCompanySizes(prev => prev.filter(s => s !== 'medium')); }} />
                      <Label htmlFor="trial-size-medium" className="font-normal cursor-pointer" translate="no">Médio (11-50 funcionários)</Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox id="trial-size-large" checked={companySizes.includes('large')} onCheckedChange={(checked) => { if (checked) setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'large']); else setCompanySizes(prev => prev.filter(s => s !== 'large')); }} />
                      <Label htmlFor="trial-size-large" className="font-normal cursor-pointer" translate="no">Grande (+50 funcionários)</Label>
                    </div>
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">Faixa de faturamento:</Label>
                  <RadioGroup value={revenueRange} onValueChange={setRevenueRange}>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="micro" id="trial-micro" /><Label htmlFor="trial-micro" className="font-normal cursor-pointer" translate="no">Microempresa (até R$ 360 mil/ano)</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="small-business" id="trial-small-business" /><Label htmlFor="trial-small-business" className="font-normal cursor-pointer" translate="no">Pequena empresa (R$ 360 mil - R$ 4,8 milhões/ano)</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="medium-business" id="trial-medium-business" /><Label htmlFor="trial-medium-business" className="font-normal cursor-pointer" translate="no">Média empresa (R$ 4,8M - R$ 300M/ano)</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="large-business" id="trial-large-business" /><Label htmlFor="trial-large-business" className="font-normal cursor-pointer" translate="no">Grande empresa (+R$ 300M/ano)</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="all" id="trial-all-revenue" /><Label htmlFor="trial-all-revenue" className="font-normal cursor-pointer" translate="no">Todas as faixas</Label></div>
                  </RadioGroup>
                </div>

                {/* Digital Presence */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">Presença Digital (Site):</Label>
                  <RadioGroup value={digitalPresence} onValueChange={setDigitalPresence}>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="no-site" id="trial-no-site" /><Label htmlFor="trial-no-site" className="font-normal cursor-pointer" translate="no">Não possui site</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="basic-site" id="trial-basic-site" /><Label htmlFor="trial-basic-site" className="font-normal cursor-pointer" translate="no">Possui site básico / institucional</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="structured-site" id="trial-structured-site" /><Label htmlFor="trial-structured-site" className="font-normal cursor-pointer" translate="no">Possui site estruturado</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="all" id="trial-all-presence" /><Label htmlFor="trial-all-presence" className="font-normal cursor-pointer" translate="no">Todos</Label></div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">Filtre empresas pela presença de site institucional</p>
                </div>

                {/* Digital Activity */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">Nível de Atividade Digital:</Label>
                  <RadioGroup value={digitalActivity} onValueChange={setDigitalActivity}>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="low" id="trial-low-activity" /><Label htmlFor="trial-low-activity" className="font-normal cursor-pointer" translate="no">Baixa ou inexistente</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="basic" id="trial-basic-activity" /><Label htmlFor="trial-basic-activity" className="font-normal cursor-pointer" translate="no">Básica</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="active" id="trial-active-activity" /><Label htmlFor="trial-active-activity" className="font-normal cursor-pointer" translate="no">Ativa</Label></div>
                    <div className="flex items-center space-x-2" translate="no"><RadioGroupItem value="all" id="trial-all-activity" /><Label htmlFor="trial-all-activity" className="font-normal cursor-pointer" translate="no">Todos os níveis</Label></div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">Filtre pelo nível de engajamento digital da empresa</p>
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full gap-2 text-base py-6" size="lg" disabled={alreadyUsed}>
                  <Search className="h-5 w-5" />
                  {alreadyUsed ? "Teste já utilizado" : "Buscar Leads"}
                </Button>

                {alreadyUsed && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">Você já realizou sua pesquisa gratuita.</p>
                    <Button variant="outline" className="gap-2" onClick={() => window.open(PAYMENT_URL, "_blank")}>
                      <Lock className="h-4 w-4" />
                      Desbloquear Acesso Completo
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
};

export default TrialSearch;

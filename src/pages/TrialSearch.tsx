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
import { useNavigate } from "react-router-dom";
import TrialNavbar from "@/components/TrialNavbar";
import TrialLeadCard from "@/components/TrialLeadCard";
import TrialInfoSections from "@/components/TrialInfoSections";
import { customerTypes, countries, brazilianStates } from "@/data/searchConstants";
import StatsCard from "@/components/StatsCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";


const getDeviceId = (): string => {
  let id = localStorage.getItem("negocix_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("negocix_device_id", id);
  }
  return id;
};

const trackTrialEvent = async (eventType: string, searchConfig: Record<string, any> = {}, resultsCount = 0) => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await (supabase as any).from("trial_analytics").insert({
      event_type: eventType,
      search_config: searchConfig,
      results_count: resultsCount,
      device_id: getDeviceId(),
    }).select();
    if (error) {
      console.error("Trial tracking insert error:", error);
    } else {
      console.log("Trial event tracked:", eventType, data);
    }
  } catch (e) {
    console.error("Trial tracking error:", e);
  }
};

const PAYMENT_URL = "https://checkout.alphahubfy.com/checkout/pro-653b5773-804e-4682-8dde-e72b88de60c0";
const TRIAL_KEY = "negocix_trial_used";
const TRIAL_RESULTS_KEY = "negocix_trial_results_v2";

// Whitelisted device IDs that can do unlimited trial searches
const UNLIMITED_DEVICE_IDS = [
  localStorage.getItem("negocix_admin_unlimited") === "true" ? getDeviceId() : ""
];

const isUnlimitedDevice = (): boolean => {
  return localStorage.getItem("negocix_admin_unlimited") === "true";
};

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
  const navigate = useNavigate();
  const [step, setStep] = useState<TrialStep>(() => {
    if (isUnlimitedDevice()) return "home";
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
      if (saved) {
        const val = parseInt(saved);
        // Check if inflation was already applied (flag)
        const inflated = localStorage.getItem("negocix_trial_inflated");
        if (!inflated && val > 0) {
          const newVal = Math.ceil(val * 1.30);
          localStorage.setItem("negocix_trial_total", String(newVal));
          localStorage.setItem("negocix_trial_inflated", "true");
          return newVal;
        }
        return val;
      }
      return 0;
    } catch { return 0; }
  });

  const [showLockDialog, setShowLockDialog] = useState(false);
  const alreadyUsed = !isUnlimitedDevice() && localStorage.getItem(TRIAL_KEY) === "true";

  // Track page view and time on page
  useEffect(() => {
    const enteredAt = Date.now();
    trackTrialEvent("page_view");
    
    // Track time periodically and on page hide
    let lastTracked = 0;
    const trackTime = () => {
      const seconds = Math.round((Date.now() - enteredAt) / 1000);
      if (seconds > lastTracked + 5) { // only track if 5+ more seconds
        lastTracked = seconds;
        trackTrialEvent("time_on_page", { seconds });
      }
    };
    
    const handleVisChange = () => {
      if (document.visibilityState === "hidden") trackTime();
    };
    const handleUnload = () => trackTime();
    
    document.addEventListener("visibilitychange", handleVisChange);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      trackTime();
      document.removeEventListener("visibilitychange", handleVisChange);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  // Keep users inside the trial flow without breaking access to /teste/admin
  useEffect(() => {
    const blockNavigation = () => {
      if (window.location.pathname === "/teste") {
        window.history.pushState(null, "", "/teste");
      }
    };

    if (window.location.pathname === "/teste") {
      window.history.replaceState(null, "", "/teste");
      window.history.pushState(null, "", "/teste");
      window.history.pushState(null, "", "/teste");
    }

    window.addEventListener("popstate", blockNavigation);

    return () => {
      window.removeEventListener("popstate", blockNavigation);
    };
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
    setSelectedCustomers(prev => {
      if (prev.includes(customer)) {
        return prev.filter(c => c !== customer);
      }
      if (prev.length >= 1) {
        toast({
          title: "🔒 Recurso exclusivo",
          description: "Seleção múltipla disponível apenas no acesso completo. Desbloqueie agora!",
          variant: "destructive",
        });
        return prev;
      }
      return [customer];
    });
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

    // For unlimited devices, clear previous cached results to force fresh display
    if (isUnlimitedDevice()) {
      localStorage.removeItem(TRIAL_RESULTS_KEY);
      localStorage.removeItem("negocix_trial_total");
      localStorage.removeItem("negocix_trial_inflated");
      setLeads([]);
      setTotalFound(0);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for trial

      const response = await fetch(`${supabaseUrl}/functions/v1/search-leads`, {
        method: 'POST',
        signal: controller.signal,
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

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data?.leads && data.leads.length > 0) {
        // Filter out accounting-related leads to avoid confusion in trial results
        const accountingTerms = ['contabil', 'contábil', 'contabilidade', 'contador', 'escritorio contabil', 'escritório contábil'];
        const filteredLeads = data.leads.filter((lead: any) => {
          const nameLC = (lead.name || '').toLowerCase();
          const emailLC = (lead.email || '').toLowerCase();
          const categoryLC = (lead.category || '').toLowerCase();
          return !accountingTerms.some(term => nameLC.includes(term) || emailLC.includes(term) || categoryLC.includes(term));
        });
        const total = filteredLeads.length;
        const inflatedTotal = Math.ceil(total * 1.30); // Show 30% more to encourage signup
        const preview = filteredLeads.slice(0, 6);
        setLeads(preview);
        setTotalFound(inflatedTotal);
        if (!isUnlimitedDevice()) {
          localStorage.setItem(TRIAL_KEY, "true");
        }
        localStorage.setItem(TRIAL_RESULTS_KEY, JSON.stringify(preview));
        localStorage.setItem("negocix_trial_total", String(inflatedTotal));
        localStorage.setItem("negocix_trial_inflated", "true");
        
        // Track search event with full details
        const region = city && state ? `${city}, ${state}` : state || city || "";
        trackTrialEvent("search", {
          segment: selectedCustomers.join(", "),
          products,
          region,
          businessType,
          realCount: total,
          inflatedCount: inflatedTotal,
          previewCount: preview.length,
        }, total);
        
        setStep("results");
      } else {
        toast({ title: "Nenhum resultado", description: "Tente outro segmento ou localização", variant: "destructive" });
        setStep("config");
      }
    } catch (error: any) {
      console.error("Trial search error:", error);
      if (error?.name === 'AbortError') {
        toast({ title: "Busca demorou demais", description: "Tente uma cidade menor ou outro segmento", variant: "destructive" });
      } else {
        toast({ title: "Erro na busca", description: "Tente novamente", variant: "destructive" });
      }
      setStep("config");
    }
  };

  // ==================== LOCK DIALOG (rendered via Portal, works in any step) ====================
  const lockDialog = (
    <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
      <DialogContent className="w-[92vw] max-w-sm text-center z-[100] p-4 sm:p-6">
        <DialogHeader className="items-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-lg">Versão completa</DialogTitle>
          <DialogDescription className="text-sm">
            Desbloqueie o acesso completo da plataforma.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm text-muted-foreground space-y-2.5 text-left mx-auto">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> Pesquisas ilimitadas</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> Contatos completos</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> Fornecedores e representantes</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> Exportação para Excel</li>
        </ul>
        <Button
          size="default"
          className="w-full bg-gradient-primary hover:opacity-90 text-sm h-11 rounded-xl shadow-primary mt-1"
          onClick={() => { trackTrialEvent("checkout_click"); window.open(PAYMENT_URL, "_blank"); }}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Desbloquear Acesso
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Acesso imediato</span></div>
          <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /><span>Todos os recursos</span></div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderAdminDot = (wrapperClassName = "pt-2") => (
    <div className={`flex justify-center ${wrapperClassName}`}>
      <button
        type="button"
        onClick={() => navigate("/teste/admin")}
        className="w-3 h-3 rounded-full bg-blue-900 hover:bg-blue-700 transition-colors cursor-pointer"
        aria-label="Abrir painel admin"
      />
    </div>
  );

  // ==================== HOME STEP ====================
  if (step === "home") {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw] flex flex-col">
        <TrialNavbar />
        {lockDialog}
        <main className="relative flex items-center justify-center min-h-[calc(100vh-4rem)]">
          {/* Background effects */}
          <div className="absolute inset-0 bg-gradient-hero" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-glow/20 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

          <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-2 mb-5 px-5 py-2.5 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 animate-fade-in-down">
              <Star className="h-5 w-5 text-warning" fill="currentColor" />
              <span className="text-base text-primary-foreground/90 font-medium">Experimente Agora</span>
            </div>
            
            <h1 className="mb-4 text-4xl md:text-6xl font-bold leading-tight text-primary-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Encontre{" "}
              <span className="relative">
                <span className="relative z-10">Clientes Qualificados</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-success-glow/40 -rotate-1 rounded" />
              </span>
            </h1>
            
            <p className="mb-8 text-lg md:text-xl text-primary-foreground/80 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              Veja na prática como a nossa plataforma encontra leads qualificados para o seu negócio.
            </p>
            
            <div className="flex flex-col gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Button 
                size="lg" 
                className="bg-success hover:bg-success-hover text-success-foreground shadow-success hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group text-lg h-16 px-8 rounded-xl w-full"
                onClick={() => {
                  if (alreadyUsed) {
                    const saved = localStorage.getItem(TRIAL_RESULTS_KEY);
                    if (saved) { setStep("results"); return; }
                  }
                  setStep("config");
                }}
              >
                Experimentar Grátis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-primary-foreground/60 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /><span>Sem cadastro</span></div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /><span>Dados reais</span></div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /><span>100% grátis</span></div>
            </div>
          </div>
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
        {lockDialog}
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
                razaoSocial={(lead as any).razaoSocial}
                nomeFantasia={(lead as any).nomeFantasia}
                index={i}
                onRequestUnlock={() => { trackTrialEvent("card_click", { lead_name: lead.name }); setShowLockDialog(true); }}
              />
            ))}
          </div>

          {/* Locked CTA section */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Just 2 blurred skeleton cards for visual hint */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 blur-[2px] select-none pointer-events-none opacity-40" aria-hidden="true">
              {Array.from({ length: 2 }).map((_, i) => (
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
                </Card>
              ))}
            </div>

            {/* Overlay CTA */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="text-center max-w-sm px-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  +{(totalFound - 10).toLocaleString('pt-BR')} leads bloqueados
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Desbloqueie para ver todos os resultados completos.
                </p>
                <Button
                  size="lg"
                  className="w-full bg-gradient-primary hover:opacity-90 text-base h-14 rounded-xl shadow-primary"
                  onClick={() => { trackTrialEvent("unlock_click"); setShowLockDialog(true); }}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Desbloquear Acesso
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Nova pesquisa - apenas para device admin/unlimited */}
          {isUnlimitedDevice() && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-6 rounded-xl"
                onClick={() => {
                  localStorage.removeItem(TRIAL_RESULTS_KEY);
                  localStorage.removeItem("negocix_trial_total");
                  localStorage.removeItem("negocix_trial_inflated");
                  localStorage.removeItem(TRIAL_KEY);
                  setLeads([]);
                  setTotalFound(0);
                  setStep("config");
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Fazer nova pesquisa (admin)
              </Button>
            </div>
          )}

          {renderAdminDot("pt-6")}

        </main>
      </div>
    );
  }

  // ==================== CONFIG STEP ====================
  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-[100vw]" lang="pt-BR">
      <TrialNavbar />
      {lockDialog}
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
                    Para quem você vende: * <span className="text-sm font-normal text-muted-foreground">({selectedCustomers.length}/1 — <Lock className="inline h-3 w-3" /> múltiplos no acesso completo)</span>
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


                {/* Submit */}
                <Button type="submit" className="w-full gap-2 text-base py-6" size="lg" disabled={alreadyUsed}>
                  <Search className="h-5 w-5" />
                  {alreadyUsed ? "Teste já utilizado" : "Buscar Leads"}
                </Button>

                {alreadyUsed && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">Você já realizou sua pesquisa gratuita.</p>
                    <Button variant="outline" className="gap-2" onClick={() => setShowLockDialog(true)}>
                      <Lock className="h-4 w-4" />
                      Desbloquear Acesso Completo
                    </Button>
                  </div>
                )}

                {renderAdminDot()}
              </div>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
};

export default TrialSearch;

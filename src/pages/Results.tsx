import { Building2, TrendingUp, Users, Zap, Download, Crown, Pencil } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import StatsCard from "@/components/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import * as XLSX from 'xlsx';

// Score a lead by "size" using multiple factors: porte, employees, revenue
const sizeScore = (lead: any): number => {
  let score = 0;
  const porte = String(lead.companySize || lead.porte || '').toUpperCase();
  if (porte.includes('GRANDE')) score += 1000;
  else if (porte.includes('MEDIA') || porte.includes('MÉDIA') || porte.includes('MEDIO') || porte.includes('MÉDIO')) score += 600;
  else if (porte.includes('PEQUEN')) score += 300;
  else if (porte.includes('MICRO')) score += 100;
  else if (porte.includes('DEMAIS')) score += 500;

  const emp = String(lead.employeeCount || '');
  const nums = emp.match(/\d+/g)?.map(Number) || [];
  if (nums.length) {
    const maxEmp = Math.max(...nums);
    score += Math.min(maxEmp, 5000) / 5;
  }

  const rev = String(lead.revenue || '');
  const revDigits = rev.replace(/[^\d]/g, '');
  if (revDigits) {
    const n = Number(revDigits);
    if (isFinite(n) && n > 0) score += Math.min(Math.log10(n + 1) * 100, 800);
  }
  if (/milh/i.test(rev)) score += 200;
  if (/bilh/i.test(rev)) score += 600;

  const cap = Number((lead as any).capitalSocial || 0);
  if (isFinite(cap) && cap > 0) score += Math.min(Math.log10(cap + 1) * 50, 400);

  return score;
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
  isMatriz?: boolean;
  digitalPresence?: 'no-site' | 'basic-site' | 'structured-site';
  digitalActivity?: 'low' | 'basic' | 'active';
}

// Function to alternate leads by category for variety
const alternateLeadsByCategory = (leads: Lead[]): Lead[] => {
  if (leads.length === 0) return [];
  
  // Group leads by category
  const byCategory: { [key: string]: Lead[] } = {};
  leads.forEach(lead => {
    const cat = lead.category || 'Outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(lead);
  });
  
  const categories = Object.keys(byCategory);
  if (categories.length <= 1) return leads; // No need to alternate if single category
  
  // Interleave leads from different categories
  const result: Lead[] = [];
  const categoryIndices: { [key: string]: number } = {};
  categories.forEach(cat => categoryIndices[cat] = 0);
  
  let totalAdded = 0;
  const maxLeads = leads.length;
  let catIndex = 0;
  
  while (totalAdded < maxLeads) {
    // Get 2-4 leads from current category (random for variety)
    const currentCat = categories[catIndex % categories.length];
    const batch = Math.floor(Math.random() * 3) + 2; // 2-4 leads
    
    for (let i = 0; i < batch && totalAdded < maxLeads; i++) {
      if (categoryIndices[currentCat] < byCategory[currentCat].length) {
        result.push(byCategory[currentCat][categoryIndices[currentCat]]);
        categoryIndices[currentCat]++;
        totalAdded++;
      }
    }
    
    catIndex++;
    
    // Check if all categories are exhausted
    const allExhausted = categories.every(cat => categoryIndices[cat] >= byCategory[cat].length);
    if (allExhausted) break;
  }
  
  return result;
};

// Função para ordenar leads alfabeticamente
const sortLeadsAlphabetically = (leads: Lead[]): Lead[] => {
  return [...leads].sort((a, b) => {
    const nameA = a.name?.toLowerCase() || '';
    const nameB = b.name?.toLowerCase() || '';
    return nameA.localeCompare(nameB, 'pt-BR');
  });
};

const LEADS_PER_PAGE = 30;

const Results = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [topMode, setTopMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'category'>('alphabetical');
  const [visibleCount, setVisibleCount] = useState(LEADS_PER_PAGE);
  const [cityCorrection, setCityCorrection] = useState<{ original: string; corrected: string } | null>(null);
  const { toast } = useToast();
  const location = useLocation();
  const { restoreScrollPosition } = useScrollPosition();
  const hasRestoredScroll = useRef(false);
  const { isAdmin } = useAdminCheck();
  const navigate = useNavigate();

  const exportToExcel = async () => {
    if (leads.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Faça uma busca primeiro para gerar leads",
        variant: "destructive",
      });
      return;
    }

    // Full export (all Receita Federal fields) only for specific user
    let fullExport = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email?.toLowerCase() === 'contatoativarepres@gmail.com') {
        fullExport = true;
      }
    } catch (e) {
      console.warn('Could not determine user for export mode', e);
    }

    const extractCityState = (address: string) => {
      const parts = address.split(',').map(p => p.trim());
      let cidade = '';
      let estado = '';
      if (parts.length >= 2) {
        for (let i = 0; i < parts.length; i++) {
          const dashMatch = parts[i]?.match(/^(.+?)\s*-\s*([A-Za-z]{2})$/);
          if (dashMatch) {
            cidade = dashMatch[1].trim();
            estado = dashMatch[2].trim().toUpperCase();
            break;
          }
        }
        if (!estado) {
          for (let i = parts.length - 1; i >= 0; i--) {
            const clean = parts[i]?.replace(/[\d\-\.]/g, '').trim();
            if (clean && /^[A-Za-z]{2}$/.test(clean)) {
              estado = clean.toUpperCase();
              if (i > 0 && !cidade) {
                cidade = parts[i - 1]?.replace(/[\d\-\.]/g, '').trim() || '';
              }
              break;
            }
          }
        }
      }
      return { cidade, estado };
    };

    const formatCnpj = (cnpj: string) => {
      const d = (cnpj || '').replace(/\D/g, '');
      if (d.length !== 14) return cnpj || '';
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
    };
    const formatCapital = (v: any) => {
      const n = Number(v);
      if (!isFinite(n) || n <= 0) return '';
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    let excelData: any[];
    let columnWidths: { wch: number }[];

    if (fullExport) {
      excelData = leads.map((lead: any) => {
        const { cidade, estado } = extractCityState(lead.address);
        return {
          'Nome': lead.name,
          'Razão Social': lead.razaoSocial || '',
          'Nome Fantasia': lead.nomeFantasia || '',
          'CNPJ': formatCnpj(lead.cnpj || ''),
          'Categoria': lead.category,
          'CNAE Principal': lead.cnaePrincipal || '',
          'Descrição CNAE': lead.descricaoCnae || '',
          'CNAE Secundária': lead.cnaeSecundaria || '',
          'Natureza Jurídica': lead.naturezaJuridica || '',
          'Situação Cadastral': lead.situacaoCadastral || '',
          'Data Situação': lead.dataSituacaoCadastral || '',
          'Motivo Situação': lead.motivoSituacao || '',
          'Data Abertura': lead.openedDate || '',
          'Matriz/Filial': lead.matrizFilial || (lead.isMatriz ? 'MATRIZ' : ''),
          'Porte': lead.porte || lead.companySize || '',
          'Capital Social': formatCapital(lead.capitalSocial),
          'Faturamento Estimado': lead.revenue || '',
          'Funcionários (estimado)': lead.employeeCount || '',
          'MEI': lead.mei || '',
          'Simples Nacional': lead.simples || '',
          'Telefone 1': lead.telefone1 || lead.phone || '',
          'Telefone 2': lead.telefone2 || '',
          'WhatsApp': lead.hasWhatsApp ? 'Sim' : 'Não',
          'Email': lead.email || '',
          'Website': lead.website || '',
          'Instagram': lead.instagram || '',
          'Endereço': lead.endereco || '',
          'Complemento': lead.complemento || '',
          'Bairro': lead.bairro || '',
          'CEP': lead.cep || '',
          'Cidade': lead.cidade || cidade,
          'Estado': lead.estado || estado,
          'Endereço Completo': lead.address,
          'Sócio': lead.nomeSocio || lead.responsible || '',
          'Faixa Etária Sócio': lead.faixaEtariaSocio || '',
          'Qualificação Sócio': lead.qualificacaoSocio || '',
          'Score de Match (%)': lead.matchScore,
        };
      });
      columnWidths = new Array(Object.keys(excelData[0] || {}).length).fill(0).map(() => ({ wch: 22 }));
    } else {
      excelData = leads.map((lead: any) => {
        const { cidade, estado } = extractCityState(lead.address);
        return {
          'Nome': lead.name,
          'CNPJ': formatCnpj(lead.cnpj || ''),
          'Cidade': cidade,
          'Estado': estado,
          'Endereço': lead.address,
          'Telefone': lead.phone,
          'Email': lead.email || 'N/A',
          'Instagram': lead.instagram || 'N/A',
          'Responsável': lead.responsible,
          'Categoria': lead.category,
          'Porte': lead.companySize || 'N/A',
          'Funcionários': lead.employeeCount || 'N/A',
          'Score de Match (%)': lead.matchScore,
        };
      });
      columnWidths = [
        { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 40 },
        { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 },
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    worksheet['!cols'] = columnWidths;

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `leads-negocix-${fullExport ? 'completo-' : ''}${timestamp}.xlsx`;
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: `${leads.length} leads exportados${fullExport ? ' (modo completo)' : ''}`,
    });
  };

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // If navigated from history with saved leads, render them directly (no refetch)
        const historyLeads = (location.state as { historyLeads?: Lead[] } | null)?.historyLeads;
        if (historyLeads && Array.isArray(historyLeads) && historyLeads.length > 0) {
          const sorted = sortLeadsAlphabetically(historyLeads);
          setLeads(sorted);
          setAllLeads(sorted);
          setLoading(false);
          return;
        }

        const searchConfigStr = localStorage.getItem('leadSearchConfig');

        // Cache desabilitado: toda busca bate na edge function ao vivo
        try {
          localStorage.removeItem('cachedLeads');
          localStorage.removeItem('cachedSearchConfig');
        } catch {}


        // Get search configuration from localStorage
        if (!searchConfigStr) {
          toast({
            title: "Erro",
            description: "Configure sua busca primeiro",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const searchConfig = JSON.parse(searchConfigStr);
        console.log('🔍 Fetching NEW leads with config:', searchConfig);
        
        // Call the edge function with raw fetch to support long timeout (10 min)
        // Retry automático (1x) para erros transitórios: rede caiu, 5xx, resposta truncada.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const { data: { session } } = await supabase.auth.getSession();

        const body = JSON.stringify({
          segment: (searchConfig.selectedCustomers || []).join(', '),
          cnaes: searchConfig.selectedCnaes || [],
          products: searchConfig.products,
          region: searchConfig.region,
          nationwide: searchConfig.nationwide || false,
          country: searchConfig.country || 'BR',
          ecommerceType: searchConfig.ecommerceType || '',
          businessType: searchConfig.businessType || 'all',
          digitalPresence: searchConfig.digitalPresence || 'all',
          digitalActivity: searchConfig.digitalActivity || 'all',
          whatsappOnly: searchConfig.whatsappOnly || false,
          receitaFederalOnly: searchConfig.receitaFederalOnly || false,
          neighborhood: searchConfig.neighborhood || '',
          filters: {
            category: searchConfig.category,
            companySizes: searchConfig.companySizes || ['all'],
            revenueRange: searchConfig.revenueRange,
          }
        });

        // Guarda-chuva no cliente: bloqueia buscas obviamente inválidas antes de gastar
        // wall-time no servidor. Evita "0 leads" silencioso por input vazio.
        const hasAnyCriterion =
          (searchConfig.selectedCustomers && searchConfig.selectedCustomers.length > 0) ||
          (searchConfig.selectedCnaes && searchConfig.selectedCnaes.length > 0);
        if (!hasAnyCriterion) {
          toast({
            title: "Selecione ao menos 1 segmento ou CNAE",
            description: "A busca precisa de pelo menos um critério para retornar leads.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const attemptFetch = async (attempt: number): Promise<{ data: any; transient: boolean; abort: boolean }> => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 600000);
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/search-leads`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
                'apikey': supabaseKey,
              },
              body,
              signal: controller.signal,
            });

            const serverLeadCount = parseInt(response.headers.get('x-leads-count') || '0', 10);
            let parsed: any = null;
            try {
              parsed = await response.json();
            } catch (parseErr) {
              console.warn('⚠️ JSON parse falhou, tentando texto bruto…', parseErr);
              try {
                const raw = await response.text();
                parsed = JSON.parse(raw);
              } catch {
                parsed = null;
              }
            }

            const parsedCount = Array.isArray(parsed?.leads) ? parsed.leads.length : 0;
            // 5xx → transitório
            if (response.status >= 500) {
              console.warn(`⚠️ HTTP ${response.status} (tentativa ${attempt})`);
              return { data: parsed, transient: true, abort: false };
            }
            // Payload truncado → transitório
            if (serverLeadCount > 0 && parsedCount === 0) {
              console.warn(`⚠️ Mismatch header=${serverLeadCount} body=0 (tentativa ${attempt})`);
              return { data: parsed, transient: true, abort: false };
            }
            return { data: parsed, transient: false, abort: false };
          } catch (fetchErr: any) {
            const isAbort = fetchErr?.name === 'AbortError';
            console.warn(`⚠️ Fetch erro (tentativa ${attempt}):`, fetchErr?.message || fetchErr);
            // Rede caiu / DNS / connection reset → transitório (mas abort de 10min não retrata)
            return { data: null, transient: !isAbort, abort: isAbort };
          } finally {
            clearTimeout(timeoutId);
          }
        };

        let data: any = null;
        let lastAbort = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await attemptFetch(attempt);
          data = res.data;
          lastAbort = res.abort;
          if (!res.transient) break;
          if (attempt < 2) {
            console.log(`🔁 Retentando busca (tentativa ${attempt + 1}/2) em 1.5s…`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        if (!data || !Array.isArray(data.leads)) {
          toast({
            title: lastAbort ? "Tempo esgotado" : "Erro ao buscar leads",
            description: lastAbort
              ? "A busca demorou demais. Tente novamente ou busque por uma região menor."
              : (data?.error || "Falha temporária no servidor. Tente novamente em alguns segundos."),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

      console.log('✅ API returned leads:', data?.leads?.length || 0);
        // Edge function already logs the search — no duplicate logging needed here

        if (data?.leads && data.leads.length > 0) {
          const sortedLeads = sortLeadsAlphabetically(data.leads);
          setLeads(sortedLeads);
          setAllLeads(sortedLeads);
          if (data.correctedCity && data.originalCity && data.correctedCity !== data.originalCity) {
            const toTitle = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            setCityCorrection({ original: toTitle(data.originalCity), corrected: toTitle(data.correctedCity) });
          } else {
            setCityCorrection(null);
          }
          // Cache best-effort: localStorage tem limite (~5MB). Se estourar, ignora.
          try {
            localStorage.setItem('cachedLeads', JSON.stringify(data.leads));
            localStorage.setItem('cachedSearchConfig', searchConfigStr || '');
            console.log('💾 Leads cached successfully:', data.leads.length);
          } catch (cacheErr) {
            console.warn('⚠️ Cache pulado (quota excedida):', data.leads.length, 'leads');
            try {
              localStorage.removeItem('cachedLeads');
              localStorage.removeItem('cachedSearchConfig');
            } catch {}
          }
        } else if (data?.error) {
          toast({
            title: data.allSeen ? "Leads já exibidos" : "Erro ao buscar leads",
            description: data.error + (data.details ? ` ${data.details}` : ''),
            variant: data.allSeen ? "default" : "destructive",
          });
        } else {
          toast({
            title: "Nenhum lead encontrado",
            description: "Tente ajustar os filtros ou buscar em outra cidade",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('❌ Error fetching leads:', error);
        toast({
          title: "Erro ao buscar leads",
          description: "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []); // Empty deps - only run once on mount

  // Restore scroll position after leads are loaded
  useEffect(() => {
    if (!loading && leads.length > 0 && !hasRestoredScroll.current) {
      hasRestoredScroll.current = true;
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        restoreScrollPosition();
      }, 100);
    }
  }, [loading, leads.length, restoreScrollPosition]);

  // Toggle sort order
  const handleToggleSort = () => {
    if (sortOrder === 'alphabetical') {
      setSortOrder('category');
      setLeads(prev => alternateLeadsByCategory(prev));
    } else {
      setSortOrder('alphabetical');
      setLeads(prev => sortLeadsAlphabetically(prev));
    }
  };

  const handleEditSearch = () => {
    navigate('/configuracao');
  };

  // Admin-only: toggle Top 15 biggest companies
  const handleToggleTop = () => {
    if (topMode) {
      setTopMode(false);
      setLeads(sortOrder === 'alphabetical' ? sortLeadsAlphabetically(allLeads) : alternateLeadsByCategory(allLeads));
      setVisibleCount(LEADS_PER_PAGE);
    } else {
      // Dedup por telefone e e-mail (mesma rede/CNPJ raiz) antes de pegar os maiores
      const normPhone = (p?: string) => (p || '').replace(/\D/g, '').replace(/^55/, '').slice(-10);
      const normEmail = (e?: string) => (e || '').trim().toLowerCase();
      const seenPhones = new Set<string>();
      const seenEmails = new Set<string>();
      const sorted = [...allLeads].sort((a, b) => sizeScore(b) - sizeScore(a));
      const unique: typeof allLeads = [];
      for (const lead of sorted) {
        const ph = normPhone((lead as any).phone);
        const em = normEmail((lead as any).email);
        if (ph && seenPhones.has(ph)) continue;
        if (em && seenEmails.has(em)) continue;
        if (ph) seenPhones.add(ph);
        if (em) seenEmails.add(em);
        unique.push(lead);
        if (unique.length >= 15) break;
      }
      setTopMode(true);
      setLeads(unique);
      setVisibleCount(unique.length);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Buscando leads...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Empresas Encontradas</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Encontramos {leads.length} empresas compatíveis com seu perfil
            </p>
            {cityCorrection && (
              <p className="mt-2 text-sm text-primary">
                Mostrando resultados para <span className="font-semibold">{cityCorrection.corrected}</span>
                <span className="text-muted-foreground"> (você digitou "{cityCorrection.original}")</span>
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleEditSearch}
              variant="outline"
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Editar busca</span>
              <span className="sm:hidden">Editar</span>
            </Button>
            {isAdmin && (
              <Button
                onClick={handleToggleTop}
                variant={topMode ? "default" : "outline"}
                className="gap-2"
              >
                <Crown className="h-4 w-4" />
                {topMode ? "Mostrar todos" : "Top 15 Maiores"}
              </Button>
            )}
            <Button 
              onClick={handleToggleSort}
              variant="outline"
              className="gap-2"
            >
              {sortOrder === 'alphabetical' ? 'A-Z' : 'Categoria'}
              <span className="text-xs text-muted-foreground">
                ({sortOrder === 'alphabetical' ? 'Alfabético' : 'Por categoria'})
              </span>
            </Button>
            <Button 
              onClick={exportToExcel}
              className="gap-2"
              size="lg"
            >
              <Download className="h-5 w-5" />
              <span className="hidden sm:inline">Exportar para Excel</span>
              <span className="sm:hidden">Exportar</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-4 mb-6 md:mb-8">
          <StatsCard
            title="Total de Leads"
            value={leads.length}
            icon={Building2}
            trend="+12% esta semana"
            trendUp={true}
          />
          <StatsCard
            title="Alta Prioridade"
            value={leads.filter(l => l.matchScore >= 85).length}
            icon={Zap}
            trend="23% do total"
            trendUp={true}
          />
          <StatsCard
            title="Match Médio"
            value={leads.length > 0 ? `${Math.round(leads.reduce((acc, l) => acc + l.matchScore, 0) / leads.length)}%` : "0%"}
            icon={TrendingUp}
          />
          <StatsCard
            title="Novos Clientes"
            value={leads.filter(l => l.openedDate?.includes("meses") || l.openedDate?.includes("mês")).length}
            icon={Users}
          />
        </div>

        {/* Lead Cards */}
        {leads.length > 0 ? (
          <>
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {leads.slice(0, visibleCount).map((lead) => (
                <LeadCard 
                  key={lead.id} 
                  {...lead} 
                  website={lead.website}
                  hasWhatsApp={lead.hasWhatsApp}
                />
              ))}
            </div>
            {visibleCount < leads.length && (
              <div className="flex justify-center mt-8">
                <Button 
                  onClick={() => setVisibleCount(prev => Math.min(prev + LEADS_PER_PAGE, leads.length))}
                  variant="outline"
                  size="lg"
                >
                  Carregar mais ({leads.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">Nenhum lead encontrado. Configure uma nova busca.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Results;

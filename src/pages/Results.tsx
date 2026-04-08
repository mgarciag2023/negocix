import { Building2, TrendingUp, Users, Zap, Download } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import StatsCard from "@/components/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import * as XLSX from 'xlsx';

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
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'category'>('alphabetical');
  const [visibleCount, setVisibleCount] = useState(LEADS_PER_PAGE);
  const { toast } = useToast();
  const location = useLocation();
  const { restoreScrollPosition } = useScrollPosition();
  const hasRestoredScroll = useRef(false);

  const exportToExcel = () => {
    if (leads.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Faça uma busca primeiro para gerar leads",
        variant: "destructive",
      });
      return;
    }

    // Preparar dados para o Excel
    // Extract city and state from address
    const extractCityState = (address: string) => {
      const parts = address.split(',').map(p => p.trim());
      let cidade = '';
      let estado = '';
      if (parts.length >= 2) {
        // Usually: "Rua X, 123, Bairro, Cidade - UF, CEP"
        const lastParts = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        const dashMatch = secondLast?.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
        if (dashMatch) {
          cidade = dashMatch[1].trim();
          estado = dashMatch[2].trim();
        } else {
          const dashMatch2 = lastParts?.match(/^(.+?)\s*-\s*([A-Z]{2})/);
          if (dashMatch2) {
            cidade = dashMatch2[1].trim();
            estado = dashMatch2[2].trim();
          } else {
            cidade = secondLast || '';
            estado = lastParts?.replace(/[\d-]/g, '').trim() || '';
          }
        }
      }
      return { cidade, estado };
    };

    const excelData = leads.map((lead) => {
      const { cidade, estado } = extractCityState(lead.address);
      return {
        'Nome': lead.name,
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
        'Motivo 1': lead.reasons[0] || '',
        'Motivo 2': lead.reasons[1] || '',
        'Motivo 3': lead.reasons[2] || '',
      };
    });

    // Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 30 }, // Nome
      { wch: 40 }, // Endereço
      { wch: 15 }, // Telefone
      { wch: 30 }, // Email
      { wch: 20 }, // Instagram
      { wch: 25 }, // Responsável
      { wch: 15 }, // Categoria
      { wch: 25 }, // Faturamento
      { wch: 20 }, // Tempo no Mercado
      { wch: 12 }, // Score
      { wch: 50 }, // Motivo 1
      { wch: 50 }, // Motivo 2
      { wch: 50 }, // Motivo 3
    ];
    worksheet['!cols'] = columnWidths;

    // Gerar arquivo e fazer download
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `leads-negocix-${timestamp}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: `${leads.length} leads exportados com sucesso`,
    });
  };

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const searchConfigStr = localStorage.getItem('leadSearchConfig');
        const cachedLeadsStr = localStorage.getItem('cachedLeads');
        const cachedConfigStr = localStorage.getItem('cachedSearchConfig');

        // Use cache if the search config hasn't changed
        if (cachedLeadsStr && cachedConfigStr && cachedConfigStr === searchConfigStr) {
          try {
            const cachedLeads = JSON.parse(cachedLeadsStr);
            if (Array.isArray(cachedLeads) && cachedLeads.length > 0) {
              console.log('📦 Cache HIT - Using cached leads:', cachedLeads.length);
              setLeads(sortLeadsAlphabetically(cachedLeads));
              setLoading(false);
              return;
            }
          } catch {
            console.error('❌ Error parsing cached leads');
          }
        }

        console.log('💾 Cache MISS - Will fetch from API');

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
        
        // Call the edge function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
        
        let data, error;
        try {
          const result = await supabase.functions.invoke('search-leads', {
            body: {
              segment: searchConfig.selectedCustomers.join(', '),
              products: searchConfig.products,
              region: searchConfig.region,
              country: searchConfig.country || 'BR',
              ecommerceType: searchConfig.ecommerceType || '',
              businessType: searchConfig.businessType || 'all',
              digitalPresence: searchConfig.digitalPresence || 'all',
              digitalActivity: searchConfig.digitalActivity || 'all',
              whatsappOnly: searchConfig.whatsappOnly || false,
              receitaFederalOnly: searchConfig.receitaFederalOnly || false,
              filters: {
                category: searchConfig.category,
                companySizes: searchConfig.companySizes || ['all'],
                revenueRange: searchConfig.revenueRange,
              }
            }
          });
          data = result.data;
          error = result.error;
        } catch (abortErr: any) {
          if (abortErr?.name === 'AbortError' || controller.signal.aborted) {
            toast({
              title: "Tempo esgotado",
              description: "A busca demorou demais. Tente novamente ou busque por uma região menor.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          throw abortErr;
        } finally {
          clearTimeout(timeoutId);
        }

        if (error) {
          console.error('❌ Error calling search-leads:', error);

          // Try to surface the actual error body returned by the backend function
          let description = error.message || "Tente novamente mais tarde";
          try {
            const anyErr = error as any;
            const ctx = anyErr?.context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              if (body?.error) description = body.error;
            } else if (typeof anyErr?.details === 'string' && anyErr.details.trim()) {
              description = anyErr.details;
            }
          } catch {
            // ignore parsing issues
          }

          toast({
            title: "Erro ao buscar leads",
            description,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

      console.log('✅ API returned leads:', data?.leads?.length || 0);
        
        // Always log the search, regardless of result count
        const resultsCount = data?.leads?.length || 0;
        const leadsToSave = data?.leads || [];
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Save search log with results
            const { error: logError } = await supabase
              .from("search_logs")
              .insert({
                user_id: user.id,
                user_email: user.email || "",
                search_type: "leads",
                search_config: searchConfig as any,
                results_count: resultsCount,
                results: leadsToSave as any,
              });
            if (logError) console.error("Error saving search log:", logError);

            // Also persist leads to companies table for future reuse
            if (leadsToSave.length > 0) {
              const companyRows = leadsToSave
                .filter((l: any) => l.name && l.phone)
                .map((l: any) => {
                  // Extract city/state from address
                  const parts = (l.address || '').split(',').map((p: string) => p.trim());
                  let cidade = '', estado = '';
                  for (const part of parts) {
                    const match = part.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
                    if (match) { cidade = match[1].trim(); estado = match[2].trim(); break; }
                  }
                  return {
                    cnpj: null,
                    razao_social: l.name,
                    nome_fantasia: l.name,
                    telefone_1: l.phone || null,
                    telefone_2: null,
                    email: l.email || null,
                    descricao_cnae: l.category || null,
                    endereco: l.address || null,
                    cidade: cidade || null,
                    estado: estado || null,
                    situacao_cadastral: 'ATIVA',
                  };
                });
              
              if (companyRows.length > 0) {
                // Use upsert-like approach: insert and ignore conflicts on nome_fantasia+cidade
                const { error: compErr } = await supabase
                  .from("companies")
                  .insert(companyRows);
                if (compErr) console.error("Error saving to companies:", compErr);
                else console.log(`✅ Saved ${companyRows.length} leads to companies table`);
              }
            }
          }
        } catch (logErr) {
          console.error("Error logging search:", logErr);
        }

        if (data?.leads && data.leads.length > 0) {
          const sortedLeads = sortLeadsAlphabetically(data.leads);
          setLeads(sortedLeads);
          localStorage.setItem('cachedLeads', JSON.stringify(data.leads));
          localStorage.setItem('cachedSearchConfig', searchConfigStr || '');
          console.log('💾 Leads cached successfully:', data.leads.length);
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
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Leads Encontrados</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Encontramos {leads.length} leads compatíveis com seu perfil
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
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

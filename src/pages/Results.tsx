import { Building2, TrendingUp, Users, Zap, Download } from "lucide-react";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import StatsCard from "@/components/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';

interface Lead {
  id: string;
  name: string;
  address: string;
  phone: string;
  instagram?: string;
  responsible: string;
  matchScore: number;
  category: string;
  revenue: string;
  openedDate: string;
  reasons: string[];
}

const Results = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
    const excelData = leads.map((lead) => ({
      'Nome': lead.name,
      'Endereço': lead.address,
      'Telefone': lead.phone,
      'Instagram': lead.instagram || 'N/A',
      'Responsável': lead.responsible,
      'Categoria': lead.category,
      'Faturamento Estimado': lead.revenue,
      'Tempo no Mercado': lead.openedDate,
      'Score de Match (%)': lead.matchScore,
      'Motivo 1': lead.reasons[0] || '',
      'Motivo 2': lead.reasons[1] || '',
      'Motivo 3': lead.reasons[2] || '',
    }));

    // Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 30 }, // Nome
      { wch: 40 }, // Endereço
      { wch: 15 }, // Telefone
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
        // Check if we have cached leads first
        const cachedLeadsStr = localStorage.getItem('cachedLeads');
        if (cachedLeadsStr) {
          const cachedLeads = JSON.parse(cachedLeadsStr);
          console.log('📦 Using cached leads:', cachedLeads.length);
          setLeads(cachedLeads);
          setLoading(false);
          return;
        }

        // Get search configuration from localStorage
        const searchConfigStr = localStorage.getItem('leadSearchConfig');
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
        console.log('🔍 Searching with config:', searchConfig);
        
        // Call the edge function
        const { data, error } = await supabase.functions.invoke('search-leads', {
          body: {
            segment: searchConfig.selectedCustomers.join(', '),
            products: searchConfig.products,
            location: searchConfig.location,
            state: searchConfig.state,
            filters: {
              category: searchConfig.category,
              companySize: searchConfig.companySize,
            }
          }
        });

        if (error) {
          console.error('❌ Error calling search-leads:', error);
          toast({
            title: "Erro ao buscar leads",
            description: error.message || "Tente novamente mais tarde",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        console.log('✅ Received leads:', data?.leads?.length || 0);
        
        if (data?.leads && data.leads.length > 0) {
          setLeads(data.leads);
          // Cache the leads
          localStorage.setItem('cachedLeads', JSON.stringify(data.leads));
        } else if (data?.error) {
          toast({
            title: "Nenhum lead encontrado",
            description: data.error,
            variant: "destructive",
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
  }, [toast]);

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
          <Button 
            onClick={exportToExcel}
            className="gap-2 w-full sm:w-auto"
            size="lg"
          >
            <Download className="h-5 w-5" />
            <span className="hidden sm:inline">Exportar para Excel</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
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
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} {...lead} />
            ))}
          </div>
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

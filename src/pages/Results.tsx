import { Building2, TrendingUp, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import StatsCard from "@/components/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Get search configuration from localStorage
        const searchConfigStr = localStorage.getItem('leadSearchConfig');
        if (!searchConfigStr) {
          toast({
            title: "Erro",
            description: "Configure sua busca primeiro",
            variant: "destructive",
          });
          return;
        }

        const searchConfig = JSON.parse(searchConfigStr);
        
        // Call the edge function
        const { data, error } = await supabase.functions.invoke('search-leads', {
          body: {
            segment: searchConfig.selectedCustomers.join(', '),
            products: searchConfig.products,
            location: searchConfig.location,
            filters: {
              category: searchConfig.category,
              companySize: searchConfig.companySize,
            }
          }
        });

        if (error) {
          console.error('Error calling search-leads:', error);
          toast({
            title: "Erro ao buscar leads",
            description: "Tente novamente mais tarde",
            variant: "destructive",
          });
          return;
        }

        if (data?.leads) {
          setLeads(data.leads);
        }
      } catch (error) {
        console.error('Error fetching leads:', error);
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
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Leads Encontrados</h1>
          <p className="text-muted-foreground text-lg">
            Encontramos {leads.length} leads compatíveis com seu perfil
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
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
          <div className="grid gap-6 md:grid-cols-2">
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

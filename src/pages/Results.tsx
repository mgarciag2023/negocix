import { Building2, TrendingUp, Users, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import StatsCard from "@/components/StatsCard";

const Results = () => {
  const mockLeads = [
    {
      id: "1",
      name: "Pizzaria Napoli",
      address: "Rua das Flores, 123 - Centro",
      phone: "(47) 99998-8888",
      instagram: "@pizzarianapoli",
      responsible: "João Silva",
      matchScore: 92,
      category: "Restaurante",
      revenue: "R$ 30-50 mil/mês",
      openedDate: "Há 3 meses",
      reasons: [
        "Abriu há 3 meses (cliente novo no mercado)",
        "Faturamento estimado compatível com seu produto",
        "Ainda não tem fornecedor estabelecido",
        "Alto movimento nas redes sociais",
      ],
    },
    {
      id: "2",
      name: "Padaria Pão Quente",
      address: "Av. Principal, 456 - Bairro Novo",
      phone: "(47) 99997-7777",
      instagram: "@padariapqquente",
      responsible: "Maria Santos",
      matchScore: 85,
      category: "Padaria",
      revenue: "R$ 50-80 mil/mês",
      openedDate: "Há 2 anos",
      reasons: [
        "Está expandindo o cardápio recentemente",
        "Localização privilegiada com alto fluxo",
        "Cliente tradicional na região",
        "Busca novos fornecedores para crescimento",
      ],
    },
    {
      id: "3",
      name: "Bar do Zé",
      address: "Rua do Comércio, 789 - Vila Nova",
      phone: "(47) 99996-6666",
      responsible: "José Oliveira",
      matchScore: 78,
      category: "Bar",
      revenue: "R$ 20-35 mil/mês",
      openedDate: "Há 5 anos",
      reasons: [
        "Estabelecimento consolidado na região",
        "Público fiel e constante",
        "Procura melhorar mix de produtos",
      ],
    },
    {
      id: "4",
      name: "Lanchonete Sabor Rápido",
      address: "Av. Central, 321 - Centro",
      phone: "(47) 99995-5555",
      instagram: "@saborrapido",
      responsible: "Ana Paula",
      matchScore: 88,
      category: "Lanchonete",
      revenue: "R$ 25-40 mil/mês",
      openedDate: "Há 6 meses",
      reasons: [
        "Crescimento rápido nos últimos meses",
        "Ótima avaliação nas redes sociais",
        "Planeja abrir segunda unidade",
        "Busca fornecedores confiáveis",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Leads Encontrados</h1>
          <p className="text-muted-foreground text-lg">
            Encontramos {mockLeads.length} leads compatíveis com seu perfil
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <StatsCard
            title="Total de Leads"
            value={mockLeads.length}
            icon={Building2}
            trend="+12% esta semana"
            trendUp={true}
          />
          <StatsCard
            title="Alta Prioridade"
            value={mockLeads.filter(l => l.matchScore >= 85).length}
            icon={Zap}
            trend="23% do total"
            trendUp={true}
          />
          <StatsCard
            title="Match Médio"
            value="86%"
            icon={TrendingUp}
          />
          <StatsCard
            title="Novos Clientes"
            value={mockLeads.filter(l => l.openedDate?.includes("meses")).length}
            icon={Users}
          />
        </div>

        {/* Lead Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {mockLeads.map((lead) => (
            <LeadCard key={lead.id} {...lead} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Results;

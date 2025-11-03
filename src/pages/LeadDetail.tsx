import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Phone, Instagram, User, TrendingUp, Calendar, 
  ArrowLeft, Heart, MessageCircle, Mail, ExternalLink 
} from "lucide-react";
import Navbar from "@/components/Navbar";

const LeadDetail = () => {
  const { id } = useParams();

  // Mock data - in real app, fetch by id
  const lead = {
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
    description: "Pizzaria moderna com foco em pizzas artesanais e ingredientes premium. Atende principalmente o público jovem da região central.",
    hours: "Seg-Dom: 18h - 23h",
    employees: "8-12 funcionários",
    socialMedia: {
      followers: "2.3k",
      engagement: "Alto",
      lastPost: "Há 2 dias",
    },
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-success text-success-foreground";
    if (score >= 60) return "bg-primary text-primary-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <Button variant="ghost" asChild className="mb-4 md:mb-6">
          <Link to="/resultados">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos Resultados
          </Link>
        </Button>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <Card className="p-4 md:p-8">
              <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{lead.name}</h1>
                  <Badge variant="secondary" className="mb-4 text-xs">{lead.category}</Badge>
                  <div className="flex items-start text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm md:text-base">{lead.address}</span>
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground">{lead.description}</p>
                </div>
                
                <div className={`flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full flex-shrink-0 ${getScoreColor(lead.matchScore)}`}>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold">{lead.matchScore}</div>
                    <div className="text-[10px] md:text-xs">match</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6">
                <div className="p-3 md:p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                    Faturamento Estimado
                  </div>
                  <p className="text-base md:text-lg font-semibold text-foreground">{lead.revenue}</p>
                </div>
                
                <div className="p-3 md:p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                    Tempo no Mercado
                  </div>
                  <p className="text-base md:text-lg font-semibold text-foreground">{lead.openedDate}</p>
                </div>
                
                <div className="p-3 md:p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                    <User className="h-3 w-3 md:h-4 md:w-4" />
                    Funcionários
                  </div>
                  <p className="text-base md:text-lg font-semibold text-foreground">{lead.employees}</p>
                </div>
                
                <div className="p-3 md:p-4 bg-muted rounded-lg">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1">Horário</div>
                  <p className="text-base md:text-lg font-semibold text-foreground">{lead.hours}</p>
                </div>
              </div>

              <div className="bg-success-light border-l-4 border-success rounded-md p-4 md:p-6">
                <h3 className="font-semibold text-foreground text-base md:text-lg mb-3">Por que é um excelente lead:</h3>
                <ul className="space-y-2">
                  {lead.reasons.map((reason, index) => (
                    <li key={index} className="text-sm md:text-base text-foreground flex items-start">
                      <span className="text-success mr-2 text-lg md:text-xl flex-shrink-0">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card className="p-4 md:p-6">
              <h3 className="font-semibold text-foreground text-lg md:text-xl mb-4">Presença nas Redes Sociais</h3>
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="text-center p-3 md:p-4 bg-muted rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-foreground">{lead.socialMedia.followers}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Seguidores</p>
                </div>
                <div className="text-center p-3 md:p-4 bg-muted rounded-lg">
                  <p className="text-xl md:text-2xl font-bold text-foreground">{lead.socialMedia.engagement}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Engajamento</p>
                </div>
                <div className="text-center p-3 md:p-4 bg-muted rounded-lg">
                  <p className="text-base md:text-lg font-bold text-foreground">{lead.socialMedia.lastPost}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Último Post</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Contact Sidebar */}
          <div className="space-y-4 md:space-y-6">
            <Card className="p-4 md:p-6">
              <h3 className="font-semibold text-foreground text-lg md:text-xl mb-4">Informações de Contato</h3>
              
              <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground">Telefone</p>
                    <a href={`tel:${lead.phone}`} className="font-medium text-sm md:text-base text-primary hover:underline truncate block">
                      {lead.phone}
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                    <Instagram className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground">Instagram</p>
                    <a 
                      href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm md:text-base text-primary hover:underline truncate block"
                    >
                      {lead.instagram}
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                    <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground">Responsável</p>
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{lead.responsible}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 md:space-y-3">
                <Button className="w-full bg-success hover:bg-success-hover h-10 md:h-11 text-sm md:text-base" asChild>
                  <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                
                <Button variant="outline" className="w-full h-10 md:h-11 text-sm md:text-base" asChild>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Ligar
                  </a>
                </Button>
                
                <Button variant="outline" className="w-full h-10 md:h-11 text-sm md:text-base">
                  <Heart className="mr-2 h-4 w-4" />
                  Adicionar aos Favoritos
                </Button>
              </div>
            </Card>

            <Card className="p-4 md:p-6">
              <h3 className="font-semibold text-foreground text-lg md:text-xl mb-4">Sugestão de Abordagem</h3>
              <div className="bg-primary-light rounded-lg p-3 md:p-4">
                <p className="text-xs md:text-sm text-foreground leading-relaxed">
                  "Olá {lead.responsible}! Vi que a {lead.name} está crescendo bem na região. 
                  Como vocês acabaram de abrir, imagino que ainda estejam estruturando fornecedores. 
                  Trabalho com [seus produtos] e gostaria de apresentar nossas soluções. 
                  Tem um momento para conversarmos?"
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LeadDetail;

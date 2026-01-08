import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Phone, Instagram, User, TrendingUp, Calendar, 
  ArrowLeft, Heart, MessageCircle, Mail, Globe, ExternalLink, Users
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useEffect } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";

const LeadDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  // Get lead data from navigation state
  const leadData = location.state?.lead;
  const isLeadFavorite = leadData ? isFavorite(leadData.id) : false;
  
  const handleFavoriteClick = () => {
    if (!leadData) return;
    const added = toggleFavorite(leadData);
    if (added) {
      toast.success("Lead adicionado aos favoritos!");
    } else {
      toast.info("Lead removido dos favoritos");
    }
  };
  
  // Do NOT scroll to top - let the back navigation work naturally
  // The Results page will restore the scroll position
  
  // Redirect back if no lead data
  useEffect(() => {
    if (!leadData) {
      navigate('/resultados');
    }
  }, [leadData, navigate]);
  
  if (!leadData) {
    return null;
  }

  const lead = {
    ...leadData,
    description: `${leadData.category} localizado em ${leadData.address.split('-')[1] || 'região central'}. Estabelecimento com potencial para parceria comercial.`,
  };

  // Check if has real website
  const hasWebsite = lead.website && lead.website !== 'Não disponível' && lead.website.trim().length > 5;
  
  // Check if has Instagram
  const hasInstagram = lead.instagram && lead.instagram !== 'Não disponível' && lead.instagram.trim().length > 0;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-success text-success-foreground";
    if (score >= 70) return "bg-primary text-primary-foreground";
    if (score >= 55) return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excelente";
    if (score >= 70) return "Bom";
    if (score >= 55) return "Médio";
    return "Baixo";
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
                
                <div className={`flex flex-col h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full flex-shrink-0 ${getScoreColor(lead.matchScore)}`}>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-bold">{lead.matchScore}</div>
                    <div className="text-[10px] md:text-xs">{getScoreLabel(lead.matchScore)}</div>
                  </div>
                </div>
              </div>

              {/* Company Info Grid - Updated to match LeadCard */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
                {lead.companySize && (
                  <div className="p-3 md:p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                      <Users className="h-3 w-3 md:h-4 md:w-4" />
                      Porte
                    </div>
                    <p className="text-base md:text-lg font-semibold text-foreground">{lead.companySize}</p>
                  </div>
                )}
                
                {lead.employeeCount && (
                  <div className="p-3 md:p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                      <User className="h-3 w-3 md:h-4 md:w-4" />
                      Funcionários
                    </div>
                    <p className="text-base md:text-lg font-semibold text-foreground">{lead.employeeCount}</p>
                  </div>
                )}
                
                {lead.revenue && (
                  <div className="p-3 md:p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                      Faturamento
                    </div>
                    <p className="text-base md:text-lg font-semibold text-foreground">{lead.revenue}</p>
                  </div>
                )}
                
                {lead.openedDate && (
                  <div className="p-3 md:p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                      No mercado
                    </div>
                    <p className="text-base md:text-lg font-semibold text-foreground">{lead.openedDate}</p>
                  </div>
                )}
              </div>

              <div className="bg-success-light border-l-4 border-success rounded-md p-4 md:p-6">
                <h3 className="font-semibold text-foreground text-base md:text-lg mb-3">Por que é um excelente lead:</h3>
                <ul className="space-y-2">
                  {lead.reasons.map((reason: string, index: number) => (
                    <li key={index} className="text-sm md:text-base text-foreground flex items-start">
                      <span className="text-success mr-2 text-lg md:text-xl flex-shrink-0">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
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
                
                {lead.email && lead.email !== 'Não disponível' && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                      <Mail className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-muted-foreground">Email</p>
                      <a href={`mailto:${lead.email}`} className="font-medium text-sm md:text-base text-primary hover:underline truncate block">
                        {lead.email}
                      </a>
                    </div>
                  </div>
                )}
                
                {hasInstagram && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-pink-100 flex-shrink-0">
                      <Instagram className="h-4 w-4 md:h-5 md:w-5 text-pink-500" />
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
                )}
                
                {/* Website section */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                    <Globe className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground">Website</p>
                    {hasWebsite ? (
                      <a 
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm md:text-base text-primary hover:underline truncate flex items-center gap-1"
                      >
                        {lead.website.replace(/^https?:\/\//, '').split('/')[0]}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">Não possui site</span>
                    )}
                  </div>
                </div>
                
                {lead.responsible && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary-light flex-shrink-0">
                      <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-muted-foreground">Responsável</p>
                      <p className="font-medium text-sm md:text-base text-foreground truncate">{lead.responsible}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 md:space-y-3">
                {lead.hasWhatsApp && (
                  <Button className="w-full bg-success hover:bg-success-hover h-10 md:h-11 text-sm md:text-base" asChild>
                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                )}
                
                <Button variant="outline" className="w-full h-10 md:h-11 text-sm md:text-base" asChild>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Ligar
                  </a>
                </Button>
                
                <Button 
                  variant="outline" 
                  className={`w-full h-10 md:h-11 text-sm md:text-base ${isLeadFavorite ? 'border-destructive text-destructive' : ''}`}
                  onClick={handleFavoriteClick}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isLeadFavorite ? 'fill-destructive' : ''}`} />
                  {isLeadFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                </Button>
              </div>
            </Card>

            <Card className="p-4 md:p-6">
              <h3 className="font-semibold text-foreground text-lg md:text-xl mb-4">Sugestão de Abordagem</h3>
              <div className="bg-primary-light rounded-lg p-3 md:p-4">
                <p className="text-xs md:text-sm text-foreground leading-relaxed">
                  "Olá{lead.responsible ? ` ${lead.responsible}` : ''}! Vi que a {lead.name} está crescendo bem na região. 
                  {lead.openedDate && lead.openedDate.includes('meses') ? 
                    ' Como vocês abriram recentemente, imagino que ainda estejam estruturando fornecedores.' :
                    ' Gostaria de apresentar uma proposta que pode agregar valor ao seu negócio.'
                  } 
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
import { MapPin, Phone, Instagram, User, Users, TrendingUp, Calendar, Mail, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { useLeadContactState } from "@/hooks/useLeadContactState";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import LeadContactStatus from "@/components/LeadContactStatus";

interface LeadCardProps {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  instagram?: string;
  website?: string | null;
  responsible?: string;
  matchScore: number;
  reasons: string[];
  revenue?: string;
  openedDate?: string;
  category: string;
  employeeCount?: string;
  companySize?: string;
  hasWhatsApp?: boolean;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
}

const LeadCard = ({
  id,
  name,
  address,
  phone,
  email,
  instagram,
  website,
  responsible,
  matchScore,
  reasons,
  revenue,
  openedDate,
  category,
  employeeCount,
  companySize,
  hasWhatsApp,
  cnpj,
}: LeadCardProps) => {
  const { saveScrollPosition } = useScrollPosition();
  const { getContactState, setContactStatus, setInterestStatus } = useLeadContactState();
  const { saveLead, isLeadSaved } = useSavedLeads();
  
  const { contactStatus, interestStatus } = getContactState(id);
  const isSaved = isLeadSaved(id);
  
  const handleSaveLead = () => {
    const lead = {
      id, name, address, phone, email, instagram, website, responsible,
      matchScore, reasons, revenue, openedDate: openedDate, category, employeeCount, companySize, hasWhatsApp
    };
    saveLead(lead);
  };
  
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

  // Check if has real website (not null, not empty, not "Não disponível")
  const hasWebsite = website && website !== 'Não disponível' && website.trim().length > 5;
  
  // Check if has Instagram
  const hasInstagram = instagram && instagram !== 'Não disponível' && instagram.trim().length > 0;
  
  return (
    <Card className="p-4 md:p-6 hover:shadow-card-hover transition-all duration-300 relative">
      {/* Saved Badge */}
      {isSaved && (
        <Badge className="absolute top-2 right-2 bg-success text-success-foreground text-xs">
          Salvo
        </Badge>
      )}
      
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-1 truncate pr-8">{name}</h3>
          <Badge variant="secondary" className="mb-2 text-xs">{category}</Badge>
          <div className="flex items-start text-muted-foreground text-xs md:text-sm">
            <MapPin className="h-3 w-3 md:h-4 md:w-4 mr-1 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{address}</span>
          </div>
        </div>
        
        <div className={`flex flex-col h-16 w-16 md:h-18 md:w-18 items-center justify-center rounded-full flex-shrink-0 ${getScoreColor(matchScore)}`}>
          <div className="text-center">
            <div className="text-xl md:text-2xl font-bold">{matchScore}</div>
            <div className="text-[9px] md:text-[10px]">{getScoreLabel(matchScore)}</div>
          </div>
        </div>
      </div>
      
      {/* Reasons section */}
      <div className="bg-success-light border-l-4 border-success rounded-md p-3 md:p-4 mb-4">
        <h4 className="font-semibold text-foreground mb-2 text-sm md:text-base">Por que é um bom lead:</h4>
        <ul className="space-y-1">
          {reasons.map((reason, index) => (
            <li key={index} className="text-xs md:text-sm text-foreground flex items-start">
              <span className="text-success mr-2 flex-shrink-0">✓</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Company Info Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
        {cnpj && (
          <div className="flex items-center gap-2 text-xs md:text-sm col-span-2">
            <span className="text-muted-foreground text-[10px]">CNPJ:</span>
            <span className="text-foreground font-medium font-mono">{cnpj}</span>
          </div>
        )}
        {companySize && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Users className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[10px]">Porte</span>
              <span className="text-foreground font-medium">{companySize}</span>
            </div>
          </div>
        )}
        {employeeCount && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <User className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[10px]">Funcionários</span>
              <span className="text-foreground font-medium">{employeeCount}</span>
            </div>
          </div>
        )}
        {revenue && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[10px]">Faturamento</span>
              <span className="text-foreground font-medium">{revenue}</span>
            </div>
          </div>
        )}
        {openedDate && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Calendar className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[10px]">No mercado</span>
              <span className="text-foreground font-medium">{openedDate}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Contact Info */}
      <div className="space-y-2 mb-4 p-3 border border-border rounded-lg">
        <h4 className="font-semibold text-foreground text-xs mb-2">Contato</h4>
        
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <Phone className="h-3 w-3 md:h-4 md:w-4 text-primary flex-shrink-0" />
          <a href={`tel:${phone}`} className="text-primary hover:underline truncate font-medium">{phone}</a>
        </div>
        
        {email && email !== 'Não disponível' && email.length > 0 && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Mail className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
            <a href={`mailto:${email}`} className="text-primary hover:underline truncate">{email}</a>
          </div>
        )}
        
        {hasInstagram && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Instagram className="h-3 w-3 md:h-4 md:w-4 text-pink-500 flex-shrink-0" />
            <a 
              href={`https://instagram.com/${instagram!.replace('@', '')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline truncate"
            >
              {instagram}
            </a>
          </div>
        )}
        
        {/* Website section - only show if has real website */}
        {hasWebsite && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Globe className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
            <a 
              href={website!} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline truncate flex items-center gap-1"
            >
              {website!.replace(/^https?:\/\//, '').split('/')[0]}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        
        {responsible && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <User className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground truncate">{responsible}</span>
          </div>
        )}
      </div>
      
      {/* Contact Status Control */}
      <div className="mb-4 p-3 border border-border rounded-lg bg-muted/20">
        <h4 className="font-semibold text-foreground text-xs mb-2">Controle de Contato</h4>
        <LeadContactStatus
          leadId={id}
          contactStatus={contactStatus}
          interestStatus={interestStatus}
          onContactStatusChange={(status) => setContactStatus(id, status)}
          onInterestStatusChange={(status) => setInterestStatus(id, status)}
          onSaveLead={handleSaveLead}
          canSave={!isSaved}
        />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild className="flex-1 text-sm md:text-base h-9 md:h-10" onClick={saveScrollPosition}>
          <Link 
            to={`/lead/${id}`}
            state={{ 
              lead: { 
                id, name, address, phone, email, instagram, website, responsible, 
                matchScore, reasons, revenue, openedDate, category,
                employeeCount, companySize, hasWhatsApp
              } 
            }}
          >
            Ver Detalhes
          </Link>
        </Button>
        <Button variant="outline" asChild className="flex-1 text-sm md:text-base h-9 md:h-10">
          <a href={`tel:${phone}`}>
            Ligar
          </a>
        </Button>
        {hasWhatsApp && (
          <Button variant="outline" asChild className="flex-1 text-sm md:text-base h-9 md:h-10 border-green-500 text-green-600 hover:bg-green-50">
            <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
};

export default LeadCard;

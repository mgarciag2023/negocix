import { MapPin, Phone, Instagram, User, TrendingUp, Calendar, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useState } from "react";

interface LeadCardProps {
  id: string;
  name: string;
  address: string;
  phone: string;
  instagram?: string;
  responsible?: string;
  matchScore: number;
  reasons: string[];
  revenue?: string;
  openedDate?: string;
  category: string;
}

const LeadCard = ({
  id,
  name,
  address,
  phone,
  instagram,
  responsible,
  matchScore,
  reasons,
  revenue,
  openedDate,
  category,
}: LeadCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-success text-success-foreground";
    if (score >= 60) return "bg-primary text-primary-foreground";
    return "bg-muted text-muted-foreground";
  };
  
  return (
    <Card className="p-6 hover:shadow-card-hover transition-all duration-300 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={() => setIsFavorite(!isFavorite)}
      >
        <Heart className={`h-5 w-5 ${isFavorite ? "fill-destructive text-destructive" : ""}`} />
      </Button>
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-foreground mb-1">{name}</h3>
          <Badge variant="secondary" className="mb-2">{category}</Badge>
          <div className="flex items-center text-muted-foreground text-sm">
            <MapPin className="h-4 w-4 mr-1" />
            {address}
          </div>
        </div>
        
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${getScoreColor(matchScore)}`}>
          <div className="text-center">
            <div className="text-2xl font-bold">{matchScore}</div>
            <div className="text-xs">match</div>
          </div>
        </div>
      </div>
      
      <div className="bg-success-light border-l-4 border-success rounded-md p-4 mb-4">
        <h4 className="font-semibold text-foreground mb-2">Por que é um bom lead:</h4>
        <ul className="space-y-1">
          {reasons.map((reason, index) => (
            <li key={index} className="text-sm text-foreground flex items-start">
              <span className="text-success mr-2">✓</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {revenue && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Faturamento: <span className="text-foreground font-medium">{revenue}</span></span>
          </div>
        )}
        {openedDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Abriu: <span className="text-foreground font-medium">{openedDate}</span></span>
          </div>
        )}
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <a href={`tel:${phone}`} className="text-primary hover:underline">{phone}</a>
        </div>
        {instagram && (
          <div className="flex items-center gap-2 text-sm">
            <Instagram className="h-4 w-4 text-muted-foreground" />
            <a href={`https://instagram.com/${instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{instagram}</a>
          </div>
        )}
        {responsible && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{responsible}</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link to={`/lead/${id}`}>Ver Detalhes</Link>
        </Button>
        <Button variant="outline" asChild className="flex-1">
          <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
            Contatar
          </a>
        </Button>
      </div>
    </Card>
  );
};

export default LeadCard;

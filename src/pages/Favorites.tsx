import { Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";
import LeadCard from "@/components/LeadCard";

const Favorites = () => {
  const { favorites } = useFavorites();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Meus Favoritos</h1>
          <p className="text-muted-foreground text-base md:text-lg">
            {favorites.length > 0 
              ? `${favorites.length} lead${favorites.length > 1 ? 's' : ''} salvo${favorites.length > 1 ? 's' : ''}`
              : 'Leads que você salvou para acompanhamento'
            }
          </p>
        </div>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Nenhum lead favoritado ainda
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Quando você adicionar leads aos favoritos, eles aparecerão aqui para fácil acesso
            </p>
            <Button asChild>
              <Link to="/resultados">
                Ver Leads Disponíveis
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {favorites.map((lead) => (
              <LeadCard
                key={lead.id}
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
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Favorites;

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Search, MapPin, Briefcase, Phone, MessageSquare } from "lucide-react";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-hero py-12 md:py-20 text-white">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-4 md:mb-6 text-3xl md:text-5xl font-bold leading-tight">
                Encontre Representantes e Profissionais
              </h1>
              <p className="mb-6 md:mb-8 text-base md:text-xl text-white/90">
                Conecte-se com representantes comerciais, engenheiros, arquitetos, contadores e outros profissionais qualificados para sua empresa.
              </p>
              <Button size="lg" asChild className="bg-success hover:bg-success-hover text-white shadow-success">
                <Link to="/search-representatives">
                  <Search className="mr-2 h-5 w-5" />
                  Começar Busca
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">
              Como Funciona
            </h2>
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary-light">
                  <Briefcase className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Escolha o Segmento</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Selecione entre representantes comerciais ou profissionais liberais
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-success-light">
                  <MapPin className="h-7 w-7 md:h-8 md:w-8 text-success" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Defina a Região</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Filtre por estado e cidade para encontrar profissionais perto de você
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary-light">
                  <Users className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Veja os Resultados</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Receba uma lista de profissionais com nome, contato e área de atuação
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-success-light">
                  <Phone className="h-7 w-7 md:h-8 md:w-8 text-success" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Entre em Contato</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Ligue ou envie mensagem diretamente pelo WhatsApp
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Segments Section */}
        <section className="bg-muted py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-foreground">
              Profissionais Disponíveis
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 max-w-4xl mx-auto">
              {[
                "Representantes Comerciais",
                "Engenheiros",
                "Arquitetos",
                "Contadores",
                "Eletricistas",
                "Advogados",
                "Médicos",
                "Dentistas",
                "Nutricionistas",
                "Psicólogos",
              ].map((segment) => (
                <div
                  key={segment}
                  className="bg-card rounded-lg p-3 md:p-4 text-center border shadow-sm"
                >
                  <span className="text-sm md:text-base font-medium text-foreground">{segment}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary-light py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-3 md:mb-4 text-2xl md:text-3xl font-bold text-foreground">
              Encontre o Profissional Ideal
            </h2>
            <p className="mb-6 md:mb-8 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Representantes comerciais para expandir suas vendas ou profissionais liberais para projetos específicos.
            </p>
            <Button size="lg" asChild className="bg-success hover:bg-success-hover shadow-success">
              <Link to="/search-representatives">
                <Search className="mr-2 h-5 w-5" />
                Buscar Agora
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Target, TrendingUp, Zap, MessageSquare, Sparkles, Users, Package } from "lucide-react";
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
                Encontre Clientes, Representantes e Crie Abordagens Perfeitas
              </h1>
              <p className="mb-6 md:mb-8 text-base md:text-xl text-white/90">
                IA poderosa que encontra os melhores leads, representantes comerciais e cria abordagens profissionais personalizadas.
                Economize tempo e converta mais vendas.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center flex-wrap">
                <Button size="lg" asChild className="bg-success hover:bg-success-hover text-white shadow-success w-full sm:w-auto">
                  <Link to="/configuracao">
                    <Target className="mr-2 h-5 w-5" />
                    Buscar Leads
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="bg-white/10 text-white border-white/30 hover:bg-white/20 w-full sm:w-auto">
                  <Link to="/search-representatives">
                    <Users className="mr-2 h-5 w-5" />
                    Buscar Representantes
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="bg-white/10 text-white border-white/30 hover:bg-white/20 w-full sm:w-auto">
                  <Link to="/search-suppliers">
                    <Package className="mr-2 h-5 w-5" />
                    Buscar Fornecedores
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="bg-white/10 text-white border-white/30 hover:bg-white/20 w-full sm:w-auto">
                  <Link to="/abordagem">
                    <Sparkles className="mr-2 h-5 w-5" />
                    Criar Abordagem
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary-light">
                  <Zap className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Busca Inteligente</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Encontre leads reais do Google Maps com dados verificados e atualizados
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-success-light">
                  <Target className="h-7 w-7 md:h-8 md:w-8 text-success" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Alta Precisão</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Score de compatibilidade e filtros avançados para encontrar o cliente ideal
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary-light">
                  <MessageSquare className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Abordagens com IA</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Crie mensagens profissionais e personalizadas para cada cliente
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-success-light">
                  <TrendingUp className="h-7 w-7 md:h-8 md:w-8 text-success" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-bold text-foreground">Mais Conversões</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Aborde os clientes certos com a mensagem certa e feche mais negócios
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary-light py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-3 md:mb-4 text-2xl md:text-3xl font-bold text-foreground">
              Pronto para Revolucionar Suas Vendas?
            </h2>
            <p className="mb-6 md:mb-8 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Encontre clientes em segundos e crie abordagens que realmente convertem. 
              Tudo com inteligência artificial.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild className="bg-success hover:bg-success-hover shadow-success w-full sm:w-auto">
                <Link to="/configuracao">
                  <Building2 className="mr-2 h-5 w-5" />
                  Começar Busca
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link to="/abordagem">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Criar Abordagem
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;

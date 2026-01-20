import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Target, TrendingUp, Zap, MessageSquare, Sparkles, Users, Package, ArrowRight, Star, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 md:py-28">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-hero" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-glow/20 rounded-full blur-3xl animate-float" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-success-glow/10 rounded-full blur-3xl animate-pulse-soft" />
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-2 h-2 bg-primary-foreground/40 rounded-full animate-bounce-gentle" />
          <div className="absolute top-40 right-20 w-3 h-3 bg-success-glow/60 rounded-full animate-bounce-gentle" style={{ animationDelay: "0.5s" }} />
          <div className="absolute bottom-32 left-1/4 w-2 h-2 bg-accent/50 rounded-full animate-bounce-gentle" style={{ animationDelay: "1s" }} />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 animate-fade-in-down">
                <Star className="h-4 w-4 text-warning" fill="currentColor" />
                <span className="text-sm text-primary-foreground/90 font-medium">Plataforma líder em prospecção</span>
              </div>
              
              <h1 className="mb-6 text-4xl md:text-6xl font-bold leading-tight text-primary-foreground opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                Encontre Clientes e{" "}
                <span className="relative">
                  <span className="relative z-10">Fornecedores Qualificados</span>
                  <span className="absolute bottom-2 left-0 right-0 h-3 bg-success-glow/40 -rotate-1 rounded" />
                </span>
              </h1>
              
              <p className="mb-10 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                Plataforma inteligente que encontra leads qualificados e fornecedores para o seu negócio.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <Button 
                  size="lg" 
                  asChild 
                  className="bg-success hover:bg-success-hover text-success-foreground shadow-success hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group text-base h-14 px-8 rounded-xl"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <Link to="/configuracao" onClick={() => window.scrollTo(0, 0)}>
                    <Target className="mr-2 h-5 w-5" />
                    Buscar Leads
                    <ArrowRight className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild 
                  className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/20 hover:-translate-y-1 transition-all duration-300 text-base h-14 px-8 rounded-xl backdrop-blur-sm"
                >
                  <Link to="/search-suppliers" onClick={() => window.scrollTo(0, 0)}>
                    <Package className="mr-2 h-5 w-5" />
                    Buscar Fornecedores
                  </Link>
                </Button>
              </div>
              
              {/* Stats */}
              <div className="mt-16 grid grid-cols-2 gap-8 max-w-xs mx-auto opacity-0 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary-foreground">150+</div>
                  <div className="text-sm text-primary-foreground/60">Leads/busca</div>
                </div>
                <div className="text-center border-l border-primary-foreground/20">
                  <div className="text-2xl md:text-3xl font-bold text-primary-foreground">22</div>
                  <div className="text-sm text-primary-foreground/60">Países</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              <path d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="hsl(var(--background))"/>
            </svg>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 md:py-28 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-light text-primary text-sm font-semibold mb-4">
                Por que escolher nossa plataforma
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ferramentas Poderosas para{" "}
                <span className="text-gradient">Vender Mais</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Tudo que você precisa para encontrar clientes e fechar negócios
              </p>
            </div>
            
            <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Zap,
                  title: "Busca Inteligente",
                  description: "Leads reais do Google Maps com dados verificados e atualizados em tempo real",
                  color: "primary",
                  delay: "0.1s"
                },
                {
                  icon: Target,
                  title: "Alta Precisão",
                  description: "Score de confiança e filtros avançados para encontrar o cliente ideal",
                  color: "success",
                  delay: "0.2s"
                },
                {
                  icon: MessageSquare,
                  title: "Abordagens IA",
                  description: "Mensagens personalizadas e profissionais geradas por inteligência artificial",
                  color: "accent",
                  delay: "0.3s"
                },
                {
                  icon: TrendingUp,
                  title: "Mais Conversões",
                  description: "Aborde os clientes certos com a mensagem certa e aumente suas vendas",
                  color: "success",
                  delay: "0.4s"
                }
              ].map((feature, index) => (
                <div 
                  key={index} 
                  className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-2 opacity-0 animate-fade-in-up border border-border/50"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className={`relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl ${
                    feature.color === 'primary' ? 'bg-primary-light' : 
                    feature.color === 'success' ? 'bg-success-light' : 
                    'bg-accent-light'
                  } group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`h-7 w-7 ${
                      feature.color === 'primary' ? 'text-primary' : 
                      feature.color === 'success' ? 'text-success' : 
                      'text-accent'
                    }`} />
                  </div>
                  
                  <h3 className="relative mb-2 text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="relative text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 bg-gradient-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.05),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--success)/0.05),transparent_50%)]" />
          
          <div className="container mx-auto px-4 relative">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-success-light text-success text-sm font-semibold mb-4">
                Simples e Rápido
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Como Funciona
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: "01", title: "Configure", desc: "Escolha o segmento e localização dos leads" },
                { step: "02", title: "Busque", desc: "Nossa IA encontra os melhores clientes" },
                { step: "03", title: "Venda", desc: "Use abordagens personalizadas para converter" },
              ].map((item, index) => (
                <div 
                  key={index} 
                  className="relative text-center opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${0.1 + index * 0.15}s` }}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary text-primary-foreground text-2xl font-bold mb-4 shadow-primary">
                    {item.step}
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-primary/30" />
                  )}
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-primary opacity-[0.03]" />
          
          <div className="container mx-auto px-4 relative">
            <div className="max-w-4xl mx-auto bg-gradient-card rounded-3xl p-8 md:p-12 shadow-xl border border-border/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-success/10 to-transparent rounded-full blur-3xl" />
              
              <div className="relative text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Pronto para Revolucionar Suas Vendas?
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                  Encontre clientes em segundos e crie abordagens que realmente convertem.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg" 
                    asChild 
                    className="bg-gradient-primary hover:opacity-90 shadow-primary hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-base h-14 px-8 rounded-xl"
                  >
                    <Link to="/configuracao" onClick={() => window.scrollTo(0, 0)}>
                      <Building2 className="mr-2 h-5 w-5" />
                      Começar Agora
                    </Link>
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    asChild 
                    className="border-2 hover:-translate-y-1 transition-all duration-300 text-base h-14 px-8 rounded-xl"
                  >
                    <Link to="/search-suppliers" onClick={() => window.scrollTo(0, 0)}>
                      <Package className="mr-2 h-5 w-5" />
                      Buscar Fornecedores
                    </Link>
                  </Button>
                </div>
                
                <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Sem cadastro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Resultados reais</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>IA avançada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;

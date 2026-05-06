import { Target, Database, Shield, Zap, MessageSquare, Building2, MapPin, Globe, TrendingUp, Users, User, Phone, Mail, Sparkles, Download, FileSpreadsheet, FileText, Search, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import exportIllustration from "@/assets/trial-export-illustration.jpg";

const features = [
  { icon: Target, title: "Empresas Filtradas", desc: "Encontre empresas por CNAE, cidade e porte com dados prontos pra prospecção.", gradient: "from-teal-400 to-blue-400" },
  { icon: Shield, title: "Contatos dos Compradores", desc: "Tenha acesso a WhatsApp, e-mail e telefone de quem realmente compra.", gradient: "from-teal-400 to-emerald-400" },
  { icon: Zap, title: "Abordagem Direta", desc: "Entre em contato com clientes qualificados sem perder tempo com intermediários.", gradient: "from-blue-400 to-teal-400" },
];

const steps = [
  { n: "1", icon: Target, title: "Escolha o cliente certo", desc: "Você informa o tipo de cliente, a região e qual é a sua representada, e a Negocix busca as melhores empresas para você mandar mensagem." },
  { n: "2", icon: Database, title: "Dados prontos para contato", desc: "Você recebe as principais informações da empresa: CNPJ, WhatsApp, telefone, e-mail do comprador, site, localização e Instagram, tudo organizado e fácil de usar." },
  { n: "3", icon: MessageSquare, title: "Fale com quem decide", desc: "Com os contatos certos em mãos, você fala direto com o decisor, economiza tempo e aumenta suas chances de fechar mais vendas." },
];

const companyFields = [
  { icon: Building2, label: "Nome Fantasia" },
  { icon: Building2, label: "Razão Social" },
  { icon: Building2, label: "CNPJ" },
  { icon: MapPin, label: "Endereço Completo" },
  { icon: Globe, label: "Website" },
  { icon: TrendingUp, label: "Faturamento" },
  { icon: Users, label: "Porte" },
  { icon: Users, label: "Nº Funcionários" },
];

const contactFields = [
  { icon: User, label: "Nome completo do comprador" },
  { icon: MessageSquare, label: "WhatsApp" },
  { icon: Phone, label: "Telefone" },
  { icon: Mail, label: "E-mail" },
];

const exportFormats = [
  { name: "Excel", desc: "Exportar em Excel", bgColor: "bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", nameColor: "text-emerald-600", icon: FileSpreadsheet },
  { name: "Planilhas", desc: "Exportar em Planilhas", bgColor: "bg-slate-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-700", nameColor: "text-foreground", icon: FileSpreadsheet },
  { name: "PDF", desc: "Exportar em PDF", bgColor: "bg-slate-50", iconBg: "bg-red-100", iconColor: "text-red-600", nameColor: "text-foreground", icon: FileText },
];

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const Reveal = ({ children, delay = 0, className = "" }: RevealProps) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}
    >
      {children}
    </div>
  );
};

interface TrialInfoSectionsProps {
  onStart: () => void;
}

const TrialInfoSections = ({ onStart }: TrialInfoSectionsProps) => {
  return (
    <div className="w-full">
      {/* 1. O que é a Negocix */}
      <section className="py-14 md:py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-5 max-w-xl md:max-w-5xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
                O que é a <span className="text-success">Negocix</span>?
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                A Negocix é uma <strong className="text-foreground">Ferramenta de Prospecção</strong> criada para ajudar Representantes Comerciais a encontrarem clientes com mais rapidez e eficiência.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm border border-slate-100 overflow-hidden relative h-full">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mb-4">
                    <f.icon className="h-7 w-7 text-success" />
                  </div>
                  <h3 className="text-xl font-bold text-success mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                  {/* Bottom gradient bar */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${f.gradient}`} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 3 Passos Simples */}
      <section className="py-14 md:py-20 bg-white">
        <div className="container mx-auto px-5 max-w-xl md:max-w-5xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-5xl font-extrabold text-success mb-3 tracking-tight">3 Passos Simples</h2>
              <p className="text-muted-foreground text-base md:text-lg">Veja como é fácil encontrar seus próximos clientes</p>
            </div>
          </Reveal>

          <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="relative">
                  {/* Step number */}
                  <div className="absolute -top-4 -left-1 md:-left-2 w-10 h-10 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center shadow-md z-10">
                    {s.n}
                  </div>
                  {/* Card */}
                  <div className="bg-white rounded-2xl p-6 pt-8 text-center shadow-sm border border-slate-100 h-full ml-2 md:ml-0">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-success/10 mb-4">
                      <s.icon className="h-7 w-7 text-success" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-3">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Você recebe tudo pronto */}
      <section className="py-14 md:py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-5 max-w-xl md:max-w-3xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 leading-tight tracking-tight">
                Você recebe <span className="text-success italic">tudo pronto</span> pra fechar negócio!
              </h2>
              <p className="text-base md:text-lg text-muted-foreground">
                Chegue na conversa sabendo com quem falar, quanto a empresa fatura e como vender.
              </p>
              <div className="flex items-center justify-center my-6">
                <div className="h-px bg-border flex-1 max-w-[80px]" />
                <Sparkles className="h-5 w-5 text-success mx-3" />
                <div className="h-px bg-border flex-1 max-w-[80px]" />
              </div>
              <p className="text-muted-foreground">Essas são todas as informações que você recebe por cada lead:</p>
            </div>
          </Reveal>

          {/* Sobre a Empresa */}
          <Reveal>
            <div className="bg-white rounded-2xl p-5 md:p-6 mb-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Sobre a Empresa</h3>
              </div>
              <div className="space-y-2">
                {companyFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50/80 border border-slate-100/80">
                    <f.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-foreground text-sm">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Contato do Comprador */}
          <Reveal delay={100}>
            <div className="bg-success/5 rounded-2xl p-5 md:p-6 border border-success/20 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-success" />
                <h3 className="font-bold text-foreground">Contato do Comprador</h3>
              </div>
              <div className="space-y-2">
                {contactFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-slate-100/60">
                    <f.icon className="h-4 w-4 text-success flex-shrink-0" />
                    <span className="font-medium text-foreground text-sm">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. Exporte para qualquer formato */}
      <section className="py-14 md:py-20 bg-gradient-to-b from-slate-200/60 to-slate-300/40">
        <div className="container mx-auto px-5 max-w-xl md:max-w-3xl">
          <Reveal>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-success/10 border border-success/30">
                <Download className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold text-success">Exportação Fácil</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 leading-tight tracking-tight">
                Exporte seus clientes para{" "}
                <span className="text-success">qualquer formato</span>
              </h2>
              <p className="text-base md:text-lg text-muted-foreground">Baixe suas listas de clientes em:</p>
            </div>
          </Reveal>

          <div className="space-y-3 mb-8">
            {exportFormats.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className={`${f.bgColor} rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-slate-200/50`}>
                  <div className={`w-12 h-12 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${f.nameColor}`}>{f.name}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="rounded-2xl overflow-hidden border border-slate-200/50 shadow-sm bg-white">
              <img
                src={exportIllustration}
                alt="Profissionais usando a plataforma Negocix para exportar leads"
                loading="lazy"
                width={1024}
                height={768}
                className="w-full h-auto"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-24 relative overflow-hidden bg-gradient-hero">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary-glow/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />

        <div className="container mx-auto px-5 max-w-2xl relative z-10">
          <Reveal>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
                <Sparkles className="h-4 w-4 text-warning" />
                <span className="text-sm text-primary-foreground/90 font-medium">Pronto para começar?</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-extrabold text-primary-foreground mb-4 leading-tight tracking-tight">
                Faça sua{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">primeira pesquisa grátis</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-success-glow/40 -rotate-1 rounded" />
                </span>
              </h2>

              <p className="text-primary-foreground/80 text-base md:text-lg mb-8">
                Veja na prática como a Negocix encontra leads qualificados para o seu negócio.
              </p>

              <Button
                size="lg"
                onClick={onStart}
                className="bg-success hover:bg-success-hover text-success-foreground shadow-success hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group text-base h-14 px-10 rounded-xl w-full sm:w-auto"
              >
                <Search className="mr-2 h-5 w-5" />
                Experimentar Grátis
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-primary-foreground/60 flex-wrap">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span>Sem cadastro</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span>Dados reais</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span>100% grátis</span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default TrialInfoSections;
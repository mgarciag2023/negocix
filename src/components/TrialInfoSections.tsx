import { Target, Database, Shield, Zap, MessageSquare, Building2, MapPin, Globe, TrendingUp, Users, User, Phone, Mail, Sparkles, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import exportIllustration from "@/assets/trial-export-illustration.jpg";

const features = [
  { icon: Target, title: "Empresas Filtradas", desc: "Encontre empresas por CNAE, cidade e porte com dados prontos pra prospecção." },
  { icon: Shield, title: "Contatos dos Compradores", desc: "Tenha acesso a WhatsApp, e-mail e telefone de quem realmente compra." },
  { icon: Zap, title: "Abordagem Direta", desc: "Entre em contato com clientes qualificados sem perder tempo com intermediários." },
  { icon: MessageSquare, title: "Mais Conversões", desc: "Fale com decisores e aumente suas chances de fechar mais negócios." },
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
  { name: "Excel", desc: "Exportar em Excel", color: "from-emerald-500 to-emerald-600", icon: FileSpreadsheet },
  { name: "Planilhas", desc: "Exportar em Planilhas", color: "from-green-500 to-green-600", icon: FileSpreadsheet },
  { name: "PDF", desc: "Exportar em PDF", color: "from-red-500 to-red-600", icon: FileText },
];

const TrialInfoSections = () => {
  return (
    <div className="bg-background w-full">
      {/* 1. O que é a Negocix */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              O que é a <span className="text-success">Negocix</span>?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              A Negocix é uma <strong className="text-foreground">Ferramenta de Prospecção</strong> criada para ajudar Representantes Comerciais a encontrarem clientes com mais rapidez e eficiência.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {features.map((f, i) => (
              <Card key={i} className="p-6 md:p-8 text-center border-border/50 shadow-card hover:shadow-card-hover transition-all">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mb-4">
                  <f.icon className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 3 Passos Simples */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-bold text-success mb-3">3 Passos Simples</h2>
            <p className="text-muted-foreground text-base md:text-lg">Veja como é fácil encontrar seus próximos clientes</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={i} className="relative p-6 md:p-8 text-center border-border/50 shadow-card">
                <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shadow-lg">
                  {s.n}
                </div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mt-2 mb-4">
                  <s.icon className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Você recebe tudo pronto */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              Você recebe <span className="text-success">tudo</span>{" "}
              <span className="text-primary">pronto</span> pra fechar negócio!
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

          {/* Sobre a Empresa */}
          <Card className="p-5 md:p-6 mb-5 border-border/50 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-foreground">Sobre a Empresa</h3>
            </div>
            <div className="space-y-2">
              {companyFields.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40">
                  <f.icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium text-foreground text-sm">{f.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Contato do Comprador */}
          <Card className="p-5 md:p-6 border-success/30 bg-success/5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-success" />
              <h3 className="font-bold text-foreground">Contato do Comprador</h3>
            </div>
            <div className="space-y-2">
              {contactFields.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background">
                  <f.icon className="h-4 w-4 text-success flex-shrink-0" />
                  <span className="font-medium text-foreground text-sm">{f.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Exporte para qualquer formato */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-primary/10 to-primary/5">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-success/10 border border-success/30">
              <Download className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-success">Exportação Fácil</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              Exporte seus clientes para{" "}
              <span className="text-success">qualquer</span>{" "}
              <span className="text-primary">formato</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground">Baixe suas listas de clientes em:</p>
          </div>

          <div className="space-y-4 mb-8">
            {exportFormats.map((f, i) => (
              <Card key={i} className="p-5 flex items-center gap-4 border-border/50 shadow-card hover:shadow-card-hover transition-all">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <f.icon className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{f.name}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden border border-border/50 shadow-card bg-card">
            <img
              src={exportIllustration}
              alt="Profissionais usando a plataforma Negocix para exportar leads"
              loading="lazy"
              width={1024}
              height={768}
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrialInfoSections;

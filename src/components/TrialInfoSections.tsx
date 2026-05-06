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
      className={`transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${className}`}
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
    <div className="w-full" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* 1. O que é a Negocix — light gray-blue bg like reference */}
      <section className="py-14 md:py-20" style={{ background: 'linear-gradient(180deg, #edf1f7 0%, #f5f7fa 100%)' }}>
        <div className="container mx-auto px-5 max-w-xl md:max-w-5xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-[1.85rem] md:text-5xl font-extrabold tracking-tight mb-4" style={{ color: '#1a2d42' }}>
                O que é a <span style={{ color: '#2bb89d' }}>Negocix</span>?
              </h2>
              <p className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: '#5a6b7d' }}>
                A Negocix é uma <strong style={{ color: '#1a2d42' }}>Ferramenta de Prospecção</strong> criada para ajudar Representantes Comerciais a encontrarem clientes com mais rapidez e eficiência.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white rounded-2xl p-6 md:p-8 text-center overflow-hidden relative h-full" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #e0f5f0, #d4eee8)' }}>
                    <f.icon className="h-7 w-7" style={{ color: '#2bb89d' }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#2bb89d' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7a8a9a' }}>{f.desc}</p>
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${f.gradient}`} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 1.5 Base de Empresas — dark blue gradient like reference */}
      <section className="py-14 md:py-20 relative overflow-hidden" style={{ background: 'linear-gradient(170deg, #1a4a7a 0%, #1e5a8e 40%, #2468a0 70%, #1e5a8e 100%)' }}>
        <div className="container mx-auto px-5 max-w-xl md:max-w-3xl relative z-10">
          <Reveal>
            <div className="text-center mb-4">
              <h2 className="text-[1.75rem] md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
                Acesse uma das maiores Bases de{" "}
                <span style={{ color: '#2bb89d' }}>Empresas do Brasil!</span>
              </h2>
              <p className="text-lg md:text-2xl font-bold text-white/90 mb-8">
                Mais de <span style={{ color: '#2bb89d' }}>37 MILHÕES</span> de CNPJs cadastrados por todo o Brasil
              </p>
            </div>
          </Reveal>

          <div className="space-y-4 mb-8">
            {[
              { emoji: "📞", text: "Contato direto com os compradores (telefone, WhatsApp e e-mail)" },
              { emoji: "🏢", text: <>Empresas de <span className="font-bold" style={{ color: '#2bb89d' }}>TODOS</span> os segmentos e regiões do Brasil</> },
              { emoji: "✅", text: "Dados organizados e prontos para prospecção" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex items-center gap-4 p-5 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-3xl flex-shrink-0">{item.emoji}</span>
                  <p className="text-white/90 font-semibold text-base md:text-lg">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={240}>
            <p className="text-center text-xl md:text-2xl font-extrabold text-white">
              Nunca mais fique sem empresas para prospectar.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 2. 3 Passos Simples — white bg */}
      <section className="py-14 md:py-20 bg-white">
        <div className="container mx-auto px-5 max-w-xl md:max-w-5xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-[1.85rem] md:text-5xl font-extrabold mb-3 tracking-tight" style={{ color: '#2bb89d' }}>3 Passos Simples</h2>
              <p className="text-base md:text-lg" style={{ color: '#7a8a9a' }}>Veja como é fácil encontrar seus próximos clientes</p>
            </div>
          </Reveal>

          <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="relative">
                  <div className="absolute -top-4 -left-1 md:-left-2 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center shadow-md z-10 text-white" style={{ background: '#2a4a6e' }}>
                    {s.n}
                  </div>
                  <div className="bg-white rounded-2xl p-6 pt-8 text-center h-full ml-2 md:ml-0" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #eef1f5' }}>
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #e0f5f0, #d4eee8)' }}>
                      <s.icon className="h-7 w-7" style={{ color: '#2bb89d' }} />
                    </div>
                    <h3 className="text-lg font-bold mb-3" style={{ color: '#1a2d42' }}>{s.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#7a8a9a' }}>{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Você recebe tudo pronto — light blue-gray bg like reference */}
      <section className="py-14 md:py-20" style={{ background: 'linear-gradient(180deg, #e8ecf2 0%, #edf1f7 100%)' }}>
        <div className="container mx-auto px-5 max-w-xl md:max-w-3xl">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-[1.85rem] md:text-5xl font-extrabold mb-4 leading-tight tracking-tight" style={{ color: '#1a2d42' }}>
                Você recebe <span className="italic" style={{ color: '#2bb89d' }}>tudo</span>{" "}
                <span className="italic" style={{ color: '#2a5a80' }}>pronto</span> pra fechar negócio!
              </h2>
              <p className="text-base md:text-lg" style={{ color: '#5a6b7d' }}>
                Chegue na conversa sabendo com quem falar, quanto a empresa fatura e como vender.
              </p>
              <div className="flex items-center justify-center my-6">
                <div className="h-px flex-1 max-w-[80px]" style={{ background: '#c8d0da' }} />
                <Sparkles className="h-5 w-5 mx-3" style={{ color: '#2bb89d' }} />
                <div className="h-px flex-1 max-w-[80px]" style={{ background: '#c8d0da' }} />
              </div>
              <p style={{ color: '#5a6b7d' }}>Essas são todas as informações que você recebe por cada lead:</p>
            </div>
          </Reveal>

          {/* Sobre a Empresa */}
          <Reveal>
            <div className="bg-white rounded-2xl p-5 md:p-6 mb-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5" style={{ color: '#2a5a80' }} />
                <h3 className="font-bold" style={{ color: '#1a2d42' }}>Sobre a Empresa</h3>
              </div>
              <div className="space-y-2">
                {companyFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#f4f6f9', border: '1px solid #ebeef3' }}>
                    <f.icon className="h-4 w-4 flex-shrink-0" style={{ color: '#2a5a80' }} />
                    <span className="font-medium text-sm" style={{ color: '#1a2d42' }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Contato do Comprador */}
          <Reveal delay={100}>
            <div className="rounded-2xl p-5 md:p-6" style={{ background: 'rgba(43, 184, 157, 0.06)', border: '1px solid rgba(43, 184, 157, 0.2)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5" style={{ color: '#2bb89d' }} />
                <h3 className="font-bold" style={{ color: '#1a2d42' }}>Contato do Comprador</h3>
              </div>
              <div className="space-y-2">
                {contactFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white" style={{ border: '1px solid #ebeef3' }}>
                    <f.icon className="h-4 w-4 flex-shrink-0" style={{ color: '#2bb89d' }} />
                    <span className="font-medium text-sm" style={{ color: '#1a2d42' }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. Exporte — blue-gray gradient bg like reference */}
      <section className="py-14 md:py-20" style={{ background: 'linear-gradient(180deg, #b8c6d6 0%, #9aafbf 50%, #8da3b5 100%)' }}>
        <div className="container mx-auto px-5 max-w-xl md:max-w-3xl">
          <Reveal>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full" style={{ background: 'rgba(43,184,157,0.12)', border: '1px solid rgba(43,184,157,0.3)' }}>
                <Download className="h-4 w-4" style={{ color: '#2bb89d' }} />
                <span className="text-sm font-semibold" style={{ color: '#2bb89d' }}>Exportação Fácil</span>
              </div>
              <h2 className="text-[1.85rem] md:text-5xl font-extrabold mb-4 leading-tight tracking-tight" style={{ color: '#1a2d42' }}>
                Exporte seus clientes para{" "}
                <span style={{ color: '#2bb89d' }}>qualquer formato</span>
              </h2>
              <p className="text-base md:text-lg" style={{ color: '#4a5a6a' }}>Baixe suas listas de clientes em:</p>
            </div>
          </Reveal>

          <div className="space-y-3 mb-8">
            {[
              { name: "Excel", desc: "Exportar em Excel", icon: FileSpreadsheet, nameColor: '#2bb89d', bg: 'rgba(255,255,255,0.5)', iconBg: '#e0f5f0', iconColor: '#1a8a6a' },
              { name: "Planilhas", desc: "Exportar em Planilhas", icon: FileSpreadsheet, nameColor: '#1a2d42', bg: 'rgba(255,255,255,0.35)', iconBg: '#e0f5f0', iconColor: '#1a8a6a' },
              { name: "PDF", desc: "Exportar em PDF", icon: FileText, nameColor: '#1a2d42', bg: 'rgba(255,255,255,0.35)', iconBg: '#fee2e2', iconColor: '#dc2626' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: f.bg, border: '1px solid rgba(255,255,255,0.3)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: f.iconBg }}>
                    <f.icon className="h-6 w-6" style={{ color: f.iconColor }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: f.nameColor }}>{f.name}</h3>
                    <p className="text-sm" style={{ color: '#5a6b7d' }}>{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '2px dashed rgba(43,184,157,0.3)', borderRadius: '16px' }}>
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

      {/* FINAL CTA — dark blue gradient */}
      <section className="py-16 md:py-24 relative overflow-hidden" style={{ background: 'linear-gradient(170deg, #0d1f36 0%, #1a4a7a 40%, #1e5a8e 80%, #1a4a7a 100%)' }}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-[100px]" style={{ background: 'rgba(43,184,157,0.1)' }} />

        <div className="container mx-auto px-5 max-w-2xl relative z-10">
          <Reveal>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-white/80 font-medium">Pronto para começar?</span>
              </div>

              <h2 className="text-[1.85rem] md:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                Faça sua{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">primeira pesquisa grátis</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 rounded" style={{ background: 'rgba(43,184,157,0.3)', transform: 'rotate(-1deg)' }} />
                </span>
              </h2>

              <p className="text-white/60 text-base md:text-lg mb-8">
                Veja na prática como a Negocix encontra leads qualificados para o seu negócio.
              </p>

              <Button
                size="lg"
                onClick={onStart}
                className="text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group text-base h-14 px-10 rounded-xl w-full sm:w-auto font-bold"
                style={{ background: 'linear-gradient(135deg, #2bb89d, #22a08a)' }}
              >
                <Search className="mr-2 h-5 w-5" />
                Experimentar Grátis
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/50 flex-wrap">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#2bb89d' }} /><span>Sem cadastro</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#2bb89d' }} /><span>Dados reais</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#2bb89d' }} /><span>100% grátis</span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default TrialInfoSections;
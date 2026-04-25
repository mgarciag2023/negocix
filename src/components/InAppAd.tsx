import { useState, useEffect, useCallback, useRef } from "react";
import { X, MessageCircle, BookOpen, Award, ArrowRight } from "lucide-react";

interface Ad {
  id: string;
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
}

const ADS: Ad[] = [
  {
    id: "suporte-whatsapp",
    icon: <MessageCircle className="h-10 w-10" />,
    accentColor: "from-emerald-500 to-green-600",
    glowColor: "shadow-emerald-500/30",
    title: "Precisa de ajuda?",
    description:
      "Está enfrentando alguma dificuldade ou gostaria de tirar alguma dúvida? Nossa equipe de suporte está pronta para te ajudar!",
    ctaLabel: "Falar com o suporte",
ctaUrl: "https://compraseguraonline.org.ua/c/d8cd080117",
  },
  {
    id: "abordagens-representantes",
    icon: <BookOpen className="h-10 w-10" />,
    accentColor: "from-blue-500 to-indigo-600",
    glowColor: "shadow-blue-500/30",
    title: "Melhores Abordagens para Representantes",
    description:
      "Descubra as técnicas de abordagem que mais convertem e aumente suas vendas como representante comercial.",
    ctaLabel: "Saber mais",
ctaUrl: "https://compraseguraonline.org.ua/c/d8cd080117",
  },
  {
    id: "metodo-representante",
    icon: <Award className="h-10 w-10" />,
    accentColor: "from-amber-500 to-orange-600",
    glowColor: "shadow-amber-500/30",
    title: "Método MCV – Como Converter Contatos em Vendas",
    description:
      "Aprenda o método completo para transformar contatos em clientes e aumentar suas vendas como representante comercial.",
    ctaLabel: "Conhecer o método",
    ctaUrl: "https://compraseguraonline.org.ua/c/d8cd080117",
  },
];

const STORAGE_KEY = "negocix_hidden_ads";
const FIRST_DELAY = 3_000;
const REPEAT_INTERVAL = 7 * 60 * 1000; // 7 minutos

function getHiddenAds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function hideAdPermanently(adId: string) {
  const hidden = getHiddenAds();
  if (!hidden.includes(adId)) {
    hidden.push(adId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  }
}

export default function InAppAd() {
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);
  const [visible, setVisible] = useState(false);
  const lastShownIndex = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickNextAd = useCallback(() => {
    const hidden = getHiddenAds();
    const available = ADS.filter((a) => !hidden.includes(a.id));
    if (available.length === 0) return null;
    let nextIdx = (lastShownIndex.current + 1) % available.length;
    lastShownIndex.current = nextIdx;
    return available[nextIdx];
  }, []);

  const showAd = useCallback(() => {
    const ad = pickNextAd();
    if (ad) {
      setCurrentAd(ad);
      setVisible(true);
    }
  }, [pickNextAd]);

  const scheduleNext = useCallback(() => {
    timerRef.current = setTimeout(() => {
      showAd();
    }, REPEAT_INTERVAL);
  }, [showAd]);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      showAd();
      scheduleNext();
    }, FIRST_DELAY);
    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showAd, scheduleNext]);

  const handleClose = () => {
    setVisible(false);
    setCurrentAd(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext();
  };

  const handleHideForever = () => {
    if (currentAd) hideAdPermanently(currentAd.id);
    setVisible(false);
    setCurrentAd(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext();
  };

  if (!visible || !currentAd) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-[92vw] max-w-lg animate-in zoom-in-95 duration-300">
        {/* Glow effect behind card */}
        <div
          className={`absolute -inset-1 rounded-3xl bg-gradient-to-br ${currentAd.accentColor} opacity-20 blur-xl`}
        />

        <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Gradient accent bar */}
          <div
            className={`h-1.5 w-full bg-gradient-to-r ${currentAd.accentColor}`}
          />

          {/* Close X */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 hover:bg-muted transition-all text-muted-foreground hover:text-foreground hover:scale-110"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-8 pt-7">
            {/* Icon */}
            <div
              className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${currentAd.accentColor} text-white shadow-lg ${currentAd.glowColor} mb-5`}
            >
              {currentAd.icon}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight mb-3">
              {currentAd.title}
            </h3>

            {/* Description */}
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              {currentAd.description}
            </p>

            {/* CTA Button */}
            <button
              onClick={() => window.open(currentAd.ctaUrl, "_blank")}
              className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r ${currentAd.accentColor} text-white font-bold text-lg shadow-lg ${currentAd.glowColor} hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}
            >
              {currentAd.ctaLabel}
              <ArrowRight className="h-5 w-5" />
            </button>

            {/* Hide forever */}
            <div className="flex justify-center mt-5">
              <button
                onClick={handleHideForever}
                className="text-sm text-foreground hover:text-foreground/70 transition-colors"
              >
                Não mostrar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

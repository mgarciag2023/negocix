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
ctaUrl: "https://checkout.pagamentocenterlink.shop/checkout/pro-ff07fe4f-5394-49aa-b0cb-235ce9245c99?utm_source=ig&utm_medium=social&utm_campaign=checkout&utm_content=link_in_bio",
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
ctaUrl: "https://checkout.pagamentocenterlink.shop/checkout/pro-ff07fe4f-5394-49aa-b0cb-235ce9245c99?utm_source=ig&utm_medium=social&utm_campaign=checkout&utm_content=link_in_bio",
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
    ctaUrl: "https://checkout.pagamentocenterlink.shop/checkout/pro-ff07fe4f-5394-49aa-b0cb-235ce9245c99?utm_source=ig&utm_medium=social&utm_campaign=checkout&utm_content=link_in_bio",
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
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-3 overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto animate-in zoom-in-95 duration-300">
        {/* Glow effect behind card */}
        <div
          className={`absolute -inset-1 rounded-3xl bg-gradient-to-br ${currentAd.accentColor} opacity-20 blur-xl pointer-events-none`}
        />

        <div className="relative bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Gradient accent bar */}
          <div
            className={`h-1.5 w-full bg-gradient-to-r ${currentAd.accentColor} shrink-0`}
          />

          {/* Close X */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-muted/80 hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5 overflow-y-auto flex-1">
            {/* Icon */}
            <div
              className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${currentAd.accentColor} text-white shadow-lg ${currentAd.glowColor} mb-3`}
            >
              {currentAd.icon}
            </div>

            {/* Title */}
            <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight mb-2 break-words">
              {currentAd.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 break-words">
              {currentAd.description}
            </p>

            {/* CTA Button */}
            <button
              onClick={() => window.open(currentAd.ctaUrl, "_blank")}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r ${currentAd.accentColor} text-white font-bold text-sm sm:text-base shadow-lg ${currentAd.glowColor} active:scale-[0.98] transition-all duration-200`}
            >
              <span className="break-words text-center">{currentAd.ctaLabel}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>

            {/* Hide forever */}
            <div className="flex justify-center mt-3">
              <button
                onClick={handleHideForever}
                className="text-xs text-foreground hover:text-foreground/70 transition-colors"
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

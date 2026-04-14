import { useState, useEffect, useCallback, useRef } from "react";
import { X, MessageCircle, BookOpen, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Ad {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
}

const ADS: Ad[] = [
  {
    id: "suporte-whatsapp",
    icon: <MessageCircle className="h-8 w-8 text-green-500" />,
    title: "Precisa de ajuda?",
    description:
      "Está enfrentando alguma dificuldade ou gostaria de tirar alguma dúvida? Nossa equipe de suporte está pronta para te ajudar!",
    ctaLabel: "Falar com o suporte",
    ctaUrl: "https://compraseguraonline.org.ua/c/50ef0bfb5f",
  },
  {
    id: "abordagens-representantes",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    title: "Melhores Abordagens para Representantes",
    description:
      "Descubra as técnicas de abordagem que mais convertem e aumente suas vendas como representante comercial.",
    ctaLabel: "Saber mais",
    ctaUrl: "#", // placeholder
  },
  {
    id: "metodo-representante",
    icon: <Award className="h-8 w-8 text-amber-500" />,
    title: "Seja um Representante Melhor",
    description:
      "Aprenda o método completo para se destacar como representante e conquistar mais clientes.",
    ctaLabel: "Conhecer o método",
    ctaUrl: "#", // placeholder
  },
];

const STORAGE_KEY = "negocix_hidden_ads";
const FIRST_DELAY = 6_000; // 6 seconds
const REPEAT_INTERVAL = 7 * 60 * 1000; // 7 minutes

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

    // round-robin through available ads
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
    // First ad after 6 seconds
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
    // Reschedule next ad
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext();
  };

  const handleHideForever = () => {
    if (currentAd) {
      hideAdPermanently(currentAd.id);
    }
    setVisible(false);
    setCurrentAd(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext();
  };

  if (!visible || !currentAd) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-[90vw] max-w-md p-6 mx-4 animate-in zoom-in-95 duration-300">
        {/* Close X */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="p-3 rounded-full bg-muted">{currentAd.icon}</div>
          <h3 className="text-lg font-bold text-foreground">
            {currentAd.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {currentAd.description}
          </p>

          <Button
            className="w-full mt-2"
            size="lg"
            onClick={() => window.open(currentAd.ctaUrl, "_blank")}
          >
            {currentAd.ctaLabel}
          </Button>

          <button
            onClick={handleHideForever}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-1"
          >
            Não mostrar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

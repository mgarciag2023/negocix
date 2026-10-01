import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Route as RouteIcon, MapPin, Navigation, Loader2, LocateFixed, ExternalLink } from "lucide-react";
import { useSavedLeads, SavedLead } from "@/hooks/useSavedLeads";
import { extractCity, geocodeAddress, optimizeRoute, buildMapsLinks, distanceKm, LatLng } from "@/lib/route";
import { toast } from "sonner";

type Stop = { lead: SavedLead; point: LatLng };

const RoutePlanner = () => {
  const [params] = useSearchParams();
  const { savedLeads, loading } = useSavedLeads();
  const cities = useMemo(() => {
    const m = new Map<string, number>();
    savedLeads.forEach((l) => { const c = extractCity(l.address); m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [savedLeads]);
  const [city, setCity] = useState<string>(params.get("cidade") || "");
  const activeCity = cities.some(([c]) => c === city) ? city : cities[0]?.[0] || "";
  const cityLeads = savedLeads.filter((l) => extractCity(l.address) === activeCity);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "asking" | "granted" | "denied">("idle");
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState("");
  const [route, setRoute] = useState<Stop[]>([]);
  const [failed, setFailed] = useState<SavedLead[]>([]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = cityLeads.length > 0 && cityLeads.every((l) => selected.has(l.id));

  const askLocation = () => {
    if (!navigator.geolocation) { setLocStatus("denied"); toast.error("Seu navegador não permite localização"); return; }
    setLocStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocStatus("granted"); toast.success("Localização permitida"); },
      () => { setLocStatus("denied"); toast.info("Sem localização: a rota começa pela primeira empresa"); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const buildRoute = async () => {
    const chosen = cityLeads.filter((l) => selected.has(l.id));
    if (chosen.length < 2) { toast.error("Selecione ao menos 2 leads"); return; }
    setBuilding(true); setRoute([]); setFailed([]);
    const ok: Stop[] = []; const bad: SavedLead[] = [];
    for (let i = 0; i < chosen.length; i++) {
      setProgress(`Localizando empresas ${i + 1}/${chosen.length}...`);
      try {
        const { point, cached } = await geocodeAddress(chosen[i].address);
        point ? ok.push({ lead: chosen[i], point }) : bad.push(chosen[i]);
        if (!cached) await new Promise((r) => setTimeout(r, 1100));
      } catch { bad.push(chosen[i]); }
    }
    const order = optimizeRoute(userLoc, ok.map((s) => s.point));
    setRoute(order.map((i) => ok[i]));
    setFailed(bad);
    setBuilding(false); setProgress("");
    if (ok.length === 0) toast.error("Não foi possível localizar os endereços");
  };

  const legs = route.map((s, i) => {
    const prev = i === 0 ? userLoc : route[i - 1].point;
    return prev ? distanceKm(prev, s.point) : 0;
  });
  const total = legs.reduce((a, b) => a + b, 0);
  const links = route.length ? buildMapsLinks(userLoc, route) : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Link to="/leads-salvos" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads salvos
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1"><RouteIcon className="h-6 w-6 text-primary" /> Roteirização</h1>
        <p className="text-sm text-muted-foreground mb-6">Escolha a cidade, marque os leads que vai visitar e veja a melhor ordem de visita.</p>

        <Card className="mb-4"><CardContent className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Cidade</p>
            <Select value={activeCity} onValueChange={(v) => { setCity(v); setSelected(new Set()); setRoute([]); }}>
              <SelectTrigger><SelectValue placeholder={loading ? "Carregando..." : "Nenhum lead salvo"} /></SelectTrigger>
              <SelectContent>
                {cities.map(([c, n]) => <SelectItem key={c} value={c}>{c} ({n})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={locStatus === "granted" ? "secondary" : "outline"} size="sm" onClick={askLocation} disabled={locStatus === "asking"}>
              {locStatus === "asking" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-1" />}
              {locStatus === "granted" ? "Localização ativa" : "Permitir minha localização"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {locStatus === "granted" ? "A rota começa de onde você está." : locStatus === "denied" ? "Localização recusada — a rota começa pela empresa mais conveniente." : "Opcional: permita para começar a rota de onde você está."}
            </span>
          </div>
        </CardContent></Card>

        {cityLeads.length > 0 && (
          <Card className="mb-4"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(cityLeads.map((l) => l.id)))} />
                Selecionar todos ({cityLeads.length})
              </label>
              <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {cityLeads.map((l) => (
                <label key={l.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} className="mt-1" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.address}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button className="w-full mt-4" onClick={buildRoute} disabled={building || selected.size < 2}>
              {building ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{progress}</> : <><Navigation className="h-4 w-4 mr-2" />Criar rota</>}
            </Button>
          </CardContent></Card>
        )}

        {!loading && savedLeads.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Salve alguns leads primeiro para montar uma rota.</CardContent></Card>
        )}

        {route.length > 0 && (
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Melhor ordem de visita</h2>
              <Badge>~{total.toFixed(1)} km em linha reta</Badge>
            </div>
            <ol className="space-y-2">
              {route.map((s, i) => (
                <li key={s.lead.id} className="flex items-start gap-3 p-2 rounded-md border border-border">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.lead.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{s.lead.address}</span></p>
                    {(i > 0 || userLoc) && <p className="text-xs text-primary mt-0.5">{legs[i].toFixed(1)} km {i === 0 ? "de você" : "da anterior"}</p>}
                  </div>
                </li>
              ))}
            </ol>
            {failed.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">Não foi possível localizar: {failed.map((f) => f.name).join(", ")}.</p>
            )}
            <div className="mt-4 space-y-2">
              {links.map((url, i) => (
                <Button key={url} asChild className="w-full">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir rota no Google Maps{links.length > 1 ? ` (parte ${i + 1}/${links.length})` : ""}
                  </a>
                </Button>
              ))}
            </div>
          </CardContent></Card>
        )}
      </main>
    </div>
  );
};

export default RoutePlanner;

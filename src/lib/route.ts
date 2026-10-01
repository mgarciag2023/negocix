const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

/** Extracts "Cidade - UF" from a free-form Brazilian address. */
export const extractCity = (address: string | null | undefined): string => {
  if (!address) return "Sem cidade";
  const parts = address.split(/[,\-–]/).map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const uf = parts[i].toUpperCase();
    if (UFS.includes(uf)) {
      const city = parts[i - 1].replace(/\d{5}-?\d{3}/, "").trim();
      if (city && !/^\d+$/.test(city)) {
        const pretty = city.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
        return `${pretty} - ${uf}`;
      }
    }
  }
  return "Sem cidade";
};

export type LatLng = { lat: number; lng: number };

const GEO_CACHE_KEY = "negocix_geocode_cache";
const readCache = (): Record<string, LatLng | null> => {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeCache = (c: Record<string, LatLng | null>) => {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch { /* quota */ }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const nominatim = async (q: string): Promise<LatLng | null> => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
};

/** Geocodes an address (free OpenStreetMap service, cached, ~1 req/s). */
export const geocodeAddress = async (address: string): Promise<{ point: LatLng | null; cached: boolean }> => {
  const cache = readCache();
  if (address in cache) return { point: cache[address], cached: true };
  let point = await nominatim(address);
  if (!point) {
    // fallback: drop street number/complement, keep street + city + UF
    const parts = address.split(",").map((p) => p.trim());
    if (parts.length > 2) {
      await sleep(1100);
      point = await nominatim(parts.slice(-3).join(", "));
    }
  }
  cache[address] = point;
  writeCache(cache);
  return { point, cached: false };
};

export const distanceKm = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Nearest-neighbour + 2-opt ordering of stops starting from `start`. Returns indices. */
export const optimizeRoute = (start: LatLng | null, stops: LatLng[]): number[] => {
  const n = stops.length;
  if (n <= 1) return stops.map((_, i) => i);
  const remaining = new Set(stops.map((_, i) => i));
  const order: number[] = [];
  let current: LatLng = start ?? stops[0];
  if (!start) { order.push(0); remaining.delete(0); }
  while (remaining.size) {
    let best = -1, bestD = Infinity;
    remaining.forEach((i) => { const d = distanceKm(current, stops[i]); if (d < bestD) { bestD = d; best = i; } });
    order.push(best); remaining.delete(best); current = stops[best];
  }
  const pt = (k: number) => (k < 0 ? start! : stops[order[k]]);
  const first = start ? 0 : 1;
  let improved = true, guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = first; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pt(i - 1), b = pt(i), c = pt(j), d = j + 1 < n ? pt(j + 1) : null;
        const before = distanceKm(a, b) + (d ? distanceKm(c, d) : 0);
        const after = distanceKm(a, c) + (d ? distanceKm(b, d) : 0);
        if (after + 1e-9 < before) {
          order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return order;
};

/** Google Maps directions links (max 9 waypoints per link). */
export const buildMapsLinks = (start: LatLng | null, stops: { point: LatLng }[]): string[] => {
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const links: string[] = [];
  let origin: LatLng | null = start;
  let i = 0;
  while (i < stops.length) {
    const chunk = stops.slice(i, i + 10);
    const dest = chunk[chunk.length - 1].point;
    const waypoints = chunk.slice(0, -1).map((s) => fmt(s.point)).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${fmt(dest)}`;
    if (origin) url += `&origin=${fmt(origin)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    links.push(url);
    origin = dest;
    i += 10;
  }
  return links;
};

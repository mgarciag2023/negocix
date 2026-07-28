import { supabase } from "@/integrations/supabase/client";

export const getDeviceId = (): string => {
  try {
    let id = localStorage.getItem("negocix_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("negocix_device_id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
};

export const getUtms = (): Record<string, string> => {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach((k) => {
      const v = p.get(k);
      if (v) out[k] = v;
    });
    // Persist first-touch UTMs so later events keep attribution
    if (Object.keys(out).length > 0) {
      localStorage.setItem("negocix_utms", JSON.stringify(out));
      return out;
    }
    const stored = localStorage.getItem("negocix_utms");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const trackEvent = async (
  eventType: string,
  config: Record<string, unknown> = {},
  resultsCount = 0,
) => {
  try {
    await (supabase as any).from("trial_analytics").insert({
      event_type: eventType.slice(0, 50),
      search_config: { ...getUtms(), path: window.location.pathname, ...config },
      results_count: resultsCount,
      device_id: getDeviceId(),
    });
  } catch (e) {
    console.error("tracking error", e);
  }
};

export const firePixel = (eventName: string, params?: Record<string, unknown>) => {
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") fbq("track", eventName, params);
  } catch {
    /* noop */
  }
};

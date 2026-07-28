import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent, firePixel } from "@/lib/tracking";

/**
 * Tracks a page_view (with UTM attribution) on every route change,
 * across the whole app — not only on /teste.
 */
const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    void trackEvent("page_view", { path: location.pathname });
    firePixel("PageView");
  }, [location.pathname]);

  return null;
};

export default PageTracker;

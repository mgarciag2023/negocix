import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { getSessionSafely } from "@/lib/auth-session";
// Index removed — root now redirects to /auth or /configuracao
import Auth from "./pages/Auth";
import Configuration from "./pages/Configuration";
import Results from "./pages/Results";
import LeadDetail from "./pages/LeadDetail";
import SavedLeads from "./pages/SavedLeads";
import CreateApproach from "./pages/CreateApproach";
import SearchRepresentatives from "./pages/SearchRepresentatives";
import RepresentativesResults from "./pages/RepresentativesResults";
import SearchSuppliers from "./pages/SearchSuppliers";
import SuppliersResults from "./pages/SuppliersResults";
import SearchCompanies from "./pages/SearchCompanies";
import Admin from "./pages/Admin";
import SearchHistory from "./pages/SearchHistory";
import NotFound from "./pages/NotFound";
import TrialSearch from "./pages/TrialSearch";
import TrialAdmin from "./pages/TrialAdmin";
import ResetPassword from "./pages/ResetPassword";
import InAppAd from "./components/InAppAd";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    // Set up listener FIRST so we catch auth events during session restore
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    const restoreSession = async () => {
      const currentSession = await getSessionSafely();
      if (!isMounted) return;
      setSession((prev) => prev ?? currentSession);
      setLoading(false);
    };

    void restoreSession();

    // Safety net: never keep the user on the spinner for more than 4s.
    // If session restore is hanging, fall through (will redirect to /auth if no session).
    safetyTimer = setTimeout(() => {
      if (!isMounted) return;
      setLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      if (safetyTimer) clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <InAppAd />
      {children}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public pages */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/teste" element={<TrialSearch />} />
          <Route path="/testes" element={<TrialSearch />} />
          <Route path="/teste/admin" element={<TrialAdmin />} />
          
          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/configuracao" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
          <Route path="/resultados" element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/lead/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
          <Route path="/leads-salvos" element={<ProtectedRoute><SavedLeads /></ProtectedRoute>} />
          <Route path="/abordagem" element={<ProtectedRoute><CreateApproach /></ProtectedRoute>} />
          <Route path="/search-representatives" element={<ProtectedRoute><SearchRepresentatives /></ProtectedRoute>} />
          <Route path="/representatives-results" element={<ProtectedRoute><RepresentativesResults /></ProtectedRoute>} />
          <Route path="/search-suppliers" element={<ProtectedRoute><SearchSuppliers /></ProtectedRoute>} />
          <Route path="/suppliers-results" element={<ProtectedRoute><SuppliersResults /></ProtectedRoute>} />
          <Route path="/buscar-empresas" element={<ProtectedRoute><SearchCompanies /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/historico" element={<ProtectedRoute><SearchHistory /></ProtectedRoute>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
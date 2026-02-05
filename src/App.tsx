import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth page - public */}
          <Route path="/auth" element={<Auth />} />
          
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
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
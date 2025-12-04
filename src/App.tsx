import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Configuration from "./pages/Configuration";
import Results from "./pages/Results";
import LeadDetail from "./pages/LeadDetail";
import Favorites from "./pages/Favorites";
import CreateApproach from "./pages/CreateApproach";
import SearchRepresentatives from "./pages/SearchRepresentatives";
import RepresentativesResults from "./pages/RepresentativesResults";
import SearchSuppliers from "./pages/SearchSuppliers";
import SuppliersResults from "./pages/SuppliersResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/configuracao" element={<Configuration />} />
          <Route path="/resultados" element={<Results />} />
          <Route path="/lead/:id" element={<LeadDetail />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/abordagem" element={<CreateApproach />} />
          <Route path="/search-representatives" element={<SearchRepresentatives />} />
          <Route path="/representatives-results" element={<RepresentativesResults />} />
          <Route path="/search-suppliers" element={<SearchSuppliers />} />
          <Route path="/suppliers-results" element={<SuppliersResults />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

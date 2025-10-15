import { Link, useLocation } from "react-router-dom";
import { Building2, FileText, Heart, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-primary">LeadFinder Pro</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Button
              variant={isActive("/configuracao") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/configuracao">
                <Settings className="mr-2 h-4 w-4" />
                Configurar Busca
              </Link>
            </Button>
            
            <Button
              variant={isActive("/resultados") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/resultados">
                <FileText className="mr-2 h-4 w-4" />
                Resultados
              </Link>
            </Button>
            
            <Button
              variant={isActive("/favoritos") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/favoritos">
                <Heart className="mr-2 h-4 w-4" />
                Favoritos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

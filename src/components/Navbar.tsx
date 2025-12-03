import { Link, useLocation } from "react-router-dom";
import { Users, Search, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-primary">RepFinder</span>
          </Link>
          
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant={isActive("/search-representatives") ? "default" : "ghost"}
              size="sm"
              className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3"
              asChild
            >
              <Link to="/search-representatives">
                <Search className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden sm:inline">Buscar</span>
              </Link>
            </Button>
            
            <Button
              variant={isActive("/favoritos") ? "default" : "ghost"}
              size="sm"
              className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3"
              asChild
            >
              <Link to="/favoritos">
                <Heart className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden sm:inline">Favoritos</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

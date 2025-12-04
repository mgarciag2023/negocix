import { Link, useLocation } from "react-router-dom";
import { Building2, Heart, Settings, Sparkles, Users, Package, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { path: "/configuracao", icon: Settings, label: "Buscar" },
    { path: "/search-representatives", icon: Users, label: "Representantes" },
    { path: "/search-suppliers", icon: Package, label: "Fornecedores" },
    { path: "/abordagem", icon: Sparkles, label: "Abordagem" },
    { path: "/favoritos", icon: Heart, label: "Favoritos" },
  ];
  
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Building2 className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-primary">Negocix</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "default" : "ghost"}
                size="sm"
                className="h-9 text-sm px-3"
                asChild
              >
                <Link to={item.path}>
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>
          
          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-1">
            {/* Quick access buttons */}
            <Button
              variant={isActive("/configuracao") ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2"
              asChild
            >
              <Link to="/configuracao">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            
            <Button
              variant={isActive("/favoritos") ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2"
              asChild
            >
              <Link to="/favoritos">
                <Heart className="h-4 w-4" />
              </Link>
            </Button>
            
            {/* Dropdown for more options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={item.path} className="flex items-center gap-2 w-full">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

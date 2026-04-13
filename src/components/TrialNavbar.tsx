import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

const TrialNavbar = () => {
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          <Link to="/teste" className="flex items-center gap-2">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Building2 className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-primary">Negocix</span>
          </Link>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            TESTE GRÁTIS
          </span>
        </div>
      </div>
    </nav>
  );
};

export default TrialNavbar;

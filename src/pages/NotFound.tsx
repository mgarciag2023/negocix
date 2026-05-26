import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleHome = () => {
    try {
      navigate("/", { replace: true });
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">Página não encontrada</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={handleHome}>Voltar para a página inicial</Button>
          <Button variant="outline" asChild>
            <Link to="/auth">Ir para login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

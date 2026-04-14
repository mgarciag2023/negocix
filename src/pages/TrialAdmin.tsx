import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Lock } from "lucide-react";

const TrialAdminPanel = lazy(() => import("@/components/TrialAdminPanel"));

const TRIAL_ADMIN_PASSWORD = "negocix2025";

const TrialAdminPage = () => {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showDialog, setShowDialog] = useState(true);

  const handleLogin = () => {
    if (password === TRIAL_ADMIN_PASSWORD) {
      setUnlocked(true);
      setShowDialog(false);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Dialog open={showDialog} onOpenChange={(open) => { if (!open) navigate("/teste"); }}>
          <DialogContent className="w-[90vw] max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" /> Acesso Restrito
              </DialogTitle>
              <DialogDescription className="text-sm">Digite a senha para acessar o painel.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoFocus
              />
              {error && <p className="text-xs text-destructive">Senha incorreta</p>}
              <Button className="w-full" onClick={handleLogin}>Entrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teste")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Painel do Simulador</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>}>
          <TrialAdminPanel />
        </Suspense>
      </main>
    </div>
  );
};

export default TrialAdminPage;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Settings, Ban, CheckCircle, Loader2, Save, Target, History, KeyRound, Trash2, Search } from "lucide-react";
import SearchLogsTable from "@/components/admin/SearchLogsTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  leads_per_search?: number;
  representatives_per_search?: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [blockReason, setBlockReason] = useState("");
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roles) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await fetchProfiles();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return;
    }

    // Fetch user lead limits
    const { data: limitsData } = await supabase
      .from("user_lead_limits")
      .select("user_id, leads_per_search, representatives_per_search");

    // Merge limits into profiles
    const profilesWithLimits = (profilesData || []).map((profile) => {
      const limit = limitsData?.find((l) => l.user_id === profile.user_id);
      return {
        ...profile,
        leads_per_search: limit?.leads_per_search || null,
        representatives_per_search: limit?.representatives_per_search || null,
      };
    });

    setProfiles(profilesWithLimits);
  };

  const toggleBlockUser = async (profile: Profile) => {
    const newBlockedStatus = !profile.is_blocked;
    
    const { error } = await supabase
      .from("profiles")
      .update({
        is_blocked: newBlockedStatus,
        blocked_at: newBlockedStatus ? new Date().toISOString() : null,
        blocked_reason: newBlockedStatus ? blockReason : null,
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do usuário",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: newBlockedStatus ? "Usuário bloqueado" : "Usuário desbloqueado",
      description: `${profile.email} foi ${newBlockedStatus ? "bloqueado" : "desbloqueado"} com sucesso`,
    });

    setBlockReason("");
    fetchProfiles();
  };


  const resetUserPassword = async () => {
    if (!passwordUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }
    
    setSavingPassword(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: passwordUser.user_id, newPassword },
      });
      
      if (error) throw error;
      
      toast({
        title: "Senha alterada",
        description: `Senha de ${passwordUser.email} alterada com sucesso`,
      });
      
      setPasswordUser(null);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível alterar a senha",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteUser = async (profile: Profile) => {
    setDeletingUserId(profile.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: profile.user_id },
      });
      if (error) throw error;
      toast({
        title: "Conta excluída",
        description: `A conta ${profile.email} foi excluída com sucesso`,
      });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível excluir a conta",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-primary">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel Admin</h1>
            <p className="text-muted-foreground">Gerencie usuários e configurações do sistema</p>
          </div>
        </div>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Estatísticas
              </CardTitle>
              <CardDescription>
                Resumo dos usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{profiles.length}</p>
                  <p className="text-sm text-muted-foreground">Total de usuários</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-destructive">
                    {profiles.filter((p) => p.is_blocked).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Usuários bloqueados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Usuários
            </CardTitle>
            <CardDescription>
              Visualize e gerencie o acesso dos usuários
            </CardDescription>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {profiles
                  .filter((p) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.email.toLowerCase().includes(q) ||
                      (p.full_name && p.full_name.toLowerCase().includes(q)) ||
                      (p.phone && p.phone.includes(q))
                    );
                  })
                  .map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.email}</TableCell>
                      <TableCell>{profile.full_name || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                      <TableCell>
                        {profile.phone ? (
                          <span className="text-sm">
                            {profile.phone.length === 11
                              ? `(${profile.phone.slice(0,2)}) ${profile.phone.slice(2,7)}-${profile.phone.slice(7)}`
                              : profile.phone.length === 10
                              ? `(${profile.phone.slice(0,2)}) ${profile.phone.slice(2,6)}-${profile.phone.slice(6)}`
                              : profile.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.is_blocked ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />
                            Bloqueado
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1 bg-success">
                            <CheckCircle className="h-3 w-3" />
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(profile.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}{" "}
                          <span className="text-muted-foreground">
                            {new Date(profile.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setPasswordUser(profile); setNewPassword(""); }}
                          >
                            <KeyRound className="h-3 w-3 mr-1" />
                            Senha
                          </Button>
                          {profile.email !== "mgarciag2023@gmail.com" && (
                            <>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant={profile.is_blocked ? "outline" : "destructive"}
                                    size="sm"
                                  >
                                    {profile.is_blocked ? "Desbloquear" : "Bloquear"}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {profile.is_blocked ? "Desbloquear usuário?" : "Bloquear usuário?"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {profile.is_blocked
                                        ? `Tem certeza que deseja desbloquear ${profile.email}?`
                                        : `Tem certeza que deseja bloquear ${profile.email}? O usuário não poderá mais acessar o sistema.`}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  {!profile.is_blocked && (
                                    <div className="space-y-2">
                                      <Label htmlFor="block-reason">Motivo do bloqueio (opcional)</Label>
                                      <Input
                                        id="block-reason"
                                        placeholder="Ex: Uso indevido do sistema"
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                      />
                                    </div>
                                  )}
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => toggleBlockUser(profile)}
                                      className={profile.is_blocked ? "" : "bg-destructive hover:bg-destructive/90"}
                                    >
                                      {profile.is_blocked ? "Desbloquear" : "Bloquear"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deletingUserId === profile.user_id}
                                  >
                                    {deletingUserId === profile.user_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                      <Trash2 className="h-3 w-3 mr-1" />
                                    )}
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir permanentemente a conta de {profile.email}? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser(profile)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Excluir permanentemente
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {profiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum usuário cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Search Logs */}
        <div className="mt-6">
          <SearchLogsTable />
        </div>


        {/* Password Reset Dialog */}
        <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para {passwordUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordUser(null)}>
                Cancelar
              </Button>
              <Button onClick={resetUserPassword} disabled={savingPassword || newPassword.length < 6}>
                {savingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Alterar Senha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};


export default Admin;
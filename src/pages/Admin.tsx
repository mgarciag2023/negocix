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
import { Shield, Users, Settings, Ban, CheckCircle, Loader2, Save, Target, History, KeyRound, Trash2 } from "lucide-react";
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

interface LeadSettings {
  leads_min: string;
  leads_max: string;
  leads_target: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<LeadSettings>({
    leads_min: "70",
    leads_max: "150",
    leads_target: "90",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userLeadLimit, setUserLeadLimit] = useState("");
  const [userRepLimit, setUserRepLimit] = useState("");
  const [savingUserLimit, setSavingUserLimit] = useState(false);
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
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
      await Promise.all([fetchProfiles(), fetchSettings()]);
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

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value");

    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }

    if (data) {
      const settingsMap: LeadSettings = {
        leads_min: "70",
        leads_max: "150",
        leads_target: "90",
      };
      data.forEach((s) => {
        if (s.setting_key in settingsMap) {
          settingsMap[s.setting_key as keyof LeadSettings] = s.setting_value;
        }
      });
      setSettings(settingsMap);
    }
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

  const saveSettings = async () => {
    setSavingSettings(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const updates = Object.entries(settings).map(([key, value]) => 
      supabase
        .from("system_settings")
        .update({ setting_value: value, updated_by: user?.id })
        .eq("setting_key", key)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Configurações salvas",
        description: "As configurações de leads foram atualizadas com sucesso",
      });
    }

    setSavingSettings(false);
  };

  const openUserLimitDialog = (profile: Profile) => {
    setEditingUser(profile);
    setUserLeadLimit(profile.leads_per_search?.toString() || "");
    setUserRepLimit(profile.representatives_per_search?.toString() || "");
  };

  const saveUserLeadLimit = async () => {
    if (!editingUser) return;
    
    setSavingUserLimit(true);
    
    const leadLimit = userLeadLimit ? parseInt(userLeadLimit) : null;
    const repLimit = userRepLimit ? parseInt(userRepLimit) : null;
    
    const hasAnyLimit = (leadLimit && leadLimit > 0) || (repLimit && repLimit > 0);
    
    if (!hasAnyLimit) {
      // Delete the limit if all empty
      const { error } = await supabase
        .from("user_lead_limits")
        .delete()
        .eq("user_id", editingUser.user_id);
      
      if (error && error.code !== "PGRST116") {
        toast({
          title: "Erro",
          description: "Não foi possível remover os limites",
          variant: "destructive",
        });
        setSavingUserLimit(false);
        return;
      }
    } else {
      const upsertData: any = {
        user_id: editingUser.user_id,
      };
      if (leadLimit && leadLimit > 0) upsertData.leads_per_search = leadLimit;
      if (repLimit && repLimit > 0) upsertData.representatives_per_search = repLimit;
      
      const { error } = await supabase
        .from("user_lead_limits")
        .upsert(upsertData, { onConflict: "user_id" });
      
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível salvar os limites",
          variant: "destructive",
        });
        setSavingUserLimit(false);
        return;
      }
    }

    toast({
      title: "Limites salvos",
      description: `Limites para ${editingUser.email} atualizados com sucesso`,
    });

    setEditingUser(null);
    setUserLeadLimit("");
    setUserRepLimit("");
    setSavingUserLimit(false);
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lead Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações de Leads
              </CardTitle>
              <CardDescription>
                Defina os limites de leads por pesquisa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="leads_min">Mínimo</Label>
                  <Input
                    id="leads_min"
                    type="number"
                    value={settings.leads_min}
                    onChange={(e) => setSettings({ ...settings, leads_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads_target">Meta</Label>
                  <Input
                    id="leads_target"
                    type="number"
                    value={settings.leads_target}
                    onChange={(e) => setSettings({ ...settings, leads_target: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads_max">Máximo</Label>
                  <Input
                    id="leads_max"
                    type="number"
                    value={settings.leads_max}
                    onChange={(e) => setSettings({ ...settings, leads_max: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>

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
                    <TableHead>Leads</TableHead>
                    <TableHead>Representantes</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
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
                        {profile.leads_per_search ? (
                          <Badge variant="secondary" className="gap-1">
                            <Target className="h-3 w-3" />
                            {profile.leads_per_search}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Padrão</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.representatives_per_search ? (
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {profile.representatives_per_search}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Padrão (30)</span>
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
                            onClick={() => openUserLimitDialog(profile)}
                          >
                            <Target className="h-3 w-3 mr-1" />
                            Limite
                          </Button>
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

        {/* User Lead Limit Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Limites por Pesquisa</DialogTitle>
              <DialogDescription>
                Defina limites personalizados para {editingUser?.email}. Deixe vazio para usar o padrão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-lead-limit">Leads por pesquisa</Label>
                <Input
                  id="user-lead-limit"
                  type="number"
                  placeholder={`Padrão: ${settings.leads_target}`}
                  value={userLeadLimit}
                  onChange={(e) => setUserLeadLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Global: Mín {settings.leads_min}, Meta {settings.leads_target}, Máx {settings.leads_max}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-rep-limit">Representantes por pesquisa</Label>
                <Input
                  id="user-rep-limit"
                  type="number"
                  placeholder="Padrão: 30"
                  value={userRepLimit}
                  onChange={(e) => setUserRepLimit(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button onClick={saveUserLeadLimit} disabled={savingUserLimit}>
                {savingUserLimit ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
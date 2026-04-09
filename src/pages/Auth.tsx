import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSessionSafely } from "@/lib/auth-session";
import { Building2, Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles, Target, TrendingUp, Shield, User, Phone } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100);
const nameSchema = z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100);
const phoneSchema = z.string().min(10, "Telefone deve ter no mínimo 10 dígitos").max(20);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; fullName?: string; phone?: string }>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate("/");
      }
    });

    const restoreSession = async () => {
      const session = await getSessionSafely();

      if (!isMounted) return;

      if (session?.user) {
        navigate("/");
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string; fullName?: string; phone?: string } = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "As senhas não coincidem";
      }
      try {
        nameSchema.parse(fullName.trim());
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.fullName = e.errors[0].message;
        }
      }
      const phoneDigits = phone.replace(/\D/g, "");
      try {
        phoneSchema.parse(phoneDigits);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.phone = e.errors[0].message;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Erro ao entrar",
              description: "Email ou senha incorretos",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro ao entrar",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Bem-vindo!",
            description: "Login realizado com sucesso",
          });
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Erro ao criar conta",
              description: "Este email já está cadastrado. Tente fazer login.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro ao criar conta",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Conta criada!",
            description: "Verifique seu email para confirmar o cadastro",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Target, text: "Leads qualificados do Google Maps" },
    { icon: Sparkles, text: "Abordagens personalizadas com IA" },
    { icon: TrendingUp, text: "Aumente suas conversões" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-glow/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-success-glow/10 rounded-full blur-3xl animate-pulse-soft" />
        </div>
        
        {/* Decorative dots */}
        <div className="absolute top-32 right-20 w-2 h-2 bg-primary-foreground/40 rounded-full animate-bounce-gentle" />
        <div className="absolute top-48 left-24 w-3 h-3 bg-success-glow/60 rounded-full animate-bounce-gentle" style={{ animationDelay: "0.5s" }} />
        <div className="absolute bottom-40 left-1/3 w-2 h-2 bg-accent/50 rounded-full animate-bounce-gentle" style={{ animationDelay: "1s" }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 shadow-xl">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-primary-foreground">Negocix</span>
          </Link>
          
          <h1 className="text-4xl xl:text-5xl font-bold text-primary-foreground leading-tight mb-6">
            Encontre os melhores
            <span className="block mt-2">
              <span className="relative">
                clientes para você
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-success-glow/30 -rotate-1 rounded" />
              </span>
            </span>
          </h1>
          
          <p className="text-lg text-primary-foreground/70 mb-10 max-w-md">
            Plataforma inteligente de prospecção que encontra leads qualificados usando inteligência artificial.
          </p>
          
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 text-primary-foreground/90"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10 backdrop-blur-sm">
                  <feature.icon className="h-5 w-5" />
                </div>
                <span className="text-base">{feature.text}</span>
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="mt-16 flex gap-12">
            <div>
              <div className="text-3xl font-bold text-primary-foreground">90+</div>
              <div className="text-sm text-primary-foreground/60">Leads por busca</div>
            </div>
            <div className="border-l border-primary-foreground/20 pl-12">
              <div className="text-3xl font-bold text-primary-foreground">22</div>
              <div className="text-sm text-primary-foreground/60">Países</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile background */}
        <div className="lg:hidden absolute inset-0 bg-gradient-hero opacity-30" />
        <div className="lg:hidden absolute -top-20 -right-20 w-64 h-64 bg-primary-glow/10 rounded-full blur-3xl" />
        
        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-primary">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-primary">Negocix</span>
            </Link>
          </div>

          {/* Form header */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              {isLogin ? "Bem-vindo de volta!" : "Crie sua conta"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "Entre para continuar prospectando"
                : "Comece a encontrar clientes agora"}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-border/50">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                    {errors.password}
                  </p>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-11 h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                      required
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-primary hover:opacity-90 shadow-primary transition-all duration-300 hover:-translate-y-0.5"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isLogin ? "Entrando..." : "Criando conta..."}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 text-center">
              <p className="text-muted-foreground text-sm">
                {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="ml-2 text-primary hover:underline font-semibold"
                >
                  {isLogin ? "Criar conta" : "Fazer login"}
                </button>
              </p>
            </div>
          </div>

          {/* Security badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Seus dados estão seguros e protegidos</span>
          </div>

          {/* Back to home */}
          <div className="text-center mt-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="text-muted-foreground hover:text-foreground text-sm">
                ← Voltar para o início
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
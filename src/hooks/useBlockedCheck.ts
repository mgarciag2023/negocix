import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const useBlockedCheck = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkBlocked = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_blocked, blocked_reason, trial_expires_at")
          .eq("user_id", user.id)
          .maybeSingle();

        const trialExpired = profile?.trial_expires_at && new Date(profile.trial_expires_at) < new Date();

        if (profile?.is_blocked || trialExpired) {
          setIsBlocked(true);
          await supabase.auth.signOut();
          toast({
            title: "Acesso bloqueado",
            description: trialExpired 
              ? "Seu período de teste expirou. Entre em contato com o suporte para continuar usando."
              : (profile?.blocked_reason || "Sua conta foi bloqueada. Entre em contato com o suporte."),
            variant: "destructive",
          });
          navigate("/auth");
        }
      } catch (error) {
        console.error("Error checking blocked status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkBlocked();
  }, [navigate, toast]);

  return { isBlocked, loading };
};

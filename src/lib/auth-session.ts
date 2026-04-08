import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const authStorageKeys = [
  `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`,
  "supabase.auth.token",
];

const isRecoverableAuthError = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  return ["failed to fetch", "authretryablefetcherror", "network", "504"].some((term) =>
    message.includes(term)
  );
};

export const clearStoredAuthSession = () => {
  if (typeof window === "undefined") return;

  authStorageKeys.forEach((key) => window.localStorage.removeItem(key));
};

export const getSessionSafely = async (): Promise<Session | null> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    return session;
  } catch (error) {
    console.error("Failed to restore auth session:", error);

    if (isRecoverableAuthError(error)) {
      clearStoredAuthSession();
    }

    return null;
  }
};

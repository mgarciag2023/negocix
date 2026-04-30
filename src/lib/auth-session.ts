import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const authStorageKeys = [
  `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`,
  "supabase.auth.token",
];

const AUTH_SESSION_TIMEOUT_MS = 6000;

const isRecoverableAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    message?: string;
    name?: string;
    status?: number;
  };

  const message = candidate.message?.toLowerCase() ?? "";
  const name = candidate.name?.toLowerCase() ?? "";

  return (
    candidate.status === 504 ||
    [
      "failed to fetch",
      "authretryablefetcherror",
      "network",
      "504",
      "auth session timeout",
    ].some((term) => message.includes(term) || name.includes(term))
  );
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = AUTH_SESSION_TIMEOUT_MS): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error("Auth session timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      });
  });
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
    } = await withTimeout(supabase.auth.getSession());

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

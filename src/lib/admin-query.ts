import { supabase } from '@/integrations/supabase/client';
import { cachedAutomaticQuery } from './automatic-query-cache';

// Cache is never authorization: protected panels still check access on every mount.
export async function adminQuery<T>(dataset: string, fetcher: () => Promise<T>, manual = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const owner = session?.user.id;
  // The password-protected demo panel has no auth session: keep its data tab-local.
  return cachedAutomaticQuery(owner ? localStorage : sessionStorage, owner || 'trial-panel', dataset, fetcher, manual);
}
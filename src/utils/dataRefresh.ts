import { supabase } from '../lib/supabase';

export const TENANTS_CHANGED_EVENT = 'hal5-tenants-changed';
export const LEASES_CHANGED_EVENT = 'hal5-leases-changed';

export function emitTenantsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TENANTS_CHANGED_EVENT));
}

export function emitLeasesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEASES_CHANGED_EVENT));
}

type RefreshHandler = () => void;

/** Listen for custom window events that signal tenant/lease data changed. */
export function subscribeDataRefresh(
  events: string[],
  handler: RefreshHandler
): () => void {
  if (typeof window === 'undefined') return () => {};
  for (const event of events) {
    window.addEventListener(event, handler);
  }
  return () => {
    for (const event of events) {
      window.removeEventListener(event, handler);
    }
  };
}

/**
 * Optional Supabase realtime on tenants / leases / lease_spaces.
 * Returns an unsubscribe function.
 */
export function subscribeTenantsLeasesRealtime(handler: RefreshHandler): () => void {
  const channel = supabase
    .channel('hal5-tenants-leases-refresh')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, handler)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leases' }, handler)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lease_spaces' }, handler)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

import type { User } from '@supabase/supabase-js';

export type AccountRole = 'presidence' | 'caissiere' | 'client';

export const PRESIDENCE_EMAIL = 'presidence@gmail.com';

export function isPresidenceUser(user: User | null | undefined) {
  return user?.email?.toLowerCase() === PRESIDENCE_EMAIL || user?.user_metadata?.account_role === 'presidence';
}

export function getCanonicalRole(user: User | null | undefined, requestedRole?: AccountRole): AccountRole | null {
  if (!user) return null;
  if (user.email?.toLowerCase() === PRESIDENCE_EMAIL) return 'presidence';
  if (user.user_metadata?.account_role === 'presidence') return 'presidence';
  if (requestedRole) return requestedRole;
  if (user.user_metadata?.account_role === 'caissiere') return 'caissiere';
  return 'client';
}
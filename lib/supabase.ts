import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Déclaration globale pour éviter les réinstanciations multiples en mode dev
declare global {
  var supabaseInstance: SupabaseClient | undefined;
}

export const supabase =
  globalThis.supabaseInstance ||
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.supabaseInstance = supabase;
}
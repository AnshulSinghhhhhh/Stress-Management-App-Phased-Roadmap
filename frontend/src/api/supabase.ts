import { createClient } from '@supabase/supabase-js';

// Supabase environment variables from Vite or defaults
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://jseqzmijnldskugtcfcy.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_h6Cdbt0krpCyQni6GG2Iuw_y4VfWGPQ';

/**
 * Initialized Supabase client for browser authentication ONLY.
 *
 * CRITICAL ARCHITECTURAL GUARDRAIL (SOP §6 & Ground Rule 3):
 * The frontend Supabase client is strictly auth-only. It must NEVER expose
 * or gain `.from()` table access. All reads/writes to checkins, crisis_events,
 * relief_sessions, and trigger_tags must go exclusively through FastAPI,
 * ensuring the synchronous crisis detector runs before any check-in is persisted.
 */
const rawClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface SupabaseAuthOnlyClient {
  auth: typeof rawClient.auth;
}

export const supabase: SupabaseAuthOnlyClient = {
  auth: rawClient.auth,
};

export default supabase;


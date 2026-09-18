import { createClient } from '@supabase/supabase-js';

// Supabase environment variables from Vite or defaults
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://jseqzmijnldskugtcfcy.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_h6Cdbt0krpCyQni6GG2Iuw_y4VfWGPQ';

/**
 * Initialized Supabase client for browser authentication,
 * Realtime subscriptions, and direct PostgREST queries.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;

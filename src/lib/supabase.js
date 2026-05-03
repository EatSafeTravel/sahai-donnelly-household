import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const HOUSEHOLD_EMAIL = import.meta.env.VITE_HOUSEHOLD_EMAIL;

// The single row that holds the family's shared state
export const HOUSEHOLD_ROW_ID = 'main';

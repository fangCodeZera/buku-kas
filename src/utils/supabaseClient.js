// SECURITY: Only anon key used here. Service role key must never appear in frontend code.
// Purpose: Creates and exports a single Supabase client instance for use throughout the app.
// This file is created in Phase 0 of the localStorage → Supabase migration.
// It does not make any queries — it only initializes the client.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'FATAL: Supabase environment variables missing. Check your .env file.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;

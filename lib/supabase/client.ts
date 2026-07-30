// Browser-side Supabase client. Only anon key; all RLS applies.
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import { getSupabaseBrowserKey, getSupabaseUrl } from '@/lib/supabase/env';

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseBrowserKey(),
  );
}

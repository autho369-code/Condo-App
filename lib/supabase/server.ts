// Server-side Supabase client. Reads cookies from Next.js so the user's session
// flows through to RLS — every query runs as the authenticated user.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';
import { getSupabaseBrowserKey, getSupabaseUrl } from '@/lib/supabase/env';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseBrowserKey(),
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(items: Array<{ name: string; value: string; options?: any }>) {
          try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* set called from a Server Component — handled by middleware */ }
        },
      },
    },
  );
}

// Service-role client for platform-operator-only operations.
// NEVER import this from a Client Component or Route Handler exposed to the browser.
import { createClient as createPlainClient } from '@supabase/supabase-js';
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured');
  }
  return createPlainClient<Database>(
    getSupabaseUrl(),
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

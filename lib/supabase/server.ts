// Server-side Supabase client. Reads cookies from Next.js so the user's session
// flows through to RLS — every query runs as the authenticated user.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  return createPlainClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

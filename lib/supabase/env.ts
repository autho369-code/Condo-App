/**
 * Supabase renamed its hosted integration keys from anon/service-role to
 * publishable/secret. Support both generations so Vercel's managed variables
 * and existing local environments behave identically.
 */
export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  return value;
}

export function getSupabaseBrowserKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured');
  }
  return value;
}


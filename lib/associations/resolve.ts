import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedAssociation = { id: string; name: string; slug: string | null };

/**
 * Resolve an association route param that may be either a short slug
 * (granville-courts) or a raw UUID (legacy links). Returns the real row or null.
 */
export async function resolveAssociation(param: string): Promise<ResolvedAssociation | null> {
  if (!param) return null;
  const supabase = await createClient();
  const sel = (supabase as any).from('associations').select('id, name, slug');
  const { data } = UUID_RE.test(param)
    ? await sel.eq('id', param).maybeSingle()
    : await sel.eq('slug', param).maybeSingle();
  return (data as ResolvedAssociation) ?? null;
}

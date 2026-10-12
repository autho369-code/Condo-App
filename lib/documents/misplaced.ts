import 'server-only';

import { isEntityDocumentStoragePath } from '@/lib/security/storage-paths';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Not a server action module: this reads with the service client and must only
// be called from server code that has already resolved the caller's portfolio.
type MisplacedDocument = { id: string; file_url: string; entity_id: string; file_name: string | null };

// Only the legacy seed prefix is repairable. A row pointing at some other
// association's folder may be stale, and moving that object would take a real
// file away from its owner.
export const LEGACY_DOCUMENT_PREFIX = 'granville/';

/**
 * Association documents whose file sits outside associations/<id>/… fail
 * document_path_matches_entity, so RLS hides them from staff and owners even
 * though the file exists. The associations come from the caller's own access
 * (row-level security), so a manager assigned to some associations only sees
 * and repairs theirs; the hidden rows are then read with the service client.
 */
export async function findMisplacedAssociationDocuments(portfolioId: string): Promise<MisplacedDocument[]> {
  const supabase = await createClient();
  const svc = createServiceClient() as any;
  // Paged: the Data API returns at most 1,000 rows per request.
  const associations = await fetchAllRows<{ id: string }>(() => (supabase as any)
    .from('associations').select('id').eq('portfolio_id', portfolioId).order('id'));
  // Fail closed: never fall back to the whole company.
  if (associations.error || associations.truncated) return [];
  const ids = new Set(associations.rows.map((a) => a.id));
  if (ids.size === 0) return [];
  // Only legacy-prefix rows can be repaired (few); filter them to the
  // caller's associations here instead of sending every id in the URL.
  const docs = await fetchAllRows<MisplacedDocument>(() => svc
    .from('documents')
    .select('id, file_url, entity_id, file_name')
    .eq('entity_type', 'association')
    .like('file_url', `${LEGACY_DOCUMENT_PREFIX}%`)
    .order('id'));
  if (docs.error) return [];
  return docs.rows.filter((d) =>
    ids.has(d.entity_id)
    && d.file_url
    && d.file_url.startsWith(LEGACY_DOCUMENT_PREFIX)
    && !d.file_url.includes('..')
    && !isEntityDocumentStoragePath(d.file_url, 'association', d.entity_id));
}


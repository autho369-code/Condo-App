import 'server-only';

import { isEntityDocumentStoragePath } from '@/lib/security/storage-paths';
import { createServiceClient } from '@/lib/supabase/server';

// Not a server action module: this reads with the service client and must only
// be called from server code that has already resolved the caller's portfolio.
type MisplacedDocument = { id: string; file_url: string; entity_id: string; file_name: string | null };

/**
 * Association documents whose file sits outside associations/<id>/… fail
 * document_path_matches_entity, so RLS hides them from staff and owners even
 * though the file exists. Read with the service client, strictly scoped to the
 * caller's portfolio.
 */
export async function findMisplacedAssociationDocuments(portfolioId: string): Promise<MisplacedDocument[]> {
  const svc = createServiceClient() as any;
  const { data: associations } = await svc.from('associations').select('id').eq('portfolio_id', portfolioId);
  const ids = (associations ?? []).map((a: { id: string }) => a.id);
  if (ids.length === 0) return [];
  const { data: docs } = await svc
    .from('documents')
    .select('id, file_url, entity_id, file_name')
    .eq('entity_type', 'association')
    .in('entity_id', ids);
  return ((docs ?? []) as MisplacedDocument[]).filter((d) =>
    d.file_url && !isEntityDocumentStoragePath(d.file_url, 'association', d.entity_id));
}


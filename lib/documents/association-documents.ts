import type { SupabaseClient } from '@supabase/supabase-js';

export const ASSOCIATION_DOCUMENT_BUCKET = 'association-documents';

export function sanitizeDocumentFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return cleaned || 'document';
}

export function associationDocumentPath({
  associationId,
  fileName,
  portfolioId,
  timestamp = Date.now(),
}: {
  associationId: string;
  fileName: string;
  portfolioId: string;
  timestamp?: number;
}) {
  return `${portfolioId}/${associationId}/${timestamp}-${sanitizeDocumentFileName(fileName)}`;
}

export async function attachSignedDocumentUrls<T extends { storage_path: string }>(
  supabase: SupabaseClient<any>,
  documents: T[],
) {
  return Promise.all(documents.map(async (document) => {
    const { data } = await supabase.storage
      .from(ASSOCIATION_DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, 60 * 10);
    return {
      ...document,
      signed_url: data?.signedUrl ?? null,
    };
  }));
}

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/me';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'association-documents';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await requireAuth();
  const supabase = await createClient();

  // Metadata RLS is the authorization boundary: assigned management staff,
  // portfolio admins/operators, and active board members may read this row.
  const { data: document, error } = await (supabase as any).from('meeting_documents')
    .select('id, meeting_id, storage_path')
    .eq('id', id)
    .maybeSingle();
  if (error || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (!isScopedStoragePath(document.storage_path, 'meetings', document.meeting_id)) {
    return NextResponse.json({ error: 'Invalid document reference' }, { status: 422 });
  }

  const service = createServiceClient() as any;
  const { data: signed, error: signingError } = await service.storage.from(BUCKET)
    .createSignedUrl(document.storage_path, 60);
  if (signingError || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Document is temporarily unavailable' }, { status: 503 });
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

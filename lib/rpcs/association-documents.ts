'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  ASSOCIATION_DOCUMENT_BUCKET,
  associationDocumentPath,
} from '@/lib/documents/association-documents';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export async function uploadAssociationDocument(associationId: string, formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const file = formData.get('file');
  const folder = String(formData.get('folder') ?? 'governing_documents').trim() || 'governing_documents';
  const sharedWithOwner = formData.get('shared_with_owner') === 'on';
  const returnTo = `/associations/${associationId}`;

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${returnTo}?document_error=${encodeURIComponent('Choose a document to upload.')}`);
  }
  if (!me.portfolio?.id) {
    redirect(`${returnTo}?document_error=${encodeURIComponent('Could not identify the current portfolio.')}`);
  }

  const storagePath = associationDocumentPath({
    associationId,
    fileName: file.name,
    portfolioId: me.portfolio.id,
  });

  const { error: uploadError } = await supabase.storage
    .from(ASSOCIATION_DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    redirect(`${returnTo}?document_error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error: insertError } = await (supabase as any)
    .from('association_attachments')
    .insert({
      association_id: associationId,
      byte_size: file.size,
      content_type: file.type || null,
      file_name: file.name,
      folder,
      shared_with_owner: sharedWithOwner,
      storage_path: storagePath,
      uploaded_by: me.auth_user_id,
    });
  if (insertError) {
    await supabase.storage.from(ASSOCIATION_DOCUMENT_BUCKET).remove([storagePath]);
    redirect(`${returnTo}?document_error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath(returnTo);
  revalidatePath('/portal/documents');
  redirect(`${returnTo}?document_uploaded=1`);
}

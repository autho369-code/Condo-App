'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { findMisplacedAssociationDocuments } from '@/lib/documents/misplaced';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'association-documents';

/** Move misplaced association files into associations/<id>/operating/ and repoint their rows. */
export async function repairMisplacedAssociationDocuments() {
  const me = await requireStaff(); // in-action guard: server actions are callable endpoints
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) redirect('/documents?error=' + encodeURIComponent('No portfolio found for your account.'));

  const svc = createServiceClient() as any;
  const misplaced = await findMisplacedAssociationDocuments(portfolioId);
  let moved = 0;
  const failed: string[] = [];
  for (const doc of misplaced) {
    const baseName = (doc.file_url.split('/').pop() ?? 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const target = `associations/${doc.entity_id}/operating/${baseName}`;
    const { error: moveError } = await svc.storage.from(BUCKET).move(doc.file_url, target);
    if (moveError) { failed.push(`${doc.file_name ?? baseName}: ${moveError.message}`); continue; }
    const { error: updateError } = await svc.from('documents').update({ file_url: target }).eq('id', doc.id);
    if (updateError) {
      // Put the file back so the row still points at a real object.
      await svc.storage.from(BUCKET).move(target, doc.file_url);
      failed.push(`${doc.file_name ?? baseName}: ${updateError.message}`);
      continue;
    }
    moved += 1;
  }

  revalidatePath('/documents');
  if (failed.length > 0) {
    redirect(`/documents?repaired=${moved}&error=${encodeURIComponent(`Some files could not be moved: ${failed.join('; ')}`)}`);
  }
  redirect(`/documents?repaired=${moved}`);
}

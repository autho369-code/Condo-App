'use server';

import { randomUUID } from 'node:crypto';
import { requireStaff } from '@/lib/auth/me';
import { generateDocumentPdf } from '@/lib/documents/generated-pdf';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'association-documents';
const MAX_TEXT_LENGTH = 50_000;

export type GenerateDocumentInput = {
  templateId?: string | null;
  associationId: string;
  ownerIds?: string[];
  letterType: string;
  subject: string;
  body: string;
  createDraftNotice?: boolean;
};

function noticeType(letterType: string): string {
  if (letterType === 'violation_notice') return 'violation';
  if (letterType === 'board_packet') return 'board_packet';
  if (letterType === 'assessment_letter') return 'payment_reminder';
  return 'general';
}

export async function generateAndStoreDocument(input: GenerateDocumentInput) {
  const me = await requireStaff();
  const subject = input.subject?.trim();
  const body = input.body?.trim();
  const associationId = input.associationId?.trim();
  if (!associationId) throw new Error('Select an association before generating the document.');
  if (!subject || subject.length > 300) throw new Error('Subject must be between 1 and 300 characters.');
  if (!body || body.length > MAX_TEXT_LENGTH) throw new Error('Document body must be between 1 and 50,000 characters.');

  const supabase = await createClient();
  const db = supabase as any;
  const { data: association, error: associationError } = await db.from('associations')
    .select('id, name, portfolio_id').eq('id', associationId).is('archived_at', null).maybeSingle();
  if (associationError || !association) throw new Error('Association is unavailable or outside your access.');

  if (input.templateId) {
    const { data: template } = await db.from('document_templates')
      .select('id').eq('id', input.templateId).is('archived_at', null).eq('active', true).maybeSingle();
    if (!template) throw new Error('Template is unavailable or outside your access.');
  }

  const requestedOwners = [...new Set((input.ownerIds ?? []).filter(Boolean))];
  let recipients: Array<{ owner_id: string; email: string; name: string }> = [];
  if (requestedOwners.length) {
    const { data: occupancies, error: occupancyError } = await db.from('occupancies')
      .select('owner_id, owners!owner_id(email, full_name)')
      .eq('association_id', associationId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .in('owner_id', requestedOwners);
    if (occupancyError) throw new Error('Could not validate selected owners.');
    recipients = (occupancies ?? []).map((row: any) => ({
      owner_id: row.owner_id,
      email: row.owners?.email ?? '',
      name: row.owners?.full_name ?? 'Owner',
    }));
    if (new Set(recipients.map((row) => row.owner_id)).size !== requestedOwners.length) {
      throw new Error('One or more selected owners are outside this association.');
    }
    if (input.createDraftNotice && recipients.some((row) => !row.email)) {
      throw new Error('Every selected notice recipient must have an email address.');
    }
  }

  const pdf = generateDocumentPdf({
    subject,
    body,
    associationName: association.name,
    preparedFor: recipients.map((row) => row.name),
  });
  const safeType = (input.letterType || 'document').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${safeType}-${date}.pdf`;
  const path = `associations/${associationId}/generated/${date}-${randomUUID()}.pdf`;
  const service = createServiceClient() as any;
  const { error: uploadError } = await service.storage.from(BUCKET)
    .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

  let documentId: string | null = null;
  let noticeId: string | null = null;
  try {
    const { data: document, error: documentError } = await db.from('documents').insert({
      entity_type: 'association',
      entity_id: associationId,
      doc_type: 'other',
      file_name: fileName,
      file_url: path,
      uploaded_by: me.auth_user_id,
    }).select('id').single();
    if (documentError) throw new Error(`Document record failed: ${documentError.message}`);
    documentId = document.id;

    if (input.createDraftNotice) {
      const { data: notice, error: noticeError } = await db.from('notices').insert({
        association_id: associationId,
        notice_type: noticeType(input.letterType),
        status: 'draft',
        subject,
        body,
        send_to: recipients.length ? 'selected_owners' : 'all_owners',
        channel: 'email',
        template_id: input.templateId ?? null,
        created_by: me.auth_user_id,
      }).select('id').single();
      if (noticeError) throw new Error(`Draft notice failed: ${noticeError.message}`);
      noticeId = notice.id;

      if (recipients.length) {
        const { error: recipientError } = await db.from('notice_recipients').insert(recipients.map((recipient) => ({
          notice_id: noticeId,
          owner_id: recipient.owner_id,
          email: recipient.email,
          name: recipient.name,
        })));
        if (recipientError) throw new Error(`Notice recipients failed: ${recipientError.message}`);
      }
    }
  } catch (error) {
    if (noticeId) await db.from('notices').delete().eq('id', noticeId);
    if (documentId) await db.from('documents').delete().eq('id', documentId);
    await service.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return { documentId, noticeId, fileName };
}

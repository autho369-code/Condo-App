import 'server-only';
import { randomUUID } from 'node:crypto';
import { generateDocumentPdf } from '@/lib/documents/generated-pdf';
import { queueEmails, richTextToPlainText, textToHtml } from '@/lib/email/queue';
import { createServiceClient } from '@/lib/supabase/server';
import { buildStepLetter } from '@/lib/violations/step-letter';

const BUCKET = 'association-documents';

export type AdvanceResult = {
  step: number;
  step_name: string;
  fee: number | string;
  letter_template_id: string | null;
  delivery_methods: string[] | null;
  offers_hearing: boolean;
};

/**
 * After advance_violation succeeds, write the step's letter, store it as a PDF
 * and deliver it by the step's methods: email (queued to the owner), portal
 * (the owner can open it from their violation), mail (added to the print
 * queue). Returns a short summary for the staff confirmation message.
 *
 * `db` is the caller's session client — every read and the letter insert go
 * through RLS (can_manage_violations). Only the PDF upload uses the service
 * client, at a path the letter row is bound to.
 */
export async function deliverStepLetter(db: any, violationId: string, result: AdvanceResult, sentBy: string | null): Promise<string> {
  const methods = (result.delivery_methods ?? []).filter((m) => ['email', 'portal', 'mail', 'certified_mail'].includes(m));
  const byMail = methods.includes('mail') || methods.includes('certified_mail');
  if (methods.length === 0) return 'No letter for this step (no delivery method set).';

  const { data: v, error } = await db
    .from('violations')
    .select('id, title, description, date_observed, cure_deadline, notice_sent_at, last_step_at, fines_total, association_id, owner_id, governing_document_reference, associations(name, portfolio_id), units(unit_number), owners(full_name, email)')
    .eq('id', violationId)
    .maybeSingle();
  if (error || !v) throw new Error('Could not load the violation to write its letter.');

  const [{ data: template }, { data: settings }] = await Promise.all([
    result.letter_template_id
      ? db.from('document_templates').select('subject, body').eq('id', result.letter_template_id).is('archived_at', null).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('association_violation_settings').select('hearing_request_days').eq('association_id', v.association_id).maybeSingle(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const hearingDays = Number(settings?.hearing_request_days ?? 14);
  // Anchored to when the step was recorded, so a resent letter states the same deadline.
  const stepAt = v.last_step_at ? new Date(v.last_step_at).getTime() : Date.now();
  const hearingDeadline = result.offers_hearing
    ? new Date(stepAt + hearingDays * 86_400_000).toISOString().slice(0, 10)
    : null;
  const associationName = v.associations?.name ?? 'Your association';
  const { subject, body } = buildStepLetter(
    {
      ownerName: v.owners?.full_name ?? null,
      unitNumber: v.units?.unit_number ?? null,
      associationName,
      violationTitle: v.title,
      violationDescription: v.description,
      rule: v.governing_document_reference,
      dateObserved: v.date_observed,
      cureDeadline: v.cure_deadline,
      stepName: result.step_name,
      fee: Number(result.fee) || 0,
      finesTotal: Number(v.fines_total) || 0,
      offersHearing: !!result.offers_hearing,
      hearingDeadline,
      today,
    },
    // Templates from the rich-text editor are HTML; letters are plain text (escaped again for email).
    template ? { subject: template.subject ? richTextToPlainText(template.subject) : null, body: template.body ? richTextToPlainText(template.body) : null } : null,
  );

  const pdf = generateDocumentPdf({
    subject,
    body,
    associationName,
    preparedFor: v.owners?.full_name ? [v.owners.full_name] : [],
  });
  const path = `violations/${v.id}/letters/${today}-step${result.step}-${randomUUID()}.pdf`;
  const service = createServiceClient() as any;
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`Could not save the letter PDF: ${uploadError.message}`);

  const ownerEmail: string | null = v.owners?.email?.trim() || null;
  const wantsEmail = methods.includes('email');
  const { data: letter, error: letterError } = await db
    .from('violation_letters')
    .insert({
      violation_id: v.id,
      association_id: v.association_id,
      step_order: result.step,
      step_name: result.step_name,
      subject,
      body,
      pdf_path: path,
      delivery_methods: methods,
      emailed_to: wantsEmail ? ownerEmail : null,
      email_status: !wantsEmail ? 'not_requested' : ownerEmail ? 'queued' : 'no_email_on_file',
      mail_status: byMail ? 'to_mail' : 'not_requested',
    })
    .select('id')
    .single();
  if (letterError || !letter) {
    await service.storage.from(BUCKET).remove([path]);
    throw new Error(`Could not record the letter: ${letterError?.message ?? 'unknown error'}`);
  }

  const done: string[] = [];
  if (wantsEmail) {
    if (ownerEmail) {
      const { error: emailError } = await queueEmails(db, [{
        to: ownerEmail,
        toName: v.owners?.full_name ?? null,
        subject,
        html: textToHtml(body),
        portfolioId: v.associations?.portfolio_id ?? null,
        associationId: v.association_id,
        ownerId: v.owner_id,
        sentBy,
        idempotencyKey: `violation-letter:${letter.id}`,
      }]);
      if (emailError) throw new Error(`Letter saved, but the email could not be queued: ${emailError}`);
      done.push(`emailed to ${ownerEmail}`);
    } else {
      done.push('NOT emailed — no email on file for the owner');
    }
  }
  if (methods.includes('portal')) done.push(v.owner_id ? 'posted to the owner portal' : 'not posted to a portal — no owner on the violation');
  if (methods.includes('certified_mail')) done.push('added to the mail queue (certified)');
  else if (methods.includes('mail')) done.push('added to the mail queue');
  return `Letter ${done.join(', ')}.`;
}

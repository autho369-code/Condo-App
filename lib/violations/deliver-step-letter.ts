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
  /** Present when the terms come from the snapshot recorded at advance time. */
  hearing_request_days?: number | null;
  template_subject?: string | null;
  template_body?: string | null;
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

  // Prefer the terms recorded when the step was taken (template wording and
  // hearing window as they were then); fall back to live values only when the
  // caller has no snapshot (the advance itself, which happens at the same moment).
  const snapshot = 'template_body' in result || 'hearing_request_days' in result;
  const [{ data: liveTemplate }, { data: settings }] = await Promise.all([
    !snapshot && result.letter_template_id
      ? db.from('document_templates').select('subject, body').eq('id', result.letter_template_id).is('archived_at', null).maybeSingle()
      : Promise.resolve({ data: null }),
    snapshot && result.hearing_request_days != null
      ? Promise.resolve({ data: { hearing_request_days: result.hearing_request_days } })
      : db.from('association_violation_settings').select('hearing_request_days').eq('association_id', v.association_id).maybeSingle(),
  ]);
  const template = snapshot
    ? (result.template_subject || result.template_body ? { subject: result.template_subject ?? null, body: result.template_body ?? null } : null)
    : liveTemplate;

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
      // 'pending' until the email is really in the queue (see queueLetterEmail).
      email_status: !wantsEmail ? 'not_requested' : ownerEmail ? 'pending' : 'no_email_on_file',
      mail_status: byMail ? 'to_mail' : 'not_requested',
    })
    .select('id')
    .single();
  if (letterError || !letter) {
    await service.storage.from(BUCKET).remove([path]);
    if (letterError?.code === '23505') {
      throw new Error('A letter for this step was already created (probably by another request a moment ago). Refresh the page.');
    }
    throw new Error(`Could not record the letter: ${letterError?.message ?? 'unknown error'}`);
  }

  const done: string[] = [];
  if (wantsEmail) {
    if (ownerEmail) {
      await queueLetterEmail(db, { id: letter.id, subject, body, emailed_to: ownerEmail }, {
        toName: v.owners?.full_name ?? null,
        portfolioId: v.associations?.portfolio_id ?? null,
        associationId: v.association_id,
        ownerId: v.owner_id,
        sentBy,
      }, `violation-letter:${letter.id}`);
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

type LetterEmailContext = {
  toName: string | null;
  portfolioId: string | null;
  associationId: string;
  ownerId: string | null;
  sentBy: string | null;
};

/** Queue a letter's email and only then mark it queued (pending -> queued). */
async function queueLetterEmail(
  db: any,
  letter: { id: string; subject: string; body: string; emailed_to: string },
  ctx: LetterEmailContext,
  idempotencyKey: string,
) {
  const { error } = await queueEmails(db, [{
    to: letter.emailed_to,
    toName: ctx.toName,
    subject: letter.subject,
    html: textToHtml(letter.body),
    portfolioId: ctx.portfolioId,
    associationId: ctx.associationId,
    ownerId: ctx.ownerId,
    sentBy: ctx.sentBy,
    idempotencyKey,
  }]);
  if (error) {
    throw new Error(`Letter saved, but the email could not be queued (${error}). Use "Send letter for this step" to retry the email only.`);
  }
  const { error: statusError } = await db
    .from('violation_letters').update({ email_status: 'queued' }).eq('id', letter.id).eq('email_status', 'pending');
  if (statusError) throw new Error(`Email queued, but the letter's status could not be updated: ${statusError.message}`);
}

/**
 * Recover or repeat the current step's letter WITHOUT creating a second one.
 * Returns null when no letter exists for the step yet (the caller then runs
 * the full delivery). An existing letter keeps its PDF, portal copy and mail
 * queue entry; only the email is (re)sent.
 */
export async function retryStepLetter(db: any, violationId: string, step: number, sentBy: string | null): Promise<string | null> {
  const { data: letter, error } = await db
    .from('violation_letters')
    .select('id, subject, body, emailed_to, email_status, delivery_methods, violations(association_id, owner_id, associations(portfolio_id), owners(full_name))')
    .eq('violation_id', violationId)
    .eq('step_order', step)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the step's letter: ${error.message}`);
  if (!letter) return null;

  const wantsEmail = (letter.delivery_methods ?? []).includes('email');
  if (!wantsEmail || !letter.emailed_to) {
    return letter.email_status === 'no_email_on_file'
      ? "The letter for this step already exists; it can't be emailed because the owner has no email on file. Nothing was duplicated."
      : 'The letter for this step was already delivered by portal / mail. Nothing was duplicated.';
  }
  const ctx: LetterEmailContext = {
    toName: letter.violations?.owners?.full_name ?? null,
    portfolioId: letter.violations?.associations?.portfolio_id ?? null,
    associationId: letter.violations?.association_id,
    ownerId: letter.violations?.owner_id ?? null,
    sentBy,
  };
  if (letter.email_status === 'pending') {
    // The first attempt never reached the queue: retry with the original key.
    await queueLetterEmail(db, letter, ctx, `violation-letter:${letter.id}`);
    return `The letter's email was queued to ${letter.emailed_to} (retry of the failed send).`;
  }
  // Already emailed once: send the same letter again (a new key, same letter record).
  const { error: resendError } = await queueEmails(db, [{
    to: letter.emailed_to,
    toName: ctx.toName,
    subject: letter.subject,
    html: textToHtml(letter.body),
    portfolioId: ctx.portfolioId,
    associationId: ctx.associationId,
    ownerId: ctx.ownerId,
    sentBy,
    idempotencyKey: `violation-letter:${letter.id}:resend:${Date.now()}`,
  }]);
  if (resendError) throw new Error(`The email could not be queued: ${resendError}`);
  return `The same letter was emailed again to ${letter.emailed_to}.`;
}


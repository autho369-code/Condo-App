// Builds the letter sent when a violation moves to its next follow-up step.
// Pure (no I/O) so the wording and merge rules are unit-tested.

export type StepLetterContext = {
  ownerName: string | null;
  unitNumber: string | null;
  associationName: string;
  violationTitle: string;
  violationDescription: string | null;
  rule: string | null;
  dateObserved: string | null;
  cureDeadline: string | null;
  stepName: string;
  fee: number;
  finesTotal: number;
  offersHearing: boolean;
  hearingDeadline: string | null;
  today: string;
};

export type StepLetterTemplate = { subject: string | null; body: string | null };

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function longDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function stepLetterMergeValues(ctx: StepLetterContext): Record<string, string> {
  return {
    owner_name: ctx.ownerName ?? 'Homeowner',
    unit_number: ctx.unitNumber ?? '',
    association_name: ctx.associationName,
    violation_title: ctx.violationTitle,
    violation_description: ctx.violationDescription ?? '',
    rule: ctx.rule ?? '',
    date_observed: longDate(ctx.dateObserved),
    cure_deadline: longDate(ctx.cureDeadline),
    step_name: ctx.stepName,
    fine_amount: ctx.fee > 0 ? money(ctx.fee) : '',
    fines_total: money(ctx.finesTotal),
    hearing_deadline: longDate(ctx.hearingDeadline),
    today: longDate(ctx.today),
  };
}

/** Replace {{key}} (any case, optional spaces). Unknown keys stay visible as [key] so they are caught in review. */
export function mergeTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const k = key.toLowerCase();
    return k in values ? values[k] : `[${k}]`;
  });
}

function standardBody(ctx: StepLetterContext, v: Record<string, string>): string {
  const where = ctx.unitNumber ? `${ctx.associationName}, unit ${ctx.unitNumber}` : ctx.associationName;
  const parts: string[] = [
    `Dear ${v.owner_name},`,
    `This letter concerns ${where}.${v.date_observed ? ` On ${v.date_observed}, the following was observed:` : ' The following was observed:'} ${ctx.violationTitle}.`,
  ];
  if (ctx.violationDescription?.trim()) parts.push(ctx.violationDescription.trim());
  if (ctx.rule) parts.push(`Rule: ${ctx.rule}`);
  if (ctx.fee > 0) {
    parts.push(
      `Under the association's enforcement policy, a fine of ${money(ctx.fee)} has been posted to your account for this step (${ctx.stepName}). ` +
      `Fines for this violation now total ${money(ctx.finesTotal)}.`,
    );
  }
  if (v.cure_deadline && ctx.fee === 0) parts.push(`Please correct this by ${v.cure_deadline}.`);
  else parts.push('Please correct this as soon as possible to avoid further action.');
  if (ctx.offersHearing) {
    parts.push(
      `You may request a hearing before the board${v.hearing_deadline ? ` by ${v.hearing_deadline}` : ''}. ` +
      'To request one, sign in to your owner portal and open this violation, or reply to this letter.',
    );
  }
  parts.push(`If you have already corrected this, thank you — please let us know so we can close it.`);
  parts.push(`Sincerely,\n${ctx.associationName} management`);
  return parts.join('\n\n');
}

export function buildStepLetter(ctx: StepLetterContext, template: StepLetterTemplate | null): { subject: string; body: string } {
  const values = stepLetterMergeValues(ctx);
  const subject = template?.subject?.trim()
    ? mergeTemplate(template.subject.trim(), values)
    : `${ctx.associationName}: ${ctx.stepName} — ${ctx.violationTitle}`;
  const body = template?.body?.trim() ? mergeTemplate(template.body.trim(), values) : standardBody(ctx, values);
  return { subject: subject.slice(0, 300), body: body.slice(0, 50000) };
}

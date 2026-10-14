// Plain rules shared by the architectural review actions and pages (kept out
// of the 'use server' module so they can be unit tested).

export const ARC_OPEN_STATUSES = ['submitted', 'under_review', 'more_info'] as const;

type OccupancyLike = {
  status?: string | null;
  occupancy_type?: string | null;
  move_out_date?: string | null;
};

/**
 * The unit's current owner: a current owner occupancy that has not reached its
 * move-out date (`today` is YYYY-MM-DD in the association's calendar).
 */
export function isCurrentOwnerOccupancy(occ: OccupancyLike, today: string): boolean {
  if (occ.status !== 'current' || occ.occupancy_type !== 'owner') return false;
  return !occ.move_out_date || occ.move_out_date > today;
}

/** What a staff decision needs before it is recorded (null when complete). */
export function decisionInputError(decision: string, notes: string | null): string | null {
  if (decision === 'deny' && !notes) return 'Give the homeowner a reason when denying a request.';
  return null;
}

/** The message after a decision, saying whether the homeowner was emailed. */
export function decisionNotice(status: string, emailed: boolean): string {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (status === 'under_review') return `Decision recorded: ${label}.`;
  return emailed
    ? `Decision recorded: ${label}. The homeowner has been emailed.`
    : `Decision recorded: ${label}. No email was sent (the homeowner has no email on file, or it could not be queued); they see the decision in their portal.`;
}

export type ArcInstructions = {
  portal_homepage_html: string | null;
  submission_form_html: string | null;
  document_upload_html: string | null;
  online_requests_disabled: boolean;
};

/** Trimmed instruction text, or null when blank. Shown as plain text, never HTML. */
export function instructionText(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v ? v : null;
}

// Board report package: the association's chosen monthly statements as one
// PDF, published to the board portal as an association document
// (doc_type 'board_report') and announced to active board members.
//
// Callers are responsible for authorization: the staff action verifies
// can_manage_association with the user's session before calling, and the
// cron route is authenticated by the cron secret.

import { generateLiveExportRows } from '@/lib/reports/live-export';
import { generateMonthlyFinancialPackagePdf, prepareMonthlyPackageRows } from '@/lib/reports/monthly-package';
import { queueEmails } from '@/lib/email/queue';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';

export const BOARD_REPORT_SECTIONS = [
  ['trial_balance', 'Trial balance'],
  ['balance_sheet', 'Balance sheet'],
  ['income_statement', 'Income statement'],
  ['budget_vs_actual', 'Budget vs actual'],
  ['ar_aging', 'Owner receivables aging'],
  ['delinquency_summary', 'Delinquency summary'],
  ['ap_aging', 'Payables aging'],
  ['bank_reconciliation', 'Bank reconciliation'],
] as const;
export type BoardReportSection = (typeof BOARD_REPORT_SECTIONS)[number][0];
export const DEFAULT_BOARD_SECTIONS: BoardReportSection[] = ['balance_sheet', 'income_statement', 'budget_vs_actual', 'ar_aging', 'delinquency_summary', 'bank_reconciliation'];
const KEYS = new Set<string>(BOARD_REPORT_SECTIONS.map(([k]) => k));

export const isBoardSection = (v: string): v is BoardReportSection => KEYS.has(v);

/** Sections with per-unit detail, never included when the package is shared with homeowners. */
export const OWNER_HIDDEN_SECTIONS = new Set<string>(['ar_aging']);

/** Selected sections in canonical package order. */
export function orderSections(selected: string[]): BoardReportSection[] {
  const set = new Set(selected);
  return BOARD_REPORT_SECTIONS.map(([k]) => k).filter((k) => set.has(k));
}

/** First and last day (YYYY-MM-DD) of the month before `today`. */
export function previousMonth(today = new Date()) {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export const boardPackagePath = (associationId: string, dateTo: string) => `associations/${associationId}/board-reports/${dateTo}.pdf`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export async function publishBoardPackage(opts: {
  dataClient: any;
  svc: any;
  association: { id: string; name: string; portfolio_id: string; company_name?: string | null };
  dateFrom: string;
  dateTo: string;
  sections: string[];
  shareScope: 'board' | 'owners';
  notify: boolean;
  actorId: string | null;
  source: 'manual' | 'scheduled';
}) {
  const { dataClient, svc, association, dateFrom, dateTo, shareScope, notify, actorId, source } = opts;
  if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo) || dateFrom > dateTo) throw new Error('Choose a valid reporting period.');
  // Shared with every homeowner: leave out the receivables aging, which lists
  // each unit's open charges and balance. (The delinquency summary is totals.)
  const sections = orderSections(opts.sections).filter((s) => shareScope !== 'owners' || !OWNER_HIDDEN_SECTIONS.has(s));
  if (!sections.length) throw new Error('Choose at least one report for the board package.');

  const params = { association_id: association.id, date_from: dateFrom, date_to: dateTo, scope: 'association' };
  const rows = await Promise.all(sections.map((slug) => generateLiveExportRows(dataClient, association.portfolio_id, slug as any, params)));
  const titles = new Map<string, string>(BOARD_REPORT_SECTIONS as unknown as [string, string][]);
  const pdf = generateMonthlyFinancialPackagePdf({
    associationName: association.name,
    companyName: association.company_name,
    dateFrom,
    dateTo,
    sections: sections.map((slug, i) => ({ title: titles.get(slug)!, rows: prepareMonthlyPackageRows(slug as any, rows[i], dateTo) })),
  });

  const path = boardPackagePath(association.id, dateTo);
  const { error: upErr } = await svc.storage.from('association-documents').upload(path, Buffer.from(pdf), { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Could not store the package: ${upErr.message}`);

  const fileName = `Board report ${fmt(dateFrom)} – ${fmt(dateTo)}.pdf`;
  const description = sections.map((s) => titles.get(s)).join(', ');
  const { data: existing } = await svc.from('documents').select('id').eq('entity_type', 'association').eq('entity_id', association.id).eq('file_url', path).maybeSingle();
  const row = {
    doc_type: 'board_report', file_name: fileName, folder: 'Board reports', share_scope: shareScope,
    description: description.slice(0, 500), uploaded_at: new Date().toISOString(), uploaded_by: actorId,
  };
  const { data: doc, error: docErr } = existing
    ? await svc.from('documents').update(row).eq('id', existing.id).select('id').single()
    : await svc.from('documents').insert({ ...row, entity_type: 'association', entity_id: association.id, file_url: path }).select('id').single();
  if (docErr) throw new Error(`Could not record the package: ${docErr.message}`);

  let emailed = 0;
  if (notify) {
    const { data: members } = await svc.from('board_members').select('email, full_name').eq('association_id', association.id).eq('active', true);
    // Link to the board portal on the company's own workspace address.
    const { data: portfolio } = await svc.from('portfolios').select('slug').eq('id', association.portfolio_id).maybeSingle();
    const boardReportsUrl = tenantWorkspaceUrl(portfolio?.slug, '/board/reports');
    const recipients = [...new Map(((members ?? []) as any[])
      .filter((m) => typeof m.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim()))
      .map((m) => [m.email.trim().toLowerCase(), m])).values()];
    const { count } = await queueEmails(svc, recipients.map((m: any) => ({
      to: m.email.trim(),
      toName: m.full_name ?? null,
      subject: `${association.name}: board report for ${fmt(dateFrom)} – ${fmt(dateTo)}`,
      text: `The board report for ${association.name} (${fmt(dateFrom)} – ${fmt(dateTo)}) is ready in your board portal:\n${boardReportsUrl}\n\nIncluded: ${description}.`,
      portfolioId: association.portfolio_id,
      associationId: association.id,
      fromName: association.company_name ?? null,
      // One notice per board member per period, even if the package is republished.
      idempotencyKey: `board-report:${association.id}:${dateTo}:${m.email.trim().toLowerCase()}`,
    })));
    emailed = count;
  }

  await svc.from('audit_logs').insert({
    portfolio_id: association.portfolio_id, entity_type: 'association', entity_id: association.id,
    action: existing ? 'board_report_republished' : 'board_report_published', actor_id: actorId,
    changes: { document_id: doc.id, date_from: dateFrom, date_to: dateTo, sections, share_scope: shareScope, source, emailed },
  });
  return { documentId: doc.id as string, emailed, replaced: Boolean(existing) };
}

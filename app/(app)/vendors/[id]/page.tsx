import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, Surface, SectionTitle } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { inviteVendorToPortal, turnOffVendorPortal } from '../actions';
import { buildVendorPerformanceScorecard, formatPerformanceDays } from '@/lib/vendors/performance';
import { loadPortfolioVendorPerformanceRows } from '@/lib/vendors/performance-query';
import { Stars, summarize } from '@/components/work-orders/rating';
import { RecordMetaPanels, RecordTagChips } from '@/components/records/record-meta';
import { loadRecordMeta } from '@/lib/records/load';
import { tradeLabel } from '@/lib/vendors/options';
import { mergePrivateFieldsOne } from '@/lib/private-fields';

export const dynamic = 'force-dynamic';

const COMPLIANCE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'workers_comp_expiration', label: "Workers' comp" },
  { key: 'general_liability_expiration', label: 'General liability' },
  { key: 'auto_insurance_expiration', label: 'Auto insurance' },
  { key: 'epa_certification_expiration', label: 'EPA certification' },
  { key: 'state_license_expiration', label: 'State license' },
  { key: 'contract_expiration', label: 'Contract' },
];

function expirationTone(value: string | null): { tone: Tone; label: string } {
  if (!value) return { tone: 'neutral', label: 'Not on file' };
  // Date-only compare: coverage ending today is still valid today.
  const ymd = String(value).slice(0, 10);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  if (ymd < now.toISOString().slice(0, 10)) return { tone: 'danger', label: `Expired ${date(value)}` };
  if (ymd <= soon) return { tone: 'warning', label: `Expires ${date(value)}` };
  return { tone: 'success', label: `Valid to ${date(value)}` };
}

function woStatusTone(status: string | null): Tone {
  switch (status) {
    case 'completed':
    case 'closed':
      return 'success';
    case 'in_progress':
    case 'scheduled':
    case 'assigned':
      return 'info';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warning';
  }
}

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; invited?: string; portal_off?: string }>;
}) {
  const me = await requireWorkspaceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) notFound();

  const { data: vendor } = await db
    .from('vendors')
    // vendor_financial_details is finance-only; for other staff the embed is null.
    .select('*, associations(name), vendor_financial_details(bank_account_number)')
    .eq('id', id)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .maybeSingle();
  if (!vendor) notFound();
  // Internal notes live in staff-only vendor_private (the vendor reads its own row).
  await mergePrivateFieldsOne(db, 'vendor_private', 'vendor_id', ['notes'], vendor);

  const meta = await loadRecordMeta(db, 'vendor', id);
  // Portal access is a login linked to this exact record: its first record
  // (vendors.auth_user_id) or one added by accepting this record's invitation.
  const { data: addedLogin, error: addedLoginError } = await db.from('vendor_portal_logins').select('vendor_id').eq('vendor_id', id).is('revoked_at', null).maybeSingle();
  if (addedLoginError) throw new Error(`Could not load this vendor's portal access: ${addedLoginError.message}`);
  const portalLinked = !!vendor.portal_activated && (!!vendor.auth_user_id || !!addedLogin);
  const [performanceRows, { data: workOrders }, { data: ratingRows }, { data: auditRows }, { data: glRow }] = await Promise.all([
    loadPortfolioVendorPerformanceRows(db, portfolioId, [vendor.id]),
    db
      .from('work_orders')
      .select('id, number, title, status, priority, scheduled_date, completed_date, created_at, associations(name)')
      .eq('vendor_id', id)
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(25),
    db
      .from('work_order_ratings')
      .select('score, quality, timeliness, communication, would_hire_again, comment, rater_role, created_at, work_orders(id, number, title)')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('audit_logs')
      .select('action, actor_email, changes, created_at')
      .eq('entity_type', 'vendor')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    vendor.default_gl_account_id
      ? db.from('gl_accounts').select('number, name').eq('id', vendor.default_gl_account_id).eq('portfolio_id', portfolioId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const ratings = (ratingRows ?? []) as any[];
  const rating = summarize(ratings);
  const avgOf = (k: 'quality' | 'timeliness' | 'communication') => {
    const v = ratings.map((r) => r[k]).filter((x) => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + Number(b), 0) / v.length) * 10) / 10 : null;
  };

  const wos = (workOrders ?? []) as any[];
  const scorecard = buildVendorPerformanceScorecard(performanceRows, vendor);
  const emails: string[] = Array.isArray(vendor.emails) ? vendor.emails : [];
  const phones: Array<{ type?: string; number?: string }> = Array.isArray(vendor.phone_numbers) ? vendor.phone_numbers : [];

  const addressParts = [vendor.address_street, vendor.address_city, vendor.address_state, vendor.address_zip].filter(Boolean);

  return (
    <DataWorkspace
      title={vendor.name}
      description={`${vendor.is_management_company ? 'Management company' : (vendor.associations?.name ?? 'No association')} · ${tradeLabel(vendor.trade)} · ${(vendor.vendor_type ?? 'general').replace(/_/g, ' ')}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/vendors"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Vendors</Button></Link>
          <Link href={`/vendors/compliance?vendor=${vendor.id}`}><Button variant="secondary">Compliance docs</Button></Link>
          <Link href={`/vendors/${vendor.id}/edit`}><Button>Edit</Button></Link>
        </div>
      }
    >
      <div className="space-y-6">
        {sp.saved && <Alert tone="success">{sp.saved === 'tags' ? 'Tags saved.' : sp.saved === 'note' ? 'Note added.' : 'Vendor saved.'}</Alert>}
        <RecordTagChips tags={meta.tags} href={(t) => `/vendors?tag=${t}`} />
        {sp.invited && <Alert tone="success">Portal invitation sent to {sp.invited}.</Alert>}
        {sp.portal_off && <Alert tone="success">Portal access turned off for this vendor record.</Alert>}
        {sp.error && <Alert>{sp.error}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Completed · 12 mo', value: scorecard.completed },
            { label: 'Open work orders', value: scorecard.open, sublabel: `${scorecard.overdue} overdue` },
            { label: 'On-time completion', value: scorecard.onTimeRate === null ? '—' : `${scorecard.onTimeRate}%`, sublabel: scorecard.serviceRecord.evidence },
            { label: 'Avg completion', value: formatPerformanceDays(scorecard.averageCompletionDays) },
            { label: 'Service record', value: scorecard.serviceRecord.label },
            { label: 'Compliance', value: scorecard.compliance.label },
            { label: 'Satisfaction', value: rating.average === null ? '—' : `${rating.average} ★`, sublabel: rating.count ? `${rating.count} rating${rating.count === 1 ? '' : 's'}${rating.hireAgainPct !== null ? ` · ${rating.hireAgainPct}% would hire again` : ''}` : 'No ratings yet' },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Surface>
            <SectionTitle title="Contact" />
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Emails</dt>
                <dd className="text-gray-900">{emails.length ? emails.join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Phone</dt>
                <dd className="text-gray-900">{phones.length ? phones.map((p) => `${p.type ? `${p.type}: ` : ''}${p.number}`).join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Address</dt>
                <dd className="text-gray-900">{addressParts.length ? addressParts.join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Payment</dt>
                <dd className="text-gray-900 capitalize">{(vendor.payment_type ?? 'check').replace(/_/g, ' ')}{vendor.payment_terms ? ` · ${vendor.payment_terms}` : ''}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">1099</dt>
                <dd className="text-gray-900">{vendor.send_1099 ? (vendor.has_taxpayer_id ? 'W-9 on file' : 'Needs W-9') : 'Not required'}</dd>
              </div>
            </dl>
          </Surface>

          <Surface>
            <SectionTitle title="Compliance &amp; expirations" />
            <div className="space-y-2">
              {COMPLIANCE_FIELDS.map((f) => {
                const { tone, label } = expirationTone(vendor[f.key] ?? null);
                return (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{f.label}</span>
                    <StatusChip tone={tone}>{label}</StatusChip>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Surface>
            <SectionTitle title="Accounting" />
            <dl className="space-y-2 text-sm">
              {([
                // The check run writes one check per bill regardless of the saved preference.
                ['Checks', 'One check per bill'],
                ['Check stub', vendor.check_stub_breakdown === 'summary' ? 'One line per bill' : 'Each bill line item'],
                ['Hold payments', vendor.hold_payments ? 'Yes' : 'No'],
                ['Payment terms', vendor.payment_terms || '—'],
                ['Default memo', vendor.default_check_memo || '—'],
                ['Default GL', glRow ? `${glRow.number} · ${glRow.name}` : '—'],
                ['Work order adjustment', `${Number(vendor.work_order_adjustment ?? 0).toFixed(2)}%`],
                ['Bank account', vendor.has_bank_account ? `${vendor.savings_account ? 'Savings' : 'Checking'}${vendor.vendor_financial_details?.bank_account_number ? ` ending ${String(vendor.vendor_financial_details.bank_account_number).slice(-4)}` : ' on file'}` : '—'],
              ] as const).map(([k, val]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-40 shrink-0 text-gray-500">{k}</dt>
                  <dd className="text-gray-900">{val}</dd>
                </div>
              ))}
            </dl>
          </Surface>

          <Surface>
            <SectionTitle title="Vendor portal" />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusChip tone={portalLinked ? 'success' : 'neutral'}>{portalLinked ? 'Activated' : 'Not activated'}</StatusChip>
              {vendor.portal_login_last_at && <span className="text-gray-500">Last login {date(vendor.portal_login_last_at)}</span>}
            </div>
            {portalLinked && (
              <form action={turnOffVendorPortal} className="mt-4">
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <Button type="submit" variant="secondary">Turn off portal access</Button>
                <p className="mt-2 text-xs text-gray-500">The vendor keeps access to their other associations.</p>
              </form>
            )}
            {!portalLinked && (
              <form action={inviteVendorToPortal} className="mt-4">
                <input type="hidden" name="vendor_id" value={vendor.id} />
                <input type="hidden" name="return_to" value={`/vendors/${vendor.id}`} />
                <Button type="submit" variant="secondary" disabled={emails.length === 0}>Send portal invitation</Button>
                {emails.length === 0 && <p className="mt-2 text-xs text-gray-500">Add an email address first.</p>}
              </form>
            )}
            {vendor.notes && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <div className="text-[13px] font-semibold text-gray-700">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{vendor.notes}</p>
              </div>
            )}
          </Surface>
        </div>

        <Surface>
          <SectionTitle
            title="Performance scorecard"
            description="Explainable operational evidence — no subjective or hidden rating"
          />
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-gray-500">Service record</div>
              <div className="mt-1"><StatusChip tone={scorecard.serviceRecord.tone}>{scorecard.serviceRecord.label}</StatusChip></div>
              <div className="mt-2 text-xs text-gray-500">{scorecard.serviceRecord.evidence}</div>
            </div>
            <div>
              <div className="text-gray-500">Completion evidence</div>
              <div className="mt-1 font-medium text-gray-950">{scorecard.onTimeCompletions}/{scorecard.scheduledCompletions} on time</div>
              <div className="mt-2 text-xs text-gray-500">Completed work orders in the trailing 365 days</div>
            </div>
            <div>
              <div className="text-gray-500">Compliance evidence</div>
              <div className="mt-1"><StatusChip tone={scorecard.compliance.tone}>{scorecard.compliance.label}</StatusChip></div>
              <div className="mt-2 text-xs text-gray-500">{scorecard.compliance.current} current · {scorecard.compliance.expiringSoon} expiring · {scorecard.compliance.expired} expired · {scorecard.compliance.notRecorded} not recorded</div>
            </div>
          </div>
          <p className="mt-4 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
            A service label is shown only after three scheduled completions. Exceptional is 95%+, Strong is 85%+, Watch is 70%+, and Needs attention is below 70%. Open and overdue counts are current rather than limited to the 12-month completion window.
          </p>
        </Surface>

        <Surface>
          <SectionTitle title="Ratings" description="From staff, owners and the board after completed jobs." />
          {ratings.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No ratings yet. Rate a completed work order to start this vendor&apos;s record.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><div className="text-gray-500">Overall</div><div className="mt-1 flex items-center gap-2"><Stars value={rating.average} size="md" /><span className="font-medium tabular-nums text-gray-950">{rating.average}</span></div></div>
                <div><div className="text-gray-500">Quality</div><div className="mt-1 font-medium tabular-nums text-gray-950">{avgOf('quality') ?? '—'}</div></div>
                <div><div className="text-gray-500">On time</div><div className="mt-1 font-medium tabular-nums text-gray-950">{avgOf('timeliness') ?? '—'}</div></div>
                <div><div className="text-gray-500">Communication</div><div className="mt-1 font-medium tabular-nums text-gray-950">{avgOf('communication') ?? '—'}</div></div>
              </div>
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {ratings.slice(0, 10).map((r, i) => (
                  <li key={i} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={r.score} />
                      <span className="text-xs capitalize text-gray-500">{r.rater_role} · {date(r.created_at)}</span>
                      {r.work_orders && <Link href={`/work-orders/${r.work_orders.id}`} className="text-xs text-gray-500 hover:text-gray-900 hover:underline">#{r.work_orders.number ?? ''} {r.work_orders.title}</Link>}
                    </div>
                    {r.comment && <p className="mt-1 text-gray-700">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Surface>

        <Surface>
          <SectionTitle title="Recent work orders" description={`${wos.length} most recent`} />
          {wos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No work orders assigned to this vendor yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Work order</TH>
                  <TH>Association</TH>
                  <TH>Status</TH>
                  <TH>Scheduled</TH>
                  <TH>Completed</TH>
                </TR>
              </THead>
              <tbody>
                {wos.map((w) => (
                  <TR key={w.id} className="hover:bg-gray-50">
                    <TD>
                      <Link href={`/work-orders/${w.id}`} className="font-medium text-gray-900 hover:underline">
                        {w.title}
                      </Link>
                      {w.number && <div className="text-[13px] text-gray-500">#{w.number}</div>}
                    </TD>
                    <TD className="text-gray-700">{w.associations?.name ?? '—'}</TD>
                    <TD><StatusChip tone={woStatusTone(w.status)}>{(w.status ?? '').replace(/_/g, ' ') || '—'}</StatusChip></TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{w.scheduled_date ? date(w.scheduled_date) : '—'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{w.completed_date ? date(w.completed_date) : '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>

        <RecordMetaPanels type="vendor" id={id} meta={meta} currentUserId={me.auth_user_id} tagHref={(t) => `/vendors?tag=${t}`} />

        <Surface>
          <SectionTitle title="Audit log" description="Changes to this vendor record" />
          {(auditRows ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(auditRows as any[]).map((a, i) => (
                <li key={i} className="py-3 text-sm">
                  <div className="text-gray-900">{String(a.action).replace(/_/g, ' ')} <span className="text-gray-500">· {a.actor_email ?? 'system'} · {date(a.created_at)}</span></div>
                  {a.changes && Object.keys(a.changes).length > 0 && (
                    <div className="mt-1 text-[13px] text-gray-500">Changed: {Object.keys(a.changes).map((k) => k.replace(/_/g, ' ')).join(', ')}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </DataWorkspace>
  );
}

import Link from 'next/link';
import { Plus, ShieldCheck, FileText } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';
import { toggleReminder } from './actions';

export const dynamic = 'force-dynamic';

// Bucket holding owner-uploaded policy documents (association records).
const BUCKET = 'association-documents';

function ReminderToggle({ policyId, field, on, label }: { policyId: string; field: string; on: boolean; label: string }) {
  return (
    <form action={toggleReminder}>
      <input type="hidden" name="policy_id" value={policyId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? '0' : '1'} />
      <button
        type="submit"
        title={`${label} reminder emails are ${on ? 'on' : 'off'} — click to turn ${on ? 'off' : 'on'}`}
        className={
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ' +
          (on
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100')
        }
      >
        {label} {on ? 'on' : 'off'}
      </button>
    </form>
  );
}

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  await requireStaff();
  const supabase = await createClient();

  const { data: policies } = await (supabase as any)
    .from('v_upcoming_expirations')
    .select('*')
    .order('expiration_date', { ascending: true });

  const rows = policies ?? [];
  const expiring30 = rows.filter((r: any) => r.days_remaining <= 30 && r.days_remaining > 0).length;
  const expired = rows.filter((r: any) => r.days_remaining < 0).length;
  const active = rows.filter((r: any) => r.days_remaining > 30).length;

  // Signed links for uploaded certificates (private bucket)
  const certLinkById = new Map<string, string>();
  const toSign = rows.filter((r: any) => r.certificate_file_url && !/^https?:\/\//i.test(r.certificate_file_url));
  if (toSign.length > 0) {
    try {
      const svc = createServiceClient() as any;
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(toSign.map((r: any) => r.certificate_file_url), 3600);
      const byPath = new Map<string, string>();
      for (const s of signed ?? []) if (s?.path && s?.signedUrl) byPath.set(s.path, s.signedUrl);
      for (const r of toSign) {
        const url = byPath.get(r.certificate_file_url);
        if (url) certLinkById.set(r.id, url);
      }
    } catch {}
  }
  for (const r of rows) {
    if (r.certificate_file_url && /^https?:\/\//i.test(r.certificate_file_url)) certLinkById.set(r.id, r.certificate_file_url);
  }

  return (
    <DataWorkspace
      title="Insurance policies"
      description="Track HO6 certificates, coverage, and policy periods. Owners and managers get email reminders 30 and 15 days before expiry."
      actions={
        <Link href="/insurance/new">
          <Button><Plus className="h-4 w-4" /> Add policy</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Active policies', value: active },
            { label: 'Expiring soon (30d)', value: expiring30 },
            { label: 'Expired', value: expired },
            { label: 'Total tracked', value: rows.length },
          ]}
        />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ShieldCheck}
              title="No insurance policies yet"
              description="Add your first HO6 policy to start tracking coverage and expiration dates."
              action={
                <Link href="/insurance/new">
                  <Button><Plus className="h-4 w-4" /> Add first policy</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Owner</TH>
                <TH>Association</TH>
                <TH>Policy #</TH>
                <TH>Insurance Co.</TH>
                <TH>Coverage</TH>
                <TH>Policy period</TH>
                <TH>Document</TH>
                <TH>Reminders</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((p: any) => (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900">{p.owner_name}</TD>
                  <TD className="text-gray-600">{p.association_name ?? '—'}</TD>
                  <TD className="font-mono text-xs text-gray-600">{p.policy_number}</TD>
                  <TD>{p.insurance_company}</TD>
                  <TD className="tabular-nums">{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</TD>
                  <TD>
                    <span className="whitespace-nowrap text-gray-700">{p.effective_date ? date(p.effective_date) : '—'} — </span>
                    <span className={'whitespace-nowrap ' + (p.days_remaining <= 30 ? 'font-medium text-red-700' : 'text-gray-700')}>
                      {date(p.expiration_date)}
                    </span>
                    <div className="text-xs text-gray-500">
                      {p.days_remaining > 0 ? `${p.days_remaining} days left` : p.days_remaining === 0 ? 'Expires today' : 'Expired'}
                    </div>
                  </TD>
                  <TD>
                    {certLinkById.has(p.id) ? (
                      <a href={certLinkById.get(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">
                        <FileText className="h-3.5 w-3.5 text-gray-400" /> View
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      <ReminderToggle policyId={p.id} field="remind_owner" on={p.remind_owner !== false} label="Owner" />
                      <ReminderToggle policyId={p.id} field="remind_manager" on={p.remind_manager !== false} label="Manager" />
                    </div>
                  </TD>
                  <TD>
                    <StatusChip
                      tone={
                        p.status === 'expired'
                          ? 'danger'
                          : p.status === 'expiring_soon'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {p.status === 'expiring_soon' ? 'Expiring' : p.status}
                    </StatusChip>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}

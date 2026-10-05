import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { recordAgreementSignatures, updateManagementAgreement } from '@/lib/rpcs/management-agreements';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'danger' | 'info'> = {
  draft: 'neutral', active: 'success', renewing: 'info', expired: 'danger', terminated: 'danger',
};

function renewalNotice(a: any): { tone: 'warning' | 'danger' | 'info'; text: string } | null {
  if (!a.end_date || !['active', 'renewing'].includes(a.status)) return null;
  const end = new Date(`${a.end_date}T00:00:00`);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  const notice = Number(a.termination_notice_days ?? 0);
  if (days < 0) return { tone: 'danger', text: `This agreement ended ${date(a.end_date)}. Renew it or mark it expired.` };
  if (notice && days <= notice) {
    return { tone: 'warning', text: a.auto_renew
      ? `Auto-renews ${date(a.end_date)} for ${a.renewal_term_months ?? 12} months. The ${notice}-day notice window to change terms is open now.`
      : `Ends ${date(a.end_date)} (${days} days). The ${notice}-day notice window is open — confirm renewal with the board.` };
  }
  if (days <= 90) return { tone: 'info', text: `Ends ${date(a.end_date)} — ${days} days from today.` };
  return null;
}

export default async function ManagementAgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const [{ data: a }, { data: associations }] = await Promise.all([
    db.from('management_agreements')
      .select('*, associations(id, name), owners(id, full_name)')
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle(),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (!a) notFound();

  const terms = (a.terms ?? {}) as { management_fee?: number | null; fee_basis?: string | null; notes?: string };
  const notice = renewalNotice(a);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/owners/management-agreements" className="transition-colors hover:text-gray-700">Management agreements</Link>}
          title={a.name}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusChip tone={STATUS_TONE[a.status] ?? 'neutral'}>{String(a.status).replace(/_/g, ' ')}</StatusChip>
              <span>{a.associations?.name ?? a.owners?.full_name ?? 'No association linked'}</span>
              <span>· {date(a.start_date)} — {a.end_date ? date(a.end_date) : 'ongoing'}</span>
            </span>
          }
          actions={!a.signed_at ? <Link href={`/signatures/new?subject_type=management_agreement&subject_id=${a.id}`}><Button>Send for e-signature</Button></Link> : undefined}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">{sp.saved}</Alert>}
      {notice && <Alert tone={notice.tone} className="mb-5">{notice.text}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Section title="Terms" padded>
          <form action={updateManagementAgreement} className="space-y-4">
            <input type="hidden" name="id" value={a.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required className="sm:col-span-2">
                <Input id="name" name="name" required maxLength={200} defaultValue={a.name} />
              </Field>
              <Field label="Association" htmlFor="association_id">
                <Select id="association_id" name="association_id" defaultValue={a.association_id ?? ''}>
                  <option value="">None</option>
                  {(associations ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue={a.status}>
                  {['draft', 'active', 'renewing', 'expired', 'terminated'].map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
                </Select>
              </Field>
              <Field label="Start date" htmlFor="start_date" required>
                <Input id="start_date" name="start_date" type="date" required defaultValue={a.start_date ?? ''} />
              </Field>
              <Field label="End date" htmlFor="end_date" hint="Leave blank for an open-ended term.">
                <Input id="end_date" name="end_date" type="date" defaultValue={a.end_date ?? ''} />
              </Field>
              <Field label="Management fee ($)" htmlFor="management_fee">
                <Input id="management_fee" name="management_fee" type="number" min="0" step="0.01" defaultValue={terms.management_fee ?? ''} />
              </Field>
              <Field label="Fee basis" htmlFor="fee_basis">
                <Select id="fee_basis" name="fee_basis" defaultValue={terms.fee_basis ?? 'per_month'}>
                  <option value="per_month">Flat per month</option>
                  <option value="per_unit_month">Per unit per month</option>
                  <option value="per_year">Flat per year</option>
                  <option value="percent_of_income">Percent of assessment income</option>
                </Select>
              </Field>
              <Field label="Renewal term (months)" htmlFor="renewal_term_months">
                <Input id="renewal_term_months" name="renewal_term_months" type="number" min="0" max="120" defaultValue={a.renewal_term_months ?? ''} />
              </Field>
              <Field label="Termination notice (days)" htmlFor="termination_notice_days">
                <Input id="termination_notice_days" name="termination_notice_days" type="number" min="0" max="730" defaultValue={a.termination_notice_days ?? ''} />
              </Field>
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="auto_renew" defaultChecked={a.auto_renew} className="h-4 w-4 rounded border-gray-300" />
              Renews automatically unless either party gives notice
            </label>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={a.notes ?? terms.notes ?? ''} />
            </Field>
            <Button type="submit">Save terms</Button>
          </form>
        </Section>

        <div>
          <Section title="Execution" padded>
            {a.signed_at ? (
              <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <dt className="text-gray-500">Association</dt><dd className="text-gray-900">{a.signed_by_owner ?? a.owner_signature ?? '—'}</dd>
                <dt className="text-gray-500">Signed</dt><dd className="text-gray-900">{date(a.signed_at)}</dd>
                <dt className="text-gray-500">Manager</dt><dd className="text-gray-900">{a.manager_signature ?? '—'}</dd>
              </dl>
            ) : (
              <form action={recordAgreementSignatures} className="space-y-3">
                <input type="hidden" name="id" value={a.id} />
                <p className="text-[13px] text-gray-500">Record the executed agreement. A draft becomes active.</p>
                <Field label="Signed for the association by" htmlFor="signed_by_owner">
                  <Input id="signed_by_owner" name="signed_by_owner" required maxLength={120} placeholder="e.g. Jane Doe, Board President" />
                </Field>
                <Field label="Signed on" htmlFor="signed_on">
                  <Input id="signed_on" name="signed_on" type="date" required max={todayInZone()} />
                </Field>
                <Button type="submit" variant="secondary" className="w-full">Record signatures</Button>
              </form>
            )}
          </Section>
          {typeof a.document_url === 'string' && /^https:\/\//i.test(a.document_url) && (
            <Section title="Document" padded>
              <a href={a.document_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-gray-600">Open signed agreement</a>
            </Section>
          )}
        </div>
      </div>
    </Workspace>
  );
}

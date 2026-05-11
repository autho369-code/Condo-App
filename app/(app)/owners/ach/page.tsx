import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OwnerAchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const [{ data: owners }, { data: paymentMethods }, { data: mandates }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, email, portal_activated, archived_at')
      .is('archived_at', null)
      .order('full_name'),
    (supabase as any)
      .from('payment_methods')
      .select('id, owner_id, method_type, bank_name, account_type, last_four, is_default, is_verified, verified_at, archived_at')
      .is('archived_at', null),
    (supabase as any)
      .from('autopay_mandates')
      .select('id, owner_id, status, frequency, next_run_date, failure_count, last_failure_reason'),
  ]);

  const methodsByOwner = new Map<string, any[]>();
  for (const method of paymentMethods ?? []) {
    const ownerId = (method as any).owner_id;
    methodsByOwner.set(ownerId, [...(methodsByOwner.get(ownerId) ?? []), method]);
  }

  const mandateByOwner = new Map<string, any>();
  for (const mandate of mandates ?? []) {
    if (!mandateByOwner.has((mandate as any).owner_id)) mandateByOwner.set((mandate as any).owner_id, mandate);
  }

  let rows: any[] = (owners ?? []).map((owner: any) => ({
    owner,
    methods: methodsByOwner.get(owner.id) ?? [],
    mandate: mandateByOwner.get(owner.id),
  }));

  if (sp.owner) rows = rows.filter((row) => row.owner.id === sp.owner);
  if (q) {
    rows = rows.filter((row) =>
      [row.owner.full_name, row.owner.email, row.methods[0]?.bank_name, row.methods[0]?.last_four].some((value) =>
        value?.toLowerCase().includes(q),
      ),
    );
  }

  const activeMandates = (mandates ?? []).filter((mandate: any) => mandate.status === 'active').length;
  const verifiedMethods = (paymentMethods ?? []).filter((method: any) => method.is_verified).length;

  return (
    <DataWorkspace
      title="Owner ACH Setup"
      description="Review owner payment methods, autopay mandates, verification status, and ACH readiness before enabling payment workflows."
      actions={<Link href="/owners" className="text-sm font-medium text-champagne-700 hover:underline">Back to homeowners</Link>}
      rail={
        <div className="space-y-3 text-sm text-ink-700">
          <div className="text-xs font-semibold uppercase text-ink-500">Confirmation rule</div>
          <div className="rounded border border-amber-200 bg-champagne-50 p-3 text-xs text-amber-800">
            ACH setup is a protected action. Use this screen to review readiness, then confirm changes through the payment processor flow.
          </div>
          <Link href="/reports?slug=homeowner-ledger" className="block rounded border border-ink-100 p-3 hover:bg-cream-50">Run homeowner ledger report</Link>
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip
          metrics={[
            { label: 'Owners in queue', value: rows.length },
            { label: 'Payment methods', value: paymentMethods?.length ?? 0 },
            { label: 'Verified methods', value: verifiedMethods },
            { label: 'Active autopay', value: activeMandates },
          ]}
        />

        <FilterBar action="/owners/ach" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner, email, bank, or last four" />

        <Table>
          <THead>
            <TR>
              <TH>Owner</TH>
              <TH>Payment Method</TH>
              <TH>Verification</TH>
              <TH>Autopay</TH>
              <TH>Next Step</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map(({ owner, methods, mandate }) => {
              const primary = methods.find((method: any) => method.is_default) ?? methods[0];
              return (
                <TR key={owner.id} className="hover:bg-cream-50">
                  <TD>
                    <Link href={`/owners/${owner.id}`} className="font-medium text-champagne-700 hover:underline">{owner.full_name}</Link>
                    <div className="mt-1 text-xs text-ink-500">{owner.email}</div>
                  </TD>
                  <TD>
                    {primary ? (
                      <>
                        <div className="font-medium text-ink-900">{primary.bank_name ?? primary.method_type}</div>
                        <div className="mt-1 text-xs text-ink-500">{primary.account_type ?? 'bank'} ending {primary.last_four ?? '----'}</div>
                      </>
                    ) : (
                      <span className="text-ink-500">No payment method</span>
                    )}
                  </TD>
                  <TD>
                    <StatusChip tone={primary?.is_verified ? 'success' : primary ? 'warning' : 'neutral'}>
                      {primary?.is_verified ? 'Verified' : primary ? 'Needs verification' : 'Not started'}
                    </StatusChip>
                    <div className="mt-1 text-xs text-ink-500">Verified {date(primary?.verified_at)}</div>
                  </TD>
                  <TD>
                    <StatusChip tone={mandate?.status === 'active' ? 'success' : mandate ? 'warning' : 'neutral'}>
                      {mandate?.status?.replace(/_/g, ' ') ?? 'No mandate'}
                    </StatusChip>
                    <div className="mt-1 text-xs text-ink-500">Next run {date(mandate?.next_run_date)}</div>
                  </TD>
                  <TD>
                    <Link href={`/owners/forms?owner=${owner.id}&template=ach_authorization`} className="text-sm font-medium text-champagne-700 hover:underline">
                      Prepare authorization
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}

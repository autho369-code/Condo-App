import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { verifyVendorAch, activateVendorAch, revokeVendorAch } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

function maskAccount(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '—';
  const len = accountNumber.length;
  if (len <= 4) return accountNumber;
  return '••••' + accountNumber.slice(-4);
}

function AchStatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'success' : status === 'verified' ? 'info' : 'warning';
  const label = status === 'active' ? 'Active' : status === 'verified' ? 'Verified' : 'Pending';
  return <StatusChip tone={tone}>{label}</StatusChip>;
}

function AchWorkflowBadge({ status }: { status: string }) {
  const steps = ['pending', 'verified', 'active'];
  const currentIdx = steps.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isComplete = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <div className={`h-px w-6 ${isComplete ? 'bg-blue-500' : 'bg-gray-200'}`} />}
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                isComplete
                  ? isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                    : 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isComplete && !isCurrent ? '✓' : i + 1}
            </div>
          </div>
        );
      })}
      <span className="ml-3 text-xs capitalize text-gray-500">{status === 'active' ? 'Active' : status === 'verified' ? 'Verified' : 'Pending'}</span>
    </div>
  );
}

export default async function VendorAchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const { data } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, payment_type, bank_routing_number, bank_account_number, savings_account, is_auto_pay, auto_pay_setup_at, auto_pay_notes, ach_status, ach_verified_at, ach_verified_by, ach_activated_at, ach_activated_by, hold_payments, archived_at')
    .is('archived_at', null)
    .order('name');

  // Fetch verifier/activator names
  const staffIds = new Set<string>();
  for (const v of (data ?? [])) {
    if (v.ach_verified_by) staffIds.add(v.ach_verified_by);
    if (v.ach_activated_by) staffIds.add(v.ach_activated_by);
  }
  const { data: profiles } = staffIds.size > 0
    ? await (supabase as any).from('profiles').select('id, full_name').in('id', Array.from(staffIds))
    : { data: [] };
  const profileMap = new Map<string, string>();
  for (const p of (profiles ?? [])) profileMap.set(p.id, p.full_name);

  let rows: any[] = data ?? [];

  // Filter for single-vendor view
  const focusVendor = sp.vendor ? rows.find((vendor: any) => vendor.id === sp.vendor) : null;

  if (sp.vendor) {
    rows = rows.filter((vendor: any) => vendor.id === sp.vendor);
  }
  if (q) {
    rows = rows.filter((vendor: any) =>
      [vendor.name, vendor.trade, vendor.payment_type].some((value) => value?.toLowerCase().includes(q)),
    );
  }

  const achReady = (data ?? []).filter((vendor: any) => vendor.bank_routing_number && vendor.bank_account_number).length;
  const autoPay = (data ?? []).filter((vendor: any) => vendor.is_auto_pay).length;
  const verified = (data ?? []).filter((vendor: any) => vendor.ach_status === 'verified' || vendor.ach_status === 'active').length;
  const active = (data ?? []).filter((vendor: any) => vendor.ach_status === 'active').length;

  // If focused on a single vendor that has bank info, show the authorization detail
  if (focusVendor && focusVendor.bank_routing_number && focusVendor.bank_account_number) {
    const hasBank = !!(focusVendor.bank_routing_number && focusVendor.bank_account_number);
    const canVerify = focusVendor.ach_status === 'pending';
    const canActivate = focusVendor.ach_status === 'verified';
    const canRevoke = focusVendor.ach_status === 'verified' || focusVendor.ach_status === 'active';

    return (
      <DataWorkspace
        title="Vendor Bank Account Authorization"
        description={`Review and authorize ACH payments for ${focusVendor.name}.`}
        actions={
          <>
            <Link href="/vendors/ach"><Button variant="secondary">All vendors</Button></Link>
            <Link href="/vendors"><Button variant="ghost">Back to vendors</Button></Link>
          </>
        }
      >
        <div className="space-y-6">
          {/* Vendor header */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">{focusVendor.name}</h2>
                <p className="mt-1 text-sm capitalize text-gray-500">{focusVendor.trade?.replace(/_/g, ' ')}</p>
                <div className="mt-2 flex gap-2">
                  <StatusChip tone={focusVendor.payment_type === 'ach' ? 'success' : 'neutral'}>
                    {focusVendor.payment_type?.replace(/_/g, ' ') ?? 'check'}
                  </StatusChip>
                  {focusVendor.hold_payments && <StatusChip tone="danger">Payment hold</StatusChip>}
                </div>
              </div>
              <AchStatusBadge status={focusVendor.ach_status ?? 'pending'} />
            </div>
          </div>

          {/* Workflow progress */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-3 text-xs font-semibold uppercase text-gray-500">Authorization Progress</div>
            <AchWorkflowBadge status={focusVendor.ach_status ?? 'pending'} />
          </div>

          {/* Bank details */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-3 text-xs font-semibold uppercase text-gray-500">Bank Account Details</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">Routing Number</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gray-900">{focusVendor.bank_routing_number}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Account Number</div>
                <div className="mt-1 font-mono text-lg font-semibold text-gray-900">{maskAccount(focusVendor.bank_account_number)}</div>
                <div className="mt-1 text-xs text-gray-400">Last 4 digits shown — full number stored securely</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Account Type</div>
                <div className="mt-1 text-sm font-medium text-gray-900">{focusVendor.savings_account ? 'Savings' : 'Checking'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Auto-Pay</div>
                <div className="mt-1">
                  <StatusChip tone={focusVendor.is_auto_pay ? 'info' : 'neutral'}>
                    {focusVendor.is_auto_pay ? 'Enabled' : 'Not enabled'}
                  </StatusChip>
                  {focusVendor.auto_pay_setup_at && (
                    <div className="mt-1 text-xs text-gray-500">Since {date(focusVendor.auto_pay_setup_at)}</div>
                  )}
                </div>
              </div>
            </div>
            {focusVendor.auto_pay_notes && (
              <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                <span className="font-medium">Notes:</span> {focusVendor.auto_pay_notes}
              </div>
            )}
          </div>

          {/* Audit log */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-3 text-xs font-semibold uppercase text-gray-500">Audit Log</div>
            <div className="space-y-3">
              {/* Bank info added — always shown if bank info exists */}
              {hasBank && (
                <div className="flex items-start gap-3 border-b border-gray-100 pb-3 text-sm">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">i</div>
                  <div>
                    <div className="font-medium text-gray-900">Bank account added</div>
                    <div className="text-xs text-gray-500">
                      Routing {focusVendor.bank_routing_number} / Account ending {maskAccount(focusVendor.bank_account_number)}
                      {' '}· {focusVendor.savings_account ? 'Savings' : 'Checking'}
                    </div>
                  </div>
                </div>
              )}

              {/* Verified entry */}
              {focusVendor.ach_verified_at && (
                <div className="flex items-start gap-3 border-b border-gray-100 pb-3 text-sm">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-600">✓</div>
                  <div>
                    <div className="font-medium text-gray-900">Bank account verified</div>
                    <div className="text-xs text-gray-500">
                      Verified {date(focusVendor.ach_verified_at, 'long')}
                      {focusVendor.ach_verified_by && <> by {profileMap.get(focusVendor.ach_verified_by) ?? 'staff'}</>}
                    </div>
                  </div>
                </div>
              )}

              {/* Activated entry */}
              {focusVendor.ach_activated_at && (
                <div className="flex items-start gap-3 border-b border-gray-100 pb-3 text-sm">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs text-green-600">✓</div>
                  <div>
                    <div className="font-medium text-gray-900">ACH payments activated</div>
                    <div className="text-xs text-gray-500">
                      Activated {date(focusVendor.ach_activated_at, 'long')}
                      {focusVendor.ach_activated_by && <> by {profileMap.get(focusVendor.ach_activated_by) ?? 'staff'}</>}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">Auto-pay enabled automatically on activation</div>
                  </div>
                </div>
              )}

              {/* Pending state */}
              {!focusVendor.ach_verified_at && !focusVendor.ach_activated_at && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-600">!</div>
                  <div>
                    <div className="font-medium text-gray-900">Awaiting verification</div>
                    <div className="text-xs text-gray-500">Bank account details have not yet been verified by staff.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-3 text-xs font-semibold uppercase text-gray-500">Actions</div>
            <div className="flex flex-wrap gap-3">
              {canVerify && (
                <form action={async (fd: FormData) => { await verifyVendorAch(fd); }}>
                  <input type="hidden" name="vendor_id" value={focusVendor.id} />
                  <Button type="submit" size="lg">Verify Bank Account</Button>
                </form>
              )}
              {canActivate && (
                <form action={async (fd: FormData) => { await activateVendorAch(fd); }}>
                  <input type="hidden" name="vendor_id" value={focusVendor.id} />
                  <Button type="submit" size="lg" variant="secondary">Activate ACH Payments</Button>
                </form>
              )}
              {canRevoke && (
                <form action={revokeVendorAch}>
                  <input type="hidden" name="vendor_id" value={focusVendor.id} />
                  <Button type="submit" variant="danger">Revoke Authorization</Button>
                </form>
              )}
              {focusVendor.ach_status === 'active' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                  ACH is active. Payments can be sent via ACH.
                </div>
              )}
            </div>
          </div>
        </div>
      </DataWorkspace>
    );
  }

  // If no focus vendor (or vendor without bank info), show overview list
  return (
    <DataWorkspace
      title="Vendor ACH Setup"
      description="Review bank readiness, payout method, auto-pay flags, and authorization status before enabling vendor ACH."
      actions={<Link href="/vendors"><Button variant="secondary">Back to vendors</Button></Link>}
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Vendors reviewed', value: rows.length },
          { label: 'ACH ready', value: achReady },
          { label: 'Verified', value: verified },
          { label: 'Active', value: active },
          { label: 'Missing bank info', value: Math.max((data?.length ?? 0) - achReady, 0) },
        ]} />
        <FilterBar action="/vendors/ach" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, trade, or payment type" />
        <Table>
          <THead><TR><TH>Vendor</TH><TH>Payment</TH><TH>Bank Details</TH><TH>ACH Status</TH><TH>Auto-pay</TH><TH>Next Step</TH></TR></THead>
          <tbody>
            {rows.map((vendor: any) => {
              const hasBank = vendor.bank_routing_number && vendor.bank_account_number;
              return (
                <TR key={vendor.id} className="hover:bg-gray-50">
                  <TD>
                    <Link href={`/vendors/ach?vendor=${vendor.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                      {vendor.name}
                    </Link>
                    <div className="mt-1 text-xs capitalize text-gray-500">{vendor.trade?.replace(/_/g, ' ')}</div>
                  </TD>
                  <TD>
                    <StatusChip tone={vendor.payment_type === 'ach' ? 'success' : 'neutral'}>
                      {vendor.payment_type?.replace(/_/g, ' ') ?? 'check'}
                    </StatusChip>
                    {vendor.hold_payments && <div className="mt-1"><StatusChip tone="danger">Payment hold</StatusChip></div>}
                  </TD>
                  <TD>
                    {hasBank ? (
                      <>
                        <div className="text-sm font-mono text-gray-900">…{maskAccount(vendor.bank_account_number)}</div>
                        <div className="mt-1 text-xs text-gray-500">{vendor.savings_account ? 'Savings' : 'Checking'}</div>
                      </>
                    ) : (
                      <StatusChip tone="warning">Missing bank info</StatusChip>
                    )}
                  </TD>
                  <TD>
                    <AchStatusBadge status={vendor.ach_status ?? 'pending'} />
                    {vendor.ach_verified_at && <div className="mt-1 text-xs text-gray-500">Verified {date(vendor.ach_verified_at)}</div>}
                  </TD>
                  <TD>
                    <StatusChip tone={vendor.is_auto_pay ? 'info' : 'neutral'}>
                      {vendor.is_auto_pay ? 'Enabled' : 'Not enabled'}
                    </StatusChip>
                    <div className="mt-1 text-xs text-gray-500">Setup {date(vendor.auto_pay_setup_at)}</div>
                  </TD>
                  <TD>
                    {hasBank ? (
                      <Link href={`/vendors/ach?vendor=${vendor.id}`} className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                        Review authorization →
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">Add bank details first</span>
                    )}
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

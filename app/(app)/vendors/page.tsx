import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type VendorColumn = {
  key: string;
  label: string;
  kind?: 'date' | 'tax' | 'bank';
};

const VENDOR_COLUMNS: VendorColumn[] = [
  { key: 'vendor_type', label: 'Vendor Type' },
  { key: 'trade', label: 'Trade' },
  { key: 'phone_numbers', label: 'Phone Numbers' },
  { key: 'emails', label: 'Emails' },
  { key: 'address_street', label: 'Address Street' },
  { key: 'address_city', label: 'City' },
  { key: 'address_state', label: 'State' },
  { key: 'address_zip', label: 'ZIP' },
  { key: 'portal_activated', label: 'Portal Activated' },
  { key: 'portal_login_last_at', label: 'Portal Last Login', kind: 'date' },
  { key: 'taxpayer_name', label: 'Taxpayer Name' },
  { key: 'taxpayer_id', label: 'Taxpayer ID', kind: 'tax' },
  { key: 'tax_account_number', label: 'Tax Account #' },
  { key: 'send_1099', label: 'Send 1099' },
  { key: 'check_consolidation', label: 'Check Consolidation' },
  { key: 'check_stub_breakdown', label: 'Check Stub Breakdown' },
  { key: 'hold_payments', label: 'Hold Payments' },
  { key: 'email_echeck_receipt', label: 'Email eCheck Receipt' },
  { key: 'payment_terms', label: 'Payment Terms' },
  { key: 'default_check_memo', label: 'Default Check Memo' },
  { key: 'default_gl_account_id', label: 'Default GL Account' },
  { key: 'work_order_adjustment', label: 'WO Adjustment' },
  { key: 'payment_type', label: 'Payment Type' },
  { key: 'bank_routing_number', label: 'Routing #', kind: 'bank' },
  { key: 'bank_account_number', label: 'Bank Account #', kind: 'bank' },
  { key: 'savings_account', label: 'Savings Account' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created', kind: 'date' },
  { key: 'updated_at', label: 'Updated', kind: 'date' },
  { key: 'is_auto_pay', label: 'Auto Pay' },
  { key: 'auto_pay_setup_at', label: 'Auto Pay Setup', kind: 'date' },
  { key: 'auto_pay_notes', label: 'Auto Pay Notes' },
  { key: 'is_utility', label: 'Utility' },
] as const;

export default async function VendorsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('vendors')
    .select('*')
    .is('archived_at', null)
    .order('name');

  const vendors = rows ?? [];
  const activeCount = vendors.length;
  const achReadyCount = vendors.filter((v: any) => v.payment_type === 'ach' || Boolean(v.bank_routing_number && v.bank_account_number)).length;
  const w9NeededCount = vendors.filter((v: any) => !v.taxpayer_id && !v.is_utility).length;
  const holdCount = vendors.filter((v: any) => v.hold_payments).length;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-5xl px-8 py-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Vendors</h1>
                <p className="mt-1 max-w-3xl text-sm text-gray-500">
                  Manage contractors, utilities, W-9 readiness, ACH setup, compliance documents, and vendor forms.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/send-email"><Button variant="secondary">Send vendor form</Button></Link>
                <Link href="/vendors/new"><Button>New vendor</Button></Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Metric label="Active vendors" value={activeCount} />
              <Metric label="ACH ready" value={achReadyCount} />
              <Metric label="W-9 needed" value={w9NeededCount} />
            </div>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Search</div>
              <div className="flex gap-3">
                <input
                  placeholder="Search vendor, trade, type, payment method"
                  className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm"
                />
                <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option>All trades</option>
                </select>
                <button className="h-10 rounded-md bg-gray-900 px-5 text-sm font-medium text-white">Apply</button>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Vendor Ledger</h2>
                  <p className="text-xs text-gray-500">3 center columns; remaining Supabase fields live in each row dropdown.</p>
                </div>
                <Link href="/reports/vendor_directory" className="text-xs font-medium text-blue-700 hover:underline">Vendor Directory</Link>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="border-b border-gray-200 px-4 py-2 font-semibold">Vendor</th>
                    <th className="border-b border-gray-200 px-4 py-2 font-semibold">Payment & Compliance</th>
                    <th className="border-b border-gray-200 px-4 py-2 font-semibold">Menu</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor: any) => (
                    <tr key={vendor.id} className="border-b border-gray-100 align-top hover:bg-blue-50/40">
                      <td className="px-4 py-3">
                        <Link href="/vendors" className="font-medium text-blue-700 hover:underline">{vendor.name}</Link>
                        <div className="mt-1 text-xs capitalize text-gray-500">
                          {[vendor.vendor_type, vendor.trade].filter(Boolean).map((v: string) => v.replace(/_/g, ' ')).join(' - ') || 'No type'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{formatContact(vendor)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Flag show={vendor.payment_type} label={String(vendor.payment_type ?? '').replace(/_/g, ' ')} />
                          <Flag show={vendor.send_1099} label="1099" tone="amber" />
                          <Flag show={vendor.hold_payments} label="Hold" tone="red" />
                          <Flag show={vendor.portal_activated} label="Portal" tone="green" />
                          <Flag show={vendor.is_auto_pay} label="Auto pay" tone="purple" />
                          <Flag show={vendor.is_utility} label="Utility" tone="blue" />
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Tax: {formatVendorCell(vendor.taxpayer_id, 'tax')} · Bank: {formatVendorCell(vendor.bank_account_number, 'bank')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-start gap-2">
                          <select
                            aria-label={`Actions for ${vendor.name}`}
                            className="h-8 rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                            defaultValue=""
                          >
                            <option value="" disabled>Actions</option>
                            <option>Vendor profile</option>
                            <option>ACH setup</option>
                            <option>Request W-9</option>
                            <option>Request documents</option>
                            <option>Send vendor form</option>
                            <option>New bill</option>
                            <option>Payment history</option>
                          </select>
                          <details className="min-w-44">
                            <summary className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs text-blue-700">More fields</summary>
                            <div className="mt-2 max-h-72 w-80 overflow-y-auto rounded border border-gray-200 bg-white p-3 shadow-sm">
                              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-xs">
                                {VENDOR_COLUMNS.map((column) => (
                                  <FieldRow key={column.key} label={column.label} value={formatVendorCell(vendor[column.key], column.kind)} />
                                ))}
                              </dl>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                        No vendors are visible for this manager portfolio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </main>
      </div>
      <VendorRightPanel holdCount={holdCount} />
    </div>
  );
}

function VendorRightPanel({ holdCount }: { holdCount: number }) {
  return (
    <ContextPanel title="Tasks">
      <PanelSection title="Tasks">
        <PanelLink href="/vendors/new">New Vendor</PanelLink>
        <PanelLink href="/vendors">Vendor ACH Setup</PanelLink>
        <PanelLink href="/send-email">Request W-9</PanelLink>
        <PanelLink href="/forms">Request Documents</PanelLink>
        <PanelLink href="/send-email">Send Vendor Form</PanelLink>
        <PanelLink href="/vendors">ACH Setup</PanelLink>
        <PanelLink href="/send-email">Request W-9</PanelLink>
        <PanelLink href="/forms">Vendor Documents</PanelLink>
        <PanelLink href="/send-email">Vendor Forms</PanelLink>
        <PanelLink href="/vendors?filter=payment-holds">Payment Holds ({holdCount})</PanelLink>
      </PanelSection>
      <PanelSection title="Reports">
        <PanelLink href="/reports/vendor_directory">Vendor Directory</PanelLink>
        <PanelLink href="/reports/vendor_1099_summary">1099 Report</PanelLink>
        <PanelLink href="/reports/check_register">Check Register</PanelLink>
      </PanelSection>
      <PanelSection title="Help Topics">
        <PanelLink href="/vendors">Managing Vendors</PanelLink>
      </PanelSection>
    </ContextPanel>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="truncate text-gray-900" title={value}>{value}</dd>
    </>
  );
}

function Flag({ show, label, tone = 'gray' }: { show: unknown; label: string; tone?: 'gray' | 'green' | 'amber' | 'red' | 'purple' | 'blue' }) {
  if (!show) return null;
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`rounded px-2 py-0.5 text-xs capitalize ${tones[tone]}`}>{label}</span>;
}

function formatContact(vendor: any) {
  const email = Array.isArray(vendor.emails) ? vendor.emails[0] : null;
  const phone = Array.isArray(vendor.phone_numbers) ? vendor.phone_numbers[0]?.number ?? vendor.phone_numbers[0]?.value ?? vendor.phone_numbers[0] : null;
  return [email, phone].filter(Boolean).join(' - ') || 'No contact on file';
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function formatVendorCell(value: unknown, kind?: string) {
  if (value === null || value === undefined || value === '') return '-';
  if (kind === 'date') return date(value as string);
  if (kind === 'tax') return maskIdentifier(String(value));
  if (kind === 'bank') return maskIdentifier(String(value));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replace(/_/g, ' ');
}

function maskIdentifier(value: string) {
  if (value.length <= 4) return value;
  return `...${value.slice(-4)}`;
}

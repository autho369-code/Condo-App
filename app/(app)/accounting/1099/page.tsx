import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { SectionTitle, EmptyState } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { money } from '@/lib/utils';
import { FileText } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const IRS_1099_NEC_THRESHOLD = 600;
const IRS_1099_MISC_THRESHOLD = 600;
const CURRENT_YEAR = new Date().getFullYear();

type Vendor1099Summary = {
  vendor_id: string;
  vendor_name: string;
  taxpayer_name: string;
  taxpayer_id: string;
  tax_account_number: string | null;
  vendor_type: string;
  total_paid: number;
  bill_count: number;
  is_over_threshold: boolean;
  form_type: '1099-NEC' | '1099-MISC';
};

function maskTIN(tin: string): string {
  if (!tin) return '—';
  // Show only last 4 digits
  const cleaned = tin.replace(/[^0-9]/g, '');
  if (cleaned.length <= 4) return tin;
  return '***-**-' + cleaned.slice(-4);
}

export default async function Tax1099Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const me = await requireStaff();
  const { year: yearStr } = await searchParams;
  const taxYear = parseInt(yearStr ?? '') || CURRENT_YEAR;

  const supabase = await createClient();

  // Fetch all paid bills for the tax year with vendor 1099 info
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;

  const { data: bills } = await (supabase as any)
    .from('payable_bills')
    .select(`
      id, amount, paid_at, bill_date, status, 
      vendor:vendor_id(
        id, name, vendor_type, send_1099, 
        taxpayer_name, taxpayer_id, tax_account_number,
        address_street, address_city, address_state, address_zip
      )
    `)
    .eq('status', 'paid')
    .gte('paid_at', yearStart)
    .lte('paid_at', yearEnd)
    .order('paid_at', { ascending: false });

  // Aggregate by vendor — only include vendors with send_1099=true
  const vendorMap = new Map<string, Vendor1099Summary>();
  for (const bill of (bills ?? []) as any[]) {
    const v = bill.vendor;
    if (!v || typeof v !== 'object' || !v.send_1099) continue;

    const vid = v.id;
    if (!vendorMap.has(vid)) {
      vendorMap.set(vid, {
        vendor_id: vid,
        vendor_name: v.name ?? 'Unknown',
        taxpayer_name: v.taxpayer_name ?? v.name ?? 'Unknown',
        taxpayer_id: v.taxpayer_id ?? '',
        tax_account_number: v.tax_account_number ?? null,
        vendor_type: v.vendor_type ?? '',
        total_paid: 0,
        bill_count: 0,
        is_over_threshold: false,
        form_type: '1099-NEC',
      });
    }
    const entry = vendorMap.get(vid)!;
    entry.total_paid += bill.amount ?? 0;
    entry.bill_count += 1;
  }

  // Determine threshold and form type
  for (const [, v] of vendorMap) {
    // 1099-NEC for non-employee compensation (contractors, services)
    v.is_over_threshold = v.total_paid >= IRS_1099_NEC_THRESHOLD;
    v.form_type = '1099-NEC';
  }

  const vendors = Array.from(vendorMap.values()).sort(
    (a, b) => b.total_paid - a.total_paid
  );

  const totalReportable = vendors
    .filter((v) => v.is_over_threshold)
    .reduce((sum, v) => sum + v.total_paid, 0);

  const totalVendorsWith1099 = vendors.length;
  const vendorsOverThreshold = vendors.filter((v) => v.is_over_threshold).length;
  const vendorsUnderThreshold = vendors.filter((v) => !v.is_over_threshold).length;

  // Available years for selector (current year and 2 years back)
  const availableYears = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

  return (
    <DataWorkspace
      title="1099 Tax Reporting"
      description={`IRS Form 1099-NEC for non-employee compensation paid to vendors during tax year ${taxYear}. Filing threshold: $${IRS_1099_NEC_THRESHOLD.toLocaleString()}.`}
      actions={
        <>
          <form method="get" className="flex items-center gap-2">
            <Select name="year" defaultValue={taxYear} className="w-28" aria-label="Tax year">
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">View</Button>
          </form>
          {vendorsOverThreshold > 0 && (
            <Link href={`/accounting/1099/print?year=${taxYear}`}>
              <Button>Generate 1099 forms</Button>
            </Link>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            {
              label: '1099 vendors',
              value: totalVendorsWith1099,
              sublabel: `${vendorsOverThreshold} over threshold · ${vendorsUnderThreshold} under`,
            },
            {
              label: 'Threshold',
              value: `$${IRS_1099_NEC_THRESHOLD.toLocaleString()}`,
              sublabel: 'IRS minimum for 1099-NEC',
            },
            {
              label: 'Reportable total',
              value: money(totalReportable),
              sublabel: `${vendorsOverThreshold} vendor${vendorsOverThreshold !== 1 ? 's' : ''} requiring filing`,
            },
            {
              label: 'Tax year',
              value: taxYear,
              sublabel: `Bill payments from Jan 1 – Dec 31, ${taxYear}`,
            },
          ]}
        />

        {/* Vendors over threshold — require 1099 filing */}
        {vendorsOverThreshold > 0 && (
          <div>
            <SectionTitle title="Vendors requiring 1099-NEC filing" />
            <Table>
              <THead>
                <TR>
                  <TH>Vendor</TH>
                  <TH>Taxpayer Name</TH>
                  <TH>TIN / EIN</TH>
                  <TH>Type</TH>
                  <TH>Bills Paid</TH>
                  <TH className="text-right">Total Paid</TH>
                  <TH>Form</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <tbody>
                {vendors
                  .filter((v) => v.is_over_threshold)
                  .map((v: Vendor1099Summary) => (
                    <TR key={v.vendor_id}>
                      <TD>
                        <Link
                          href={`/vendors/${v.vendor_id}`}
                          className="font-medium text-gray-900 hover:text-gray-950 hover:underline"
                        >
                          {v.vendor_name}
                        </Link>
                      </TD>
                      <TD>{v.taxpayer_name}</TD>
                      <TD className="font-mono text-xs">{maskTIN(v.taxpayer_id)}</TD>
                      <TD>
                        <span className="text-xs capitalize text-gray-500">
                          {v.vendor_type}
                        </span>
                      </TD>
                      <TD className="tabular-nums">{v.bill_count}</TD>
                      <TD className="text-right tabular-nums">{money(v.total_paid)}</TD>
                      <TD>
                        <StatusChip tone="warning">
                          {v.form_type}
                        </StatusChip>
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/accounting/1099/print?year=${taxYear}&vendor=${v.vendor_id}`}
                        >
                          <Button variant="secondary" size="sm">
                            Print
                          </Button>
                        </Link>
                      </TD>
                    </TR>
                  ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Vendors under threshold — no filing required but tracked */}
        {vendorsUnderThreshold > 0 && (
          <div>
            <SectionTitle
              title="Vendors under threshold (no filing required)"
              description={`These vendors are marked for 1099 reporting but total payments did not reach the $${IRS_1099_NEC_THRESHOLD.toLocaleString()} threshold for tax year ${taxYear}.`}
            />
            <Table>
              <THead>
                <TR>
                  <TH>Vendor</TH>
                  <TH>Taxpayer Name</TH>
                  <TH>TIN / EIN</TH>
                  <TH>Type</TH>
                  <TH>Bills Paid</TH>
                  <TH className="text-right">Total Paid</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {vendors
                  .filter((v) => !v.is_over_threshold)
                  .map((v: Vendor1099Summary) => (
                    <TR key={v.vendor_id}>
                      <TD>
                        <Link
                          href={`/vendors/${v.vendor_id}`}
                          className="font-medium text-gray-900 hover:text-gray-950 hover:underline"
                        >
                          {v.vendor_name}
                        </Link>
                      </TD>
                      <TD>{v.taxpayer_name}</TD>
                      <TD className="font-mono text-xs">{maskTIN(v.taxpayer_id)}</TD>
                      <TD>
                        <span className="text-xs capitalize text-gray-500">
                          {v.vendor_type}
                        </span>
                      </TD>
                      <TD className="tabular-nums">{v.bill_count}</TD>
                      <TD className="text-right tabular-nums">{money(v.total_paid)}</TD>
                      <TD>
                        <StatusChip tone="neutral">
                          Below threshold
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
              </tbody>
            </Table>
          </div>
        )}

        {vendors.length === 0 && (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={FileText}
              title={`No 1099-reportable vendors for ${taxYear}`}
              description="Vendors appear here when they are marked for 1099 reporting and have paid bills in the selected tax year."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

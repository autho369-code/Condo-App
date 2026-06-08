import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const IRS_1099_NEC_THRESHOLD = 600;
const CURRENT_YEAR = new Date().getFullYear();

type Vendor1099Detail = {
  vendor_id: string;
  vendor_name: string;
  taxpayer_name: string;
  taxpayer_id: string;
  tax_account_number: string | null;
  vendor_type: string;
  total_paid: number;
  bill_count: number;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
};

// Payer (Portier369 / management company) info from portfolio
function getPayerInfo(portfolio: any) {
  return {
    name: portfolio?.company_name ?? 'Portier369',
    street: portfolio?.address_street ?? '',
    city: portfolio?.address_city ?? '',
    state: portfolio?.address_state ?? '',
    zip: portfolio?.address_zip ?? '',
    tin: portfolio?.tax_id ?? '',
    phone: portfolio?.support_phone ?? '',
  };
}

function formatTIN(tin: string): string {
  const cleaned = tin.replace(/[^0-9]/g, '');
  if (cleaned.length === 9) {
    return cleaned.slice(0, 2) + '-' + cleaned.slice(2);
  }
  return tin;
}

function formatAddress(v: Vendor1099Detail): string {
  const parts = [v.address_street, v.address_city];
  if (v.address_state && v.address_zip) {
    parts.push(`${v.address_state} ${v.address_zip}`);
  } else if (v.address_state) {
    parts.push(v.address_state);
  } else if (v.address_zip) {
    parts.push(v.address_zip);
  }
  return parts.filter(Boolean).join(', ');
}

export default async function Print1099Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; vendor?: string }>;
}) {
  const me = await requireStaff();
  const { year: yearStr, vendor: vendorFilter } = await searchParams;
  const taxYear = parseInt(yearStr ?? '') || CURRENT_YEAR;

  const supabase = await createClient();

  // Get portfolio info for payer
  const portfolioId = me.portfolio?.id;
  const { data: portfolio } = portfolioId
    ? await (supabase as any)
        .from('portfolios')
        .select('company_name, address_street, address_city, address_state, address_zip, tax_id, support_phone')
        .eq('id', portfolioId)
        .single()
    : { data: null };

  const payer = getPayerInfo(portfolio);

  // Fetch all paid bills for the tax year with vendor 1099 info
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;

  let query = (supabase as any)
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
    .lte('paid_at', yearEnd);

  if (vendorFilter) {
    query = query.eq('vendor_id', vendorFilter);
  }

  const { data: bills } = await query.order('paid_at', { ascending: true });

  // Aggregate by vendor
  const vendorMap = new Map<string, Vendor1099Detail>();
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
        address_street: v.address_street ?? null,
        address_city: v.address_city ?? null,
        address_state: v.address_state ?? null,
        address_zip: v.address_zip ?? null,
      });
    }
    const entry = vendorMap.get(vid)!;
    entry.total_paid += bill.amount ?? 0;
    entry.bill_count += 1;
  }

  const vendors = Array.from(vendorMap.values())
    .filter((v) => v.total_paid >= IRS_1099_NEC_THRESHOLD)
    .sort((a, b) => b.total_paid - a.total_paid);

  if (vendors.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-lg text-gray-700">
            No vendors meet the ${IRS_1099_NEC_THRESHOLD.toLocaleString()} 1099-NEC threshold for tax year {taxYear}.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Vendors must have at least ${IRS_1099_NEC_THRESHOLD.toLocaleString()} in total paid bills and
            be marked for 1099 reporting (send_1099 = true).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-0">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: letter; margin: 0.25in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
      `}</style>

      {/* Top controls — hidden when printing */}
      <div className="no-print mb-4 flex items-center justify-between bg-gray-50 px-6 py-3 border-b">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Form 1099-NEC — Tax Year {taxYear}
          </h1>
          <p className="text-sm text-gray-500">
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} · Print on blank paper
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Print All Forms
          </button>
          <button
            onClick={() => window.history.back()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {/* 1099-NEC Forms — one per vendor */}
      {vendors.map((v, idx) => (
        <div key={v.vendor_id} className={idx < vendors.length - 1 ? 'page-break' : ''}>
          <Form1099NEC
            vendor={v}
            payer={payer}
            taxYear={taxYear}
          />
        </div>
      ))}
    </div>
  );
}

function Form1099NEC({
  vendor,
  payer,
  taxYear,
}: {
  vendor: Vendor1099Detail;
  payer: ReturnType<typeof getPayerInfo>;
  taxYear: number;
}) {
  return (
    <div className="mx-auto max-w-[7.5in] px-4 py-2 font-sans text-[10px] leading-tight text-black">
      {/* Form header */}
      <div className="border border-black">
        {/* Top row: title + OMB */}
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[11px] font-bold">PAYER&apos;S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
            <div className="mt-1 text-[13px] font-bold">{payer.name}</div>
            <div className="text-[12px]">{payer.street}</div>
            <div className="text-[12px]">
              {[payer.city, payer.state, payer.zip].filter(Boolean).join(', ')}
            </div>
            {payer.phone && (
              <div className="text-[12px]">Phone: {payer.phone}</div>
            )}
          </div>
          <div className="w-[2in] px-2 py-1">
            <div className="text-[11px] font-bold">OMB No. 1545-0116</div>
            <div className="mt-1 text-[18px] font-bold text-center">1099-NEC</div>
            <div className="text-[11px] font-bold text-center">Nonemployee Compensation</div>
            <div className="mt-1 text-[10px] text-center">{taxYear}</div>
            <div className="mt-2 text-[9px] text-center">
              Copy A<br />
              For Internal Revenue<br />
              Service Center
            </div>
          </div>
        </div>

        {/* Payer/Recipient row */}
        <div className="flex border-b border-black">
          {/* Left column: PAYER info */}
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">PAYER&apos;S TIN</div>
            <div className="text-[13px]">{payer.tin || 'XX-XXXXXXX'}</div>
          </div>
          {/* Right column: RECIPIENT'S TIN */}
          <div className="w-[2.5in] px-2 py-1">
            <div className="text-[9px] font-bold">RECIPIENT&apos;S TIN</div>
            <div className="text-[13px]">{formatTIN(vendor.taxpayer_id) || '—'}</div>
          </div>
        </div>

        {/* Recipient name + address */}
        <div className="border-b border-black px-2 py-1">
          <div className="text-[9px] font-bold">RECIPIENT&apos;S name</div>
          <div className="text-[13px] font-bold">{vendor.taxpayer_name}</div>
          <div className="mt-1 text-[9px] font-bold">Street address (including apt. no.)</div>
          <div className="text-[12px]">{vendor.address_street || '—'}</div>
          <div className="text-[9px] font-bold mt-1">City or town, state or province, country, and ZIP or foreign postal code</div>
          <div className="text-[12px]">{formatAddress(vendor)}</div>
        </div>

        {/* Account number */}
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">Payer&apos;s RTN (optional)</div>
          </div>
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">1 Nonemployee compensation</div>
            <div className="text-[16px] font-bold">$ {vendor.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="w-[1.2in] px-2 py-1">
            <div className="text-[9px] font-bold">Account number (see instructions)</div>
            <div className="text-[12px]">{vendor.tax_account_number || ''}</div>
          </div>
        </div>

        {/* Boxes row */}
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">2 Payer made direct sales totaling $5,000 or more of consumer products to recipient for resale</div>
            <div className="mt-2 text-center">
              <span className="inline-block w-5 h-5 border border-black align-middle"></span>
              <span className="ml-1 text-[11px]">Yes</span>
            </div>
          </div>
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">4 Federal income tax withheld</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">5 State tax withheld</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="text-[9px] font-bold">6 State/Payer&apos;s state no.</div>
            <div className="text-[12px]"></div>
            <div className="text-[9px] font-bold">7 State income</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-2 py-1 text-[8px] text-gray-600">
          Form 1099-NEC (keep for your records) &nbsp;|&nbsp; Department of the Treasury — Internal Revenue Service
        </div>
      </div>

      {/* Second copy — for state filing */}
      <div className="border border-black mt-6">
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[11px] font-bold">PAYER&apos;S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.</div>
            <div className="mt-1 text-[13px] font-bold">{payer.name}</div>
            <div className="text-[12px]">{payer.street}</div>
            <div className="text-[12px]">
              {[payer.city, payer.state, payer.zip].filter(Boolean).join(', ')}
            </div>
          </div>
          <div className="w-[2in] px-2 py-1">
            <div className="text-[11px] font-bold">OMB No. 1545-0116</div>
            <div className="mt-1 text-[18px] font-bold text-center">1099-NEC</div>
            <div className="text-[11px] font-bold text-center">Nonemployee Compensation</div>
            <div className="mt-1 text-[10px] text-center">{taxYear}</div>
            <div className="mt-2 text-[9px] text-center font-bold">
              Copy 1<br />
              For State Tax<br />
              Department
            </div>
          </div>
        </div>
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">PAYER&apos;S TIN</div>
            <div className="text-[13px]">{payer.tin || 'XX-XXXXXXX'}</div>
          </div>
          <div className="w-[2.5in] px-2 py-1">
            <div className="text-[9px] font-bold">RECIPIENT&apos;S TIN</div>
            <div className="text-[13px]">{formatTIN(vendor.taxpayer_id) || '—'}</div>
          </div>
        </div>
        <div className="border-b border-black px-2 py-1">
          <div className="text-[9px] font-bold">RECIPIENT&apos;S name</div>
          <div className="text-[13px] font-bold">{vendor.taxpayer_name}</div>
          <div className="mt-1 text-[9px] font-bold">Street address (including apt. no.)</div>
          <div className="text-[12px]">{vendor.address_street || '—'}</div>
          <div className="text-[9px] font-bold mt-1">City or town, state or province, country, and ZIP or foreign postal code</div>
          <div className="text-[12px]">{formatAddress(vendor)}</div>
        </div>
        <div className="flex border-b border-black">
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">1 Nonemployee compensation</div>
            <div className="text-[16px] font-bold">$ {vendor.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">4 Federal income tax withheld</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
          <div className="flex-1 border-r border-black px-2 py-1">
            <div className="text-[9px] font-bold">5 State tax withheld</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="text-[9px] font-bold">6 State/Payer&apos;s state no.</div>
            <div className="text-[12px]"></div>
            <div className="text-[9px] font-bold">7 State income</div>
            <div className="text-[14px]">$ 0.00</div>
          </div>
        </div>
        <div className="px-2 py-1 text-[8px] text-gray-600">
          Copy 1 — For State Tax Department &nbsp;|&nbsp; Department of the Treasury — Internal Revenue Service
        </div>
      </div>

      {/* E-file data block */}
      <div className="no-print mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">E-File Data (IRS FIRE System)</h2>
        <div className="text-xs font-mono text-gray-600 space-y-1">
          <div>Payer TIN: {payer.tin || 'XX-XXXXXXX'}</div>
          <div>Payer Name: {payer.name}</div>
          <div>Recipient TIN: {formatTIN(vendor.taxpayer_id) || '—'}</div>
          <div>Recipient Name: {vendor.taxpayer_name}</div>
          <div>Box 1 (Nonemployee Compensation): {vendor.total_paid.toFixed(2)}</div>
          <div>Tax Year: {taxYear}</div>
          <div>Form Type: 1099-NEC</div>
          <div className="mt-2 font-bold">A-Record (ASCII fixed-width):</div>
          <div className="bg-white border border-gray-300 p-2 rounded overflow-x-auto whitespace-pre text-[10px]">
{`A${String(payer.tin || 'XXXXXXXXX').replace(/[^0-9]/g, '').padStart(9, '0').slice(0, 9)}${taxYear}1099-NEC${' '.repeat(10)}`}
          </div>
          <div className="mt-2 font-bold">B-Record (ASCII fixed-width):</div>
          <div className="bg-white border border-gray-300 p-2 rounded overflow-x-auto whitespace-pre text-[10px]">
{`B${String(vendor.taxpayer_id).replace(/[^0-9]/g, '').padStart(9, '0').slice(0, 9)}${vendor.taxpayer_name.slice(0, 40).padEnd(40)}${vendor.total_paid.toFixed(2).replace('.', '').padStart(11, '0')}${'0'.repeat(204)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

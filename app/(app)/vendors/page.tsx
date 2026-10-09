import Link from 'next/link';
import { Plus } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { buildVendorPerformanceScorecard, type VendorPerformanceScorecard } from '@/lib/vendors/performance';
import { loadPortfolioVendorPerformanceRows } from '@/lib/vendors/performance-query';
import { inviteVendorToPortal } from './actions';
import { Stars } from '@/components/work-orders/rating';
import { tradeLabel } from '@/lib/vendors/options';
import { recordIdsWithTag, tagsInUse } from '@/lib/records/load';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

function ComplianceBadges({ vendor }: { vendor: any }) {
  const expirations = [
    { label: 'WC', date: vendor.workers_comp_expiration },
    { label: 'GL', date: vendor.general_liability_expiration },
    { label: 'Lic', date: vendor.state_license_expiration },
    { label: 'Auto', date: vendor.auto_insurance_expiration },
    { label: 'Ctr', date: vendor.contract_expiration },
  ].filter(e => e.date);
  // Dates compare in the company's local time, not UTC.
  const today = todayInZone();
  const [ty, tm, td] = today.split('-').map(Number);
  const soonYmd = new Date(Date.UTC(ty, tm - 1, td + 30)).toISOString().slice(0, 10);

  if (expirations.length === 0) return <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {expirations.map((e) => {
        // Date-only compare: coverage ending today is still valid today.
        const ymd = String(e.date).slice(0, 10);
        const expired = ymd < today;
        const expiring = ymd <= soonYmd && !expired;
        return (
          <span key={e.label} className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${expired ? 'bg-red-50 text-red-700 ring-red-600/15' : expiring ? 'bg-amber-50 text-amber-700 ring-amber-600/15' : 'bg-gray-100 text-gray-600 ring-gray-500/15'}`}>
            {e.label}: {new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
          </span>
        );
      })}
    </div>
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trade?: string; tag?: string; association?: string; invited?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const canManageBank = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator);
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const trade = sp.trade ?? 'all';
  const tag = /^[0-9a-f-]{36}$/i.test(sp.tag ?? '') ? sp.tag! : '';
  // Each association has its own vendors; 'company' is the management company.
  const association = sp.association === 'company' || /^[0-9a-f-]{36}$/i.test(sp.association ?? '') ? sp.association! : '';

  const supabase = await createClient();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) throw new Error('Staff workspace is missing its management-company scope.');
  // Every vendor, paged past PostgREST's 1,000-row cap.
  const vendorsRes = await fetchAllRows<any>(() => (supabase as any)
    .from('vendors')
    .select('id, name, association_id, is_management_company, associations(name), emails, phone_numbers, trade, vendor_type, payment_type, payment_terms, is_utility, is_auto_pay, send_1099, has_taxpayer_id, has_bank_account, portal_activated, hold_payments, workers_comp_expiration, general_liability_expiration, epa_certification_expiration, auto_insurance_expiration, state_license_expiration, contract_expiration, archived_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')
    .order('id'));

  const allRows = vendorsRes.rows;
  const ratingsRes = await fetchAllRows<any>(() => (supabase as any)
    .from('work_order_ratings').select('id, vendor_id, score').eq('portfolio_id', portfolioId).order('id'));
  // A partial set would show skewed averages, so show none rather than wrong ones.
  const ratingsComplete = !ratingsRes.error && !ratingsRes.truncated;
  const ratingByVendor = new Map<string, { sum: number; n: number }>();
  for (const r of (ratingsComplete ? ratingsRes.rows : []) as any[]) {
    const t = ratingByVendor.get(r.vendor_id) ?? { sum: 0, n: 0 };
    t.sum += Number(r.score); t.n += 1;
    ratingByVendor.set(r.vendor_id, t);
  }
  const trades: string[] = Array.from(new Set(allRows.map((vendor: any) => vendor.trade).filter(Boolean) as string[])).sort((a, b) => tradeLabel(a).localeCompare(tradeLabel(b)));
  const associationOptions = Array.from(new Map(allRows.filter((vendor: any) => vendor.association_id)
    .map((vendor: any) => [vendor.association_id, vendor.associations?.name ?? 'No association'])).entries())
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  let rows = allRows;
  if (association === 'company') rows = rows.filter((vendor: any) => vendor.is_management_company);
  else if (association) rows = rows.filter((vendor: any) => vendor.association_id === association);
  if (trade !== 'all') rows = rows.filter((vendor: any) => vendor.trade === trade);
  if (tag) {
    const tagged = new Set(await recordIdsWithTag(supabase, 'vendor', tag));
    rows = rows.filter((vendor: any) => tagged.has(vendor.id));
  }
  const tagOptions = await tagsInUse(supabase, 'vendor');
  if (q) {
    rows = rows.filter((vendor: any) =>
      [
        vendor.name, vendor.trade, tradeLabel(vendor.trade), vendor.vendor_type, vendor.payment_type,
        ...(Array.isArray(vendor.emails) ? vendor.emails : []),
        // Entries are { type, number } objects, or bare strings on older records.
        ...(Array.isArray(vendor.phone_numbers) ? vendor.phone_numbers.map((p: any) => (typeof p === 'string' ? p : p?.number)) : []),
      ].some((value) => typeof value === 'string' && value.toLowerCase().includes(q)),
    );
  }

  const performanceRows = await loadPortfolioVendorPerformanceRows(
    supabase as any,
    portfolioId,
    rows.map((vendor: any) => vendor.id),
  );
  const rowsByVendor = new Map<string, typeof performanceRows>();
  for (const row of performanceRows) {
    if (!row.vendor_id) continue;
    const vendorRows = rowsByVendor.get(row.vendor_id) ?? [];
    vendorRows.push(row);
    rowsByVendor.set(row.vendor_id, vendorRows);
  }
  const performanceByVendor = new Map<string, VendorPerformanceScorecard>(
    rows.map((vendor: any) => [
      vendor.id,
      buildVendorPerformanceScorecard(rowsByVendor.get(vendor.id) ?? [], vendor),
    ]),
  );

  const achReady = allRows.filter((vendor: any) => vendor.has_bank_account).length;
  const w9Needed = allRows.filter((vendor: any) => vendor.send_1099 && !vendor.has_taxpayer_id).length;
  const paymentHold = allRows.filter((vendor: any) => vendor.hold_payments).length;

  return (
    <DataWorkspace
      title="Vendors"
      description="Manage contractors, utilities, W-9 readiness, ACH setup, compliance documents, and vendor forms."
      actions={
        <>
          {canManageBank && (
            <Link href="/vendors/ach"><Button variant="secondary">Vendor ACH setup</Button></Link>
          )}
          <Link href="/vendors/forms"><Button variant="secondary">Request documents</Button></Link>
          <Link href="/vendors/w9"><Button variant="secondary">Request W-9</Button></Link>
          <Link href="/vendors/new">
            <Button><Plus className="h-4 w-4" /> New vendor</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {sp.invited && <Alert tone="success" title="Portal invite sent">{`${sp.invited} will get an email with a link to set their password and access the vendor portal.`}</Alert>}
        {sp.error && <Alert tone="danger" title="Could not send invite">{sp.error}</Alert>}
        {vendorsRes.error && <Alert tone="danger" title="Could not load every vendor">{vendorsRes.error}</Alert>}
        {!ratingsComplete && <Alert tone="warning" title="Vendor ratings unavailable">{ratingsRes.error ?? 'There are too many ratings to load, so averages are hidden rather than shown from a partial set.'}</Alert>}
        {vendorsRes.truncated && <Alert tone="warning" title="List is incomplete">There are more vendors than this page can load. Filter by trade or search.</Alert>}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          <Link href="/owners" className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">Owners</Link>
          <Link href="/owners?view=directory" className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">Directory</Link>
          <Link href="/owners?view=tenants" className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">Tenants</Link>
          <Link href="/vendors" className="whitespace-nowrap border-b-2 border-gray-950 px-4 py-2.5 text-sm font-medium text-gray-950">Vendors</Link>
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Active vendors', value: allRows.length },
            { label: 'ACH ready', value: achReady },
            { label: 'W-9 needed', value: w9Needed },
            { label: 'Payment holds', value: paymentHold },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Reports</span>
          <Link href="/reports/vendor_directory" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">Vendor directory</Link>
          <Link href="/reports/vendor_ledger" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">Vendor ledger</Link>
        </div>

        <FilterBar action="/vendors" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendor, trade, email, phone, or payment method">
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associationOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {allRows.some((vendor: any) => vendor.is_management_company) && <option value="company">Management company</option>}
          </FilterSelect>
          <FilterSelect label="Trade" name="trade" defaultValue={trade}>
            <option value="all">All trades</option>
            {trades.map((item) => <option key={item} value={item}>{tradeLabel(item)}</option>)}
          </FilterSelect>
          {(tagOptions.length > 0 || tag) && (
            <FilterSelect label="Tag" name="tag" defaultValue={tag}>
              <option value="">All tags</option>
              {tagOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </FilterSelect>
          )}
        </FilterBar>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Association</TH>
              <TH>Trade</TH>
              <TH>Payment</TH>
              <TH>Tax &amp; portal</TH>
              <TH>Service record</TH>
              <TH>Compliance</TH>
              <TH>Workflows</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR><TD colSpan={8} className="py-10 text-center text-gray-500">No vendors match this filter.</TD></TR>
            ) : (
              rows.map((vendor: any) => {
                const scorecard = performanceByVendor.get(vendor.id)!;
                return <TR key={vendor.id} className="hover:bg-gray-50">
                  <TD>
                    <Link href={`/vendors/${vendor.id}`} className="font-medium text-gray-950 hover:underline">{vendor.name}</Link>
                    <div className="mt-1 text-xs text-gray-500">{vendor.vendor_type?.replace(/_/g, ' ') ?? 'general'}</div>
                    {(vendor.emails?.length > 0 || vendor.phone_numbers?.length > 0) && (
                      <div className="mt-1 space-y-0.5">
                        {vendor.emails?.map((e: string) => <div key={e} className="text-xs text-gray-500">{e}</div>)}
                        {vendor.phone_numbers?.map((p: any, i: number) => (typeof p === 'string'
                          ? <div key={`${p}-${i}`} className="text-xs text-gray-500">{p}</div>
                          : <div key={`${p?.number}-${i}`} className="text-xs text-gray-500">{p?.type ? `${p.type}: ` : ''}{p?.number}</div>))}
                      </div>
                    )}
                  </TD>
                  <TD>{vendor.is_management_company ? <StatusChip tone="info">Management company</StatusChip> : (vendor.associations?.name ?? '—')}</TD>
                  <TD>{tradeLabel(vendor.trade)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <StatusChip tone={vendor.has_bank_account ? 'success' : 'neutral'}>
                        {vendor.payment_type?.replace(/_/g, ' ') ?? 'check'}
                      </StatusChip>
                      {vendor.is_auto_pay && <StatusChip tone="info">Auto-pay</StatusChip>}
                      {vendor.hold_payments && <StatusChip tone="danger">Hold</StatusChip>}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{vendor.payment_terms ?? 'No terms'}</div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {vendor.is_utility && <StatusChip tone="info">Utility</StatusChip>}
                      {vendor.send_1099 && <StatusChip tone={vendor.has_taxpayer_id ? 'success' : 'warning'}>{vendor.has_taxpayer_id ? 'W-9 ready' : 'Need W-9'}</StatusChip>}
                      {vendor.portal_activated && <StatusChip tone="success">Portal</StatusChip>}
                    </div>
                  </TD>
                  <TD>
                    <StatusChip tone={scorecard.serviceRecord.tone}>{scorecard.serviceRecord.label}</StatusChip>
                    <div className="mt-1 text-xs tabular-nums text-gray-500">
                      {scorecard.onTimeRate === null ? 'No scheduled completions' : `${scorecard.onTimeRate}% on time`} · {scorecard.open} open
                    </div>
                    {ratingByVendor.has(vendor.id) && (() => {
                      const r = ratingByVendor.get(vendor.id)!;
                      const avg = Math.round((r.sum / r.n) * 10) / 10;
                      return <div className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-gray-500"><Stars value={avg} /> {avg} ({r.n})</div>;
                    })()}
                  </TD>
                  <TD>
                    <ComplianceBadges vendor={vendor} />
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {canManageBank && <Link href={`/vendors/ach?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">ACH</Link>}
                      <Link href={`/vendors/w9?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">W-9</Link>
                      <Link href={`/vendors/compliance?vendor=${vendor.id}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-50">Docs</Link>
                      {!vendor.portal_activated && (
                        <form action={inviteVendorToPortal}>
                          <input type="hidden" name="vendor_id" value={vendor.id} />
                          <button type="submit" className="rounded-lg border border-gray-900 bg-gray-900 px-2 py-1 font-medium text-white transition-colors hover:bg-gray-800">Invite to portal</button>
                        </form>
                      )}
                    </div>
                  </TD>
                </TR>;
              })
            )}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}

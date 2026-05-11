// Printable owner statement — composed in the editorial Portier system.
// Resident pulls this from /portal/statement?unit={uuid}; defaults to their
// first unit. Designed for both screen review and print (US Letter) — the
// `print:` Tailwind utilities collapse padding/sidebar in the layout when
// `window.print()` fires from the PrintButton.
//
// Renders the *tenant's* brand at the top — logo, address, phone, email,
// website — pulled from the same portfolios row the manager edits at
// /settings/branding. Statements landing in residents' mailboxes feel like
// they came from the management company directly, not from Portier.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { currentTenant, formatTenantAddress } from '@/lib/tenant/server';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const me = await requireAuth();
  const supabase = await createClient();
  const sp = await searchParams;

  // Tenant brand block — read from URL-resolved tenant if available,
  // otherwise from me.portfolio so the page still works on the apex.
  const t = await currentTenant();
  const brand = t ?? {
    company_name:   me.portfolio?.company_name ?? me.portfolio?.name ?? 'Your Management Co.',
    logo_url:       null,
    favicon_url:    null,
    brand_email:    null,
    billing_email_from: null,
    phone_number:   me.portfolio?.phone_number ?? null,
    website:        null,
    address_street: me.portfolio?.address_street ?? null,
    address_city:   me.portfolio?.address_city ?? null,
    address_state:  me.portfolio?.address_state ?? null,
    address_zip:    me.portfolio?.address_zip ?? null,
    portfolio_id:   me.portfolio?.id ?? '',
    slug:           '',
  } as const;

  // Pull the resident's units (RLS scopes)
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('*');
  const allUnits = (units ?? []) as any[];
  if (!allUnits.length) {
    redirect('/portal');
  }

  const unit = sp.unit
    ? allUnits.find((u) => u.unit_id === sp.unit) ?? allUnits[0]
    : allUnits[0];

  // Pull association name + recent ledger lines for this unit
  const { data: assoc } = unit?.association_id
    ? await (supabase as any).from('associations').select('name').eq('id', unit.association_id).maybeSingle()
    : { data: null };

  const { data: chargeRows } = await (supabase as any)
    .from('v_charge_balances')
    .select('*')
    .eq('unit_id', unit.unit_id)
    .order('due_date', { ascending: false })
    .limit(50);

  const { data: paymentRows } = await (supabase as any)
    .from('payments')
    .select('id, amount, payment_date, method, reference')
    .order('payment_date', { ascending: false })
    .limit(20);

  const today = new Date();
  const stmtDate = date(today);
  const stmtNumber = `${(t?.slug ?? 'pt').toUpperCase()}-${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}-${String(unit.unit_id ?? '').slice(0,6)}`;

  return (
    <article className="bg-cream-50 print:bg-white">
      {/* Action bar — hidden in print */}
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between px-2 py-4 print:hidden">
        <div>
          <Link href="/portal/ledger" className="text-sm text-champagne-700 hover:text-champagne-800 underline decoration-champagne-300 underline-offset-4">
            ← Back to ledger
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {allUnits.length > 1 && (
            <form method="get" className="flex items-center gap-2">
              <select
                name="unit"
                defaultValue={unit.unit_id ?? ''}
                className="h-9 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
              >
                {allUnits.map((u) => (
                  <option key={u.unit_id} value={u.unit_id ?? ''}>
                    Unit {u.unit_number}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">View</Button>
            </form>
          )}
          <PrintButton label="Print statement" />
        </div>
      </div>

      {/* The statement itself — sized for US Letter when printed */}
      <div className="mx-auto max-w-3xl bg-white shadow-soft-lg print:shadow-none">
        <div className="px-12 py-12 print:px-10 print:py-10">

          {/* ============ TENANT BRAND BLOCK ============ */}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-ink-100 pb-7">
            <div className="flex items-start gap-5">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={`${brand.company_name} logo`}
                  className="h-14 w-auto max-w-[180px] object-contain"
                />
              ) : null}
              <div>
                <div className="font-display text-2xl tracking-editorial text-ink-900">
                  {brand.company_name}
                </div>
                {(brand.address_street || brand.address_city) && (
                  <div className="mt-1.5 text-[12.5px] text-ink-600 leading-relaxed">
                    {brand.address_street}
                    {brand.address_street && (brand.address_city || brand.address_zip) && <br />}
                    {[brand.address_city, brand.address_state, brand.address_zip].filter(Boolean).join(', ')}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-ink-600">
                  {brand.phone_number && <span>{brand.phone_number}</span>}
                  {brand.brand_email && <span>{brand.brand_email}</span>}
                  {brand.website && <span>{brand.website.replace(/^https?:\/\//, '')}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="eyebrow">Statement</div>
              <div className="mt-1.5 font-display text-2xl tracking-editorial text-ink-900">
                {stmtDate}
              </div>
              <div className="mt-2 font-mono text-[11px] text-ink-500">
                #{stmtNumber}
              </div>
            </div>
          </header>

          {/* ============ ACCOUNT HEADER ============ */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <div className="eyebrow">Account holder</div>
              <div className="mt-2 font-display text-lg tracking-editorial text-ink-900">
                {me.profile?.full_name ?? me.email ?? 'Resident'}
              </div>
              <div className="mt-1 text-sm text-ink-600">{me.email}</div>
            </div>
            <div>
              <div className="eyebrow">Property</div>
              <div className="mt-2 font-display text-lg tracking-editorial text-ink-900">
                {assoc?.name ?? unit.association_name ?? 'Association'}
              </div>
              <div className="mt-1 text-sm text-ink-600">Unit {unit.unit_number ?? '—'}</div>
            </div>
          </div>

          {/* ============ BALANCE STRIP ============ */}
          <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100">
            <BalanceCell label="Total charged" value={money(unit.total_charged)} />
            <BalanceCell label="Total paid" value={money(unit.total_paid)} tone="positive" />
            <BalanceCell
              label="Outstanding"
              value={money(unit.outstanding_balance)}
              tone={Number(unit.outstanding_balance) > 0 ? 'danger' : 'positive'}
            />
          </div>

          {Number(unit.unapplied_credit) > 0 && (
            <div className="mt-4 rounded-md border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-700">
              <span className="font-medium">{money(unit.unapplied_credit)}</span> in unapplied credit on file —
              will apply automatically to your next charge.
            </div>
          )}

          {/* ============ CHARGES ============ */}
          <section className="mt-9">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl tracking-editorial text-ink-900">Charges</h2>
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">
                Showing the last {Math.min((chargeRows ?? []).length, 50)} entries
              </span>
            </div>
            <table className="mt-3 w-full border-collapse text-[13px] tabular-nums">
              <thead>
                <tr className="border-y border-ink-200 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Description</th>
                  <th className="py-2.5 text-right font-semibold">Amount</th>
                  <th className="py-2.5 text-right font-semibold">Paid</th>
                  <th className="py-2.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(chargeRows ?? []).map((c: any) => (
                  <tr key={c.charge_id} className="border-b border-ink-100 align-top">
                    <td className="py-2.5 text-ink-700">{date(c.due_date)}</td>
                    <td className="py-2.5 text-ink-900">{c.description}</td>
                    <td className="py-2.5 text-right text-ink-900">{money(c.charged_amount)}</td>
                    <td className="py-2.5 text-right text-sage-700">{money(c.applied_amount)}</td>
                    <td className={`py-2.5 text-right ${Number(c.balance_due) > 0 ? 'text-bordeaux-700 font-medium' : 'text-ink-700'}`}>
                      {money(c.balance_due)}
                    </td>
                  </tr>
                ))}
                {(chargeRows ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-ink-500">No charges on file.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* ============ RECENT PAYMENTS ============ */}
          {(paymentRows ?? []).length > 0 && (
            <section className="mt-9">
              <h2 className="font-display text-xl tracking-editorial text-ink-900">Recent payments</h2>
              <table className="mt-3 w-full border-collapse text-[13px] tabular-nums">
                <thead>
                  <tr className="border-y border-ink-200 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                    <th className="py-2.5 font-semibold">Date</th>
                    <th className="py-2.5 font-semibold">Method</th>
                    <th className="py-2.5 font-semibold">Reference</th>
                    <th className="py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(paymentRows ?? []).slice(0, 10).map((p: any) => (
                    <tr key={p.id} className="border-b border-ink-100">
                      <td className="py-2.5 text-ink-700">{date(p.payment_date)}</td>
                      <td className="py-2.5 uppercase text-[11px] tracking-[0.06em] text-ink-700">{p.method}</td>
                      <td className="py-2.5 text-ink-600">{p.reference ?? '—'}</td>
                      <td className="py-2.5 text-right text-sage-700">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* ============ PAYMENT INSTRUCTIONS ============ */}
          <section className="mt-12 rounded-md border border-ink-100 bg-cream-50 p-6">
            <div className="eyebrow">How to pay</div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
              Pay online at <span className="font-mono text-ink-900">your resident portal</span>{' '}
              {brand.website ? <>or visit <span className="font-mono text-ink-900">{brand.website.replace(/^https?:\/\//, '')}</span></> : null}.
              Mail checks payable to <span className="font-medium text-ink-900">{brand.company_name}</span>{' '}
              {brand.address_street && (
                <>at {brand.address_street}{brand.address_city ? `, ${brand.address_city}, ${brand.address_state ?? ''} ${brand.address_zip ?? ''}` : ''}</>
              )}
              {' '}and write your unit number on the memo line.
              {brand.brand_email && <> Questions? Email <span className="font-mono text-ink-900">{brand.brand_email}</span>.</>}
            </p>
          </section>

          {/* ============ FOOTER ============ */}
          <footer className="mt-12 border-t border-ink-100 pt-6 text-[10.5px] uppercase tracking-[0.16em] text-ink-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>This statement was generated on {stmtDate} for the account ending {(unit.unit_id ?? '').slice(-6)}.</span>
              <span>Workspace by <span className="text-ink-700">Portier</span></span>
            </div>
          </footer>

        </div>
      </div>
    </article>
  );
}

function BalanceCell({
  label, value, tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'positive' | 'danger';
}) {
  const cls =
    tone === 'positive' ? 'text-sage-700' :
    tone === 'danger'   ? 'text-bordeaux-700' :
    'text-ink-900';
  return (
    <div className="bg-white px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 font-display text-2xl number-plate tracking-editorial ${cls}`}>{value}</div>
    </div>
  );
}

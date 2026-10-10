import Link from 'next/link';
import { notFound } from 'next/navigation';
import { YearEndChecklist } from '@/components/accounting/year-end-checklist';
import { YearEndStatements } from '@/components/accounting/year-end-statements';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PrintButton } from '@/components/ui/print-button';
import { hasPortfolioAdminAccess, requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { finalizeYearEndPackage, generateYearEndPackage, supersedeYearEndPackage } from '@/lib/rpcs/year-end';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default async function YearEndPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireFinanceOrPortfolioAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: pkg } = await db.from('year_end_packages').select('*, associations(name)').eq('id', id).maybeSingle();
  if (!pkg) notFound();

  const { data: live } = pkg.status === 'draft'
    ? await db.rpc('year_end_readiness', { p_association_id: pkg.association_id, p_fiscal_year: pkg.fiscal_year })
    : { data: null };
  const items = live?.items ?? pkg.checklist ?? [];
  const s = pkg.snapshot;
  const assoc = s.association ?? {};

  return (
    <div className="min-h-full bg-canvas px-4 py-5 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={`/accounting/year-end?association_id=${pkg.association_id}&year=${pkg.fiscal_year}`} className="text-sm text-gray-500 hover:text-gray-900">← Year-end close</Link>
          <div className="flex flex-wrap gap-2">
            {pkg.status === 'finalized' && !pkg.signature_request_id && (
              <Link href={`/signatures/new?subject_type=year_end_package&subject_id=${pkg.id}`}><Button variant="secondary">Send to board for acceptance</Button></Link>
            )}
            {pkg.signature_request_id && <Link href={`/signatures/${pkg.signature_request_id}`}><Button variant="secondary">Board acceptance</Button></Link>}
            <PrintButton label="Print / save PDF" />
          </div>
        </div>

        {sp.error && <Alert tone="danger" title="Could not complete that:" className="mb-4 print:hidden">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success" className="mb-4 print:hidden">{sp.saved}</Alert>}
        {pkg.status === 'superseded' && <Alert tone="warning" className="mb-4">Superseded {fmt(pkg.superseded_at)}: {pkg.supersede_reason}</Alert>}
        {pkg.status === 'draft' && <Alert tone="info" className="mb-4 print:hidden">Draft — these figures reflect the books when the draft was prepared ({fmt(pkg.generated_at)}). Finalizing re-verifies nothing has changed since.</Alert>}

        <header className="mb-6 rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-gray-400">Year-end financial package</div>
          <h1 className="mt-1 break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]">{assoc.legal_name || assoc.name || pkg.associations?.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Fiscal year {s.fiscal_year} · {s.period_start} to {s.period_end}{assoc.tax_id ? ` · EIN ${assoc.tax_id}` : ''}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
            {pkg.status === 'finalized' ? <StatusChip tone="success">Finalized {fmt(pkg.finalized_at)}</StatusChip> : pkg.status === 'draft' ? <StatusChip tone="warning">Draft</StatusChip> : <StatusChip tone="neutral">Superseded</StatusChip>}
            <span>Prepared by {me.portfolio?.company_name ?? 'management'}</span>
          </div>
          <div className="mt-3 break-all font-mono text-[12.5px] text-gray-400">SHA-256 {pkg.snapshot_sha256}</div>
          {pkg.notes && <p className="mt-3 text-sm text-gray-600">{pkg.notes}</p>}
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] print:block">
          <div><YearEndStatements snapshot={s} /></div>
          <div className="print:hidden">
            <Section title="Close checklist" subtitle={pkg.status === 'draft' ? 'Live' : 'As recorded at finalization'}>
              <YearEndChecklist items={items} />
            </Section>
            {pkg.status === 'draft' && (
              <Section title="Finalize" padded>
                <p className="mb-3 text-[13px] text-gray-500">Locks this package permanently. It becomes visible to the board and cannot be edited — only superseded by an administrator.</p>
                <form action={finalizeYearEndPackage} className="space-y-2">
                  <input type="hidden" name="id" value={pkg.id} />
                  <Button type="submit" className="w-full" disabled={!live?.ready}>Finalize FY {pkg.fiscal_year}</Button>
                </form>
                <form action={generateYearEndPackage} className="mt-2">
                  <input type="hidden" name="association_id" value={pkg.association_id} />
                  <input type="hidden" name="fiscal_year" value={pkg.fiscal_year} />
                  <Button type="submit" variant="secondary" className="w-full">Refresh from current books</Button>
                </form>
              </Section>
            )}
            {pkg.status === 'finalized' && hasPortfolioAdminAccess(me) && (
              <Section title="Supersede" padded>
                <form action={supersedeYearEndPackage} className="space-y-2">
                  <input type="hidden" name="id" value={pkg.id} />
                  <Input name="reason" required minLength={20} maxLength={1000} placeholder="Why a revision is needed (e.g. auditor adjustment)" aria-label="Reason" />
                  <Button type="submit" variant="danger" className="w-full">Supersede package</Button>
                </form>
              </Section>
            )}
          </div>
        </div>
        <p className="mt-6 text-[12.5px] leading-4 text-gray-400">
          Generated from the association&apos;s posted general ledger. The fingerprint above identifies this exact set of figures; any later change to the books produces a different package.
        </p>
      </div>
    </div>
  );
}

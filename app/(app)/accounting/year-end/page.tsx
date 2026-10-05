import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { YearEndChecklist } from '@/components/accounting/year-end-checklist';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { generateYearEndPackage } from '@/lib/rpcs/year-end';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function PackageStatus({ status }: { status: string }) {
  if (status === 'finalized') return <StatusChip tone="success">Finalized</StatusChip>;
  if (status === 'superseded') return <StatusChip tone="neutral">Superseded</StatusChip>;
  return <StatusChip tone="warning">Draft</StatusChip>;
}

export default async function YearEndPage({
  searchParams,
}: {
  searchParams: Promise<{ association_id?: string; year?: string; error?: string; saved?: string }>;
}) {
  await requireFinanceOrPortfolioAdmin();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : thisYear - (new Date().getMonth() < 3 ? 1 : 0);

  const [{ data: associations }, { data: packages }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('year_end_packages').select('id, association_id, fiscal_year, status, generated_at, finalized_at, snapshot_sha256, associations(name)').order('fiscal_year', { ascending: false }).order('generated_at', { ascending: false }).limit(300),
  ]);
  const selected = (associations ?? []).find((a: any) => a.id === sp.association_id) ?? (associations ?? [])[0];
  const { data: readiness } = selected ? await db.rpc('year_end_readiness', { p_association_id: selected.id, p_fiscal_year: year }) : { data: null };
  const current = (packages ?? []).find((p: any) => p.association_id === selected?.id && p.fiscal_year === year && p.status !== 'superseded');

  return (
    <DataWorkspace
      title="Year-end close"
      description="Close each association's fiscal year into a permanent, fingerprinted package of statements for the board, auditors, and tax preparer."
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Could not prepare the package:">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}

        <FilterBar action="/accounting/year-end" search={false}>
          <FilterSelect label="Association" name="association_id" defaultValue={selected?.id ?? ''}>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Fiscal year" name="year" defaultValue={String(year)}>
            {years.map((y) => <option key={y} value={y}>FY {y}</option>)}
          </FilterSelect>
        </FilterBar>

        {selected && readiness && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Section title={`${selected.name} · FY ${year}`} subtitle={`${readiness.period_start} to ${readiness.period_end}`}>
              <YearEndChecklist items={readiness.items} />
            </Section>
            <Section title={current ? 'Package' : 'Prepare package'} padded>
              {current ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2"><PackageStatus status={current.status} /><span className="text-gray-500">prepared {date(current.generated_at)}</span></div>
                  <Link href={`/accounting/year-end/${current.id}`}><Button className="w-full">Open package</Button></Link>
                  {current.status === 'draft' && (
                    <form action={generateYearEndPackage}>
                      <input type="hidden" name="association_id" value={selected.id} />
                      <input type="hidden" name="fiscal_year" value={year} />
                      <Button type="submit" variant="secondary" className="w-full">Refresh draft from current books</Button>
                    </form>
                  )}
                </div>
              ) : (
                <form action={generateYearEndPackage} className="space-y-3">
                  <input type="hidden" name="association_id" value={selected.id} />
                  <input type="hidden" name="fiscal_year" value={year} />
                  <p className="text-[13px] text-gray-500">
                    {readiness.ready ? 'All required checks pass. Prepare the draft, review it, then finalize.' : 'You can prepare a draft now to review the numbers. Finalizing requires every required check.'}
                  </p>
                  <Input name="notes" maxLength={500} placeholder="Notes for the package (optional)" aria-label="Notes" />
                  <Button type="submit" className="w-full">Prepare draft package</Button>
                </form>
              )}
            </Section>
          </div>
        )}

        {(packages ?? []).length ? (
          <Table>
            <THead><TR><TH>Association</TH><TH>Fiscal year</TH><TH>Status</TH><TH>Prepared</TH><TH>Finalized</TH><TH>Fingerprint</TH></TR></THead>
            <tbody>
              {(packages ?? []).map((p: any) => (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900"><Link href={`/accounting/year-end/${p.id}`} className="hover:text-gray-600">{p.associations?.name ?? '—'}</Link></TD>
                  <TD className="tabular-nums">FY {p.fiscal_year}</TD>
                  <TD><PackageStatus status={p.status} /></TD>
                  <TD className="text-sm text-gray-600">{date(p.generated_at)}</TD>
                  <TD className="text-sm text-gray-600">{p.finalized_at ? date(p.finalized_at) : '—'}</TD>
                  <TD className="font-mono text-[11px] text-gray-400">{p.snapshot_sha256.slice(0, 12)}…</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={CalendarCheck} title="No year-end packages yet" description="Choose an association and fiscal year above to review the close checklist and prepare the first package." />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

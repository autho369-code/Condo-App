import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { PiggyBank } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Alert, Badge, EmptyState, Surface } from '@/components/ui/shell';
import { fiscalYearFor } from '@/lib/budget/fiscal';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Portfolio overview of every association's budget. Editing happens on the
// association's Budget tab (worksheet), so old deep links redirect there.
export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ association?: string; year?: string }> }) {
  await requireStaff();
  const db = (await createClient()) as any;
  const sp = await searchParams;
  const requested = Number(sp.year);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : null;

  if (sp.association && UUID_RE.test(sp.association)) {
    const { data: a } = await db.from('associations').select('id, slug').eq('id', sp.association).maybeSingle();
    if (a) redirect(`/associations/${a.slug ?? a.id}/budget${year ? `?fiscal_year=${year}` : ''}`);
  }

  const { data: associations, error } = await db.from('associations').select('id, slug, name, fiscal_year_start').is('archived_at', null).order('name');
  const list = (associations ?? []) as any[];
  const fy = year ?? fiscalYearFor(new Date(), 1);
  const ids = list.map((a) => a.id);

  const [linesRes, headersRes] = ids.length
    ? await Promise.all([
        // Every line, past PostgREST's 1,000-row cap, in a stable order.
        fetchAllRows<any>(() => db.from('budget_lines').select('association_id, category, annual_total').in('association_id', ids).eq('fiscal_year', fy).order('association_id').order('id')),
        db.from('association_budgets').select('association_id, status, adopted_at').in('association_id', ids).eq('fiscal_year', fy),
      ])
    : [{ rows: [], truncated: false, error: null }, { data: [], error: null }];
  const loadError = linesRes.error ?? headersRes.error?.message ?? null;

  const totals = new Map<string, { income: number; expense: number; lines: number }>();
  for (const l of linesRes.rows as any[]) {
    const t = totals.get(l.association_id) ?? { income: 0, expense: 0, lines: 0 };
    if (l.category === 'income') t.income += Number(l.annual_total); else t.expense += Number(l.annual_total);
    t.lines += 1;
    totals.set(l.association_id, t);
  }
  const headers = new Map<string, any>(((headersRes.data ?? []) as any[]).map((h) => [h.association_id, h]));
  const adoptedCount = list.filter((a) => headers.get(a.id)?.status === 'adopted').length;
  const draftCount = list.filter((a) => totals.has(a.id) && headers.get(a.id)?.status !== 'adopted').length;
  const years = [fy - 2, fy - 1, fy, fy + 1, fy + 2];

  return (
    <DataWorkspace title="Budgets" description="Every association’s annual budget and where it stands. Open one to edit its worksheet, adopt it, and update assessments.">
      <div className="space-y-6">
        {error && <Alert tone="danger">{error.message}</Alert>}
        {loadError && <Alert tone="danger" title="Budget totals could not be loaded.">{loadError}</Alert>}
        {linesRes.truncated && <Alert tone="warning" title="Budget totals are incomplete.">There are more budget lines than this page can load.</Alert>}
        <MetricStrip
          metrics={[
            { label: `FY${fy} adopted`, value: `${adoptedCount} of ${list.length}` },
            { label: 'In draft', value: draftCount },
            { label: 'Not started', value: list.length - adoptedCount - draftCount },
            { label: 'Budgeted net', value: money([...totals.values()].reduce((s, t) => s + t.income - t.expense, 0)) },
          ]}
        />
        <Surface padded={false} className="p-3 sm:p-4">
          <form className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] font-medium text-gray-500">
              Fiscal year
              <Select name="year" defaultValue={String(fy)} className="mt-1 w-28">
                {years.map((y) => <option key={y} value={y}>FY{y}</option>)}
              </Select>
            </label>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </Surface>

        {list.length === 0 ? (
          <Surface><EmptyState icon={PiggyBank} title="No associations yet" /></Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH className="text-right">Income</TH>
                <TH className="text-right">Expense</TH>
                <TH className="text-right">Net</TH>
                <TH className="text-right">Lines</TH>
              </tr>
            </THead>
            <tbody>
              {list.map((a) => {
                const t = totals.get(a.id);
                const h = headers.get(a.id);
                const status = h?.status === 'adopted' ? 'adopted' : t ? 'draft' : null;
                return (
                  <TR key={a.id}>
                    <TD>
                      <Link href={`/associations/${a.slug ?? a.id}/budget?fiscal_year=${fy}`} className="font-medium text-gray-900 hover:underline">{a.name}</Link>
                    </TD>
                    <TD>{status ? <Badge tone={status === 'adopted' ? 'complete' : 'pending'}>{status === 'adopted' ? 'Adopted' : 'Draft'}</Badge> : <span className="text-gray-400">Not started</span>}</TD>
                    <TD className="text-right tabular-nums">{t ? money(t.income) : '—'}</TD>
                    <TD className="text-right tabular-nums">{t ? money(t.expense) : '—'}</TD>
                    <TD className="text-right font-medium tabular-nums text-gray-950">{t ? money(t.income - t.expense) : '—'}</TD>
                    <TD className="text-right tabular-nums">{t?.lines ?? 0}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="text-[12px] text-gray-500">FY is the fiscal year ending in that calendar year; associations with a non-calendar fiscal year are grouped by the year their fiscal year ends.</p>
      </div>
    </DataWorkspace>
  );
}

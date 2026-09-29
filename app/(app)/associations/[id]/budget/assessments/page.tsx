import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { THead, TR, TH, TD } from '@/components/ui/table';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { applyAssessmentUpdate } from '@/lib/rpcs/budget-worksheet';
import { fiscalWindow, fiscalYearFor } from '@/lib/budget/fiscal';
import { money } from '@/lib/utils';
import { Calculator } from 'lucide-react';

export const dynamic = 'force-dynamic';

const METHODS = [
  { value: 'ownership_pct', label: 'Ownership percentage', hint: 'Each unit pays its percentage interest from the declaration.' },
  { value: 'equal', label: 'Equal shares', hint: 'Every unit pays the same amount.' },
  { value: 'sqft', label: 'Square footage', hint: 'Proportional to each unit’s square feet.' },
] as const;
const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly', periods: 12 },
  { value: 'quarterly', label: 'Quarterly', periods: 4 },
  { value: 'annually', label: 'Annually', periods: 1 },
] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Sp = { fiscal_year?: string; gl?: string; category?: string; method?: string; frequency?: string; effective?: string; error?: string; saved?: string };

export default async function UpdateAssessmentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  await requireFinanceOrPortfolioAdmin();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const ref = association.slug ?? id;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { data: assoc } = await db.from('associations').select('id, name, portfolio_id, fiscal_year_start, payment_frequency').eq('id', id).maybeSingle();
  if (!assoc) notFound();

  const currentFy = fiscalYearFor(new Date(), assoc.fiscal_year_start);
  const requested = Number(sp.fiscal_year);
  const fy = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentFy;
  const win = fiscalWindow(fy, assoc.fiscal_year_start);

  const [headerRes, linesRes, catsRes, historyRes] = await Promise.all([
    db.from('association_budgets').select('status, adopted_at').eq('association_id', id).eq('fiscal_year', fy).maybeSingle(),
    db.rpc('list_budget_lines', { p_association_id: id, p_fiscal_year: fy }),
    db.from('charge_categories').select('id, name, code, charge_type, gl_account_id, portfolio_id, association_id')
      .eq('active', true).is('archived_at', null).in('charge_type', ['assessment', 'special_assessment']).order('sort_order'),
    db.from('dues_increases').select('id, name, effective_date, posted_at, notes, dues_increase_lines(count)')
      .eq('association_id', id).order('created_at', { ascending: false }).limit(10),
  ]);

  const adopted = headerRes.data?.status === 'adopted';
  const incomeLines = ((linesRes.data ?? []) as any[]).filter((l) => l.category === 'income');
  const categories = ((catsRes.data ?? []) as any[]).filter(
    (c) => (!c.portfolio_id || c.portfolio_id === assoc.portfolio_id) && (!c.association_id || c.association_id === id),
  );

  const category = categories.find((c) => c.id === sp.category) ?? categories.find((c) => c.code === 'DUES') ?? categories[0];
  const gl = incomeLines.find((l) => l.gl_account_id === sp.gl)
    ?? incomeLines.find((l) => l.gl_account_id === category?.gl_account_id)
    ?? [...incomeLines].sort((a, b) => Number(b.annual_total) - Number(a.annual_total))[0];
  const method = METHODS.find((m) => m.value === sp.method)?.value ?? 'ownership_pct';
  const defaultFreq = ['monthly', 'quarterly', 'annually'].includes(assoc.payment_frequency) ? assoc.payment_frequency : 'monthly';
  const frequency = FREQUENCIES.find((f) => f.value === sp.frequency) ?? FREQUENCIES.find((f) => f.value === defaultFreq)!;

  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = (() => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10); })();
  const suggested = win.start > today ? win.start : nextMonth <= win.end ? nextMonth : today;
  const effective = sp.effective && DATE_RE.test(sp.effective) ? sp.effective : suggested;

  let rows: any[] = [];
  let previewError: string | null = null;
  if (gl && category && UUID_RE.test(gl.gl_account_id) && UUID_RE.test(category.id)) {
    const { data, error } = await db.rpc('assessment_allocation', {
      p_association_id: id, p_fiscal_year: fy, p_budget_gl_account_id: gl.gl_account_id,
      p_charge_category_id: category.id, p_method: method, p_frequency: frequency.value,
    });
    if (error) previewError = error.message;
    rows = data ?? [];
  }

  const budgetAnnual = Number(gl?.annual_total ?? 0);
  const allocatedAnnual = rows.reduce((s, r) => s + Number(r.period_amount ?? 0) * frequency.periods, 0);
  const rounding = Math.round((allocatedAnnual - budgetAnnual) * 100) / 100;
  const missing = rows.filter((r) => r.period_amount === null).length;
  const currentAnnual = rows.reduce((s, r) => s + Number(r.current_amount ?? 0) * (FREQUENCIES.find((f) => f.value === r.current_frequency)?.periods ?? 12), 0);
  const glMismatch = gl && category?.gl_account_id && category.gl_account_id !== gl.gl_account_id;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="budget" />
          <WorkspaceHeader
            eyebrow={<Link href={`/associations/${ref}/budget?fiscal_year=${fy}`} className="hover:text-gray-600">FY{fy} budget</Link>}
            title="Update assessments"
            subtitle={`Turn the adopted FY${fy} budget into each unit’s recurring assessment for ${assoc.name}.`}
          />
        </>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        {!adopted && (
          <Alert tone="warning">
            The FY{fy} budget is not adopted yet. <Link href={`/associations/${ref}/budget?fiscal_year=${fy}`} className="font-semibold underline">Finish and adopt the budget</Link> first; you can preview the allocation meanwhile.
          </Alert>
        )}

        <Section title="Allocation" padded>
          {incomeLines.length === 0 ? (
            <EmptyState icon={Calculator} title={`No income lines in the FY${fy} budget`} description="Add the assessment income line to the budget worksheet first."
              action={<Link href={`/associations/${ref}/budget?fiscal_year=${fy}`}><Button>Open the worksheet</Button></Link>} />
          ) : categories.length === 0 ? (
            <Alert tone="warning">There is no active assessment charge category. <Link href="/charge-categories" className="font-semibold underline">Create one</Link> (charge type “assessment”).</Alert>
          ) : (
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Fiscal year" htmlFor="fiscal_year">
                <Input id="fiscal_year" name="fiscal_year" type="number" min={2000} max={2100} defaultValue={fy} />
              </Field>
              <Field label="Budget line to collect" htmlFor="gl" hint="The annual income amount to spread across units.">
                <Select id="gl" name="gl" defaultValue={gl?.gl_account_id}>
                  {incomeLines.map((l) => <option key={l.gl_account_id} value={l.gl_account_id}>{l.gl_account_number} · {l.gl_account_name} — {money(l.annual_total)}</option>)}
                </Select>
              </Field>
              <Field label="Bill as" htmlFor="category" hint="The charge category owners see on their ledger.">
                <Select id="category" name="category" defaultValue={category?.id}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Split by" htmlFor="method" hint={METHODS.find((m) => m.value === method)?.hint}>
                <Select id="method" name="method" defaultValue={method}>
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Billing frequency" htmlFor="frequency">
                <Select id="frequency" name="frequency" defaultValue={frequency.value}>
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </Field>
              <Field label="First charge on" htmlFor="effective" hint={`Between today and ${win.end}.`}>
                <Input id="effective" name="effective" type="date" min={today} max={win.end} defaultValue={effective} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" variant="secondary">Preview</Button></div>
            </form>
          )}
        </Section>

        {previewError && <Alert tone="danger">{previewError}</Alert>}
        {glMismatch && (
          <Alert tone="warning">
            “{category?.name}” posts to a different income account than the budget line you chose, so budget-vs-actual will not line up. Change the category’s GL account or pick the matching budget line.
          </Alert>
        )}
        {missing > 0 && (
          <Alert tone="warning">
            {missing} unit{missing === 1 ? ' has' : 's have'} no {method === 'sqft' ? 'square footage' : 'ownership percentage'}. Fix the unit records or choose another split before applying.
          </Alert>
        )}

        {rows.length > 0 && (
          <Section
            title={`${rows.length} units · ${frequency.label.toLowerCase()} charges`}
            subtitle={`Budgeted ${money(budgetAnnual)} · allocated ${money(allocatedAnnual)}${rounding ? ` (${rounding > 0 ? '+' : ''}${money(rounding)} from rounding to cents)` : ''} · currently billed ${money(currentAnnual)} a year`}
          >
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <THead>
                <tr>
                  <TH>Unit</TH>
                  <TH>Owner</TH>
                  <TH className="text-right">Share</TH>
                  <TH className="text-right">Current</TH>
                  <TH className="text-right">New</TH>
                  <TH className="text-right">Change</TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const change = r.period_amount === null ? null : Number(r.period_amount) - Number(r.current_amount ?? 0);
                  return (
                    <TR key={r.unit_id}>
                      <TD className="font-medium text-gray-900"><Link href={`/units/${r.unit_id}`} className="hover:underline">{r.unit_number}</Link></TD>
                      <TD>{r.owner_name ?? <span className="text-gray-400">No current owner</span>}</TD>
                      <TD className="text-right tabular-nums">{r.share_pct === null ? '—' : `${Number(r.share_pct).toFixed(3)}%`}</TD>
                      <TD className="text-right tabular-nums">{r.current_amount === null ? '—' : `${money(r.current_amount)}${r.current_frequency && r.current_frequency !== frequency.value ? ` ${r.current_frequency}` : ''}`}</TD>
                      <TD className="text-right font-semibold tabular-nums text-gray-950">{r.period_amount === null ? <Badge tone="danger">Missing</Badge> : money(r.period_amount)}</TD>
                      <TD className={`text-right tabular-nums ${change && change > 0 ? 'text-red-700' : change && change < 0 ? 'text-emerald-700' : ''}`}>
                        {change === null || r.current_amount === null ? '—' : `${change > 0 ? '+' : ''}${money(change)}`}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </table></div>

            <form action={applyAssessmentUpdate} className="space-y-3 border-t border-gray-100 px-5 py-4">
              <input type="hidden" name="association_id" value={id} />
              <input type="hidden" name="association_ref" value={ref} />
              <input type="hidden" name="fiscal_year" value={fy} />
              <input type="hidden" name="budget_gl_account_id" value={gl?.gl_account_id ?? ''} />
              <input type="hidden" name="charge_category_id" value={category?.id ?? ''} />
              <input type="hidden" name="method" value={method} />
              <input type="hidden" name="frequency" value={frequency.value} />
              <input type="hidden" name="effective_date" value={effective} />
              <label className="flex min-h-10 items-start gap-2 text-[13px] text-gray-700">
                <input type="checkbox" name="confirm" className="mt-0.5 h-4 w-4 rounded border-gray-300" disabled={!adopted || missing > 0} />
                <span>
                  From {new Date(`${effective}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, stop each unit’s current “{category?.name}” charge and bill the new amount {frequency.label.toLowerCase()}.
                  Charges already posted are not changed. Remember to send owners the notice your declaration and state law require.
                </span>
              </label>
              <Button type="submit" disabled={!adopted || missing > 0}>Update {rows.length} assessments</Button>
            </form>
          </Section>
        )}

        {(historyRes.data ?? []).length > 0 && (
          <Section title="Assessment updates">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <THead>
                <tr><TH>Update</TH><TH>Effective</TH><TH className="text-right">Units</TH><TH>Posted</TH></tr>
              </THead>
              <tbody>
                {(historyRes.data ?? []).map((h: any) => (
                  <TR key={h.id}>
                    <TD><div className="font-medium text-gray-900">{h.name}</div>{h.notes && <div className="text-[12px] text-gray-500">{h.notes}</div>}</TD>
                    <TD className="tabular-nums">{h.effective_date}</TD>
                    <TD className="text-right tabular-nums">{h.dues_increase_lines?.[0]?.count ?? 0}</TD>
                    <TD className="tabular-nums">{h.posted_at ? new Date(h.posted_at).toLocaleDateString('en-US') : '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </Section>
        )}
      </div>
    </Workspace>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { BudgetWorksheet, type WorksheetAccount } from '@/components/budget/budget-worksheet';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';
import { adoptBudget, reopenBudget } from '@/lib/rpcs/budget-worksheet';
import { fiscalMonthLabels, fiscalWindow, fiscalYearFor } from '@/lib/budget/fiscal';
import { money } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';

export const dynamic = 'force-dynamic';

const INCOME = new Set(['income', 'other_income']);
const EXPENSE = new Set(['expense', 'cost_of_goods_sold', 'other_expense', 'non_operating']);

export default async function BudgetTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fiscal_year?: string; error?: string; saved?: string }>;
}) {
  const me = await requireWorkspaceStaff(); // company admins land here from their portal
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const ref = association.slug ?? id;
  const sp = await searchParams;

  const db = (await createClient()) as any;
  const { data: assoc } = await db.from('associations').select('id, name, address, fiscal_year_start').eq('id', id).maybeSingle();
  if (!assoc) notFound();

  const startMonth = assoc.fiscal_year_start;
  const currentFy = fiscalYearFor(new Date(), startMonth);
  const requested = Number(sp.fiscal_year);
  const fiscalYear = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentFy;
  const labels = fiscalMonthLabels(startMonth);
  const window = fiscalWindow(fiscalYear, startMonth);

  const [accountsRes, linesRes, headerRes, priorBudgetRes, priorActualsRes] = await Promise.all([
    db.from('gl_accounts').select('id, number, name, account_type').or(`association_id.eq.${id},association_id.is.null`).eq('active', true).order('number'),
    db.from('budget_lines').select('gl_account_id, monthly_amounts, notes').eq('association_id', id).eq('fiscal_year', fiscalYear),
    db.from('association_budgets').select('status, adopted_at, adoption_note').eq('association_id', id).eq('fiscal_year', fiscalYear).maybeSingle(),
    db.rpc('budget_worksheet_source', { p_association_id: id, p_fiscal_year: fiscalYear, p_source: 'prior_budget' }),
    db.rpc('budget_worksheet_source', { p_association_id: id, p_fiscal_year: fiscalYear, p_source: 'prior_actuals' }),
  ]);
  const loadError = [accountsRes, linesRes, headerRes, priorBudgetRes, priorActualsRes].find((r) => r.error)?.error?.message;

  const toMap = (rows: any[] | null) =>
    Object.fromEntries((rows ?? []).map((r: any) => [r.gl_account_id, (r.monthly_amounts ?? []).map((n: any) => Number(n) || 0)]));
  const lineMap = new Map<string, any>((linesRes.data ?? []).map((l: any) => [l.gl_account_id, l]));

  const accounts: WorksheetAccount[] = (accountsRes.data ?? [])
    .filter((a: any) => INCOME.has(a.account_type) || EXPENSE.has(a.account_type))
    .map((a: any) => {
      const l = lineMap.get(a.id);
      return {
        glAccountId: a.id,
        number: a.number ?? null,
        name: a.name,
        section: INCOME.has(a.account_type) ? 'income' : 'expense',
        amounts: l?.monthly_amounts ? l.monthly_amounts.map((n: any) => Number(n) || 0) : Array(12).fill(0),
        notes: l?.notes ?? '',
      };
    });

  const adopted = headerRes.data?.status === 'adopted';
  const canEdit = me.is_finance_staff || me.is_company_admin || me.is_platform_operator;
  const incomeTotal = accounts.filter((a) => a.section === 'income').reduce((s, a) => s + a.amounts.reduce((x, y) => x + y, 0), 0);
  const expenseTotal = accounts.filter((a) => a.section === 'expense').reduce((s, a) => s + a.amounts.reduce((x, y) => x + y, 0), 0);
  const years = Array.from(new Set([currentFy - 2, currentFy - 1, currentFy, currentFy + 1, currentFy + 2, fiscalYear])).sort();
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="budget" />
          <WorkspaceHeader
            title={
              <span className="flex items-center gap-2">
                FY{fiscalYear} budget
                <Badge tone={adopted ? 'complete' : 'pending'}>{adopted ? 'Adopted' : 'Draft'}</Badge>
              </span>
            }
            subtitle={`${assoc.name} · ${fmtDate(window.start)} – ${fmtDate(window.end)}`}
            actions={
              <>
                <form className="flex items-center gap-2">
                  <Select name="fiscal_year" defaultValue={String(fiscalYear)} aria-label="Fiscal year" className="h-9 w-28">
                    {years.map((y) => <option key={y} value={y}>FY{y}</option>)}
                  </Select>
                  <Button type="submit" size="sm" variant="secondary">Go</Button>
                </form>
                <Link href={`/budget-vs-actuals?association=${id}&year=${fiscalYear}`}>
                  <Button size="sm" variant="secondary">Budget vs actual</Button>
                </Link>
                <Link href={`/associations/${ref}/budget/dues-increase`}>
                  <Button size="sm" variant="secondary">Dues increase</Button>
                </Link>
                <Link href={`/associations/${ref}/budget/assessments?fiscal_year=${fiscalYear}`}>
                  <Button size="sm">Update assessments</Button>
                </Link>
              </>
            }
          />
        </>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        {loadError && <Alert tone="danger">Some budget data could not be loaded: {loadError}</Alert>}

        {adopted && (
          <Alert tone="info">
            Adopted {headerRes.data?.adopted_at ? new Date(headerRes.data.adopted_at).toLocaleDateString('en-US', { timeZone: displayTimeZone(), month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            {headerRes.data?.adoption_note ? ` — ${headerRes.data.adoption_note}` : ''}. The lines are locked; reopen the budget to change them.
          </Alert>
        )}

        <BudgetWorksheet
          associationId={id}
          associationRef={ref}
          fiscalYear={fiscalYear}
          labels={labels}
          accounts={accounts}
          sources={{ prior_budget: toMap(priorBudgetRes.data), prior_actuals: toMap(priorActualsRes.data) }}
          readOnly={adopted || !canEdit}
        />

        {canEdit && <Section title={adopted ? 'Reopen budget' : 'Adopt budget'} subtitle={
          adopted
            ? 'Reopening unlocks the lines. The reason is kept in the association’s change history.'
            : `Adopting locks FY${fiscalYear} (income ${money(incomeTotal)}, expense ${money(expenseTotal)}) and lets you turn it into owner assessments. Save the worksheet first.`
        } padded>
          {adopted ? (
            <form action={reopenBudget} className="grid max-w-xl gap-3">
              <input type="hidden" name="association_id" value={id} />
              <input type="hidden" name="association_ref" value={ref} />
              <input type="hidden" name="fiscal_year" value={fiscalYear} />
              <Field label="Reason" htmlFor="reason">
                <Textarea id="reason" name="reason" rows={2} required minLength={5} maxLength={2000} placeholder="e.g. Board amended the insurance line at the 3/12 meeting" />
              </Field>
              <div><Button type="submit" variant="secondary">Reopen for changes</Button></div>
            </form>
          ) : (
            <form action={adoptBudget} className="grid max-w-xl gap-3">
              <input type="hidden" name="association_id" value={id} />
              <input type="hidden" name="association_ref" value={ref} />
              <input type="hidden" name="fiscal_year" value={fiscalYear} />
              <Field label="Adoption note (optional)" htmlFor="note" hint="e.g. the board meeting and vote that approved it.">
                <Input id="note" name="note" maxLength={2000} placeholder="Approved 5–0 at the Nov 14 board meeting" />
              </Field>
              <div><Button type="submit">Adopt FY{fiscalYear} budget</Button></div>
            </form>
          )}
        </Section>}
      </div>
    </Workspace>
  );
}

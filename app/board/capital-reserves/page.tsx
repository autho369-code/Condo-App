import { AlertTriangle, PiggyBank, ShieldCheck } from 'lucide-react';

import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState, PageHeader, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireBoard } from '@/lib/auth/me';
import { firstShortfallYear, projectReserveFunding, reserveHealthTone } from '@/lib/reserves/projection';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BoardCapitalReservesPage() {
  const me = await requireBoard();
  const associationIds = me.board_association_ids ?? [];
  const supabase = await createClient();
  const db = supabase as any;
  const { data, error } = associationIds.length > 0
    ? await db
      .from('reserve_studies')
      .select('*, associations(name), reserve_components(*), reserve_funding_scenarios(*)')
      .in('association_id', associationIds)
      .in('status', ['board_review', 'approved'])
      .order('study_date', { ascending: false })
    : { data: [], error: null };
  const studies = data ?? [];

  const plans = studies.map((study: any) => {
    const components = (study.reserve_components ?? []).map((component: any) => ({
      id: component.id,
      name: component.name,
      currentAgeYears: Number(component.current_age_years ?? 0),
      usefulLifeYears: Number(component.useful_life_years ?? 1),
      remainingLifeYears: Number(component.remaining_life_years ?? 0),
      currentReplacementCost: Number(component.current_replacement_cost ?? 0),
      inflationRate: component.inflation_rate == null ? null : Number(component.inflation_rate),
    }));
    const scenario = (study.reserve_funding_scenarios ?? []).find((item: any) => item.is_baseline)
      ?? study.reserve_funding_scenarios?.[0];
    const rows = projectReserveFunding(components, {
      baseYear: Number(study.base_year),
      horizonYears: Number(study.horizon_years),
      openingBalance: Number(scenario?.opening_balance ?? study.opening_balance ?? 0),
      annualContribution: Number(scenario?.annual_contribution ?? study.annual_contribution ?? 0),
      contributionGrowthRate: Number(scenario?.annual_contribution_growth_rate ?? study.annual_contribution_growth_rate ?? 0),
      interestRate: Number(scenario?.annual_interest_rate ?? study.annual_interest_rate ?? 0),
      inflationRate: Number(study.annual_inflation_rate ?? 0),
      specialAssessments: Array.isArray(scenario?.special_assessments) ? scenario.special_assessments : [],
    });
    const shortfallYear = firstShortfallYear(rows);
    const first = rows[0];
    const tenYearWork = rows.slice(0, 10).reduce((sum, row) => sum + row.expenditures, 0);
    const upcoming = rows
      .flatMap((row) => row.expendituresDetail.map((item) => ({ ...item, year: row.year })))
      .slice(0, 8);
    return {
      ...study,
      components,
      rows,
      shortfallYear,
      tenYearWork,
      upcoming,
      percentFunded: first?.percentFunded ?? 100,
      endingBalance: rows.at(-1)?.endingBalance ?? Number(study.opening_balance ?? 0),
    };
  });

  const totalComponents = plans.reduce((sum: number, plan: any) => sum + plan.components.length, 0);
  const tenYearNeed = plans.reduce((sum: number, plan: any) => sum + plan.tenYearWork, 0);
  const plansWithShortfalls = plans.filter((plan: any) => plan.shortfallYear).length;
  const approvedPlans = plans.filter((plan: any) => plan.status === 'approved').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital & Reserve Plan"
        description="Board visibility into component lifecycles, projected capital work, and the long-range funding position."
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Capital plans could not be loaded. {error.message}</div>}

      <MetricStrip metrics={[
        { label: 'Plans in view', value: plans.length, sublabel: `${approvedPlans} approved` },
        { label: 'Capital components', value: totalComponents },
        { label: '10-year capital need', value: money(tenYearNeed) },
        { label: 'Plans with shortfalls', value: plansWithShortfalls, sublabel: plansWithShortfalls ? 'Board action recommended' : 'No modeled shortfalls' },
      ]} />

      {plans.length === 0 ? (
        <Surface>
          <EmptyState
            icon={PiggyBank}
            title="No reserve plan is ready for board review"
            description="Management can publish draft component schedules to the board when the underlying assumptions are ready."
          />
        </Surface>
      ) : plans.map((plan: any) => (
        <Surface key={plan.id}>
          <SectionTitle
            title={plan.name}
            description={`${plan.associations?.name ?? 'Association'} · ${plan.horizon_years}-year horizon · study dated ${date(plan.study_date)}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusChip tone={plan.status === 'approved' ? 'success' : 'info'}>{String(plan.status).replace(/_/g, ' ')}</StatusChip>
                <StatusChip tone={reserveHealthTone(plan.percentFunded, Boolean(plan.shortfallYear))}>{plan.shortfallYear ? `Shortfall ${plan.shortfallYear}` : 'Solvent through horizon'}</StatusChip>
              </div>
            }
          />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-500">Opening reserve</div><div className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{money(plan.opening_balance)}</div></div>
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-500">Annual contribution</div><div className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{money(plan.annual_contribution)}</div></div>
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-500">10-year capital work</div><div className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{money(plan.tenYearWork)}</div></div>
            <div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-500">Horizon ending balance</div><div className={`mt-1 text-xl font-semibold tabular-nums ${plan.endingBalance < 0 ? 'text-red-700' : 'text-gray-950'}`}>{money(plan.endingBalance)}</div></div>
          </div>

          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-950">Next modeled replacements</h3>
            {plan.upcoming.length > 0 ? (
              <Table>
                <THead><TR><TH>Year</TH><TH>Component</TH><TH>Cycle</TH><TH className="text-right">Projected cost</TH></TR></THead>
                <tbody>{plan.upcoming.map((item: any) => <TR key={`${item.componentId}-${item.year}-${item.replacementNumber}`}><TD className="tabular-nums">{item.year}</TD><TD className="font-medium text-gray-950">{item.componentName}</TD><TD>{item.replacementNumber === 1 ? 'Next replacement' : `Replacement ${item.replacementNumber}`}</TD><TD className="text-right tabular-nums">{money(item.amount)}</TD></TR>)}</tbody>
              </Table>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500"><AlertTriangle className="h-5 w-5" /> No replacement events have been modeled.</div>
            )}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div><span className="font-semibold">Board interpretation:</span> projections are planning estimates based on component lives, cost inflation, contributions, and reserve earnings. They do not replace a licensed reserve specialist or engineering inspection.</div>
          </div>
        </Surface>
      ))}
    </div>
  );
}

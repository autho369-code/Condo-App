import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, Plus, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';

import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import {
  firstShortfallYear,
  minimumAnnualContribution,
  projectReserveFunding,
  reserveHealthTone,
  type ReserveComponentInput,
  type SpecialAssessment,
} from '@/lib/reserves/projection';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

import { addFundingScenario, addReserveComponent, changeReserveStudyStatus } from '../actions';

export const dynamic = 'force-dynamic';

const categoryLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function ReserveStudyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    scenario?: string;
    error?: string;
    created?: string;
    component_added?: string;
    scenario_added?: string;
    status_updated?: string;
  }>;
}) {
  await requireWorkspaceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [studyResult, componentsResult, scenariosResult, assetsResult] = await Promise.all([
    db.from('reserve_studies').select('*, associations(id, name)').eq('id', id).maybeSingle(),
    db.from('reserve_components').select('*').eq('study_id', id).order('remaining_life_years').order('name'),
    db.from('reserve_funding_scenarios').select('*').eq('study_id', id).order('is_baseline', { ascending: false }).order('created_at'),
    db.from('fixed_assets').select('id, name, association_id, useful_life_years, purchase_price').is('archived_at', null).order('name'),
  ]);

  const study = studyResult.data;
  if (!study) notFound();
  const components = componentsResult.data ?? [];
  const scenarios = scenariosResult.data ?? [];
  const availableAssets = (assetsResult.data ?? []).filter((asset: any) => asset.association_id === study.association_id);
  const selectedScenario = scenarios.find((scenario: any) => scenario.id === sp.scenario)
    ?? scenarios.find((scenario: any) => scenario.is_baseline)
    ?? {
      id: 'study-default',
      name: 'Current funding plan',
      opening_balance: study.opening_balance,
      annual_contribution: study.annual_contribution,
      annual_contribution_growth_rate: study.annual_contribution_growth_rate,
      annual_interest_rate: study.annual_interest_rate,
      special_assessments: [],
      is_baseline: true,
    };

  const projectionComponents: ReserveComponentInput[] = components.map((component: any) => ({
    id: component.id,
    name: component.name,
    currentAgeYears: Number(component.current_age_years ?? 0),
    usefulLifeYears: Number(component.useful_life_years ?? 1),
    remainingLifeYears: Number(component.remaining_life_years ?? 0),
    currentReplacementCost: Number(component.current_replacement_cost ?? 0),
    inflationRate: component.inflation_rate == null ? null : Number(component.inflation_rate),
  }));
  const specialAssessments = Array.isArray(selectedScenario.special_assessments)
    ? selectedScenario.special_assessments as SpecialAssessment[]
    : [];
  const scenarioInput = {
    baseYear: Number(study.base_year),
    horizonYears: Number(study.horizon_years),
    openingBalance: Number(selectedScenario.opening_balance ?? study.opening_balance ?? 0),
    annualContribution: Number(selectedScenario.annual_contribution ?? study.annual_contribution ?? 0),
    contributionGrowthRate: Number(selectedScenario.annual_contribution_growth_rate ?? study.annual_contribution_growth_rate ?? 0),
    interestRate: Number(selectedScenario.annual_interest_rate ?? study.annual_interest_rate ?? 0),
    inflationRate: Number(study.annual_inflation_rate ?? 0),
    specialAssessments,
  };
  const projection = projectReserveFunding(projectionComponents, scenarioInput);
  const shortfallYear = firstShortfallYear(projection);
  const recommendedContribution = minimumAnnualContribution(projectionComponents, scenarioInput);
  const totalCurrentCost = projectionComponents.reduce((sum, component) => sum + component.currentReplacementCost, 0);
  const tenYearSpend = projection.slice(0, 10).reduce((sum, row) => sum + row.expenditures, 0);
  const lowestBalance = projection.length > 0 ? Math.min(...projection.map((row) => row.endingBalance)) : scenarioInput.openingBalance;
  const firstProjected = projection[0];
  const healthTone = reserveHealthTone(firstProjected?.percentFunded ?? 100, shortfallYear !== null);

  const scenarioSummaries = scenarios.map((scenario: any) => {
    const rows = projectReserveFunding(projectionComponents, {
      ...scenarioInput,
      openingBalance: Number(scenario.opening_balance ?? 0),
      annualContribution: Number(scenario.annual_contribution ?? 0),
      contributionGrowthRate: Number(scenario.annual_contribution_growth_rate ?? 0),
      interestRate: Number(scenario.annual_interest_rate ?? 0),
      specialAssessments: Array.isArray(scenario.special_assessments) ? scenario.special_assessments : [],
    });
    return {
      ...scenario,
      endingBalance: rows.at(-1)?.endingBalance ?? 0,
      shortfallYear: firstShortfallYear(rows),
      minimumBalance: rows.length > 0 ? Math.min(...rows.map((row) => row.endingBalance)) : 0,
    };
  });

  return (
    <PageShell>
      <Breadcrumb items={[{ label: 'Capital & Reserves', href: '/capital-reserves' }, { label: study.name }]} />
      <PageHeader
        eyebrow={study.associations?.name}
        title={study.name}
        description={`${study.horizon_years}-year projection from ${study.base_year} · study dated ${date(study.study_date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={study.status === 'approved' ? 'success' : study.status === 'board_review' ? 'info' : study.status === 'superseded' ? 'neutral' : 'warning'}>
              {String(study.status).replace(/_/g, ' ')}
            </StatusChip>
            {study.status === 'draft' && <form action={changeReserveStudyStatus.bind(null, id, 'board_review')}><Button type="submit" variant="secondary">Send to board review</Button></form>}
            {study.status === 'board_review' && <form action={changeReserveStudyStatus.bind(null, id, 'approved')}><Button type="submit"><ShieldCheck className="h-4 w-4" /> Approve plan</Button></form>}
            {study.status === 'approved' && <form action={changeReserveStudyStatus.bind(null, id, 'superseded')}><Button type="submit" variant="secondary">Supersede</Button></form>}
          </div>
        }
      />

      <div className="space-y-6">
        {sp.error && <Alert title="Reserve plan update failed.">{sp.error}</Alert>}
        {sp.created && <Alert tone="success" title="Reserve study created.">Add every material capital component before relying on the funding projection.</Alert>}
        {sp.component_added && <Alert tone="success" title="Component added.">The replacement event is now included in every funding scenario.</Alert>}
        {sp.scenario_added && <Alert tone="success" title="Scenario added.">Compare its shortfall year and ending balance with the current plan.</Alert>}
        {sp.status_updated && <Alert tone="success" title="Study status updated." />}
        {componentsResult.error && <Alert title="Components could not be loaded.">{componentsResult.error.message}</Alert>}

        <MetricStrip metrics={[
          { label: 'Modeled replacement cost', value: money(totalCurrentCost), sublabel: `${components.length} components` },
          { label: '10-year capital need', value: money(tenYearSpend), sublabel: 'Inflation adjusted' },
          { label: 'Lowest projected balance', value: money(lowestBalance), sublabel: shortfallYear ? `First shortfall ${shortfallYear}` : 'No modeled shortfall' },
          { label: 'Solvency contribution', value: money(recommendedContribution), sublabel: 'Minimum annual starting amount' },
        ]} />

        <Surface>
          <SectionTitle
            title="Funding scenario"
            description="Switch scenarios to compare contributions, special assessments, and reserve earnings against the same component schedule."
            actions={<StatusChip tone={healthTone}>{shortfallYear ? `Shortfall in ${shortfallYear}` : 'Solvent through horizon'}</StatusChip>}
          />
          <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {scenarios.map((scenario: any) => {
              const active = scenario.id === selectedScenario.id;
              return (
                <Link
                  key={scenario.id}
                  href={`/capital-reserves/${id}?scenario=${scenario.id}`}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${active ? 'bg-gray-950 text-white ring-gray-950' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'}`}
                >
                  {scenario.name}{scenario.is_baseline ? ' · baseline' : ''}
                </Link>
              );
            })}
          </nav>

          {projectionComponents.length === 0 ? (
            <Alert tone="warning" title="No components modeled.">Add capital components before interpreting this projection.</Alert>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Year</TH>
                  <TH className="text-right">Opening</TH>
                  <TH className="text-right">Contribution</TH>
                  <TH className="text-right">Special assessment</TH>
                  <TH className="text-right">Interest</TH>
                  <TH className="text-right">Capital work</TH>
                  <TH className="text-right">Ending</TH>
                  <TH className="text-right">Funded</TH>
                  <TH>Scheduled work</TH>
                </TR>
              </THead>
              <tbody>
                {projection.map((row) => (
                  <TR key={row.year} className={row.endingBalance < 0 ? 'bg-red-50/60' : undefined}>
                    <TD className="font-medium tabular-nums text-gray-950">{row.year}</TD>
                    <TD className="text-right tabular-nums">{money(row.openingBalance)}</TD>
                    <TD className="text-right tabular-nums">{money(row.contribution)}</TD>
                    <TD className="text-right tabular-nums">{row.specialAssessments > 0 ? money(row.specialAssessments) : '—'}</TD>
                    <TD className="text-right tabular-nums">{money(row.interestEarned)}</TD>
                    <TD className="text-right tabular-nums">{row.expenditures > 0 ? money(row.expenditures) : '—'}</TD>
                    <TD className={`text-right font-medium tabular-nums ${row.endingBalance < 0 ? 'text-red-700' : 'text-gray-950'}`}>{money(row.endingBalance)}</TD>
                    <TD className="text-right"><StatusChip tone={reserveHealthTone(row.percentFunded, row.endingBalance < 0)}>{Math.round(row.percentFunded)}%</StatusChip></TD>
                    <TD>
                      {row.expendituresDetail.length > 0
                        ? row.expendituresDetail.map((item) => <div key={`${item.componentId}-${item.replacementNumber}`} className="text-xs text-gray-600">{item.componentName} · {money(item.amount)}</div>)
                        : <span className="text-gray-400">—</span>}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>

        <Surface>
          <SectionTitle title="Capital components" description="Each component can repeat across the projection using its useful life and inflation assumption." />
          {components.length > 0 ? (
            <Table>
              <THead><TR><TH>Component</TH><TH>Category</TH><TH>Priority</TH><TH>Condition</TH><TH>Remaining life</TH><TH>Useful life</TH><TH className="text-right">Replacement cost</TH><TH>Inspection</TH></TR></THead>
              <tbody>
                {components.map((component: any) => (
                  <TR key={component.id}>
                    <TD className="font-medium text-gray-950">{component.name}<div className="text-xs font-normal text-gray-500">{component.quantity} {component.unit}</div></TD>
                    <TD>{categoryLabel(component.category)}</TD>
                    <TD><StatusChip tone={component.priority === 'critical' ? 'danger' : component.priority === 'high' ? 'warning' : component.priority === 'deferred' ? 'neutral' : 'info'}>{component.priority}</StatusChip></TD>
                    <TD>{component.condition_score ? `${component.condition_score} / 5` : '—'}</TD>
                    <TD className="tabular-nums">{component.remaining_life_years} years</TD>
                    <TD className="tabular-nums">{component.useful_life_years} years</TD>
                    <TD className="text-right tabular-nums">{money(component.current_replacement_cost)}</TD>
                    <TD className="tabular-nums">{date(component.last_inspected_at)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-900">Add the first capital component</p>
              <p className="mt-1 text-xs text-gray-500">Start with the largest structural or mechanical replacement obligation.</p>
            </div>
          )}

          <details className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900"><Plus className="mr-1 inline h-4 w-4" /> Add component</summary>
            <form action={addReserveComponent.bind(null, id)} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2"><Label htmlFor="component_name">Component name</Label><Input id="component_name" name="name" required placeholder="Roof membrane" /></div>
              <div><Label htmlFor="category">Category</Label><Select id="category" name="category" defaultValue="building_envelope"><option value="building_envelope">Building envelope</option><option value="structural">Structural</option><option value="mechanical">Mechanical</option><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option><option value="life_safety">Life safety</option><option value="site">Site and grounds</option><option value="interiors">Common interiors</option><option value="other">Other</option></Select></div>
              <div><Label htmlFor="priority">Priority</Label><Select id="priority" name="priority" defaultValue="standard"><option value="critical">Critical</option><option value="high">High</option><option value="standard">Standard</option><option value="deferred">Deferred</option></Select></div>
              <div><Label htmlFor="quantity">Quantity</Label><Input id="quantity" name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></div>
              <div><Label htmlFor="unit">Unit</Label><Input id="unit" name="unit" defaultValue="each" required /></div>
              <div><Label htmlFor="current_age_years">Current age (years)</Label><Input id="current_age_years" name="current_age_years" type="number" min="0" step="0.1" defaultValue="0" required /></div>
              <div><Label htmlFor="useful_life_years">Useful life (years)</Label><Input id="useful_life_years" name="useful_life_years" type="number" min="0.1" step="0.1" required /></div>
              <div><Label htmlFor="remaining_life_years">Remaining life (years)</Label><Input id="remaining_life_years" name="remaining_life_years" type="number" min="0" step="0.1" required /></div>
              <div><Label htmlFor="current_replacement_cost">Current replacement cost ($)</Label><Input id="current_replacement_cost" name="current_replacement_cost" type="number" min="0" step="0.01" required /></div>
              <div><Label htmlFor="inflation_rate">Component inflation (%)</Label><Input id="inflation_rate" name="inflation_rate" type="number" min="0" max="25" step="0.01" placeholder={String(study.annual_inflation_rate)} /></div>
              <div><Label htmlFor="condition_score">Condition score</Label><Select id="condition_score" name="condition_score" defaultValue=""><option value="">Not scored</option><option value="5">5 · Excellent</option><option value="4">4 · Good</option><option value="3">3 · Fair</option><option value="2">2 · Poor</option><option value="1">1 · Critical</option></Select></div>
              <div><Label htmlFor="last_inspected_at">Last inspected</Label><Input id="last_inspected_at" name="last_inspected_at" type="date" /></div>
              <div className="lg:col-span-2"><Label htmlFor="fixed_asset_id">Link fixed asset</Label><Select id="fixed_asset_id" name="fixed_asset_id" defaultValue=""><option value="">No linked asset</option>{availableAssets.map((asset: any) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</Select></div>
              <div className="sm:col-span-2 lg:col-span-4"><Label htmlFor="component_notes">Notes</Label><Textarea id="component_notes" name="notes" placeholder="Inspection source, scope assumptions, and exclusions" /></div>
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Add component</Button></div>
            </form>
          </details>
        </Surface>

        <Surface>
          <SectionTitle title="Scenario comparison" description="Keep the current plan as the baseline, then test contribution increases or a planned special assessment." />
          {scenarioSummaries.length > 0 && (
            <Table>
              <THead><TR><TH>Scenario</TH><TH className="text-right">Annual contribution</TH><TH className="text-right">Growth</TH><TH>First shortfall</TH><TH className="text-right">Minimum balance</TH><TH className="text-right">Ending balance</TH></TR></THead>
              <tbody>{scenarioSummaries.map((scenario: any) => <TR key={scenario.id}><TD><Link href={`/capital-reserves/${id}?scenario=${scenario.id}`} className="font-medium text-gray-950 hover:text-blue-700">{scenario.name}</Link>{scenario.is_baseline && <span className="ml-2 text-xs text-gray-400">baseline</span>}</TD><TD className="text-right tabular-nums">{money(scenario.annual_contribution)}</TD><TD className="text-right tabular-nums">{scenario.annual_contribution_growth_rate}%</TD><TD>{scenario.shortfallYear ? <StatusChip tone="danger">{scenario.shortfallYear}</StatusChip> : <StatusChip tone="success">None</StatusChip>}</TD><TD className="text-right tabular-nums">{money(scenario.minimumBalance)}</TD><TD className="text-right tabular-nums">{money(scenario.endingBalance)}</TD></TR>)}</tbody>
            </Table>
          )}

          <details className="mt-5 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900"><CircleDollarSign className="mr-1 inline h-4 w-4" /> Add funding scenario</summary>
            <form action={addFundingScenario.bind(null, id)} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2"><Label htmlFor="scenario_name">Scenario name</Label><Input id="scenario_name" name="name" required placeholder="Accelerated contribution plan" /></div>
              <div><Label htmlFor="scenario_opening_balance">Opening balance ($)</Label><Input id="scenario_opening_balance" name="opening_balance" type="number" min="0" step="0.01" defaultValue={String(study.opening_balance)} required /></div>
              <div><Label htmlFor="scenario_annual_contribution">Annual contribution ($)</Label><Input id="scenario_annual_contribution" name="annual_contribution" type="number" min="0" step="0.01" defaultValue={String(Math.ceil(recommendedContribution))} required /></div>
              <div><Label htmlFor="scenario_growth">Contribution growth (%)</Label><Input id="scenario_growth" name="annual_contribution_growth_rate" type="number" min="-25" max="100" step="0.01" defaultValue={String(study.annual_contribution_growth_rate)} required /></div>
              <div><Label htmlFor="scenario_interest">Reserve earnings (%)</Label><Input id="scenario_interest" name="annual_interest_rate" type="number" min="0" max="25" step="0.01" defaultValue={String(study.annual_interest_rate)} required /></div>
              <div><Label htmlFor="special_assessment_year">Special assessment year offset</Label><Input id="special_assessment_year" name="special_assessment_year" type="number" min="1" max={study.horizon_years} defaultValue="1" /></div>
              <div><Label htmlFor="special_assessment_amount">Special assessment amount ($)</Label><Input id="special_assessment_amount" name="special_assessment_amount" type="number" min="0" step="0.01" defaultValue="0" /></div>
              <div className="sm:col-span-2 lg:col-span-4"><Label htmlFor="scenario_notes">Notes</Label><Textarea id="scenario_notes" name="notes" placeholder="Board direction, assessment timing, or contribution policy" /></div>
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Add scenario</Button></div>
            </form>
          </details>
        </Surface>

        <Surface>
          <SectionTitle title="Study record" />
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-gray-500">Prepared by</dt><dd className="mt-1 font-medium text-gray-950">{study.prepared_by || 'Not recorded'}</dd></div>
            <div><dt className="text-xs text-gray-500">Funding policy</dt><dd className="mt-1 font-medium text-gray-950">{categoryLabel(study.funding_goal)}</dd></div>
            <div><dt className="text-xs text-gray-500">Inflation</dt><dd className="mt-1 font-medium tabular-nums text-gray-950">{study.annual_inflation_rate}%</dd></div>
            <div><dt className="text-xs text-gray-500">Approved</dt><dd className="mt-1 font-medium text-gray-950">{study.approved_at ? date(study.approved_at) : 'Not approved'}</dd></div>
          </dl>
          {study.notes && <p className="mt-5 border-t border-gray-100 pt-4 text-sm leading-6 text-gray-600">{study.notes}</p>}
          <div className="mt-5 flex items-center gap-2 text-xs text-gray-500"><Clock3 className="h-4 w-4" /> Last updated {date(study.updated_at)}{study.status === 'approved' && <><CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" /> Approved plan</>}</div>
        </Surface>
      </div>
    </PageShell>
  );
}

import Link from 'next/link';
import { CalendarClock, PiggyBank, Plus } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CapitalReservesPage() {
  await requireWorkspaceStaff();
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('reserve_studies')
    .select('id, name, status, study_date, base_year, horizon_years, opening_balance, annual_contribution, updated_at, associations(name), reserve_components(id, current_replacement_cost, remaining_life_years)')
    .order('updated_at', { ascending: false });

  const studies = data ?? [];
  const components = studies.flatMap((study: any) => study.reserve_components ?? []);
  const componentCost = components.reduce((sum: number, item: any) => sum + Number(item.current_replacement_cost ?? 0), 0);
  const nearTerm = components.filter((item: any) => Number(item.remaining_life_years ?? 999) <= 5).length;
  const approved = studies.filter((study: any) => study.status === 'approved').length;

  return (
    <DataWorkspace
      title="Capital & Reserves"
      description="Component-level reserve studies, replacement schedules, funding scenarios, and board-ready capital planning."
      actions={
        <Link href="/capital-reserves/new">
          <Button><Plus className="h-4 w-4" /> New reserve study</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {error && (
          <Alert tone="warning" title="Capital planning is not available yet.">
            Apply the capital reserve planning migration before creating a study. ({error.message})
          </Alert>
        )}

        <MetricStrip metrics={[
          { label: 'Reserve studies', value: studies.length, sublabel: `${approved} approved` },
          { label: 'Components modeled', value: components.length },
          { label: 'Current replacement cost', value: money(componentCost) },
          { label: 'Due within 5 years', value: nearTerm, sublabel: nearTerm > 0 ? 'Capital items to review' : 'No near-term items' },
        ]} />

        {studies.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Study</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Study date</TH>
                <TH>Horizon</TH>
                <TH className="text-right">Opening balance</TH>
                <TH className="text-right">Annual contribution</TH>
                <TH>Components</TH>
              </TR>
            </THead>
            <tbody>
              {studies.map((study: any) => (
                <TR key={study.id}>
                  <TD>
                    <Link href={`/capital-reserves/${study.id}`} className="font-medium text-gray-950 transition-colors hover:text-blue-700">
                      {study.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-gray-500">Base year {study.base_year}</div>
                  </TD>
                  <TD>{study.associations?.name ?? '—'}</TD>
                  <TD><StatusChip tone={study.status === 'approved' ? 'success' : study.status === 'board_review' ? 'info' : study.status === 'superseded' ? 'neutral' : 'warning'}>{String(study.status).replace(/_/g, ' ')}</StatusChip></TD>
                  <TD className="tabular-nums">{date(study.study_date)}</TD>
                  <TD className="tabular-nums">{study.horizon_years} years</TD>
                  <TD className="text-right tabular-nums">{money(study.opening_balance)}</TD>
                  <TD className="text-right tabular-nums">{money(study.annual_contribution)}</TD>
                  <TD className="tabular-nums">{study.reserve_components?.length ?? 0}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={PiggyBank}
              title="No component-level reserve studies yet"
              description="Model roofs, elevators, paving, mechanical systems, and other capital components, then compare contribution strategies before the board commits."
              action={<Link href="/capital-reserves/new"><Button><CalendarClock className="h-4 w-4" /> Start a reserve study</Button></Link>}
            />
          </div>
        )}

        <Alert tone="info" title="Why this is different.">
          Reserve balances alone do not show future risk. Each study projects inflation-adjusted replacement events, cash shortfalls, and the contribution needed to keep every modeled year solvent.
        </Alert>
      </div>
    </DataWorkspace>
  );
}

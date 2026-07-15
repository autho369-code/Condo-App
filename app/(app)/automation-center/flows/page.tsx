import Link from 'next/link';
import { ChevronDown, Plus, Workflow } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { deleteAutomationFlow, toggleAutomationFlow } from '@/lib/rpcs/automation-flows';
import {
  actionsSummary,
  isTriggerType,
  TRIGGER_DEFS,
  triggerDays,
  type FlowAction,
  type TriggerType,
} from '@/lib/automation/flow-defs';

export const dynamic = 'force-dynamic';

const RUNS_PER_FLOW = 20;

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function subjectLabel(run: any): string {
  const title = run.detail?.subject?.title;
  if (title) return String(title);
  return `${String(run.subject_type).replace(/_/g, ' ')} ${String(run.subject_id).slice(0, 8)}`;
}

export default async function AutomationFlowsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: flows } = await db
    .from('automation_flows')
    .select('id, name, enabled, trigger_type, trigger_config, actions, association_id, run_count, last_run_at, created_at, associations(name)')
    .order('created_at', { ascending: false });
  const flowRows = flows ?? [];

  const runsByFlow = new Map<string, any[]>();
  if (flowRows.length > 0) {
    const { data: runs } = await db
      .from('automation_flow_runs')
      .select('id, flow_id, subject_type, subject_id, fired_at, status, detail')
      .in('flow_id', flowRows.map((f: any) => f.id))
      .order('fired_at', { ascending: false })
      .limit(RUNS_PER_FLOW * flowRows.length);
    for (const run of runs ?? []) {
      const list = runsByFlow.get(run.flow_id) ?? [];
      if (list.length < RUNS_PER_FLOW) list.push(run);
      runsByFlow.set(run.flow_id, list);
    }
  }

  const activeCount = flowRows.filter((f: any) => f.enabled).length;
  const totalRuns = flowRows.reduce((sum: number, f: any) => sum + (f.run_count ?? 0), 0);

  return (
    <DataWorkspace
      title="Flows"
      description="Teach the system a rule once — when a trigger condition is met, the actions run automatically. Each flow fires at most once per record."
      actions={
        <>
          <Link href="/automation-center">
            <Button variant="secondary">Automation Center</Button>
          </Link>
          <Link href="/automation-center/flows/new">
            <Button><Plus className="h-4 w-4" /> New flow</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Something went wrong.">{sp.error}</Alert>}
        {sp.success && <Alert tone="success">{sp.success}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Flows', value: flowRows.length },
            { label: 'Active flows', value: activeCount },
            { label: 'Total runs', value: totalRuns },
          ]}
        />

        {flowRows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Workflow}
              title="No flows yet"
              description="Create your first rule — for example, email the owner and apply the late fee when a dues charge is 15 days overdue."
              action={
                <Link href="/automation-center/flows/new">
                  <Button><Plus className="h-4 w-4" /> New flow</Button>
                </Link>
              }
            />
          </Surface>
        ) : (
          <div className="space-y-4">
            {flowRows.map((flow: any) => {
              const trigger: TriggerType | null = isTriggerType(flow.trigger_type) ? flow.trigger_type : null;
              const days = trigger ? triggerDays(trigger, flow.trigger_config) : 0;
              const runs = runsByFlow.get(flow.id) ?? [];
              return (
                <Surface key={flow.id} padded={false}>
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{flow.name}</h2>
                        <Badge tone={flow.enabled ? 'complete' : 'inactive'}>{flow.enabled ? 'Active' : 'Paused'}</Badge>
                      </div>
                      <p className="mt-1 text-[13px] leading-5 text-gray-600">
                        {trigger ? TRIGGER_DEFS[trigger].summary(days) : flow.trigger_type}
                        <span className="text-gray-400"> · </span>
                        {actionsSummary((flow.actions ?? []) as FlowAction[])}
                      </p>
                      <p className="mt-1 text-[12px] text-gray-400">
                        {flow.associations?.name ?? 'All associations'}
                        <span> · </span>
                        {flow.run_count ?? 0} run{(flow.run_count ?? 0) === 1 ? '' : 's'}
                        <span> · </span>
                        Last checked {formatDateTime(flow.last_run_at)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <form action={toggleAutomationFlow}>
                        <input type="hidden" name="flow_id" value={flow.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          {flow.enabled ? 'Pause' : 'Enable'}
                        </Button>
                      </form>
                      <form action={deleteAutomationFlow}>
                        <input type="hidden" name="flow_id" value={flow.id} />
                        <Button type="submit" variant="danger" size="sm">Delete</Button>
                      </form>
                    </div>
                  </div>

                  <details className="group border-t border-gray-100">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900 sm:px-6 [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      Recent runs ({runs.length})
                    </summary>
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                      {runs.length === 0 ? (
                        <p className="text-[13px] text-gray-500">This flow has not fired for any record yet.</p>
                      ) : (
                        <Table>
                          <THead>
                            <TR>
                              <TH>Fired</TH>
                              <TH>Subject</TH>
                              <TH>Status</TH>
                              <TH>Actions</TH>
                            </TR>
                          </THead>
                          <tbody>
                            {runs.map((run: any) => (
                              <TR key={run.id}>
                                <TD className="whitespace-nowrap">{formatDateTime(run.fired_at)}</TD>
                                <TD>
                                  <div className="font-medium text-gray-900">{subjectLabel(run)}</div>
                                  <div className="text-xs capitalize text-gray-500">
                                    {String(run.subject_type).replace(/_/g, ' ')}
                                    {run.detail?.subject?.association ? ` · ${run.detail.subject.association}` : ''}
                                  </div>
                                </TD>
                                <TD><Badge status={run.status} /></TD>
                                <TD className="max-w-md text-xs text-gray-500">
                                  {Array.isArray(run.detail?.actions)
                                    ? run.detail.actions.map((a: any) => `${String(a.type).replace(/_/g, ' ')}: ${a.info}`).join(' · ')
                                    : '—'}
                                </TD>
                              </TR>
                            ))}
                          </tbody>
                        </Table>
                      )}
                    </div>
                  </details>
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

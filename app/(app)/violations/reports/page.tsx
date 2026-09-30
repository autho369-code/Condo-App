import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { convertViolationReport, dismissViolationReport } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;
const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger', high: 'danger', medium: 'warning', low: 'info',
};

function normalizeUnit(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/^(unit|apt|#)\s*/i, '').replace(/[^a-z0-9]/g, '');
}

export default async function ViolationReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assoc?: string; q?: string; error?: string; saved?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const status = sp.status === 'converted' || sp.status === 'dismissed' ? sp.status : 'reported';
  const assoc = UUID.test(sp.assoc ?? '') ? sp.assoc! : '';
  const db = (await createClient()) as any;

  let query = db
    .from('violation_cases')
    .select('id, association_id, reporter_name, reporter_unit, reporter_contact, reporter_is_owner, violator_name, violator_unit, house_rule_id, violation_type, violation_description, dates_times, witnesses, previously_reported, requested_action, reported_at, status, violation_id, determination_notes, reviewed_at, ai_severity, associations(name), house_rules(rule_number, title)')
    .is('archived_at', null)
    .eq('status', status)
    .order('reported_at', { ascending: status === 'reported' })
    .limit(200);
  if (assoc) query = query.eq('association_id', assoc);
  const [{ data, error }, { data: associations }] = await Promise.all([
    query,
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  const q = (sp.q ?? '').trim().toLowerCase();
  const reports = ((data ?? []) as any[]).filter((r) => !q || [
    r.violation_description, r.reporter_name, r.reporter_contact, r.violator_name, r.violator_unit, r.associations?.name, r.violation_type,
  ].some((v) => String(v ?? '').toLowerCase().includes(q)));

  // Unit and rule pickers for the associations that have open reports.
  const assocIds = [...new Set(reports.filter((r) => r.status === 'reported').map((r) => r.association_id))];
  const [{ data: units }, { data: rules }] = assocIds.length
    ? await Promise.all([
        db.from('units').select('id, unit_number, buildings!inner(association_id)').in('buildings.association_id', assocIds).is('archived_at', null).order('unit_number').limit(5000),
        db.from('house_rules').select('id, association_id, rule_number, title').in('association_id', assocIds).is('archived_at', null).eq('active', true).order('rule_number'),
      ])
    : [{ data: [] }, { data: [] }];
  const unitsFor = (associationId: string) => (units ?? []).filter((u: any) => u.buildings?.association_id === associationId);
  const rulesFor = (associationId: string) => (rules ?? []).filter((r: any) => r.association_id === associationId);

  return (
    <DataWorkspace
      title="Resident violation reports"
      description="Reports submitted through the public violation form. Open a violation when a report checks out, or dismiss it with a reason. The reporter's name and contact stay with staff — owners never see who reported them."
      actions={<Link href="/violations"><Button variant="secondary">Back to violations</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not update report">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}

        <FilterBar action="/violations/reports" searchDefault={sp.q ?? ''} searchPlaceholder="Search description, reporter, unit or association">
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="reported">To review</option>
            <option value="converted">Opened as violations</option>
            <option value="dismissed">Dismissed</option>
          </FilterSelect>
          <FilterSelect label="Association" name="assoc" defaultValue={assoc}>
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {reports.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Inbox}
              title={status === 'reported' ? 'No reports to review' : 'Nothing here'}
              description="Reports from the public violation form appear here for review."
            />
          </Surface>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => {
              const assocUnits = unitsFor(r.association_id);
              const match = assocUnits.find((u: any) => normalizeUnit(u.unit_number) === normalizeUnit(r.violator_unit) && normalizeUnit(r.violator_unit));
              return (
                <Surface key={r.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-semibold capitalize text-gray-950">{String(r.violation_type ?? 'other').replace(/_/g, ' ')}</h2>
                        {r.ai_severity && <StatusChip tone={SEVERITY_TONE[r.ai_severity] ?? 'neutral'}>{r.ai_severity} severity</StatusChip>}
                        {r.previously_reported && <StatusChip tone="warning">Reported before</StatusChip>}
                      </div>
                      <p className="mt-0.5 text-[13px] text-gray-500">
                        {r.associations?.name ?? '—'} · received {date(r.reported_at)}
                        {r.violator_unit ? ` · about unit ${r.violator_unit}` : ''}{r.violator_name ? ` (${r.violator_name})` : ''}
                      </p>
                    </div>
                    <div className="text-[13px] text-gray-500 sm:text-right">
                      Requested: <span className="font-medium capitalize text-gray-800">{r.requested_action ?? 'warning'}</span>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{r.violation_description}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                    {r.dates_times && <div><dt className="inline text-gray-500">When: </dt><dd className="inline text-gray-800">{r.dates_times}</dd></div>}
                    {r.witnesses && <div><dt className="inline text-gray-500">Witnesses: </dt><dd className="inline text-gray-800">{r.witnesses}</dd></div>}
                    {r.house_rules && <div><dt className="inline text-gray-500">Rule cited: </dt><dd className="inline text-gray-800">{r.house_rules.rule_number} — {r.house_rules.title}</dd></div>}
                    <div>
                      <dt className="inline text-gray-500">Reported by: </dt>
                      <dd className="inline text-gray-800">
                        {r.reporter_name}{r.reporter_unit ? ` (unit ${r.reporter_unit})` : ''}{r.reporter_is_owner ? ' · owner' : ''} · {r.reporter_contact}
                      </dd>
                    </div>
                  </dl>

                  {r.status === 'reported' ? (
                    <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 lg:grid-cols-[2fr_1fr]">
                      <form action={convertViolationReport} className="grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="case_id" value={r.id} />
                        <Field label="Unit" hint={match ? 'Matched from the report.' : r.violator_unit ? `No exact match for “${r.violator_unit}” — choose the unit.` : undefined}>
                          <Select name="unit_id" defaultValue={match?.id ?? ''}>
                            <option value="">No unit (common area)</option>
                            {assocUnits.map((u: any) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
                          </Select>
                        </Field>
                        <Field label="Rule">
                          <Select name="house_rule_id" defaultValue={r.house_rule_id ?? ''}>
                            <option value="">No specific rule</option>
                            {rulesFor(r.association_id).map((rule: any) => <option key={rule.id} value={rule.id}>{rule.rule_number} — {rule.title}</option>)}
                          </Select>
                        </Field>
                        <Field label="Title (optional)" className="sm:col-span-2">
                          <Input name="title" maxLength={200} placeholder="Defaults to the rule or report type" />
                        </Field>
                        <div className="sm:col-span-2"><Button type="submit">Open violation</Button></div>
                      </form>
                      <form action={dismissViolationReport} className="space-y-3">
                        <input type="hidden" name="case_id" value={r.id} />
                        <Field label="Dismiss with reason">
                          <Input name="reason" required maxLength={500} placeholder="e.g. Not a rule violation, duplicate" />
                        </Field>
                        <Button type="submit" variant="secondary">Dismiss report</Button>
                      </form>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
                      {r.status === 'converted' && r.violation_id
                        ? <>Opened as a violation {date(r.reviewed_at)} — <Link href={`/violations/${r.violation_id}`} className="font-medium text-gray-900 hover:underline">view violation</Link></>
                        : <>Dismissed {date(r.reviewed_at)}{r.determination_notes ? ` — ${r.determination_notes}` : ''}</>}
                    </p>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

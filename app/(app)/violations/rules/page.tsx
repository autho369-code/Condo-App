import Link from 'next/link';
import { BookOpenCheck, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Section } from '@/components/workspace/shell';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { copyHouseRules, installStarterRules } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';
import { humanize, loadAssociationScope } from '@/lib/violations/rules-data';

export const dynamic = 'force-dynamic';

export default async function ViolationRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ association_id?: string; q?: string; error?: string; saved?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { associations, selected } = await loadAssociationScope(db, sp.association_id);

  if (!selected) {
    return (
      <DataWorkspace title="Rules & fines" description="Governing-document rules, follow-up schedules, and fines per association.">
        <EmptyState icon={BookOpenCheck} title="No associations yet" description="Add an association before building its rule library." />
      </DataWorkspace>
    );
  }

  const [{ data: rules }, { data: steps }, { data: settings }] = await Promise.all([
    db.from('house_rules')
      .select('id, rule_number, title, category, default_violation_type, fine_amount, active, custom_schedule, sort_order')
      .eq('association_id', selected.id)
      .is('archived_at', null)
      .order('sort_order')
      .order('rule_number'),
    db.from('violation_followup_steps')
      .select('id, fee, days_after_previous, house_rule_id')
      .eq('association_id', selected.id)
      .is('house_rule_id', null)
      .is('archived_at', null),
    db.from('association_violation_settings').select('hearing_required_before_fine, hearing_request_days').eq('association_id', selected.id).maybeSingle(),
  ]);

  const q = (sp.q ?? '').trim().toLowerCase();
  const allRules = (rules ?? []) as any[];
  const shown = q
    ? allRules.filter((r) => `${r.rule_number} ${r.title} ${r.category}`.toLowerCase().includes(q))
    : allRules;
  const defaultSteps = (steps ?? []) as any[];
  const totalDays = defaultSteps.reduce((s, x) => s + Number(x.days_after_previous ?? 0), 0);
  const firstFine = defaultSteps.find((x) => Number(x.fee) > 0);
  const hearingGate = settings?.hearing_required_before_fine ?? true;
  const others = associations.filter((a) => a.id !== selected.id);

  return (
    <DataWorkspace
      title="Rules & fines"
      description="Each association's governing-document rules, the follow-up ladder violations move through, and the fines it posts."
      actions={
        <>
          <Link href={`/violations/rules/schedule?association_id=${selected.id}`}><Button variant="secondary">Schedule & fining policy</Button></Link>
          <Link href={`/violations/rules/new?association_id=${selected.id}`}><Button><Plus className="h-4 w-4" /> New rule</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Could not complete that:">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}

        <FilterBar action="/violations/rules" searchDefault={sp.q ?? ''} searchPlaceholder="Search rules...">
          <FilterSelect label="Association" name="association_id" defaultValue={selected.id}>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        <MetricStrip
          metrics={[
            { label: 'Active rules', value: allRules.filter((r) => r.active).length },
            { label: 'Custom schedules', value: allRules.filter((r) => r.custom_schedule).length },
            { label: 'Default ladder', value: defaultSteps.length ? `${defaultSteps.length} steps` : 'Not set', sublabel: defaultSteps.length ? `${totalDays} days end to end` : undefined },
            { label: 'Fining', value: hearingGate ? 'Hearing first' : 'Direct', sublabel: firstFine ? `First fine ${money(firstFine.fee)}` : 'No fines configured' },
          ]}
        />

        {allRules.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={BookOpenCheck}
              title={`No rules for ${selected.name} yet`}
              description="Start from 12 common condominium rules and a four-step notice-hearing-fine ladder, then edit them to match the declaration and rules & regulations."
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form action={installStarterRules}>
                    <input type="hidden" name="association_id" value={selected.id} />
                    <Button type="submit">Install starter rules</Button>
                  </form>
                  <Link href={`/violations/rules/new?association_id=${selected.id}`}><Button variant="secondary">Write a rule</Button></Link>
                </div>
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Rule</TH>
                <TH>Title</TH>
                <TH>Category</TH>
                <TH>Schedule</TH>
                <TH className="text-right">Default fine</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {shown.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs font-medium text-gray-900"><Link href={`/violations/rules/${r.id}`} className="hover:text-gray-600">{r.rule_number}</Link></TD>
                  <TD className="font-medium text-gray-900"><Link href={`/violations/rules/${r.id}`} className="hover:text-gray-600">{r.title}</Link></TD>
                  <TD className="text-sm text-gray-600">{humanize(r.category)}</TD>
                  <TD className="text-sm text-gray-600">{r.custom_schedule ? 'Custom' : 'Association default'}</TD>
                  <TD className="text-right tabular-nums text-gray-700">{r.fine_amount != null ? money(r.fine_amount) : '—'}</TD>
                  <TD>{r.active ? <StatusChip tone="success">Active</StatusChip> : <StatusChip tone="neutral">Inactive</StatusChip>}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {allRules.length > 0 && others.length > 0 && (
          <Section title="Copy rules to other associations" subtitle="Rules whose number already exists in a target association are skipped." padded>
            <form action={copyHouseRules} className="space-y-4">
              <input type="hidden" name="association_id" value={selected.id} />
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((a) => (
                  <label key={a.id} className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="target_association_ids" value={a.id} className="h-4 w-4 rounded border-gray-300" />
                    {a.name}
                  </label>
                ))}
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="include_schedules" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                Also copy follow-up schedules (the default ladder is copied only where the target has none)
              </label>
              <Button type="submit" variant="secondary">Copy {allRules.length} rules</Button>
            </form>
          </Section>
        )}
      </div>
    </DataWorkspace>
  );
}

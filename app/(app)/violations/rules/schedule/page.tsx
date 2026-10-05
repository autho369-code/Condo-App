import Link from 'next/link';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { ScheduleEditor } from '@/components/violations/schedule-editor';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { requireStaff } from '@/lib/auth/me';
import { saveViolationSchedule, saveViolationSettings } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { loadAssociationScope, loadScheduleOptions, toScheduleSteps } from '@/lib/violations/rules-data';

export const dynamic = 'force-dynamic';

const STARTER_LADDER = [
  { follow_up_name: 'Courtesy notice', days_after_previous: 0, fee: 0, offers_hearing: false, delivery_methods: ['email', 'portal'], letter_template_id: null, gl_account_id: null },
  { follow_up_name: 'Formal notice with hearing opportunity', days_after_previous: 14, fee: 0, offers_hearing: true, delivery_methods: ['email', 'portal', 'mail'], letter_template_id: null, gl_account_id: null },
  { follow_up_name: 'First fine', days_after_previous: 14, fee: 50, offers_hearing: false, delivery_methods: ['email', 'portal', 'mail'], letter_template_id: null, gl_account_id: null },
  { follow_up_name: 'Continuing violation fine', days_after_previous: 30, fee: 100, offers_hearing: false, delivery_methods: ['email', 'portal', 'mail'], letter_template_id: null, gl_account_id: null },
];

export default async function ViolationSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ association_id?: string; error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const { associations, selected } = await loadAssociationScope(db, sp.association_id);
  if (!selected) {
    return <Workspace header={<WorkspaceHeader title="Schedule & fining policy" />}><EmptyState title="No associations yet" /></Workspace>;
  }

  const [{ data: steps }, { data: settings }, { data: fineCategories }, options] = await Promise.all([
    db.from('violation_followup_steps').select('*').eq('association_id', selected.id).is('house_rule_id', null).is('archived_at', null).order('step_order'),
    db.from('association_violation_settings').select('*').eq('association_id', selected.id).maybeSingle(),
    // The association's own company (a platform operator's portfolio is not it).
    db.from('charge_categories').select('id, name, charge_type').eq('portfolio_id', selected.portfolio_id).eq('active', true).is('archived_at', null).order('sort_order'),
    loadScheduleOptions(db, selected.portfolio_id, selected.id),
  ]);
  const current = toScheduleSteps(steps);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href={`/violations/rules?association_id=${selected.id}`} className="transition-colors hover:text-gray-700">Rules & fines</Link>}
          title="Schedule & fining policy"
          subtitle={selected.name}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">{sp.saved}</Alert>}

      <div className="mb-6">
        <FilterBar action="/violations/rules/schedule" search={false}>
          <FilterSelect label="Association" name="association_id" defaultValue={selected.id}>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Section
          title="Default follow-up schedule"
          subtitle="Every violation moves through these steps unless its rule has a custom schedule. Fines post to the owner's unit ledger."
          padded
        >
          <ScheduleEditor
            action={saveViolationSchedule}
            associationId={selected.id}
            initial={current.length ? current : STARTER_LADDER}
            templates={options.templates}
            glAccounts={options.glAccounts}
            submitLabel={current.length ? 'Save schedule' : 'Save starter schedule'}
          />
        </Section>

        <Section title="Fining policy" subtitle="Due-process protections applied before any fine posts." padded>
          <form action={saveViolationSettings} className="space-y-4">
            <input type="hidden" name="association_id" value={selected.id} />
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="hearing_required_before_fine" defaultChecked={settings?.hearing_required_before_fine ?? true} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span>
                Require notice and a hearing opportunity before fining
                <span className="mt-0.5 block text-[12px] leading-4 text-gray-400">Most state condominium and HOA statutes require this. Fines are blocked until the hearing window passes without a request, or a hearing upholds the violation.</span>
              </span>
            </label>
            <Field label="Days to request a hearing" htmlFor="hearing_request_days">
              <Input id="hearing_request_days" name="hearing_request_days" type="number" min="0" max="90" defaultValue={settings?.hearing_request_days ?? 14} />
            </Field>
            <Field label="Default cure period (days)" htmlFor="default_cure_days" hint="Sets the cure deadline when a violation opens.">
              <Input id="default_cure_days" name="default_cure_days" type="number" min="0" max="365" defaultValue={settings?.default_cure_days ?? 14} />
            </Field>
            <Field label="Fine charge category" htmlFor="fine_charge_category_id">
              <Select id="fine_charge_category_id" name="fine_charge_category_id" defaultValue={settings?.fine_charge_category_id ?? ''}>
                <option value="">Automatic (first “fine” category)</option>
                {((fineCategories ?? []) as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Button type="submit" className="w-full">Save fining policy</Button>
          </form>
          <p className="mt-4 text-[12px] leading-4 text-gray-400">Not legal advice. Confirm notice periods and fine limits with association counsel for your state.</p>
        </Section>
      </div>
    </Workspace>
  );
}

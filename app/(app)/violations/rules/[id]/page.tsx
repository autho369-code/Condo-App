import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { RuleForm } from '@/components/violations/rule-form';
import { ScheduleEditor } from '@/components/violations/schedule-editor';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { archiveHouseRule, saveViolationSchedule } from '@/lib/rpcs/violation-rules';
import { createClient } from '@/lib/supabase/server';
import { loadScheduleOptions, toScheduleSteps } from '@/lib/violations/rules-data';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

export default async function RuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: rule } = await db
    .from('house_rules')
    .select('*, associations(id, name, portfolio_id)')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (!rule) notFound();

  const [{ data: customSteps }, { data: defaultSteps }, { count: openCount }, options] = await Promise.all([
    db.from('violation_followup_steps').select('*').eq('house_rule_id', id).is('archived_at', null).order('step_order'),
    db.from('violation_followup_steps').select('*').eq('association_id', rule.association_id).is('house_rule_id', null).is('archived_at', null).order('step_order'),
    db.from('violations').select('id', { count: 'exact', head: true }).eq('house_rule_id', id).not('status', 'in', '("cured","closed")'),
    loadScheduleOptions(db, rule.associations?.portfolio_id ?? me.portfolio?.id, rule.association_id),
  ]);

  const usingCustom = Boolean(rule.custom_schedule);
  const initialSteps = toScheduleSteps(usingCustom ? customSteps : defaultSteps);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<><Link href={`/violations/rules?association_id=${rule.association_id}`} className="transition-colors hover:text-gray-700">Rules & fines</Link>{' · '}{rule.associations?.name}</>}
          title={`${rule.rule_number} — ${rule.title}`}
          subtitle={`${openCount ?? 0} open violation${openCount === 1 ? '' : 's'} under this rule`}
          actions={<Link href={`/violations/new?association_id=${rule.association_id}&house_rule_id=${rule.id}`}><Button>Open violation</Button></Link>}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">{sp.saved}</Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Rule" padded>
          <RuleForm associationId={rule.association_id} rule={rule} />
        </Section>

        <div>
          <Section
            title="Follow-up schedule"
            subtitle={usingCustom
              ? 'This rule has its own ladder. Remove every step and save to go back to the association default.'
              : 'Using the association default. Edit and save to give this rule its own ladder.'}
            padded
          >
            <ScheduleEditor
              action={saveViolationSchedule}
              associationId={rule.association_id}
              houseRuleId={rule.id}
              initial={initialSteps}
              templates={options.templates}
              glAccounts={options.glAccounts}
              allowEmpty
              submitLabel={usingCustom ? 'Save custom schedule' : 'Save as custom schedule'}
            />
          </Section>

          <Section title="Archive rule" padded>
            <form action={archiveHouseRule} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input type="hidden" name="id" value={rule.id} />
              <input type="hidden" name="association_id" value={rule.association_id} />
              <p className="text-sm text-gray-500">Existing violations keep their history. The rule can no longer be chosen.</p>
              <PendingSubmit variant="danger" pendingLabel="Archiving…" confirm="Archive this rule? It can no longer be chosen for new violations.">Archive</PendingSubmit>
            </form>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}

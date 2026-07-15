import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { createAutomationFlow } from '@/lib/rpcs/automation-flows';
import {
  ACTION_DEFS,
  ACTION_TYPES,
  actionAllowedForTrigger,
  isTriggerType,
  TEMPLATE_VARIABLES_HINT,
  TRIGGER_DEFS,
  TRIGGER_TYPES,
  type TriggerType,
} from '@/lib/automation/flow-defs';

export const dynamic = 'force-dynamic';

export default async function NewAutomationFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ trigger?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const trigger: TriggerType = isTriggerType(sp.trigger) ? sp.trigger : 'charge_overdue';
  const triggerDef = TRIGGER_DEFS[trigger];

  const supabase = await createClient();
  const db = supabase as any;
  // RLS scopes this to the staff member's own associations.
  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  const allowedActions = ACTION_TYPES.filter((a) => actionAllowedForTrigger(a, trigger));

  return (
    <DataWorkspace
      title="New flow"
      description="Pick a trigger, set the threshold, and choose what happens. The flow runs hourly and fires at most once per matching record."
      actions={
        <Link href="/automation-center/flows">
          <Button variant="secondary">Cancel</Button>
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {sp.error && <Alert tone="danger" title="Could not create flow.">{sp.error}</Alert>}

        <Surface>
          <SectionTitle
            title="Trigger"
            description="Switching the trigger updates which actions are available below."
          />
          <div className="flex flex-wrap gap-2">
            {TRIGGER_TYPES.map((t) => (
              <Link key={t} href={`/automation-center/flows/new?trigger=${t}`}>
                <Button type="button" size="sm" variant={t === trigger ? 'primary' : 'secondary'}>
                  {TRIGGER_DEFS[t].label}
                </Button>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-5 text-gray-500">{triggerDef.summary(triggerDef.defaultDays)} — adjust the day threshold below.</p>
        </Surface>

        <form action={createAutomationFlow}>
          <input type="hidden" name="trigger_type" value={trigger} />
          <div className="space-y-6">
            <Surface>
              <SectionTitle title="Rule" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Flow name" htmlFor="name" required className="sm:col-span-2">
                  <Input id="name" name="name" required placeholder={`e.g. ${triggerDef.summary(triggerDef.defaultDays)}`} />
                </Field>
                <Field label="Association" htmlFor="association_id" hint="Leave on All to apply the rule portfolio-wide.">
                  <Select id="association_id" name="association_id" defaultValue="">
                    <option value="">All associations</option>
                    {(associations ?? []).map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={triggerDef.daysLabel} htmlFor="days" required>
                  <Input id="days" name="days" type="number" min={1} max={3650} required defaultValue={triggerDef.defaultDays} />
                </Field>
              </div>
            </Surface>

            <Surface>
              <SectionTitle
                title="Actions"
                description="Actions run in the order shown. Each outcome is recorded on the run."
              />
              <div className="space-y-5">
                {allowedActions.map((actionType) => (
                  <div key={actionType} className="rounded-xl border border-gray-200 p-4">
                    <label className="flex items-start gap-2.5 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        name={`action_${actionType}`}
                        defaultChecked={actionType === 'email_owner'}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <span>
                        <span className="font-medium text-gray-900">{ACTION_DEFS[actionType].label}</span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-gray-500">{ACTION_DEFS[actionType].description}</span>
                      </span>
                    </label>

                    {actionType === 'email_owner' && (
                      <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                        <Field label="Email subject" htmlFor="email_subject">
                          <Input
                            id="email_subject"
                            name="email_subject"
                            placeholder="e.g. Reminder from {{association}}: {{title}}"
                          />
                        </Field>
                        <Field label="Email body" htmlFor="email_body" hint={TEMPLATE_VARIABLES_HINT}>
                          <Textarea
                            id="email_body"
                            name="email_body"
                            rows={6}
                            placeholder={'Hi {{owner_name}},\n\n{{title}} at {{association}} needs your attention ({{days}} days). {{amount}}\n\nThank you.'}
                          />
                        </Field>
                      </div>
                    )}

                    {actionType === 'notify_manager' && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <Field label="Note to the managers" htmlFor="manager_note" hint={TEMPLATE_VARIABLES_HINT}>
                          <Textarea
                            id="manager_note"
                            name="manager_note"
                            rows={3}
                            placeholder="Optional context to include above the record summary."
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Surface>

            <div className="flex items-center gap-2">
              <Button type="submit">Create flow</Button>
              <Link href="/automation-center/flows">
                <Button type="button" variant="ghost">Cancel</Button>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </DataWorkspace>
  );
}

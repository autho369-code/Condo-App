import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { saveHouseRule } from '@/lib/rpcs/violation-rules';
import { VIOLATION_TYPES, humanize } from '@/lib/violations/rules-data';

type Rule = {
  id?: string;
  rule_number?: string;
  title?: string;
  description?: string;
  action_to_resolve?: string | null;
  category?: string | null;
  default_violation_type?: string | null;
  fine_amount?: number | null;
  active?: boolean;
};

export function RuleForm({ associationId, rule }: { associationId: string; rule?: Rule }) {
  return (
    <form action={saveHouseRule} className="space-y-4">
      <input type="hidden" name="association_id" value={associationId} />
      {rule?.id && <input type="hidden" name="id" value={rule.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Rule / article no." htmlFor="rule_number" required>
          <Input id="rule_number" name="rule_number" required maxLength={40} defaultValue={rule?.rule_number ?? ''} placeholder="e.g. Art. VII §3" />
        </Field>
        <Field label="Title" htmlFor="title" required>
          <Input id="title" name="title" required maxLength={200} defaultValue={rule?.title ?? ''} placeholder="e.g. Quiet hours" />
        </Field>
      </div>
      <Field label="Rule text" htmlFor="description" required hint="Quote the governing document. It appears on notices and in the owner portal.">
        <Textarea id="description" name="description" required rows={5} maxLength={8000} defaultValue={rule?.description ?? ''} />
      </Field>
      <Field label="Action to resolve" htmlFor="action_to_resolve" hint="What the owner must do to cure the violation.">
        <Textarea id="action_to_resolve" name="action_to_resolve" rows={2} maxLength={2000} defaultValue={rule?.action_to_resolve ?? ''} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Category" htmlFor="category">
          <Input id="category" name="category" maxLength={40} defaultValue={rule?.category ?? ''} placeholder="e.g. parking" />
        </Field>
        <Field label="Violation type" htmlFor="default_violation_type" hint="Used for reporting and analytics.">
          <Select id="default_violation_type" name="default_violation_type" defaultValue={rule?.default_violation_type ?? 'other'}>
            {VIOLATION_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </Select>
        </Field>
        <Field label="Reference fine ($)" htmlFor="fine_amount" hint="For reference; fines post from the schedule.">
          <Input id="fine_amount" name="fine_amount" type="number" min="0" step="0.01" defaultValue={rule?.fine_amount ?? ''} />
        </Field>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} className="h-4 w-4 rounded border-gray-300" />
        Active — available when opening violations
      </label>
      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/violations/rules?association_id=${associationId}`} className="text-center text-sm text-gray-600 hover:text-gray-900">Back to rules</Link>
        <Button type="submit">{rule?.id ? 'Save rule' : 'Create rule'}</Button>
      </div>
    </form>
  );
}

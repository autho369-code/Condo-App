import Link from 'next/link';
import { SectionTitle, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { saveRecurringJournalEntry } from '@/lib/rpcs/recurring';

const LINES = 6;

export type RecurringJe = {
  id: string; name: string; memo: string | null; frequency: string; interval_count: number;
  next_post_date: string | null; end_date: string | null; auto_generate: boolean; template_lines: any[] | null;
};

/** New and edit form for a recurring journal entry (same fields, same action). */
export function RecurringJournalEntryForm({
  entry, gls, associations, today,
}: { entry?: RecurringJe; gls: any[]; associations: any[]; today: string }) {
  const lines: any[] = entry?.template_lines ?? [];
  return (
      <form action={saveRecurringJournalEntry} className="space-y-6">
        {entry?.id && <input type="hidden" name="id" value={entry.id} />}
        <Surface>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Name" htmlFor="name" required className="sm:col-span-2">
              <Input id="name" name="name" required maxLength={120} placeholder="Monthly reserve allocation" defaultValue={entry?.name ?? ''} />
            </Field>
            <Field label="Repeats" htmlFor="frequency" required>
              <Select id="frequency" name="frequency" defaultValue={entry?.frequency ?? 'monthly'}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </Select>
            </Field>
            <Field label="Every" htmlFor="interval_count">
              <Input id="interval_count" name="interval_count" type="number" min={1} max={12} defaultValue={entry?.interval_count ?? 1} />
            </Field>
            <Field label={entry ? 'Next posting date' : 'First posting date'} htmlFor="next_date" required>
              <Input id="next_date" name="next_date" type="date" required defaultValue={entry?.next_post_date ?? today} />
            </Field>
            <Field label="End date (optional)" htmlFor="end_date">
              <Input id="end_date" name="end_date" type="date" defaultValue={entry?.end_date ?? ''} />
            </Field>
            <Field label="Memo" htmlFor="memo" className="sm:col-span-2">
              <Input id="memo" name="memo" maxLength={200} defaultValue={entry?.memo ?? ''} />
            </Field>
            {entry && (
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
                <input type="checkbox" name="active" defaultChecked={entry.auto_generate} className="h-4 w-4 rounded border-gray-300" />
                Post automatically
              </label>
            )}
          </div>
        </Surface>

        <Surface>
          <SectionTitle title="Lines" description="Debits must equal credits. Leave unused rows blank." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-2">GL account</th>
                  <th className="pb-2 pr-2">Association</th>
                  <th className="pb-2 pr-2">Debit</th>
                  <th className="pb-2 pr-2">Credit</th>
                  <th className="pb-2">Line memo</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(LINES, lines.length) }, (_, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <Select name={`line_${i}_gl`} aria-label={`Line ${i + 1} GL account`} defaultValue={lines[i]?.gl_account_id ?? ''}>
                        <option value="">—</option>
                        {gls.map((g: any) => <option key={g.id} value={g.id}>{g.number} · {g.name}{g.associations?.name ? ` (${g.associations.name})` : ''}</option>)}
                      </Select>
                    </td>
                    <td className="py-1 pr-2">
                      <Select name={`line_${i}_association`} aria-label={`Line ${i + 1} association`} defaultValue={lines[i]?.association_id ?? ''}>
                        <option value="">—</option>
                        {associations.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </td>
                    <td className="py-1 pr-2"><Input name={`line_${i}_debit`} inputMode="decimal" aria-label={`Line ${i + 1} debit`} defaultValue={Number(lines[i]?.debit) ? String(lines[i].debit) : ''} /></td>
                    <td className="py-1 pr-2"><Input name={`line_${i}_credit`} inputMode="decimal" aria-label={`Line ${i + 1} credit`} defaultValue={Number(lines[i]?.credit) ? String(lines[i].credit) : ''} /></td>
                    <td className="py-1"><Input name={`line_${i}_memo`} maxLength={200} aria-label={`Line ${i + 1} memo`} defaultValue={lines[i]?.memo ?? ''} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/journal-entries/recurring"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit">{entry ? 'Save changes' : 'Create recurring entry'}</Button>
        </div>
      </form>
  );
}

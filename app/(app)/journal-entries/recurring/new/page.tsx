import Link from 'next/link';
import { Alert, Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { saveRecurringJournalEntry } from '@/lib/rpcs/recurring';

export const dynamic = 'force-dynamic';

const LINES = 6;

export default async function NewRecurringJournalEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: gls }, { data: associations }] = await Promise.all([
    db.from('gl_accounts').select('id, number, name').eq('active', true).order('number'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell className="max-w-5xl">
      <Breadcrumb items={[{ label: 'Journal entries', href: '/journal-entries' }, { label: 'Recurring', href: '/journal-entries?tab=recurring' }, { label: 'New' }]} />
      <PageHeader
        title="New recurring journal entry"
        description="Posted automatically on each scheduled date — for depreciation, reserve allocations, prepaid amortization and similar entries."
      />
      {sp.error && <div className="mb-6"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}

      <form action={saveRecurringJournalEntry} className="space-y-6">
        <Surface>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Name" htmlFor="name" required className="sm:col-span-2">
              <Input id="name" name="name" required maxLength={120} placeholder="Monthly reserve allocation" />
            </Field>
            <Field label="Repeats" htmlFor="frequency" required>
              <Select id="frequency" name="frequency" defaultValue="monthly">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </Select>
            </Field>
            <Field label="Every" htmlFor="interval_count">
              <Input id="interval_count" name="interval_count" type="number" min={1} max={12} defaultValue={1} />
            </Field>
            <Field label="First posting date" htmlFor="next_date" required>
              <Input id="next_date" name="next_date" type="date" required defaultValue={today} />
            </Field>
            <Field label="Memo" htmlFor="memo" className="sm:col-span-3">
              <Input id="memo" name="memo" maxLength={200} />
            </Field>
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
                {Array.from({ length: LINES }, (_, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <Select name={`line_${i}_gl`} aria-label={`Line ${i + 1} GL account`} defaultValue="">
                        <option value="">—</option>
                        {(gls ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
                      </Select>
                    </td>
                    <td className="py-1 pr-2">
                      <Select name={`line_${i}_association`} aria-label={`Line ${i + 1} association`} defaultValue="">
                        <option value="">—</option>
                        {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </td>
                    <td className="py-1 pr-2"><Input name={`line_${i}_debit`} inputMode="decimal" aria-label={`Line ${i + 1} debit`} /></td>
                    <td className="py-1 pr-2"><Input name={`line_${i}_credit`} inputMode="decimal" aria-label={`Line ${i + 1} credit`} /></td>
                    <td className="py-1"><Input name={`line_${i}_memo`} maxLength={200} aria-label={`Line ${i + 1} memo`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/journal-entries?tab=recurring"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit">Create recurring entry</Button>
        </div>
      </form>
    </PageShell>
  );
}

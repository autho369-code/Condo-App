import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { THead, TR, TH, TD } from '@/components/ui/table';
import { Alert, EmptyState } from '@/components/ui/shell';
import { applyDuesIncrease } from '@/lib/rpcs/dues-increase';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone } from '@/lib/time/zoned';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const MODES = [
  { value: 'percent', label: 'Increase by a percentage', unit: '%' },
  { value: 'amount', label: 'Increase by a dollar amount', unit: '$' },
  { value: 'set', label: 'Set a new amount', unit: '$' },
] as const;
const FREQUENCY_LABEL: Record<string, string> = { daily: 'daily', weekly: 'weekly', monthly: 'monthly', quarterly: 'quarterly', annually: 'yearly', yearly: 'yearly' };

type Sp = { category?: string; mode?: string; value?: string; effective?: string; error?: string; saved?: string };

function realDate(raw: string | undefined) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? raw : null;
}

function longDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function DuesIncreasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  await requireFinanceOrPortfolioAdmin();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const ref = association.slug ?? id;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { data: assoc } = await db.from('associations').select('id, name, portfolio_id, timezone').eq('id', id).maybeSingle();
  if (!assoc) notFound();

  const [catsRes, historyRes] = await Promise.all([
    db.from('charge_categories').select('id, name, code, charge_type, portfolio_id, association_id')
      .eq('active', true).is('archived_at', null).in('charge_type', ['assessment', 'special_assessment']).order('sort_order'),
    db.from('audit_logs').select('id, created_at, changes')
      .eq('action', 'dues_increase').eq('entity_type', 'association').eq('entity_id', id)
      .order('created_at', { ascending: false }).limit(20),
  ]);
  const categories = ((catsRes.data ?? []) as any[]).filter(
    (c) => (!c.portfolio_id || c.portfolio_id === assoc.portfolio_id) && (!c.association_id || c.association_id === id),
  );
  const categoryName = new Map<string, string>(categories.map((c) => [c.id, c.name]));

  const category = categories.find((c) => c.id === sp.category) ?? categories.find((c) => c.code === 'DUES') ?? categories[0];
  const mode = MODES.find((m) => m.value === sp.mode) ?? MODES[0];
  const valueRaw = (sp.value ?? '').trim();
  const value = valueRaw === '' ? null : Number(valueRaw);
  const today = todayInZone(assoc.timezone || displayTimeZone());
  const nextMonth = (() => {
    const [y, m] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  })();
  const effective = realDate(sp.effective) ?? nextMonth;

  // Preview: the same function with p_apply = false changes nothing.
  let rows: any[] = [];
  let previewError: string | null = null;
  const ready = !!category && value != null && Number.isFinite(value);
  if (ready) {
    const { data, error } = await db.rpc('apply_dues_increase', {
      p_association_id: id,
      p_charge_category_id: category.id,
      p_mode: mode.value,
      p_value: value,
      p_effective_date: effective,
      p_apply: false,
    });
    if (error) previewError = error.message;
    rows = Array.isArray(data) ? data : [];
  }
  const changed = rows.filter((r) => Number(r.new_amount) !== Number(r.old_amount));
  const totalOld = rows.reduce((s, r) => s + Number(r.old_amount ?? 0), 0);
  const totalNew = rows.reduce((s, r) => s + Number(r.new_amount ?? 0), 0);

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="budget" />
          <WorkspaceHeader
            eyebrow={<Link href={`/associations/${ref}/budget`} className="hover:text-gray-600">Budget</Link>}
            title="Dues increase"
            subtitle={`Raise every unit’s recurring dues for ${assoc.name} from a date you choose.`}
            actions={<Link href={`/associations/${ref}/budget/assessments`}><Button size="sm" variant="secondary">Update from budget instead</Button></Link>}
          />
        </>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}

        <Section title="Increase" padded>
          {categories.length === 0 ? (
            <Alert tone="warning">There is no active assessment charge category. <Link href="/charge-categories" className="font-semibold underline">Create one</Link> (charge type “assessment”).</Alert>
          ) : (
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Charge" htmlFor="category" hint="The recurring charge to change on every unit.">
                <Select id="category" name="category" defaultValue={category?.id}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Change" htmlFor="mode">
                <Select id="mode" name="mode" defaultValue={mode.value}>
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label={mode.value === 'percent' ? 'Percent' : 'Amount'} htmlFor="value" hint={mode.value === 'percent' ? 'e.g. 3 for 3%. A negative value lowers dues.' : mode.value === 'amount' ? 'Added to each unit’s current amount.' : 'Every unit pays this amount.'}>
                <Input id="value" name="value" type="number" step="0.01" required defaultValue={valueRaw} />
              </Field>
              <Field label="Effective date" htmlFor="effective" hint="The first charge on or after this date bills the new amount.">
                <Input id="effective" name="effective" type="date" defaultValue={effective} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" variant="secondary">Preview</Button></div>
            </form>
          )}
        </Section>

        {previewError && <Alert tone="danger">{previewError}</Alert>}
        {ready && !previewError && rows.length === 0 && (
          <Alert tone="info">
            No unit has an active “{category?.name}” recurring charge that continues past {effective}, so there is nothing to increase.
            Set up each unit’s dues with <Link href={`/associations/${ref}/budget/assessments`} className="font-semibold underline">Update assessments</Link> (from the budget)
            or <Link href="/charges/bulk-recurring" className="font-semibold underline">Bulk recurring charges</Link>.
          </Alert>
        )}

        {rows.length > 0 && (
          <Section
            title={`${rows.length} unit${rows.length === 1 ? '' : 's'} · ${changed.length} change${changed.length === 1 ? '' : 's'}`}
            subtitle={`Per billing period: ${money(totalOld)} now → ${money(totalNew)} after (${totalNew - totalOld >= 0 ? '+' : ''}${money(totalNew - totalOld)}).`}
          >
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <THead>
                <tr>
                  <TH>Unit</TH>
                  <TH>Homeowner</TH>
                  <TH>Billed</TH>
                  <TH className="text-right">Current</TH>
                  <TH className="text-right">New</TH>
                  <TH className="text-right">Change</TH>
                  <TH>First new charge</TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const diff = Number(r.new_amount) - Number(r.old_amount);
                  return (
                    <TR key={r.recurring_id}>
                      <TD className="font-medium text-gray-900">{r.unit_number}</TD>
                      <TD>{r.homeowner ?? <span className="text-gray-400">No current owner</span>}</TD>
                      <TD className="text-gray-600">{FREQUENCY_LABEL[r.frequency] ?? r.frequency}</TD>
                      <TD className="text-right tabular-nums">{money(r.old_amount)}</TD>
                      <TD className="text-right font-semibold tabular-nums text-gray-950">{money(r.new_amount)}</TD>
                      <TD className={`text-right tabular-nums ${diff > 0 ? 'text-red-700' : diff < 0 ? 'text-emerald-700' : 'text-gray-500'}`}>{diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${money(diff)}`}</TD>
                      <TD className="tabular-nums text-gray-600">{r.first_new_post}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </table></div>

            <form action={applyDuesIncrease} className="space-y-3 border-t border-gray-100 px-5 py-4">
              <input type="hidden" name="association_id" value={id} />
              <input type="hidden" name="association_ref" value={ref} />
              <input type="hidden" name="charge_category_id" value={category?.id ?? ''} />
              <input type="hidden" name="mode" value={mode.value} />
              <input type="hidden" name="value" value={valueRaw} />
              <input type="hidden" name="effective_date" value={effective} />
              <label className="flex min-h-10 items-start gap-2 text-[13px] text-gray-700">
                <input type="checkbox" name="confirm" className="mt-0.5 h-4 w-4 rounded border-gray-300" disabled={changed.length === 0} />
                <span>
                  From {longDate(effective)}, bill the new “{category?.name}” amount shown for each unit. Charges already posted are not changed, and each unit keeps its billing schedule.
                  Remember to send owners the notice your declaration and state law require.
                </span>
              </label>
              <Button type="submit" disabled={changed.length === 0}>Apply to {changed.length} unit{changed.length === 1 ? '' : 's'}</Button>
            </form>
          </Section>
        )}

        <Section title="Past dues increases">
          {(historyRes.data ?? []).length === 0 ? (
            <EmptyState icon={TrendingUp} title="No dues increases yet" description="Increases applied here are listed with their effective date." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <THead>
                <tr><TH>Applied</TH><TH>Charge</TH><TH>Change</TH><TH>Effective</TH><TH className="text-right">Units</TH></tr>
              </THead>
              <tbody>
                {(historyRes.data ?? []).map((h: any) => {
                  const c = h.changes ?? {};
                  const how = c.mode === 'percent' ? `${Number(c.value) >= 0 ? '+' : ''}${c.value}%` : c.mode === 'amount' ? `${Number(c.value) >= 0 ? '+' : ''}${money(c.value)}` : `Set to ${money(c.value)}`;
                  return (
                    <TR key={h.id}>
                      <TD className="tabular-nums">{new Date(h.created_at).toLocaleDateString('en-US', { timeZone: displayTimeZone(), month: 'short', day: 'numeric', year: 'numeric' })}</TD>
                      <TD>{categoryName.get(c.charge_category_id) ?? 'Charge'}</TD>
                      <TD className="tabular-nums">{how}</TD>
                      <TD className="tabular-nums">{c.effective_date ?? '—'}</TD>
                      <TD className="text-right tabular-nums">{c.schedules ?? '—'}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Section>
      </div>
    </Workspace>
  );
}

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/shell';
import { setOwnerLateFeeOverride } from '@/lib/rpcs/owner-late-fees';
import { money } from '@/lib/utils';
import { todayInZone } from '@/lib/time/zoned';

type Occ = {
  id: string;
  status: string;
  occupancy_type: string;
  late_fee_exempt: boolean | null;
  late_fee_override_amount: number | null;
  late_fee_override_is_percent: boolean | null;
  late_fee_override_until: string | null;
  late_fee_override_reason: string | null;
  units?: { unit_number?: string | null; buildings?: { associations?: { name?: string | null } | null } | null } | null;
};

export function describeLateFeeRule(o: Occ, today = todayInZone()) {
  const expired = o.late_fee_override_until && o.late_fee_override_until < today;
  if (expired) return { label: 'Association default', tone: 'inactive' as const, detail: `Exception ended ${o.late_fee_override_until}` };
  if (o.late_fee_exempt) return { label: 'Exempt', tone: 'pending' as const, detail: o.late_fee_override_reason ?? '' };
  if (o.late_fee_override_amount !== null && o.late_fee_override_amount !== undefined) {
    const amt = o.late_fee_override_is_percent ? `${Number(o.late_fee_override_amount)}% of the overdue balance` : money(o.late_fee_override_amount);
    return { label: `Custom: ${amt}`, tone: 'progress' as const, detail: o.late_fee_override_reason ?? '' };
  }
  return { label: 'Association default', tone: 'inactive' as const, detail: '' };
}

export function OwnerLateFeeOverrides({ ownerId, occupancies, canEdit }: { ownerId: string; occupancies: Occ[]; canEdit: boolean }) {
  const owned = occupancies.filter((o) => o.status === 'current' && o.occupancy_type === 'owner');
  if (!owned.length) return null;
  return (
    <div id="late-fees" className="border-t border-gray-100 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-900">Late fees</h3>
      <p className="mt-0.5 text-xs text-gray-500">Exempt this owner or set a different fee. The automatic late-fee run honors it; changes are logged.</p>
      <ul className="mt-3 space-y-3">
        {owned.map((o) => {
          const rule = describeLateFeeRule(o);
          const mode = o.late_fee_exempt ? 'exempt' : o.late_fee_override_amount != null ? 'custom' : 'default';
          return (
            <li key={o.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-900">
                  Unit {o.units?.unit_number ?? '—'}
                  <span className="font-normal text-gray-500"> · {o.units?.buildings?.associations?.name ?? ''}</span>
                </div>
                <Badge tone={rule.tone}>{rule.label}</Badge>
              </div>
              {(rule.detail || o.late_fee_override_until) && (
                <div className="mt-1 text-xs text-gray-500">
                  {rule.detail}{o.late_fee_override_until && rule.label !== 'Association default' ? ` · until ${o.late_fee_override_until}` : ''}
                </div>
              )}
              {canEdit && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[12px] font-medium text-gray-500 hover:text-gray-900">Change</summary>
                  <form action={setOwnerLateFeeOverride} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="owner_id" value={ownerId} />
                    <input type="hidden" name="occupancy_id" value={o.id} />
                    <Field label="Rule" htmlFor={`lf-mode-${o.id}`}>
                      <Select id={`lf-mode-${o.id}`} name="mode" defaultValue={mode}>
                        <option value="default">Association default</option>
                        <option value="exempt">Exempt from late fees</option>
                        <option value="custom">Custom fee</option>
                      </Select>
                    </Field>
                    <Field label="Custom fee" htmlFor={`lf-amt-${o.id}`} hint="Only for a custom fee.">
                      <div className="flex gap-2">
                        <Input id={`lf-amt-${o.id}`} name="amount" type="number" min="0" step="0.01" defaultValue={o.late_fee_override_amount ?? ''} className="w-28" />
                        <Select name="unit" aria-label="Fee unit" defaultValue={o.late_fee_override_is_percent ? 'percent' : 'flat'} className="w-24">
                          <option value="flat">$</option>
                          <option value="percent">%</option>
                        </Select>
                      </div>
                    </Field>
                    <Field label="Until (optional)" htmlFor={`lf-until-${o.id}`}>
                      <Input id={`lf-until-${o.id}`} name="until" type="date" defaultValue={o.late_fee_override_until ?? ''} />
                    </Field>
                    <Field label="Reason" htmlFor={`lf-reason-${o.id}`} hint="Required for an exception.">
                      <Input id={`lf-reason-${o.id}`} name="reason" maxLength={500} defaultValue={o.late_fee_override_reason ?? ''} placeholder="e.g. Payment plan approved 9/12" />
                    </Field>
                    <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" size="sm" variant="secondary">Save late-fee rule</Button></div>
                  </form>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

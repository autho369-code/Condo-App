import Link from 'next/link';
import { Check } from 'lucide-react';
import { Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { advanceViolation, recordViolationHearing, resolveViolation } from '@/lib/rpcs/violation-rules';
import { date, money } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone } from '@/lib/time/zoned';

type Step = { id: string; follow_up_name: string; days_after_previous: number; fee: number | null; offers_hearing: boolean };
type Settings = { hearing_required_before_fine?: boolean; hearing_request_days?: number } | null;

/** Calendar date (YYYY-MM-DD) plus whole days. */
function addDaysToDate(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Mirrors the due-process gate in advance_violation() so staff see why a fine
 * is blocked before clicking: the owner may request a hearing through the
 * notice date + N days (association-local dates); fining opens the day after.
 */
function fineGate(v: any, settings: Settings): string | null {
  if (!(settings?.hearing_required_before_fine ?? true) || v.board_decision === 'upheld') return null;
  if (v.hearing_requested_at) return 'The owner requested a hearing. Record the hearing decision before fining.';
  if (!v.notice_sent_at) return 'Send a notice before fining.';
  const zone = displayTimeZone();
  const until = addDaysToDate(todayInZone(zone, new Date(v.notice_sent_at)), settings?.hearing_request_days ?? 14);
  if (until >= todayInZone(zone)) return `The owner can request a hearing until ${date(until)}.`;
  return null;
}

export function EscalationPanel({
  violation: v,
  steps,
  settings,
  fines,
}: {
  violation: any;
  steps: Step[];
  settings: Settings;
  fines: { id: string; step_name: string; amount: number; assessed_at: string }[];
}) {
  const resolved = v.status === 'cured' || v.status === 'closed';
  const next = steps[v.current_step] as Step | undefined;
  const nextFee = Number(next?.fee ?? 0);
  const gate = next && nextFee > 0 ? fineGate(v, settings) : null;
  const dueNow = v.next_followup_on && new Date(`${v.next_followup_on}T23:59:59`) <= new Date();
  const hearingOpen = !resolved && (v.hearing_required || v.hearing_requested_at) && !v.board_decision;

  return (
    <Section
      title="Escalation"
      subtitle={steps.length
        ? `Step ${Math.min(v.current_step, steps.length)} of ${steps.length}${v.next_followup_on && !resolved ? ` · next follow-up ${date(v.next_followup_on)}${dueNow ? ' (due)' : ''}` : ''}`
        : undefined}
      padded
    >
      {steps.length === 0 ? (
        <p className="text-sm text-gray-500">
          No follow-up schedule applies. <Link className="font-medium text-gray-700 underline" href={`/violations/rules/schedule?association_id=${v.association_id}`}>Set up the association schedule</Link> to track notices and fines.
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => {
            const done = i < v.current_step;
            const isNext = i === v.current_step && !resolved;
            return (
              <li key={s.id} className={`rounded-xl border px-3 py-2.5 ${isNext ? 'border-gray-900' : 'border-gray-200/70'} ${done ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="flex items-center gap-2 text-[12px] text-gray-500">
                  {done ? <Check className="h-3.5 w-3.5 text-gray-700" /> : <span className="tabular-nums">{i + 1}</span>}
                  <span>{i === 0 ? `day ${s.days_after_previous}` : `+${s.days_after_previous} days`}</span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-gray-900">{s.follow_up_name}</div>
                <div className="text-[12px] text-gray-500">
                  {Number(s.fee) > 0 ? `Fine ${money(s.fee)}` : 'Notice'}{s.offers_hearing ? ' · hearing offered' : ''}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {fines.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200/70 px-4 py-3 text-sm">
          <div className="mb-1 font-medium text-gray-900">Fines posted — {money(fines.reduce((s, f) => s + Number(f.amount), 0))}</div>
          {fines.map((f) => (
            <div key={f.id} className="flex justify-between text-gray-600"><span>{f.step_name}</span><span className="tabular-nums">{money(f.amount)} · {date(f.assessed_at)}</span></div>
          ))}
          {v.unit_id && <Link href={`/units/${v.unit_id}`} className="mt-1 inline-block text-[12px] font-medium text-gray-500 hover:text-gray-900">View unit ledger</Link>}
        </div>
      )}

      {!resolved && (
        <div className="mt-5 grid gap-5 border-t border-gray-100 pt-5 lg:grid-cols-2">
          {next ? (
            <form action={advanceViolation} className="space-y-3">
              <input type="hidden" name="id" value={v.id} />
              <div className="text-sm font-medium text-gray-900">
                Next: {next.follow_up_name}{nextFee > 0 ? ` — posts a ${money(nextFee)} fine` : ''}
              </div>
              {gate && <Alert tone="warning">{gate}</Alert>}
              <Input name="note" maxLength={500} placeholder="Note for the timeline (optional)" aria-label="Note" />
              <Button type="submit" disabled={Boolean(gate)}>Record {next.follow_up_name.toLowerCase()}</Button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">The follow-up schedule is complete. Resolve the violation when appropriate.</p>
          )}

          <div className="space-y-3">
            <form action={resolveViolation} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="id" value={v.id} />
              <Input name="note" maxLength={500} placeholder="Resolution note" aria-label="Resolution note" />
              <Button type="submit" name="resolution" value="cured" variant="secondary">Mark corrected</Button>
              <Button type="submit" name="resolution" value="closed" variant="ghost">Close</Button>
            </form>

            {hearingOpen && (
              <form action={recordViolationHearing} className="space-y-2 rounded-xl border border-gray-200/70 p-3">
                <input type="hidden" name="id" value={v.id} />
                <div className="text-sm font-medium text-gray-900">
                  Record hearing decision{v.hearing_requested_at ? ` — owner requested ${date(v.hearing_requested_at)}` : ''}
                </div>
                {v.hearing_request_note && <p className="text-[13px] text-gray-500">“{v.hearing_request_note}”</p>}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Held on"><Input name="hearing_at" type="date" /></Field>
                  <Field label="Decision">
                    <Select name="decision" defaultValue="upheld">
                      <option value="upheld">Violation upheld</option>
                      <option value="dismissed">Dismissed</option>
                    </Select>
                  </Field>
                </div>
                <Input name="notes" maxLength={500} placeholder="Board vote / notes" aria-label="Hearing notes" />
                <Button type="submit" variant="secondary">Save decision</Button>
              </form>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { rateWorkOrder } from '@/lib/rpcs/work-order-ratings';

export type RatingRow = {
  score: number; quality?: number | null; timeliness?: number | null; communication?: number | null;
  would_hire_again?: boolean | null; comment?: string | null; rater_role?: string | null; created_at?: string | null;
};

export const RATABLE_STATUSES = new Set(['done', 'completed', 'billed', 'closed']);

export function Stars({ value, size = 'sm' }: { value: number | null | undefined; size?: 'sm' | 'md' }) {
  const v = Math.round((value ?? 0) * 2) / 2;
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value.toFixed(1)} out of 5 stars` : 'No rating'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={`${cls} ${i <= v ? 'fill-amber-400 text-amber-400' : i - 0.5 === v ? 'fill-amber-200 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
}

export function summarize(rows: RatingRow[]) {
  const n = rows.length;
  if (!n) return { count: 0, average: null as number | null, hireAgainPct: null as number | null };
  const avg = rows.reduce((s, r) => s + Number(r.score), 0) / n;
  const answered = rows.filter((r) => r.would_hire_again !== null && r.would_hire_again !== undefined);
  return {
    count: n,
    average: Math.round(avg * 10) / 10,
    hireAgainPct: answered.length ? Math.round((answered.filter((r) => r.would_hire_again).length / answered.length) * 100) : null,
  };
}

function StarPicker({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: number | null }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-medium text-gray-700">{label}{!required && <span className="font-normal text-gray-400"> (optional)</span>}</legend>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="cursor-pointer">
            <input type="radio" name={name} value={i} required={required} defaultChecked={defaultValue === i} className="peer sr-only" />
            <span className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 text-sm text-gray-600 peer-checked:border-amber-400 peer-checked:bg-amber-50 peer-checked:text-amber-800 peer-focus-visible:ring-2 peer-focus-visible:ring-gray-400">
              {i}<Star aria-hidden className="h-3.5 w-3.5" />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Rating form for a completed work order. `mine` pre-fills a previous rating. */
export function RateWorkOrderForm({
  workOrderId, back, vendorName, mine, error, saved,
}: {
  workOrderId: string; back: string; vendorName?: string | null; mine?: RatingRow | null; error?: string; saved?: string;
}) {
  return (
    <div id="rating" className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}
      <form action={rateWorkOrder} className="space-y-4">
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <input type="hidden" name="back" value={back} />
        <StarPicker name="score" label={`Overall${vendorName ? ` — ${vendorName}` : ''}`} required defaultValue={mine?.score} />
        <div className="grid gap-4 lg:grid-cols-3">
          <StarPicker name="quality" label="Quality of work" defaultValue={mine?.quality} />
          <StarPicker name="timeliness" label="On time" defaultValue={mine?.timeliness} />
          <StarPicker name="communication" label="Communication" defaultValue={mine?.communication} />
        </div>
        <Field label="Would you use this vendor again?" htmlFor={`hire-${workOrderId}`}>
          <Select id={`hire-${workOrderId}`} name="would_hire_again" defaultValue={mine?.would_hire_again === true ? 'yes' : mine?.would_hire_again === false ? 'no' : ''} className="max-w-48">
            <option value="">No answer</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </Field>
        <Field label="Comment (optional)" htmlFor={`comment-${workOrderId}`}>
          <Textarea id={`comment-${workOrderId}`} name="comment" rows={3} maxLength={2000} defaultValue={mine?.comment ?? ''} placeholder="What went well, what could be better?" />
        </Field>
        <Button type="submit">{mine ? 'Update rating' : 'Submit rating'}</Button>
      </form>
    </div>
  );
}

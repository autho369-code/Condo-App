import { Field, Input, Select } from '@/components/ui/input';
import { SUPPORTED_REPORT_OUTPUT_FORMATS, reportFormatLabel } from '@/lib/reports/formats';
import { SCHEDULE_FREQUENCIES, WEEKDAYS, frequencyLabel, hourLabel } from '@/lib/reports/schedule';

type Option = { id: string; name: string };

/** Fields shared by New scheduled report and the schedule's edit page. */
export function ScheduleFields({
  definitions,
  customReports,
  hours,
  zoneLabel,
  schedule,
}: {
  definitions: Option[];
  customReports: Option[];
  hours: number[];
  zoneLabel: string;
  schedule?: {
    source: string;
    name: string;
    frequency: string;
    day_of_week: number | null;
    day_of_month: number | null;
    hour: number;
    output_format: string;
    delivery_channel: string;
    delivery_targets: string[];
  };
}) {
  const s = schedule;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Report" htmlFor="source" hint="A custom report runs with its saved association and period.">
          <Select id="source" name="source" required defaultValue={s?.source ?? ''}>
            <option value="">Select a report</option>
            {customReports.length > 0 && (
              <optgroup label="Custom reports">
                {customReports.map((r) => <option key={r.id} value={`saved:${r.id}`}>{r.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Reports">
              {definitions.map((d) => <option key={d.id} value={`def:${d.id}`}>{d.name}</option>)}
            </optgroup>
          </Select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Schedule name" htmlFor="name">
          <Input id="name" name="name" required maxLength={120} defaultValue={s?.name ?? ''} placeholder="e.g. Monthly board financials" />
        </Field>
      </div>
      <Field label="Frequency" htmlFor="frequency">
        <Select id="frequency" name="frequency" defaultValue={s?.frequency ?? 'monthly'}>
          {SCHEDULE_FREQUENCIES.map((f) => <option key={f} value={f}>{frequencyLabel(f)}</option>)}
        </Select>
      </Field>
      <Field label={`Time (${zoneLabel})`} htmlFor="hour">
        <Select id="hour" name="hour" defaultValue={String(s?.hour ?? 8)}>
          {hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </Select>
      </Field>
      <Field label="Day of the week" htmlFor="day_of_week" hint="For weekly and every-two-weeks schedules.">
        <Select id="day_of_week" name="day_of_week" defaultValue={String(s?.day_of_week ?? 1)}>
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </Select>
      </Field>
      <Field label="Day of the month" htmlFor="day_of_month" hint="For monthly, quarterly and yearly; past the month's end runs on its last day.">
        <Input id="day_of_month" name="day_of_month" type="number" min={1} max={31} step={1} defaultValue={s?.day_of_month ?? 1} />
      </Field>
      <Field label="Format" htmlFor="output_format">
        <Select id="output_format" name="output_format" defaultValue={s?.output_format ?? 'pdf'}>
          {SUPPORTED_REPORT_OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{reportFormatLabel(f)}</option>)}
        </Select>
      </Field>
      <Field label="Delivery" htmlFor="delivery_channel">
        <Select id="delivery_channel" name="delivery_channel" defaultValue={s?.delivery_channel ?? 'email'}>
          <option value="email">Email the file</option>
          <option value="download_only">Keep in Report history only</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Recipients" htmlFor="delivery_targets" hint="Email addresses separated by commas. Required for email delivery.">
          <Input id="delivery_targets" name="delivery_targets" defaultValue={(s?.delivery_targets ?? []).join(', ')} placeholder="board@example.com, treasurer@example.com" />
        </Field>
      </div>
    </div>
  );
}

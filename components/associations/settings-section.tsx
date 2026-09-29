import { Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { MONTH_OPTIONS, monthLabel, type SettingSection } from '@/lib/associations/settings-fields';
import { saveAssociationSection } from '@/lib/rpcs/association-record';
import { money } from '@/lib/utils';

type Gl = { id: string; number: number | null; name: string };

function display(field: SettingSection['fields'][number], value: any, gl: Gl[]) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">—</span>;
  switch (field.type) {
    case 'bool': return value ? 'Yes' : 'No';
    case 'money': return money(value);
    case 'percent': return `${Number(value)}%`;
    case 'month': return monthLabel(Number(value));
    case 'date': return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'select': return field.options?.find((o) => o.value === String(value))?.label ?? String(value);
    case 'gl': { const g = gl.find((x) => x.id === value); return g ? `${g.number ?? ''} ${g.name}`.trim() : '—'; }
    case 'textarea': return <span className="whitespace-pre-wrap">{String(value)}</span>;
    default: return String(value);
  }
}

function control(field: SettingSection['fields'][number], value: any, gl: Gl[]) {
  const v = value ?? '';
  switch (field.type) {
    case 'bool':
      return (
        <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name={field.key} defaultChecked={Boolean(value)} className="h-4 w-4 rounded border-gray-300" />
          {field.label}
        </label>
      );
    case 'textarea': return <Textarea id={field.key} name={field.key} rows={3} defaultValue={v} maxLength={5000} />;
    case 'select':
      return (
        <Select id={field.key} name={field.key} defaultValue={String(v)}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      );
    case 'month':
      return <Select id={field.key} name={field.key} defaultValue={String(v || 1)}>{MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    case 'gl':
      return (
        <Select id={field.key} name={field.key} defaultValue={String(v)}>
          <option value="">—</option>
          {gl.map((g) => <option key={g.id} value={g.id}>{`${g.number ?? ''} ${g.name}`.trim()}</option>)}
        </Select>
      );
    case 'date': return <Input id={field.key} name={field.key} type="date" defaultValue={v} />;
    case 'number': return <Input id={field.key} name={field.key} type="number" step="1" defaultValue={v} />;
    case 'money': return <Input id={field.key} name={field.key} type="number" step="0.01" min="0" defaultValue={v} />;
    case 'percent': return <Input id={field.key} name={field.key} type="number" step="0.001" min="0" max="100" defaultValue={v} />;
    default: return <Input id={field.key} name={field.key} defaultValue={v} maxLength={200} />;
  }
}

export function AssociationSettingsSection({
  section,
  association,
  associationRef,
  glAccounts = [],
}: {
  section: SettingSection;
  association: Record<string, any>;
  associationRef: string;
  glAccounts?: Gl[];
}) {
  const back = `/associations/${associationRef}/profile`;
  return (
    <Section title={section.title} subtitle={section.subtitle} padded>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
        {section.fields.map((f) => (
          <div key={f.key} className={`grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3 ${f.span === 2 ? 'sm:col-span-2' : ''}`}>
            <dt className="text-gray-500">{f.label}</dt>
            <dd className="text-gray-900">{display(f, association[f.key], glAccounts)}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-4 border-t border-gray-100 pt-3">
        <summary className="cursor-pointer text-[13px] font-medium text-gray-600 hover:text-gray-900">Edit {section.title.toLowerCase()}</summary>
        <form action={saveAssociationSection} className="mt-3 space-y-4">
          <input type="hidden" name="association_id" value={association.id} />
          <input type="hidden" name="section" value={section.key} />
          <input type="hidden" name="back" value={back} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((f) =>
              f.type === 'bool' ? (
                <div key={f.key} className="sm:col-span-2">{control(f, association[f.key], glAccounts)}</div>
              ) : (
                <Field key={f.key} label={f.label} htmlFor={f.key} hint={f.hint} className={f.span === 2 ? 'sm:col-span-2' : ''}>
                  {control(f, association[f.key], glAccounts)}
                </Field>
              ),
            )}
          </div>
          <Button type="submit">Save {section.title.toLowerCase()}</Button>
        </form>
      </details>
    </Section>
  );
}

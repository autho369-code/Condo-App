'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Label } from '@/components/ui/input';

// Mirror of the catalog shape (kept minimal to avoid importing server-only code).
type Col = { key: string; label: string };
type Source = {
  key: string;
  label: string;
  columns: Col[];
  filterableAssociation: boolean;
  dateColumn?: string;
  statusColumn?: string;
};
type Assoc = { id: string; name: string };

export function BuilderForm({
  sources,
  associations,
  initial,
}: {
  sources: Source[];
  associations: Assoc[];
  initial: {
    source: string;
    cols: string[];
    association: string;
    status: string;
    from: string;
    to: string;
  };
}) {
  const [sourceKey, setSourceKey] = React.useState(initial.source || sources[0]?.key || '');
  const source = sources.find((s) => s.key === sourceKey) ?? sources[0];

  // When the source matches the initial one, honor the saved column selection;
  // otherwise default to all columns of the (newly chosen) source.
  const defaultCols = React.useMemo(() => {
    if (sourceKey === initial.source && initial.cols.length > 0) return initial.cols;
    return source ? source.columns.map((c) => c.key) : [];
  }, [sourceKey, initial.source, initial.cols, source]);

  const [cols, setCols] = React.useState<string[]>(defaultCols);

  // Reset selected columns whenever the source changes.
  const prevSource = React.useRef(sourceKey);
  React.useEffect(() => {
    if (prevSource.current !== sourceKey) {
      prevSource.current = sourceKey;
      setCols(source ? source.columns.map((c) => c.key) : []);
    }
  }, [sourceKey, source]);

  function toggleCol(key: string, checked: boolean) {
    setCols((prev) => (checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));
  }

  if (!source) return null;

  return (
    <form action="/reports/builder" method="get" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Data source" htmlFor="source">
          <Select
            id="source"
            name="source"
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        {source.filterableAssociation && (
          <Field label="Association" htmlFor="association" hint="Optional — filter to one association">
            <Select id="association" name="association" defaultValue={initial.association}>
              <option value="">All associations</option>
              {associations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {source.statusColumn && (
          <Field
            label={`Filter by ${source.columns.find((c) => c.key === source.statusColumn)?.label ?? source.statusColumn}`}
            htmlFor="status"
            hint="Optional — exact match"
          >
            <Input id="status" name="status" defaultValue={initial.status} placeholder="e.g. open" />
          </Field>
        )}

        {source.dateColumn && (
          <>
            <Field label="From date" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={initial.from} />
            </Field>
            <Field label="To date" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={initial.to} />
            </Field>
          </>
        )}
      </div>

      <div>
        <Label>Columns</Label>
        <div className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {source.columns.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              <input
                type="checkbox"
                name="cols"
                value={c.key}
                checked={cols.includes(c.key)}
                onChange={(e) => toggleCol(c.key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[12px] text-gray-400">
          All columns selected by default. Unselected columns are excluded from the report.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Run report</Button>
        <Button
          type="reset"
          variant="secondary"
          onClick={() => {
            setSourceKey(sources[0]?.key ?? '');
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

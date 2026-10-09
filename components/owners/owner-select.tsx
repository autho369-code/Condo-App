'use client';

// Owner picker that follows the association field of the same form. One person
// has one owner record per association, so the same name can appear for two
// associations: once an association is chosen only its owners are offered;
// before that each option names its association. The server still checks
// (checkLinkedRecords refuses an owner of another association).
import * as React from 'react';
import { Select } from '@/components/ui/input';

export type OwnerOption = { id: string; full_name: string | null; association_id: string | null };

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange'> & {
  owners: OwnerOption[];
  /** Association names by id, for labels before an association is chosen. */
  associationNames?: Record<string, string>;
  /** Name of the association field in the same form. */
  associationField?: string;
  placeholder?: string;
};

export function OwnerSelect({
  owners,
  associationNames = {},
  associationField = 'association_id',
  placeholder = 'Select owner',
  defaultValue,
  ...rest
}: Props) {
  const ref = React.useRef<HTMLSelectElement>(null);
  const [association, setAssociation] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [value, setValue] = React.useState<string>(typeof defaultValue === 'string' ? defaultValue : '');

  React.useEffect(() => {
    const form = ref.current?.form;
    if (!form) { setReady(true); return; }
    const read = () => {
      const field = form.elements.namedItem(associationField);
      const v = field && 'value' in field ? String((field as unknown as HTMLInputElement).value ?? '') : '';
      setAssociation(v || null);
      setReady(true);
    };
    read();
    const onChange = (e: Event) => {
      if ((e.target as HTMLInputElement | null)?.name === associationField) read();
    };
    form.addEventListener('change', onChange);
    form.addEventListener('input', onChange);
    return () => {
      form.removeEventListener('change', onChange);
      form.removeEventListener('input', onChange);
    };
  }, [associationField]);

  const options = React.useMemo(
    () => (association ? owners.filter((o) => o.association_id === association) : owners),
    [owners, association],
  );

  // An owner of another association is never kept selected.
  React.useEffect(() => {
    if (ready && value && !options.some((o) => o.id === value)) setValue('');
  }, [options, value, ready]);

  const label = (o: OwnerOption) => {
    const name = o.full_name || 'Unnamed owner';
    const assoc = o.association_id ? associationNames[o.association_id] : null;
    return !association && assoc ? `${name} (${assoc})` : name;
  };

  return (
    <Select ref={ref} value={value} onChange={(e) => setValue(e.target.value)} {...rest}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
    </Select>
  );
}

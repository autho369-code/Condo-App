'use client';

// Unit picker that only offers the units of the association chosen in the
// same form (every unit while none is chosen), so a company with thousands of
// units does not get one dropdown of thousands. Follows the association field
// as it changes, like VendorSelect. The server action still checks that the
// unit belongs to the association.
import * as React from 'react';
import { Select } from '@/components/ui/input';

export type UnitOption = { id: string; label: string; associationId: string | null };

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange'> & {
  units: UnitOption[];
  /** Name of the association field in the same form. */
  associationField?: string;
  /** First option's label, e.g. "Common area / no specific unit". */
  placeholder: string;
};

export function UnitSelect({ units, associationField = 'association_id', placeholder, defaultValue, ...rest }: Props) {
  const ref = React.useRef<HTMLSelectElement>(null);
  const [association, setAssociation] = React.useState<string | null>(null);
  // The form's association is only known after mount; don't drop a saved unit before then.
  const [ready, setReady] = React.useState(false);
  const [value, setValue] = React.useState<string>(typeof defaultValue === 'string' ? defaultValue : '');

  React.useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
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

  const shown = React.useMemo(
    () => (association ? units.filter((u) => u.associationId === association) : units),
    [units, association],
  );

  // A unit of another association is cleared when the association changes.
  React.useEffect(() => {
    if (ready && value && !shown.some((u) => u.id === value)) setValue('');
  }, [ready, shown, value]);

  return (
    <Select ref={ref} value={value} onChange={(e) => setValue(e.target.value)} {...rest}>
      <option value="">{placeholder}</option>
      {shown.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
    </Select>
  );
}

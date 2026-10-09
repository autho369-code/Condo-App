'use client';

// Vendor picker that only offers the vendors of one association (each
// association has its own vendors) plus the management company, which serves
// every association. The association is either fixed (`associationId`) or
// read from the association field of the same form (`associationField`,
// default "association_id"), and the list follows it as it changes.
// The server still checks: trg_vendor_same_association refuses a vendor of
// another association.
import * as React from 'react';
import { Select } from '@/components/ui/input';

export type VendorOption = {
  id: string;
  name: string;
  association_id: string | null;
  is_management_company?: boolean | null;
};

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange'> & {
  vendors: VendorOption[];
  /** Fixed association (e.g. the work order's). */
  associationId?: string | null;
  /** Name of the association field in the same form, when not fixed. */
  associationField?: string;
  /** Offer the management company too (default true). */
  includeManagementCompany?: boolean;
  /** First option's label. */
  placeholder?: string;
};

export function VendorSelect({
  vendors,
  associationId,
  associationField = 'association_id',
  includeManagementCompany = true,
  placeholder = 'Select vendor',
  defaultValue,
  ...rest
}: Props) {
  const ref = React.useRef<HTMLSelectElement>(null);
  const fixed = associationId !== undefined;
  const [formAssociation, setFormAssociation] = React.useState<string | null>(null);
  // The form's association is only known after mount; don't drop a saved vendor before then.
  const [ready, setReady] = React.useState(fixed);
  const [value, setValue] = React.useState<string>(typeof defaultValue === 'string' ? defaultValue : '');

  React.useEffect(() => {
    if (fixed) return;
    const form = ref.current?.form;
    if (!form) return;
    const read = () => {
      const field = form.elements.namedItem(associationField);
      const v = field && 'value' in field ? String((field as HTMLInputElement).value ?? '') : '';
      setFormAssociation(v || null);
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
  }, [fixed, associationField]);

  const association = fixed ? associationId ?? null : formAssociation;
  const options = React.useMemo(() => {
    const own = association ? vendors.filter((v) => v.association_id === association) : [];
    const management = includeManagementCompany ? vendors.filter((v) => v.is_management_company) : [];
    return { own, management };
  }, [vendors, association, includeManagementCompany]);

  // A vendor of another association is never kept selected.
  React.useEffect(() => {
    if (!ready || !value) return;
    const ok = options.own.some((v) => v.id === value) || options.management.some((v) => v.id === value);
    if (!ok) setValue('');
  }, [options, value, ready]);

  return (
    <Select ref={ref} value={value} onChange={(e) => setValue(e.target.value)} {...rest}>
      <option value="">{association ? placeholder : 'Choose the association first'}</option>
      {options.own.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      {options.management.length > 0 && (
        <optgroup label="Management company">
          {options.management.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </optgroup>
      )}
    </Select>
  );
}

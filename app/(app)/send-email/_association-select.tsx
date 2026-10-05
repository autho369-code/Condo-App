'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/input';

/**
 * Association picker for the send-email form. Choosing an association
 * reloads the page with ?association= so the server can show how many
 * recipients each group resolves to (typed subject/message are kept: the
 * inputs are uncontrolled and stay mounted).
 */
export function AssociationSelect({ associations, defaultValue }: { associations: { id: string; name: string }[]; defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <Select
      id="association_id"
      name="association_id"
      required
      defaultValue={defaultValue}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        if (event.target.value) params.set('association', event.target.value);
        else params.delete('association');
        params.delete('error');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <option value="">Select an association…</option>
      {associations.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </Select>
  );
}

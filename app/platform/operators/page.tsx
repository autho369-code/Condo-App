import { createClient } from '@/lib/supabase/server';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OperatorsPage() {
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('platform_operators')
    .select('id, email, full_name, role, active, created_at')
    .order('created_at');

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-editorial text-ink-900">Platform operators</h1>
      <Table>
        <THead><TR><TH>Email</TH><TH>Name</TH><TH>Role</TH><TH>Active</TH><TH>Created</TH></TR></THead>
        <tbody>
          {(rows ?? []).map((o: any) => (
            <TR key={o.id}>
              <TD className="font-medium">{o.email}</TD>
              <TD>{o.full_name ?? '—'}</TD>
              <TD className="uppercase">{o.role}</TD>
              <TD>{o.active ? 'Yes' : 'No'}</TD>
              <TD>{date(o.created_at)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

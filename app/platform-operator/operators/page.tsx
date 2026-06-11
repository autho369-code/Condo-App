import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { PageHeader, Surface, Badge, EmptyState } from '@/components/ui/shell';
import { DataTable } from '@/components/ui/table';
import { ShieldCheck } from 'lucide-react';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PlatformOperatorsPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('platform_operators')
    .select('id, email, full_name, role, active, created_at')
    .order('created_at');

  return (
    <div>
      <PageHeader
        title="Platform operators"
        description="People with platform-level access to Portier369. Operators manage companies, billing, and subscriptions — they cannot modify association accounting or act as board members."
      />
      <DataTable
        rows={rows ?? []}
        rowKey={(o: any) => o.id}
        columns={[
          {
            key: 'email',
            header: 'Operator',
            render: (o: any) => (
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{o.full_name ?? o.email}</div>
                {o.full_name && <div className="truncate text-[12px] text-gray-500">{o.email}</div>}
              </div>
            ),
          },
          { key: 'role', header: 'Role', render: (o: any) => <span className="capitalize text-gray-700">{(o.role ?? '—').replace(/_/g, ' ')}</span> },
          { key: 'active', header: 'Status', render: (o: any) => <Badge tone={o.active ? 'complete' : 'inactive'}>{o.active ? 'Active' : 'Disabled'}</Badge> },
          { key: 'created_at', header: 'Added', className: 'text-gray-500', render: (o: any) => date(o.created_at) },
        ]}
        empty={<EmptyState icon={ShieldCheck} title="No platform operators" description="Operators are managed directly in the platform_operators table." />}
      />
    </div>
  );
}

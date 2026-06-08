import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { BulkReportsForm } from './_bulk-reports-form';

export const dynamic = 'force-dynamic';

export default async function BulkAssociationReportsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [associationsRes, reportsRes] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('report_definitions').select('slug, name, description, category').eq('active', true).order('name'),
  ]);

  return (
    <DataWorkspace
      title="Bulk Association Reports"
      description="Generate the same report(s) across multiple associations at once. Select reports, pick associations, and queue them all."
    >
      <BulkReportsForm
        associations={associationsRes.data ?? []}
        reports={reportsRes.data ?? []}
      />
    </DataWorkspace>
  );
}

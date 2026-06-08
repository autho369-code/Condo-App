import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { BulkChargesForm } from './_bulk-charges-form';

export const dynamic = 'force-dynamic';

export default async function BulkChargesPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [associationsRes, categoriesRes] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('charge_categories').select('id, name, code, charge_type, is_assessment, default_amount').eq('active', true).order('sort_order'),
  ]);

  return (
    <DataWorkspace
      title="Bulk Charges and Credits"
      description="Apply charges to multiple units at once for assessment increases, special assessments, or one-time fees."
    >
      <BulkChargesForm
        associations={associationsRes.data ?? []}
        categories={categoriesRes.data ?? []}
        portfolioId={me.portfolio?.id}
      />
    </DataWorkspace>
  );
}

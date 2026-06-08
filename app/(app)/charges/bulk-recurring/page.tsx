import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { BulkRecurringForm } from './_bulk-recurring-form';

export const dynamic = 'force-dynamic';

export default async function BulkRecurringChargesPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [associationsRes, categoriesRes] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('charge_categories').select('id, name, code, charge_type, is_assessment, default_amount, default_frequency').eq('active', true).order('sort_order'),
  ]);

  return (
    <DataWorkspace
      title="Bulk Recurring Charges"
      description="Set up recurring assessment charges for multiple units at once. Great for annual assessment increases across an entire association."
    >
      <BulkRecurringForm
        associations={associationsRes.data ?? []}
        categories={categoriesRes.data ?? []}
      />
    </DataWorkspace>
  );
}

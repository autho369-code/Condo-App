import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { BulkStatementSettingsForm } from './_bulk-settings-form';

export const dynamic = 'force-dynamic';

export default async function BulkStatementSettingsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: associations } = await db.from('associations').select('id, name, use_enhanced_statement, include_current_and_upcoming_charges, include_upcoming_in_amount_due, upcoming_charges_timeframe, include_current_message_on_statement, include_logo_on_statement, charge_history_includes, include_payments_due_date, include_payments_history_and_balance_forward, show_remaining_amount_for_past_due_charges, include_payment_coupon_on_statement').is('archived_at', null).order('name');

  return (
    <DataWorkspace
      title="Bulk Update Statement Settings"
      description="Update owner statement configuration across multiple associations at once. Changes apply to all future statements."
    >
      <BulkStatementSettingsForm associations={associations ?? []} />
    </DataWorkspace>
  );
}

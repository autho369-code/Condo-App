import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { SendStatementsForm } from './_send-statements-form';

export const dynamic = 'force-dynamic';

export default async function SendStatementsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: associations } = await db.from('associations').select('id, name').is('archived_at', null).order('name');

  return (
    <DataWorkspace
      title="Send Statements"
      description="Generate and send owner statements for all owners in an association. Statements show current charges, past-due balances, and payment history."
    >
      <SendStatementsForm associations={associations ?? []} />
    </DataWorkspace>
  );
}

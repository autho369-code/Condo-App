import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ReceivablesClient } from './receivables-client';

export const dynamic = 'force-dynamic';

export default async function ReceivablePaymentsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch initial data server-side
  const [{ data: payments }, { data: charges }, { data: associations }] = await Promise.all([
    db.from('payments')
      .select('*, units(unit_number, building_id, buildings(association_id, associations(name)))')
      .order('payment_date', { ascending: false })
      .limit(200),
    db.from('charges')
      .select('*, units(unit_number, building_id, buildings(association_id, associations(name))), gl_accounts(name, number)')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
  ]);

  const mappedReceipts = (payments ?? []).map((p: any) => ({
    id: p.id,
    receiptNumber: p.reference || '',
    amount: p.amount || 0,
    paymentMethod: p.method || '',
    memo: p.notes || '',
    receivedDate: p.payment_date || p.created_at,
    unit: p.units ? { unitNumber: p.units.unit_number } : null,
    association: p.units?.buildings?.associations ? { name: p.units.buildings.associations.name } : null,
  }));

  const mappedCharges = (charges ?? []).map((c: any) => ({
    id: c.id,
    type: c.charge_type || 'assessment',
    description: c.description || '',
    amount: c.amount || 0,
    dueDate: c.due_date || null,
    status: 'unpaid',
    paidAmount: 0,
    createdAt: c.created_at,
    unit: c.units ? { unitNumber: c.units.unit_number } : null,
    association: c.units?.buildings?.associations ? { name: c.units.buildings.associations.name } : null,
    glAccount: c.gl_accounts ? { name: c.gl_accounts.name, number: c.gl_accounts.number } : null,
  }));

  return (
    <ReceivablesClient
      initialReceipts={mappedReceipts}
      initialCharges={mappedCharges}
      associations={associations ?? []}
    />
  );
}

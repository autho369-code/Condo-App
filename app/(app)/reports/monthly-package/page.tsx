import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

function lastMonth() {
  const now = new Date();
  const firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastPrevious = new Date(firstThisMonth.getTime() - 86400000);
  const firstPrevious = new Date(Date.UTC(lastPrevious.getUTCFullYear(), lastPrevious.getUTCMonth(), 1));
  return {
    from: firstPrevious.toISOString().slice(0, 10),
    to: lastPrevious.toISOString().slice(0, 10),
  };
}

export default async function MonthlyPackagePage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');
  const period = lastMonth();

  return (
    <DataWorkspace
      title="Monthly financial package"
      description="Generate one board-ready PDF containing the association's core monthly statements and reconciliations."
      actions={<Link href="/reports"><Button variant="secondary">Back to reports</Button></Link>}
    >
      <form action="/reports/monthly-package/pdf" method="get" className="max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Association
          <Select name="association_id" required className="mt-1">
            <option value="">Select an association</option>
            {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
          </Select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">Period from
            <Input type="date" name="date_from" required defaultValue={period.from} className="mt-1" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Period to
            <Input type="date" name="date_to" required defaultValue={period.to} className="mt-1" />
          </label>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          Includes trial balance, balance sheet, income statement, budget vs actual, A/R aging, delinquency summary, A/P aging, and bank reconciliation.
        </div>
        <Button type="submit">Download monthly PDF</Button>
      </form>
    </DataWorkspace>
  );
}

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: accounts }, { data: associations }] = await Promise.all([
    (supabase as any).from('bank_accounts').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  return (
    <DataWorkspace
      title="New bank deposit"
      description="Pick the account and scope before building a deposit worksheet. No funds are transmitted from this draft screen."
      rail={<p className="text-sm leading-6 text-ink-600">Use this to stage deposits and confirm the association or unit scope before posting.</p>}
    >
      <form className="rounded border border-ink-100 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-ink-700">Bank account<select className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm"><option>Select account</option>{(accounts ?? []).map((row: any) => <option key={row.id}>{row.name}</option>)}</select></label>
          <label className="text-sm font-medium text-ink-700">Association<select className="mt-1 h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm"><option>All associations</option>{(associations ?? []).map((row: any) => <option key={row.id}>{row.name}</option>)}</select></label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input className="h-10 rounded border border-ink-200 px-3 text-sm" placeholder="Unit or owner" />
          <input className="h-10 rounded border border-ink-200 px-3 text-sm" placeholder="Reference" />
          <Button type="button">Search open items</Button>
        </div>
        <div className="mt-6 rounded border border-dashed border-ink-200 bg-cream-50 px-6 py-12 text-center text-sm text-ink-500">Select a scope to build the deposit worksheet.</div>
      </form>
    </DataWorkspace>
  );
}

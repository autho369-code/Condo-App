import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('vendors')
    .select('id, name, trade, payment_type, is_utility, is_auto_pay, portal_activated, archived_at')
    .is('archived_at', null)
    .order('name');

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <Link href="/vendors/new"><Button>+ New vendor</Button></Link>
      </div>
      <Table>
        <THead><TR><TH>Name</TH><TH>Trade</TH><TH>Pay by</TH><TH>Flags</TH></TR></THead>
        <tbody>
          {(rows ?? []).map((v: any) => (
            <TR key={v.id}>
              <TD className="font-medium">{v.name}</TD>
              <TD>{v.trade}</TD>
              <TD className="uppercase">{v.payment_type}</TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {v.is_utility && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Utility</span>}
                  {v.is_auto_pay && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Auto-pay</span>}
                  {v.portal_activated && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Portal</span>}
                </div>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
      </div>
    </div>
  );
}

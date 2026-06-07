import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PlatformPortfoliosPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (!me.is_platform_operator) {
    return <div className="p-8 text-gray-500">Access denied. Platform operators only.</div>;
  }

  const [{ data: portfolios }, { data: subscriptions }] = await Promise.all([
    db.from('portfolios').select('*, profiles:profiles(count)').is('archived_at', null).order('company_name'),
    db.from('subscriptions').select('*').is('canceled_at', null),
  ]);

  const getSub = (pid: string) => (subscriptions ?? []).find((s: any) => s.portfolio_id === pid);

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Platform — Management Companies</h1>
          <p className="text-sm text-gray-500 mt-1">Provision and manage property management companies on the platform.</p>
        </div>
        <Link href="/platform/portfolios/new"><Button>+ New company</Button></Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Company</TH>
              <TH>Tier</TH>
              <TH>Domain</TH>
              <TH>Staff</TH>
              <TH>Created</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <tbody>
            {(portfolios ?? []).map((p: any) => {
              const sub = getSub(p.id);
              return (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium text-gray-900">{p.company_name}</div>
                    <div className="text-xs text-gray-500">{p.support_email || 'No support email'}</div>
                  </TD>
                  <TD>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      p.tier === 'max' ? 'bg-purple-100 text-purple-700' :
                      p.tier === 'plus' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{p.tier || 'core'}</span>
                    {sub && <span className={`ml-1 rounded px-2 py-0.5 text-xs ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{sub.status}</span>}
                  </TD>
                  <TD className="text-sm text-gray-600">
                    {p.custom_domain ? (
                      <a href={`https://${p.custom_domain}`} className="text-blue-600 hover:underline" target="_blank">{p.custom_domain}</a>
                    ) : p.slug ? (
                      <a href={`https://${p.slug}.portier369.com`} className="text-blue-600 hover:underline" target="_blank">{p.slug}.portier369.com</a>
                    ) : <span className="text-gray-400">—</span>}
                  </TD>
                  <TD className="text-sm text-gray-600">{p.profiles?.count || 0} users</TD>
                  <TD className="text-sm text-gray-500">{date(p.created_at)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <Link href={`/platform/portfolios/${p.id}`} className="text-xs text-blue-600 hover:underline">Manage</Link>
                      <Link href={`https://${p.slug}.portier369.com`} className="text-xs text-gray-500 hover:underline" target="_blank">Visit</Link>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

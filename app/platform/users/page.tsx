import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PlatformUsersPage() {
  const supabase = await createClient();
  const [{ data: portfolios }, { data: users }] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name').is('archived_at', null),
    (supabase as any)
      .from('profiles')
      .select('id, portfolio_id, email, full_name, display_name, hoa_role, role, last_login_at, mfa_required, created_at')
      .order('email')
      .limit(300),
  ]);

  const portfolioById = new Map<string, string>((portfolios ?? []).map((portfolio: any) => [portfolio.id, portfolio.company_name]));
  const mfaRequired = (users ?? []).filter((user: any) => user.mfa_required).length;
  const neverLoggedIn = (users ?? []).filter((user: any) => !user.last_login_at).length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl tracking-editorial text-ink-900">Users</h1>
        <p className="mt-2 text-[15px] text-ink-500 leading-relaxed">Global staff and portal identity oversight by client.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Users" value={(users ?? []).length} sub="Visible profiles" />
        <Stat label="MFA required" value={mfaRequired} sub="Security posture" />
        <Stat label="Never logged in" value={neverLoggedIn} sub="Activation follow-up" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Client</TH>
                <TH>Role</TH>
                <TH>MFA</TH>
                <TH>Last login</TH>
              </TR>
            </THead>
            <tbody>
              {(users ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-10 text-center text-ink-500">No users are visible.</TD>
                </TR>
              ) : (
                (users ?? []).map((user: any) => (
                  <TR key={user.id} className="hover:bg-cream-50">
                    <TD>
                      <div className="font-medium text-ink-900">{user.full_name ?? user.display_name ?? user.email ?? 'Unnamed user'}</div>
                      <div className="mt-1 text-xs text-ink-500">{user.email ?? 'No email'}</div>
                    </TD>
                    <TD>
                      {user.portfolio_id ? (
                        <Link href={`/platform/portfolios/${user.portfolio_id}`} className="text-champagne-700 hover:underline">
                          {portfolioById.get(user.portfolio_id) ?? 'Unknown client'}
                        </Link>
                      ) : (
                        'Platform'
                      )}
                    </TD>
                    <TD>{user.hoa_role ?? user.role ?? '-'}</TD>
                    <TD>{user.mfa_required ? 'Required' : 'Optional'}</TD>
                    <TD>{date(user.last_login_at)}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

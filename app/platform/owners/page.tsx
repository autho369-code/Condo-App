import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PlatformOwnersPage() {
  const supabase = await createClient();
  const [{ data: portfolios }, { data: owners }, { data: occupancies }] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name').is('archived_at', null),
    (supabase as any)
      .from('owners')
      .select('id, portfolio_id, full_name, email, phone, portal_activated, portal_login_last_at, archived_at')
      .is('archived_at', null)
      .order('full_name')
      .limit(300),
    (supabase as any)
      .from('occupancies')
      .select('owner_id, occupancy_type, status, units(unit_number, buildings(associations(name, portfolio_id)))')
      .eq('status', 'current')
      .limit(600),
  ]);

  const portfolioById = new Map<string, string>((portfolios ?? []).map((portfolio: any) => [portfolio.id, portfolio.company_name]));
  const occupancyByOwner = new Map<string, any>();
  for (const occupancy of occupancies ?? []) {
    if (!occupancyByOwner.has((occupancy as any).owner_id)) occupancyByOwner.set((occupancy as any).owner_id, occupancy);
  }
  const portalActive = (owners ?? []).filter((owner: any) => owner.portal_activated).length;
  const missingEmail = (owners ?? []).filter((owner: any) => !owner.email).length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl tracking-editorial text-ink-900">Owners</h1>
        <p className="mt-2 text-[15px] text-ink-500 leading-relaxed">Owner directory by client and association. This is visibility, not daily owner operations.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Owners" value={(owners ?? []).length} sub="Visible owner records" />
        <Stat label="Portal active" value={portalActive} sub="Activated owner portals" />
        <Stat label="Missing email" value={missingEmail} sub="Needs data cleanup" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Owner</TH>
                <TH>Client</TH>
                <TH>Association / Unit</TH>
                <TH>Portal</TH>
                <TH>Last login</TH>
              </TR>
            </THead>
            <tbody>
              {(owners ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-10 text-center text-ink-500">No owners are visible.</TD>
                </TR>
              ) : (
                (owners ?? []).map((owner: any) => {
                  const occupancy = occupancyByOwner.get(owner.id);
                  const association = occupancy?.units?.buildings?.associations;
                  const portfolioId = owner.portfolio_id ?? association?.portfolio_id;
                  return (
                    <TR key={owner.id} className="hover:bg-cream-50">
                      <TD>
                        <div className="font-medium text-ink-900">{owner.full_name}</div>
                        <div className="mt-1 text-xs text-ink-500">{owner.email ?? owner.phone ?? 'No contact on file'}</div>
                      </TD>
                      <TD>
                        {portfolioId ? (
                          <Link href={`/platform/portfolios/${portfolioId}`} className="text-champagne-700 hover:underline">
                            {portfolioById.get(portfolioId) ?? 'Unknown client'}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TD>
                      <TD>
                        <div>{association?.name ?? '-'}</div>
                        <div className="mt-1 text-xs text-ink-500">{occupancy?.units?.unit_number ? `Unit ${occupancy.units.unit_number}` : 'No unit link'}</div>
                      </TD>
                      <TD>{owner.portal_activated ? 'Active' : 'Not active'}</TD>
                      <TD>{date(owner.portal_login_last_at)}</TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

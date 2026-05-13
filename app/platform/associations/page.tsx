import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PlatformAssociationsPage() {
  const supabase = await createClient();
  const [{ data: portfolios }, { data: associations }] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name, suspended_at').is('archived_at', null),
    (supabase as any)
      .from('associations')
      .select('id, portfolio_id, name, address, city, state, zip, unit_count, status, archived_at')
      .is('archived_at', null)
      .order('name')
      .limit(300),
  ]);

  const portfolioById = new Map((portfolios ?? []).map((portfolio: any) => [portfolio.id, portfolio]));
  const totalUnits = (associations ?? []).reduce((sum: number, association: any) => sum + (association.unit_count ?? 0), 0);
  const activeAssociations = (associations ?? []).filter((association: any) => (association.status ?? 'active') === 'active').length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl tracking-editorial text-ink-900">Associations</h1>
        <p className="mt-2 text-[15px] text-ink-500 leading-relaxed">
          Global association list across clients. Use client drilldown for owners, users, and billing context.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Associations" value={(associations ?? []).length} sub="Visible association records" />
        <Stat label="Units" value={totalUnits} sub="Total managed units" />
        <Stat label="Active" value={activeAssociations} sub="Operational associations" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Association</TH>
                <TH>Client</TH>
                <TH>Status</TH>
                <TH className="text-right">Units</TH>
              </TR>
            </THead>
            <tbody>
              {(associations ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center text-ink-500">No associations are visible.</TD>
                </TR>
              ) : (
                (associations ?? []).map((association: any) => {
                  const portfolio = portfolioById.get(association.portfolio_id) as any;
                  return (
                    <TR key={association.id} className="hover:bg-cream-50">
                      <TD>
                        <div className="font-medium text-ink-900">{association.name}</div>
                        <div className="mt-1 text-xs text-ink-500">
                          {[association.address, association.city, association.state, association.zip].filter(Boolean).join(', ')}
                        </div>
                      </TD>
                      <TD>
                        {portfolio ? (
                          <Link href={`/platform/portfolios/${association.portfolio_id}`} className="text-champagne-700 hover:underline">
                            {portfolio.company_name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TD>
                      <TD>{association.status ?? 'active'}</TD>
                      <TD className="text-right">{association.unit_count ?? 0}</TD>
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

import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PlatformPropertiesPage() {
  const supabase = await createClient();
  const [{ data: portfolios }, { data: properties }] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name, suspended_at').is('archived_at', null),
    (supabase as any)
      .from('associations')
      .select('id, portfolio_id, name, address, city, state, zip, unit_count, status, archived_at')
      .is('archived_at', null)
      .order('name')
      .limit(300),
  ]);

  const portfolioById = new Map((portfolios ?? []).map((portfolio: any) => [portfolio.id, portfolio]));
  const totalUnits = (properties ?? []).reduce((sum: number, property: any) => sum + (property.unit_count ?? 0), 0);
  const activeProperties = (properties ?? []).filter((property: any) => (property.status ?? 'active') === 'active').length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-gray-950">Properties</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global property list across clients. Use client drilldown for owners, users, and billing context.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Properties" value={(properties ?? []).length} sub="Visible association records" />
        <Stat label="Units" value={totalUnits} sub="Total managed units" />
        <Stat label="Active" value={activeProperties} sub="Operational properties" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Property</TH>
                <TH>Client</TH>
                <TH>Status</TH>
                <TH className="text-right">Units</TH>
              </TR>
            </THead>
            <tbody>
              {(properties ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center text-gray-500">No properties are visible.</TD>
                </TR>
              ) : (
                (properties ?? []).map((property: any) => {
                  const portfolio = portfolioById.get(property.portfolio_id) as any;
                  return (
                    <TR key={property.id} className="hover:bg-gray-50">
                      <TD>
                        <div className="font-medium text-gray-950">{property.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {[property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')}
                        </div>
                      </TD>
                      <TD>
                        {portfolio ? (
                          <Link href={`/platform/portfolios/${property.portfolio_id}`} className="text-blue-700 hover:underline">
                            {portfolio.company_name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TD>
                      <TD>{property.status ?? 'active'}</TD>
                      <TD className="text-right">{property.unit_count ?? 0}</TD>
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

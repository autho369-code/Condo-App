import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Building2, Users, DoorOpen, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SuperadminControlCenter() {
  const me = await requirePlatformOperator();
  const supabase = await createClient();

  // Get all portfolios with aggregate counts
  const { data: portfolios } = await (supabase as any)
    .from('portfolios')
    .select('id, company_name, address_city, address_state, tier, created_at')
    .is('archived_at', null)
    .order('company_name');

  // Get association counts per portfolio
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name, portfolio_id, city, state')
    .is('archived_at', null);

  // Get unit counts via buildings -> units
  const { data: buildings } = await (supabase as any)
    .from('buildings')
    .select('id, association_id');

  const { data: units } = await (supabase as any)
    .from('units')
    .select('id, building_id')
    .is('archived_at', null);

  // Get staff counts
  const { data: staff } = await (supabase as any)
    .from('profiles')
    .select('id, portfolio_id')
    .not('portfolio_id', 'is', null);

  // Aggregate counts
  const associationMap = new Map<string, number>();
  (associations ?? []).forEach((a: any) => {
    const count = associationMap.get(a.portfolio_id) ?? 0;
    associationMap.set(a.portfolio_id, count + 1);
  });

  const buildingByAssociation = new Map<string, string[]>();
  (buildings ?? []).forEach((b: any) => {
    const list = buildingByAssociation.get(b.association_id) ?? [];
    list.push(b.id);
    buildingByAssociation.set(b.association_id, list);
  });

  const unitMap = new Map<string, number>();
  (units ?? []).forEach((u: any) => {
    const count = unitMap.get(u.building_id) ?? 0;
    unitMap.set(u.building_id, count + 1);
  });

  // Per-portfolio unit count
  const portfolioUnitCount = new Map<string, number>();
  const portfolioAssocCount = new Map<string, number>();
  (associations ?? []).forEach((a: any) => {
    const pid = a.portfolio_id;
    portfolioAssocCount.set(pid, (portfolioAssocCount.get(pid) ?? 0) + 1);
    const bldgs = buildingByAssociation.get(a.id) ?? [];
    bldgs.forEach((bid) => {
      portfolioUnitCount.set(pid, (portfolioUnitCount.get(pid) ?? 0) + (unitMap.get(bid) ?? 0));
    });
  });

  const totalPortfolios = (portfolios ?? []).length;
  const totalAssociations = (associations ?? []).length;
  const totalUnits = Array.from(portfolioUnitCount.values()).reduce((a, b) => a + b, 0);
  const totalStaff = (staff ?? []).length;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow="Superadmin"
          title="Control Center"
          subtitle="Bird's-eye view across all management companies. Invite portfolio admins, monitor portfolio health."
          actions={
            <Link href="/platform/portfolios/new">
              <Button variant="primary">Add portfolio</Button>
            </Link>
          }
        />
      }
    >
      {/* KPI Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Portfolios" value={totalPortfolios} />
        <Stat label="Associations" value={totalAssociations} />
        <Stat label="Total Units" value={totalUnits} />
        <Stat label="Staff Members" value={totalStaff} />
      </div>

      {/* Portfolio List */}
      <Card>
        <CardHeader>
          <CardTitle>Management Companies</CardTitle>
        </CardHeader>
        <CardBody>
          {portfolios && portfolios.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Company</TH>
                  <TH>Location</TH>
                  <TH className="text-right">Associations</TH>
                  <TH className="text-right">Units</TH>
                  <TH>Tier</TH>
                  <TH>Joined</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {(portfolios ?? []).map((p: any) => {
                  const assocCount = portfolioAssocCount.get(p.id) ?? 0;
                  const unitCount = portfolioUnitCount.get(p.id) ?? 0;
                  return (
                    <TR key={p.id}>
                      <TD className="font-medium">{p.company_name}</TD>
                      <TD className="text-ink-500">{p.address_city}{p.address_state ? `, ${p.address_state}` : ''}</TD>
                      <TD className="text-right tabular-nums">{assocCount}</TD>
                      <TD className="text-right tabular-nums">{unitCount}</TD>
                      <TD>
                        <span className="rounded bg-cream-100 px-2 py-0.5 text-xs capitalize text-ink-600">
                          {p.tier ?? 'starter'}
                        </span>
                      </TD>
                      <TD className="text-xs text-ink-500">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Link href={`/platform/portfolios/${p.id}`}>
                            <Button size="sm" variant="secondary">View</Button>
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-ink-300" />
              <p className="mt-3 text-sm text-ink-500">No management companies yet.</p>
              <Link href="/platform/portfolios/new" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                Add your first portfolio →
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick Links */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/platform/portfolios" className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-soft">
            <Building2 className="h-5 w-5 text-champagne-600" />
            <div>
              <div className="text-sm font-medium text-ink-900">All Portfolios</div>
              <div className="text-xs text-ink-500">Manage companies and billing</div>
            </div>
          </Card>
        </Link>
        <Link href="/platform/operators" className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-soft">
            <Shield className="h-5 w-5 text-champagne-600" />
            <div>
              <div className="text-sm font-medium text-ink-900">Platform Operators</div>
              <div className="text-xs text-ink-500">Manage superadmin access</div>
            </div>
          </Card>
        </Link>
        <Link href="/platform/leads" className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-soft">
            <Users className="h-5 w-5 text-champagne-600" />
            <div>
              <div className="text-sm font-medium text-ink-900">Sales Leads</div>
              <div className="text-xs text-ink-500">Inbound access requests</div>
            </div>
          </Card>
        </Link>
      </div>
    </Workspace>
  );
}

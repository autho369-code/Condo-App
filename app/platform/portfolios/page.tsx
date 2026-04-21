import { createClient } from '@/lib/supabase/server';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { revalidatePath } from 'next/cache';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function provisionPortfolio(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.rpc('provision_portfolio', {
    p_company_name: formData.get('name') as string,
    p_first_admin_email: formData.get('email') as string,
    p_first_admin_name: (formData.get('admin_name') as string) || null,
    p_tier: (formData.get('tier') as any) || 'core',
    p_seats: parseInt(formData.get('seats') as string) || 5,
    p_trial_days: parseInt(formData.get('trial_days') as string) || 14,
  });
  if (error) return { error: error.message };
  revalidatePath('/platform/portfolios');
}

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from('v_portfolio_health').select('*').order('company_name');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">All portfolios</h1>
        <p className="text-sm text-gray-500">Platform-operator view across all management companies.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Provision new portfolio</CardTitle></CardHeader>
        <CardBody>
          <form action={provisionPortfolio} className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="col-span-2 md:col-span-1">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">First admin email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="admin_name">Admin name (optional)</Label>
              <Input id="admin_name" name="admin_name" />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <select id="tier" name="tier" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="core">Core</option><option value="plus">Plus</option><option value="max">Max</option>
              </select>
            </div>
            <div>
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" name="seats" type="number" defaultValue={5} min={1} />
            </div>
            <div>
              <Label htmlFor="trial_days">Trial days</Label>
              <Input id="trial_days" name="trial_days" type="number" defaultValue={14} min={0} />
            </div>
            <div className="col-span-full"><Button type="submit">Provision</Button></div>
          </form>
        </CardBody>
      </Card>

      <Table>
        <THead><TR>
          <TH>Portfolio</TH><TH>Tier</TH><TH>Status</TH>
          <TH className="text-right">Assocs</TH><TH className="text-right">Units</TH>
          <TH className="text-right">Seats</TH><TH className="text-right">Pending Inv</TH>
          <TH className="text-right">Failed logins (24h)</TH>
        </TR></THead>
        <tbody>
          {(rows ?? []).map((p: any) => (
            <TR key={p.portfolio_id}>
              <TD className="font-medium">{p.company_name}</TD>
              <TD className="uppercase">{p.tier}</TD>
              <TD>{p.suspended_at ? <span className="text-red-600">Suspended</span> : p.subscription_status ?? '—'}</TD>
              <TD className="text-right">{p.association_count}</TD>
              <TD className="text-right">{p.unit_count}</TD>
              <TD className="text-right">{p.seats_used} / {p.seats_included ?? '—'}</TD>
              <TD className="text-right">{p.pending_invitations}</TD>
              <TD className={`text-right ${p.failed_logins_24h > 0 ? 'text-red-600 font-medium' : ''}`}>{p.failed_logins_24h ?? 0}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

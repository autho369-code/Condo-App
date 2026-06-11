import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { PageHeader, PageShell, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { createChargeCategory } from '@/lib/rpcs/charges';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewChargeCategory() {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: gls } = await (supabase as any).from('gl_accounts')
    .select('id, number, name, account_type').eq('active', true).order('number');

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="New charge category"
        actions={<Link href="/charge-categories"><Button variant="secondary">Cancel</Button></Link>}
      />

      <Surface>
          <form action={createChargeCategory as any} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

            <div className="sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Boat Slip Rental" />
            </div>
            <div>
              <Label htmlFor="code">Short code</Label>
              <Input id="code" name="code" maxLength={20} placeholder="BOATSLIP" style={{ textTransform: 'uppercase' }} />
              <p className="mt-1 text-xs text-gray-500">Short identifier, uppercase, used in reports.</p>
            </div>
            <div>
              <Label htmlFor="default_amount">Default amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <Input id="default_amount" name="default_amount" type="number" step="0.01" min="0" defaultValue="0" className="pl-6" />
              </div>
            </div>
            <div>
              <Label htmlFor="default_frequency">Default frequency</Label>
              <Select id="default_frequency" name="default_frequency" defaultValue="monthly">
                <option>monthly</option><option>quarterly</option><option>annually</option>
                <option>weekly</option><option>daily</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="charge_type">Charge type (for legacy compatibility)</Label>
              <Select id="charge_type" name="charge_type" defaultValue="other">
                <option value="assessment">assessment</option>
                <option value="special_assessment">special_assessment</option>
                <option value="late_fee">late_fee</option>
                <option value="nsf_fee">nsf_fee</option>
                <option value="fine">fine</option>
                <option value="amenity_fee">amenity_fee</option>
                <option value="move_fee">move_fee</option>
                <option value="other">other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="gl_account_id">Income GL account</Label>
              <Select id="gl_account_id" name="gl_account_id">
                <option value="">—</option>
                {(gls ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.number} — {g.name} ({g.account_type})</option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>

            <div className="sm:col-span-2 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_assessment" /> Counts as an assessment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_fee" /> Is a fee (penalty)
              </label>
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Create category</Button>
              <Link href="/charge-categories"><Button variant="secondary" type="button">Cancel</Button></Link>
            </div>
          </form>
      </Surface>
    </PageShell>
  );
}

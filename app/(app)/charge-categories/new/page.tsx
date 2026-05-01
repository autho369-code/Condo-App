import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createChargeCategory } from '@/lib/rpcs/charges';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewChargeCategory() {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: gls } = await supabase.from('gl_accounts')
    .select('id, number, name, account_type').eq('active', true).order('number');

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New charge category</h1>
        <Link href="/charge-categories"><Button variant="secondary">Cancel</Button></Link>
      </div>

      <Card>
        <CardBody>
          <form action={createChargeCategory as any} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

            <div className="md:col-span-2">
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
              <select id="default_frequency" name="default_frequency" defaultValue="monthly"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option>monthly</option><option>quarterly</option><option>annually</option>
                <option>weekly</option><option>daily</option>
              </select>
            </div>
            <div>
              <Label htmlFor="charge_type">Charge type (for legacy compatibility)</Label>
              <select id="charge_type" name="charge_type" defaultValue="other"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="assessment">assessment</option>
                <option value="special_assessment">special_assessment</option>
                <option value="late_fee">late_fee</option>
                <option value="nsf_fee">nsf_fee</option>
                <option value="fine">fine</option>
                <option value="amenity_fee">amenity_fee</option>
                <option value="move_fee">move_fee</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="gl_account_id">Income GL account</Label>
              <select id="gl_account_id" name="gl_account_id"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">—</option>
                {(gls ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.number} — {g.name} ({g.account_type})</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
            </div>

            <div className="md:col-span-2 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_assessment" /> Counts as an assessment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_fee" /> Is a fee (penalty)
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Link href="/charge-categories"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Create category</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}

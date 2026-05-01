import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { submitServiceRequest } from '@/lib/rpcs/service-requests';

export const dynamic = 'force-dynamic';

const PRIORITY_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'low',       label: 'Low',       hint: 'Minor, can wait' },
  { value: 'normal',    label: 'Normal',    hint: 'Standard request' },
  { value: 'high',      label: 'High',      hint: 'Affects daily use' },
  { value: 'emergency', label: 'Emergency', hint: 'Active damage / safety' },
];

export default async function NewServiceRequest() {
  const me = await requireAuth();

  // Only owners (and board members, who are also owners) submit requests
  if (!me.is_resident && !me.is_board) {
    // Staff can create service requests on behalf of residents from the staff app,
    // but this route is for self-service only. Send staff home.
    redirect('/portal');
  }

  const supabase = await createClient();

  // Get the owner's units with association context.
  // RLS on v_unit_account_summary already filters to units the user belongs to.
  const { data: units } = await supabase
    .from('v_unit_account_summary')
    .select('unit_id, unit_number, association_name');

  const unitOptions = units ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/portal/service-requests" className="hover:text-brand-600 hover:underline">← Back to service requests</Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Submit a service request</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell us what&apos;s going on. Your property manager reviews requests during business hours and
          dispatches a vendor when needed. For an active emergency — burst pipe, no heat in winter, fire, gas leak —
          <strong className="text-gray-700"> please also call your emergency maintenance line.</strong>
        </p>
      </div>

      {unitOptions.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">
              You don&apos;t have a unit on file yet. Contact your property manager so they can link
              your account to your unit.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
          <CardBody>
            <form action={submitServiceRequest as any} className="space-y-6">
              {/* --- Unit picker --- */}
              <div>
                <Label htmlFor="unit_id">Unit</Label>
                {unitOptions.length === 1 ? (
                  <>
                    <input type="hidden" name="unit_id" value={unitOptions[0].unit_id} />
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      {unitOptions[0].association_name} · Unit {unitOptions[0].unit_number}
                    </div>
                  </>
                ) : (
                  <select id="unit_id" name="unit_id" required
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Choose a unit…</option>
                    {unitOptions.map((u: any) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.association_name} · Unit {u.unit_number}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* --- Description --- */}
              <div>
                <Label htmlFor="description">What&apos;s the issue?</Label>
                <textarea
                  id="description"
                  name="description"
                  required
                  minLength={10}
                  rows={5}
                  placeholder="Describe the problem — where in the unit, when it started, any sounds / leaks / smells, what you've already tried."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-gray-500">The more specific you are, the faster we can dispatch the right person.</p>
              </div>

              {/* --- Priority radio group --- */}
              <div>
                <Label>Priority</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRIORITY_OPTIONS.map((p) => (
                    <label key={p.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        defaultChecked={p.value === 'normal'}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium capitalize">{p.label}</div>
                        <div className="text-xs text-gray-500">{p.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* --- Entry permission --- */}
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="permission_to_enter" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Permission to enter my unit when I&apos;m not home</div>
                    <div className="text-xs text-gray-600">
                      If checked, the vendor can enter with the property manager&apos;s master key to
                      complete the work. Otherwise we&apos;ll coordinate a time with you.
                    </div>
                  </div>
                </label>

                <div className="mt-3">
                  <Label htmlFor="access_notes">Scheduling notes (optional)</Label>
                  <Input
                    id="access_notes"
                    name="access_notes"
                    placeholder="e.g. weekdays after 5pm, or leash the dog before entering"
                  />
                </div>
              </div>

              {/* --- Actions --- */}
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <Link href="/portal/service-requests" className="text-sm text-gray-600 hover:underline">Cancel</Link>
                <Button type="submit" size="lg">Submit request</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-gray-400">
        Common emergencies: no heat below 55°F, no hot water, active water leak, sewage backup,
        gas smell, electrical arcing, broken lock on an exterior door. In those cases, also call
        the number on your welcome packet.
      </p>
    </div>
  );
}

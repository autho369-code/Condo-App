import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function submitReport(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const report = {
    association_id: formData.get('association_id') as string,
    reporter_name: formData.get('reporter_name') as string,
    reporter_unit: formData.get('reporter_unit') as string || null,
    reporter_contact: formData.get('reporter_contact') as string,
    reporter_is_owner: formData.get('reporter_is_owner') === 'yes',
    violator_name: formData.get('violator_name') as string || null,
    violator_unit: formData.get('violator_unit') as string || null,
    house_rule_id: (formData.get('house_rule_id') as string) || null,
    violation_type: formData.get('violation_type') as string,
    violation_description: formData.get('violation_description') as string,
    dates_times: formData.get('dates_times') as string || null,
    witnesses: formData.get('witnesses') as string || null,
    previously_reported: formData.get('previously_reported') === 'yes',
    requested_action: formData.get('requested_action') as string || 'warning',
    reporter_signature: formData.get('reporter_signature') as string,
    ack_share_info: formData.get('ack_share_info') === 'on',
    ack_true_accurate: formData.get('ack_true_accurate') === 'on',
    ack_may_contact: formData.get('ack_may_contact') === 'on',
  };

  await (supabase as any).from('violation_cases').insert(report);
  redirect('/portal/violations/confirmation');
}

export default async function ReportViolationPage({ searchParams }: { searchParams: Promise<{ assoc?: string }> }) {
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id,name')
    .is('archived_at', null)
    .order('name');

  const assocId = sp.assoc;
  const { data: rules } = assocId ? await (supabase as any)
    .from('house_rules')
    .select('*')
    .eq('association_id', assocId)
    .eq('active', true)
    .order('sort_order') : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Violation Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Per the Illinois Condominium Property Act. For emergencies, call 911.
        </p>
      </header>

      <form action={submitReport} className="space-y-8">
        {/* Reporter */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Reporter Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reporter_name">Your Name *</Label>
              <Input id="reporter_name" name="reporter_name" required placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="reporter_unit">Unit Address *</Label>
              <Input id="reporter_unit" name="reporter_unit" required placeholder="Unit 301, 123 Main St" />
            </div>
            <div>
              <Label htmlFor="reporter_contact">Phone / Email *</Label>
              <Input id="reporter_contact" name="reporter_contact" required placeholder="Phone or email" />
            </div>
            <div>
              <Label htmlFor="association_id">Association *</Label>
              <select id="association_id" name="association_id" required defaultValue={assocId} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Are you an owner? *</Label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2"><input type="radio" name="reporter_is_owner" value="yes" defaultChecked /> Yes</label>
                <label className="flex items-center gap-2"><input type="radio" name="reporter_is_owner" value="no" /> No</label>
              </div>
            </div>
          </div>
        </section>

        {/* Violator */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Violator Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="violator_name">Name (if known)</Label>
              <Input id="violator_name" name="violator_name" placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="violator_unit">Unit Number</Label>
              <Input id="violator_unit" name="violator_unit" placeholder="Unit 205" />
            </div>
          </div>
        </section>

        {/* Violation Type & House Rules */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Nature of Violation</h2>

          <div className="mb-4">
            <Label htmlFor="violation_type">Type *</Label>
            <select id="violation_type" name="violation_type" required className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select type</option>
              <option value="noise">Noise / disturbance</option>
              <option value="construction">Unauthorized construction / alteration</option>
              <option value="pet">Pet violation</option>
              <option value="parking">Parking / vehicle issue</option>
              <option value="harassment">Harassment</option>
              <option value="smoking">Smoking in prohibited area</option>
              <option value="waste">Improper waste disposal</option>
              <option value="subletting">Unauthorized subletting / Airbnb</option>
              <option value="balcony">Balcony / patio violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {rules && rules.length > 0 && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
              <Label htmlFor="house_rule_id">Applicable House Rule (select exact rule)</Label>
              <select id="house_rule_id" name="house_rule_id" className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">-- Select the exact rule being violated --</option>
                {(rules as any[]).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    Rule {r.rule_number} — {r.title} ({r.penalty_type === 'fine' ? `Up to $${r.fine_amount}` : r.penalty_type})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-blue-700">You must reference the exact House Rule. View all rules at the bottom of this page.</p>
            </div>
          )}

          <div>
            <Label htmlFor="violation_description">Details (dates, times, witnesses) *</Label>
            <textarea id="violation_description" name="violation_description" required rows={5} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Please provide detailed information including specific dates, times, and any witnesses..." />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label htmlFor="dates_times">Specific Dates/Times</Label><Input id="dates_times" name="dates_times" placeholder="e.g. June 5, 2026 at 11:30 PM" /></div>
            <div><Label htmlFor="witnesses">Witnesses</Label><Input id="witnesses" name="witnesses" placeholder="Names of witnesses if any" /></div>
          </div>

          <div className="mt-4">
            <Label>Have you reported this before? *</Label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="previously_reported" value="yes" /> Yes</label>
              <label className="flex items-center gap-2"><input type="radio" name="previously_reported" value="no" defaultChecked /> No</label>
            </div>
          </div>
        </section>

        {/* Requested Action */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Requested Action</h2>
          <select name="requested_action" defaultValue="warning" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="warning">Warning</option>
            <option value="fine">Fine</option>
            <option value="hearing">Formal Hearing</option>
          </select>
        </section>

        {/* Signature */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Signature</h2>
          <div>
            <Label htmlFor="reporter_signature">Type your full name as signature *</Label>
            <Input id="reporter_signature" name="reporter_signature" required placeholder="Type your full name" />
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_share_info" required className="mt-1" />
              <span>I understand this report may be shared with the association board, management company, or other relevant parties. *</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_true_accurate" required className="mt-1" />
              <span>I certify the information provided is true and accurate to the best of my knowledge. *</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_may_contact" required className="mt-1" />
              <span>I understand I may be contacted for additional information. *</span>
            </label>
          </div>
        </section>

        <Button type="submit" size="lg" className="w-full">Submit Violation Report</Button>
        <p className="text-center text-xs text-gray-400">* Required fields. This report is delivered to management for review.</p>
      </form>

      {/* House Rules Reference */}
      {rules && rules.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">House Rules & Regulations</h2>
          <div className="space-y-4">
            {(rules as any[]).map((r: any) => (
              <div key={r.id} className="border-b border-gray-200 pb-3">
                <h3 className="font-medium text-gray-900">Rule {r.rule_number} — {r.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{r.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                  <span>Category: {r.category}</span>
                  <span>Penalty: {r.penalty_type === 'fine' ? `Up to $${r.fine_amount}` : r.penalty_type}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Violation Reporting & Resolution Process</h2>
        <p className="text-sm text-gray-600 mb-4">Maintaining community standards requires consistent, fair enforcement of association rules per the Illinois Condominium Property Act.</p>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">Common Violations</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
              <li>Noise disturbances and quiet hours violations</li>
              <li>Unauthorized modifications to common areas</li>
              <li>Parking and vehicle violations</li>
              <li>Pet policy violations</li>
              <li>Improper waste disposal</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Due Process</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
              <li>Written notice of alleged violation with specific rule reference</li>
              <li>10-day period to respond or request hearing</li>
              <li>Formal hearing before the Board if requested</li>
              <li>Board must respond to hearing request within 10 days</li>
              <li>No fine applied until final determination</li>
              <li>Appeal process available for disputed violations</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

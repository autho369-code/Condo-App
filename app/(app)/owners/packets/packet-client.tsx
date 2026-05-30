'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const STEP_LABELS = ['Owner Info', 'Unit Info', 'Emergency', 'Vehicles', 'Pets', 'Preferences', 'Sign Off'];

export default function OwnerPacketClient({ owners, packets }: { owners: any[]; packets: any[] }) {
  const sp = useSearchParams();
  const [step, setStep] = useState<Step>(0);
  const [ownerId, setOwnerId] = useState(sp.get('owner') || '');
  const [saving, setSaving] = useState(false);

  const ok = sp.get('ok');
  const error = sp.get('error');
  const existing = packets.find((p: any) => p.owner_id === ownerId);
  const oi = existing?.owner_info || {};
  const ui = existing?.unit_info || {};
  const ec = existing?.emergency_contact || {};
  const vi = existing?.vehicle_info || [];
  const pi = existing?.pet_info || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    fd.set('owner_id', ownerId);

    // Build JSON objects from prefixed fields
    const ownerInfo: any = {};
    const unitInfo: any = {};
    const emergency: any = {};
    const vehicles: any[] = [];
    const pets: any[] = [];

    for (const [k, v] of fd.entries()) {
      const val = String(v);
      if (k.startsWith('oi_')) ownerInfo[k.slice(3)] = val;
      else if (k.startsWith('ui_')) unitInfo[k.slice(3)] = val;
      else if (k.startsWith('em_')) emergency[k.slice(3)] = val;
      else if (k.startsWith('vh_')) {
        const [, idx, field] = k.split('_');
        if (!vehicles[+idx]) vehicles[+idx] = {};
        vehicles[+idx][field] = val;
      } else if (k.startsWith('pt_')) {
        const [, idx, field] = k.split('_');
        if (!pets[+idx]) pets[+idx] = {};
        pets[+idx][field] = val === 'true' ? true : val === 'false' ? false : val;
      }
    }

    fd.set('owner_info', JSON.stringify(ownerInfo));
    fd.set('unit_info', JSON.stringify(unitInfo));
    fd.set('emergency_contact', JSON.stringify(emergency));
    fd.set('vehicle_info', JSON.stringify(vehicles.filter(Boolean)));
    fd.set('pet_info', JSON.stringify(pets.filter(Boolean)));
    fd.set('communication_pref', String(fd.get('comm_pref') || 'email'));
    fd.set('acknowledgments', JSON.stringify({
      rules_regs: fd.get('ack_rules') === 'on',
      emergency_procedures: fd.get('ack_emergency') === 'on',
      move_in_policy: fd.get('ack_movein') === 'on',
      pet_policy: fd.get('ack_pets') === 'on',
      parking_policy: fd.get('ack_parking') === 'on',
      insurance: fd.get('ack_insurance') === 'on',
    }));
    fd.set('status', step === 6 ? 'completed' : 'draft');

    const res = await fetch('/api/owners/packets/submit', { method: 'POST', body: fd });
    const json = await res.json();
    setSaving(false);

    if (json.ok && step < 6) setStep((step + 1) as Step);
    if (step === 6) window.location.href = `/owners/packets?ok=completed&owner=${ownerId}`;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Owner Packet Builder</h1>
          <p className="mt-1 text-sm text-gray-500">Complete onboarding packet in-app. No PDFs unless exported later.</p>
        </div>
        <Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>
      </div>

      {ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div>
        <Label htmlFor="owner_select">Owner</Label>
        <select id="owner_select" value={ownerId} onChange={e => { setOwnerId(e.target.value); setStep(0); }}
          className="mt-1 h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm">
          <option value="">Select owner...</option>
          {owners.map((o: any) => <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>)}
        </select>
        {existing && <p className="mt-1 text-xs text-gray-500">Status: {existing.status} {existing.submitted_at ? `(${new Date(existing.submitted_at).toLocaleDateString()})` : ''}</p>}
      </div>

      {!ownerId && <p className="text-sm text-gray-400">Select an owner to build their packet.</p>}

      {ownerId && (
        <>
          <div className="flex gap-1 flex-wrap">
            {STEP_LABELS.map((label, i) => (
              <button key={i} type="button" onClick={() => setStep(i as Step)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="rounded border border-gray-200 bg-white p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Step {step + 1}: {STEP_LABELS[step]}</h3>

            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Info label="Name" value={oi.first_name && oi.last_name ? `${oi.first_name} ${oi.last_name}` : 'From owner record'} />
                <Info label="Email" value={oi.email || 'From owner record'} />
                <Field label="First Name" name="oi_first_name" dv={oi.first_name || ''} />
                <Field label="Last Name" name="oi_last_name" dv={oi.last_name || ''} />
                <Field label="Phone" name="oi_phone" dv={oi.phone || ''} />
                <Field label="Mailing Address" name="oi_mailing_address" dv={oi.mailing_address || ''} />
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Unit Number" name="ui_unit_number" dv={ui.unit_number || ''} />
                <Field label="Building" name="ui_building" dv={ui.building || ''} />
                <Field label="Bedrooms" name="ui_bedrooms" dv={ui.bedrooms || ''} type="number" />
                <Field label="Bathrooms" name="ui_bathrooms" dv={ui.bathrooms || ''} type="number" />
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contact Name *" name="em_name" dv={ec.name || ''} required />
                <Field label="Relationship" name="em_relationship" dv={ec.relationship || ''} />
                <Field label="Phone *" name="em_phone" dv={ec.phone || ''} type="tel" required />
                <Field label="Alt Phone" name="em_alt_phone" dv={ec.alt_phone || ''} type="tel" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Vehicles registered to this unit.</p>
                {[0, 1, 2].map(i => (
                  <div key={i} className="grid gap-3 md:grid-cols-3 rounded border border-gray-100 bg-gray-50 p-3">
                    <Field label="Make" name={`vh_${i}_make`} dv={(vi[i] || {}).make || ''} />
                    <Field label="Model" name={`vh_${i}_model`} dv={(vi[i] || {}).model || ''} />
                    <Field label="Year" name={`vh_${i}_year`} dv={(vi[i] || {}).year || ''} />
                    <Field label="Plate" name={`vh_${i}_plate`} dv={(vi[i] || {}).plate || ''} />
                    <Field label="Color" name={`vh_${i}_color`} dv={(vi[i] || {}).color || ''} />
                    <Field label="Parking Spot" name={`vh_${i}_spot`} dv={(vi[i] || {}).spot || ''} />
                  </div>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                  Record pets, ESAs, and service animals. Service animals are not pets per ADA/FHA.
                </div>
                {[0, 1, 2].map(i => (
                  <div key={i} className="grid gap-3 md:grid-cols-3 rounded border border-gray-100 bg-gray-50 p-3">
                    <Field label="Name" name={`pt_${i}_name`} dv={(pi[i] || {}).name || ''} />
                    <Field label="Type" name={`pt_${i}_type`} dv={(pi[i] || {}).type || ''} />
                    <Field label="Breed" name={`pt_${i}_breed`} dv={(pi[i] || {}).breed || ''} />
                    <Field label="Weight (lbs)" name={`pt_${i}_weight`} dv={(pi[i] || {}).weight || ''} />
                    <div className="flex gap-4 items-center pt-4">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name={`pt_${i}_esa`} value="true" defaultChecked={(pi[i] || {}).esa || false} /> ESA
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name={`pt_${i}_service`} value="true" defaultChecked={(pi[i] || {}).service || false} /> Service
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comm_pref">Preferred Communication</Label>
                  <select id="comm_pref" name="comm_pref" defaultValue={existing?.communication_pref || 'email'}
                    className="mt-1 h-10 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 text-sm">
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="mail">Mail</option>
                    <option value="portal">Portal Only</option>
                  </select>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                  Required acknowledgments. Check all to complete the packet.
                </div>
                {[
                  ['ack_rules', 'Rules & Regulations received'],
                  ['ack_emergency', 'Emergency procedures acknowledged'],
                  ['ack_movein', 'Move-in/move-out policy acknowledged'],
                  ['ack_pets', 'Pet/animal policy acknowledged'],
                  ['ack_parking', 'Parking rules acknowledged'],
                  ['ack_insurance', 'Insurance requirements (HO-6) acknowledged'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name={key} defaultChecked={existing?.acknowledgments?.[key.replace('ack_', '')]} className="mt-0.5" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between border-t pt-4">
              {step > 0 && <Button type="button" variant="secondary" onClick={() => setStep((step - 1) as Step)}>← Back</Button>}
              <div className="flex-1" />
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? 'Saving...' : step === 6 ? 'Complete Packet' : 'Save & Continue →'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Field({ label, name, dv, type = 'text', required = false }: { label: string; name: string; dv: string; type?: string; required?: boolean }) {
  return (
    <div>
      <Label htmlFor={name}>{label}{required && ' *'}</Label>
      <Input id={name} name={name} type={type} defaultValue={dv} required={required}
        className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

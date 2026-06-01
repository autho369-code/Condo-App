'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { FORM_TYPES, type FormTypeKey } from '@/lib/people/owner-form-actions';

const TABS = [
  { key: 'fill', label: 'Fill Form' },
  { key: 'history', label: 'Submission History' },
] as const;

export default function OwnerFormsClient({ owners, submissions }: { owners: any[]; submissions: any[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<string>(sp.get('tab') || 'fill');
  const [selectedOwner, setSelectedOwner] = useState<string>(sp.get('owner') || '');
  const [selectedForm, setSelectedForm] = useState<string>(sp.get('template') || '');

  const ok = sp.get('ok');
  const error = sp.get('error');
  const selectedOwnerData = owners.find((o: any) => o.id === selectedOwner);
  const ownerSubmissions = submissions.filter((s: any) => s.owner_id === selectedOwner);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Owner Forms</h1>
          <p className="mt-1 text-sm text-gray-500">Fillable in-app forms saved to owner profile. No PDFs, no fake text.</p>
        </div>
        <Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>
      </div>

      {/* Messages */}
      {ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">Saved: {ok.replace(/_/g, ' ')}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Owner Selector */}
      <div>
        <Label htmlFor="owner_select">Select Owner</Label>
        <select
          id="owner_select"
          value={selectedOwner}
          onChange={e => { setSelectedOwner(e.target.value); setSelectedForm(''); }}
          className="mt-1 h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Choose an owner...</option>
          {owners.map((o: any) => (
            <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>
          ))}
        </select>
      </div>

      {!selectedOwner && (
        <p className="text-sm text-gray-400">Select an owner above to fill or view forms.</p>
      )}

      {/* Fill Form Tab */}
      {selectedOwner && tab === 'fill' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="form_type">Form Type</Label>
            <select
              id="form_type"
              value={selectedForm}
              onChange={e => setSelectedForm(e.target.value)}
              className="mt-1 h-10 w-full max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select a form...</option>
              {FORM_TYPES.map(ft => (
                <option key={ft.key} value={ft.key}>{ft.label}</option>
              ))}
            </select>
          </div>

          {selectedForm && (
            <FormRenderer
              ownerId={selectedOwner}
              formType={selectedForm as FormTypeKey}
              existingData={ownerSubmissions.find((s: any) => s.form_type === selectedForm)?.form_data}
              onSaved={() => { setSelectedForm(''); router.refresh(); }}
            />
          )}
        </div>
      )}

      {/* Submission History Tab */}
      {selectedOwner && tab === 'history' && (
        <div className="space-y-2">
          {FORM_TYPES.map(ft => {
            const sub = ownerSubmissions.find((s: any) => s.form_type === ft.key);
            return (
              <div key={ft.key} className="flex items-center justify-between rounded border border-gray-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{ft.label}</p>
                  <p className="text-xs text-gray-500">
                    {sub ? `Submitted ${new Date(sub.submitted_at).toLocaleDateString()}` : 'Not submitted'}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  sub ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'
                }`}>
                  {sub ? 'Submitted' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Form Renderer ──────────────────────────────────────────

function FormRenderer({ ownerId, formType, existingData, onSaved }: {
  ownerId: string;
  formType: FormTypeKey;
  existingData?: Record<string, any>;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <form
      action="/api/owners/forms/submit"
      method="POST"
      onSubmit={() => setSaving(true)}
      className="rounded border border-gray-200 bg-white p-5 space-y-5"
    >
      <input type="hidden" name="owner_id" value={ownerId} />
      <input type="hidden" name="form_type" value={formType} />

      <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
        {FORM_TYPES.find(ft => ft.key === formType)?.label}
      </h3>

      {formType === 'owner_contact' && <OwnerContactForm existing={existingData} />}
      {formType === 'emergency_contact' && <EmergencyContactForm existing={existingData} />}
      {formType === 'tenant_info' && <TenantInfoForm existing={existingData} />}
      {formType === 'vehicle_parking' && <VehicleParkingForm existing={existingData} />}
      {formType === 'pet_esa' && <PetEsaForm existing={existingData} />}
      {formType === 'ach_setup' && <AchSetupForm existing={existingData} />}
      {formType === 'management_agreement_intake' && <ManagementIntakeForm existing={existingData} />}

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {saving ? 'Saving...' : existingData ? 'Update' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ─── Individual Form Components ─────────────────────────────

const field = (label: string, name: string, defaultValue: string = '', type: string = 'text', required: boolean = false) => (
  <div key={name}>
    <Label htmlFor={name}>{label}{required && ' *'}</Label>
    <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required}
      className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
  </div>
);

function OwnerContactForm({ existing }: { existing?: Record<string, any> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {field('First Name', 'first_name', existing?.first_name || '')}
      {field('Last Name', 'last_name', existing?.last_name || '')}
      {field('Email', 'email', existing?.email || '', 'email')}
      {field('Phone', 'phone', existing?.phone || '', 'tel')}
      {field('Street Address', 'street', existing?.street || '')}
      {field('City', 'city', existing?.city || '')}
      {field('State', 'state', existing?.state || '')}
      {field('ZIP', 'zip', existing?.zip || '')}
      <div className="md:col-span-2">
        <Label htmlFor="mailing_address">Mailing Address (if different)</Label>
        <textarea id="mailing_address" name="mailing_address" rows={2} defaultValue={existing?.mailing_address || ''}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
    </div>
  );
}

function EmergencyContactForm({ existing }: { existing?: Record<string, any> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {field('Contact Name', 'name', existing?.name || '', 'text', true)}
      {field('Relationship', 'relationship', existing?.relationship || '')}
      {field('Phone', 'phone', existing?.phone || '', 'tel', true)}
      {field('Alt Phone', 'alt_phone', existing?.alt_phone || '', 'tel')}
      {field('Email', 'email', existing?.email || '', 'email')}
    </div>
  );
}

function TenantInfoForm({ existing }: { existing?: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        Record current tenant and lease information. This data is visible only to authorized staff.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field('Tenant Name', 'tenant_name', existing?.tenant_name || '')}
        {field('Tenant Email', 'tenant_email', existing?.tenant_email || '', 'email')}
        {field('Tenant Phone', 'tenant_phone', existing?.tenant_phone || '', 'tel')}
        {field('Lease Start', 'lease_start', existing?.lease_start || '', 'date')}
        {field('Lease End', 'lease_end', existing?.lease_end || '', 'date')}
        {field('Monthly Rent', 'monthly_rent', existing?.monthly_rent || '')}
        {field('Security Deposit', 'security_deposit', existing?.security_deposit || '')}
      </div>
    </div>
  );
}

function VehicleParkingForm({ existing }: { existing?: Record<string, any> }) {
  const vehicles = existing?.vehicles || [{ make: '', model: '', year: '', plate: '', color: '', parking_spot: '' }];
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Add vehicles registered to this unit.</p>
      {vehicles.map((v: any, i: number) => (
        <div key={i} className="grid gap-3 md:grid-cols-3 rounded border border-gray-100 bg-gray-50 p-3">
          {field('Make', `vehicle_${i}_make`, v.make || '')}
          {field('Model', `vehicle_${i}_model`, v.model || '')}
          {field('Year', `vehicle_${i}_year`, v.year || '')}
          {field('License Plate', `vehicle_${i}_plate`, v.plate || '')}
          {field('Color', `vehicle_${i}_color`, v.color || '')}
          {field('Parking Spot #', `vehicle_${i}_spot`, v.parking_spot || '')}
        </div>
      ))}
      <input type="hidden" name="vehicle_count" value={vehicles.length} />
    </div>
  );
}

function PetEsaForm({ existing }: { existing?: Record<string, any> }) {
  const pets = existing?.pets || [{ name: '', type: '', breed: '', weight: '', esa: false, service: false }];
  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        Record pets, ESAs, and service animals. Service animals are not pets per ADA/FHA — note them separately.
      </div>
      {pets.map((p: any, i: number) => (
        <div key={i} className="grid gap-3 md:grid-cols-3 rounded border border-gray-100 bg-gray-50 p-3">
          {field('Name', `pet_${i}_name`, p.name || '')}
          {field('Type', `pet_${i}_type`, p.type || '')}
          {field('Breed', `pet_${i}_breed`, p.breed || '')}
          {field('Weight (lbs)', `pet_${i}_weight`, p.weight || '')}
          <div className="flex gap-4 items-center pt-5">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name={`pet_${i}_esa`} defaultChecked={p.esa} /> ESA
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name={`pet_${i}_service`} defaultChecked={p.service} /> Service
            </label>
          </div>
        </div>
      ))}
      <input type="hidden" name="pet_count" value={pets.length} />
    </div>
  );
}

function AchSetupForm({ existing }: { existing?: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Bank information is never collected directly. ACH setup happens through Stripe&apos;s secure payment flow. This form tracks setup status only.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field('Account Holder Name', 'account_holder', existing?.account_holder || '')}
        {field('Bank Name', 'bank_name', existing?.bank_name || '')}
        <div>
          <Label htmlFor="account_type">Account Type</Label>
          <select id="account_type" name="account_type" defaultValue={existing?.account_type || 'checking'}
            className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
        </div>
        <div>
          <Label htmlFor="setup_status">Setup Status</Label>
          <select id="setup_status" name="setup_status" defaultValue={existing?.setup_status || 'not_started'}
            className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="not_started">Not started</option>
            <option value="invite_sent">Invite sent</option>
            <option value="owner_completed">Owner completed</option>
          </select>
        </div>
        {field('Routing Number (last 4)', 'routing_last4', existing?.routing_last4 || '')}
        {field('Account Number (last 4)', 'account_last4', existing?.account_last4 || '')}
      </div>
    </div>
  );
}

function ManagementIntakeForm({ existing }: { existing?: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        Pre-agreement intake. A formal Management Agreement can be created from this data in the Agreements section.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field('Property Address', 'property_address', existing?.property_address || '')}
        <div>
          <Label htmlFor="property_type">Property Type</Label>
          <select id="property_type" name="property_type" defaultValue={existing?.property_type || 'condo'}
            className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="condo">Condominium</option>
            <option value="townhouse">Townhouse</option>
            <option value="single_family">Single Family</option>
            <option value="multi_unit">Multi-Unit</option>
          </select>
        </div>
        {field('Desired Management Start', 'desired_start', existing?.desired_start || '', 'date')}
        {field('Current Property Manager', 'current_manager', existing?.current_manager || '')}
        <div className="md:col-span-2">
          <Label htmlFor="special_instructions">Special Instructions</Label>
          <textarea id="special_instructions" name="special_instructions" rows={3} defaultValue={existing?.special_instructions || ''}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Any special requirements or notes for the management team..." />
        </div>
      </div>
    </div>
  );
}

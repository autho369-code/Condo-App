'use client';

import { useState } from 'react';
import { saveCompanySettings } from './actions';
import { Button } from '@/components/ui/button';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

interface SettingsFormProps {
  portfolio: any;
  settings: any;
}

export default function SettingsForm({ portfolio, settings }: SettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const s = settings ?? {};
  const p = portfolio ?? {};

  const notifDefaults = s.notification_defaults ?? {};
  const managerPerms = s.manager_permission_defaults ?? {};
  const ownerInvite = s.owner_invite_defaults ?? {};
  const vendorInvite = s.vendor_invite_defaults ?? {};
  const branding = s.branding ?? {};

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const formData = new FormData(e.currentTarget);

    try {
      await saveCompanySettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  }

  function ToggleField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer py-1.5">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
        />
        <span className="text-sm text-slate-300">{label}</span>
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section A: Company Profile */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Company Profile</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company_name" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Company Name
              </label>
              <input
                id="company_name"
                type="text"
                disabled
                defaultValue={p.company_name ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-600 mt-1">Set by Platform Operator</p>
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                defaultValue={s.phone ?? p.phone_number ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="office_address" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Office Address
              </label>
              <input
                id="office_address"
                name="office_address"
                type="text"
                defaultValue={s.office_address ?? p.address_street ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="123 Main Street"
              />
            </div>
            <div>
              <label htmlFor="billing_email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Billing Email
              </label>
              <input
                id="billing_email"
                name="billing_email"
                type="email"
                defaultValue={s.billing_email ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="billing@company.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="office_city" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                City
              </label>
              <input
                id="office_city"
                name="office_city"
                type="text"
                defaultValue={s.office_city ?? p.address_city ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="City"
              />
            </div>
            <div>
              <label htmlFor="office_state" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                State
              </label>
              <input
                id="office_state"
                name="office_state"
                type="text"
                defaultValue={s.office_state ?? p.address_state ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="State"
              />
            </div>
            <div>
              <label htmlFor="office_zip" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Zip
              </label>
              <input
                id="office_zip"
                name="office_zip"
                type="text"
                defaultValue={s.office_zip ?? p.address_zip ?? ''}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Zip"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section B: Notification Settings */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notification Settings</span>
        </div>
        <div className="p-5 space-y-1">
          <ToggleField name="email_notifications" label="Email Notifications" defaultChecked={notifDefaults.email ?? true} />
          <ToggleField name="sms_notifications" label="SMS Notifications" defaultChecked={notifDefaults.sms ?? false} />
          <ToggleField name="wo_notifications" label="Work Order Notifications" defaultChecked={notifDefaults.work_orders ?? true} />
          <ToggleField name="violation_notifications" label="Violation Notifications" defaultChecked={notifDefaults.violations ?? true} />
          <ToggleField name="payment_notifications" label="Payment Notifications" defaultChecked={notifDefaults.payments ?? true} />
          <ToggleField name="architectural_notifications" label="Architectural Review Notifications" defaultChecked={notifDefaults.architectural ?? false} />
        </div>
      </div>

      {/* Section C: Manager Permission Defaults */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Manager Permission Defaults</span>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500 mb-2">Set default permissions for newly invited managers.</p>
          <ToggleField name="can_manage_associations" label="Manage Associations" defaultChecked={managerPerms.can_manage_associations ?? true} />
          <ToggleField name="can_manage_owners" label="Manage Owners" defaultChecked={managerPerms.can_manage_owners ?? true} />
          <ToggleField name="can_manage_vendors" label="Manage Vendors" defaultChecked={managerPerms.can_manage_vendors ?? true} />
          <ToggleField name="can_manage_work_orders" label="Manage Work Orders" defaultChecked={managerPerms.can_manage_work_orders ?? true} />
          <ToggleField name="can_manage_violations" label="Manage Violations" defaultChecked={managerPerms.can_manage_violations ?? true} />
          <ToggleField name="can_manage_billing" label="Manage Billing" defaultChecked={managerPerms.can_manage_billing ?? false} />
        </div>
      </div>

      {/* Section D: Owner Invite Defaults */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Owner Invite Defaults</span>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500 mb-2">Configure default options when inviting new owners.</p>
          <ToggleField name="owner_portal_access" label="Grant Portal Access" defaultChecked={ownerInvite.portal_access ?? true} />
          <ToggleField name="owner_email_invite" label="Send Email Invite" defaultChecked={ownerInvite.email_invite ?? true} />
          <ToggleField name="owner_sms_invite" label="Send SMS Invite" defaultChecked={ownerInvite.sms_invite ?? false} />
        </div>
      </div>

      {/* Section E: Vendor Invite Defaults */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor Invite Defaults</span>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500 mb-2">Configure default options when inviting new vendors.</p>
          <ToggleField name="vendor_portal_access" label="Grant Portal Access" defaultChecked={vendorInvite.portal_access ?? true} />
          <ToggleField name="vendor_email_invite" label="Send Email Invite" defaultChecked={vendorInvite.email_invite ?? true} />
        </div>
      </div>

      {/* Section F: Branding */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Branding</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="logo_url" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Logo URL
            </label>
            <input
              id="logo_url"
              name="logo_url"
              type="text"
              defaultValue={branding.logo_url ?? ''}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              placeholder="https://example.com/logo.png"
            />
            {branding.logo_url && (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-slate-900/50 p-3 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logo_url}
                  alt="Company logo preview"
                  className="max-h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <span className="hidden text-xs text-slate-500">Unable to load logo preview</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Success message */}
      {saved && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-400">Settings saved successfully.</p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

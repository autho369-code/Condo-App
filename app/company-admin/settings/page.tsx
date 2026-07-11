import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Alert } from '@/components/ui/shell'
import { updateCompanySettings } from './actions'
import { Building2, Bell, UserCog, Palette, Save } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const inputCls = 'mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 placeholder:text-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const { error: errorMsg, saved } = await searchParams

  // Fetch portfolio data
  const { data: portfolio } = await db
    .from('portfolios')
    .select('*')
    .eq('id', portfolioId)
    .maybeSingle()

  // Fetch portfolio_settings
  let portfolioSettings: any = null
  try {
    const { data } = await db
      .from('portfolio_settings')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .maybeSingle()
    portfolioSettings = data
  } catch {
    portfolioSettings = null
  }

  const p = portfolio ?? {}
  const ps = portfolioSettings ?? {}
  const notifPrefs = ps.notification_prefs ?? {}
  const mgrDefaults = ps.manager_defaults ?? {}

  function Field({ label, name, defaultValue, type = 'text', placeholder = '' }: {
    label: string
    name: string
    defaultValue?: string
    type?: string
    placeholder?: string
  }) {
    return (
      <label className="block">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <input
          type={type}
          name={name}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          className={inputCls}
        />
      </label>
    )
  }

  function ToggleField({ label, name, defaultChecked = false }: {
    label: string
    name: string
    defaultChecked?: boolean
  }) {
    return (
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50/60">
        <span className="text-sm text-gray-700">{label}</span>
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="h-5 w-5 rounded border-gray-300 accent-blue-600"
        />
      </label>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Settings</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Manage company settings for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {errorMsg && <Alert title="Settings not saved">{errorMsg}</Alert>}
      {saved && <Alert tone="success" title="Settings saved" />}

      <form action={updateCompanySettings} className="space-y-6">
        {/* ── Company Profile ────────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">Company Profile</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company Name" name="company_name" defaultValue={p.company_name} />
              <Field label="Phone Number" name="phone_number" defaultValue={p.phone_number} placeholder="+1 (555) 000-0000" />
            </div>
            <Field label="Logo URL" name="logo_url" defaultValue={ps.logo_url} placeholder="https://..." />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Support Email" name="support_email" defaultValue={ps.support_email} placeholder="support@company.com" />
              <Field label="Billing Email" name="billing_email" defaultValue={ps.billing_email} placeholder="billing@company.com" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Street Address" name="address_street" defaultValue={p.address_street} />
              <Field label="City" name="address_city" defaultValue={p.address_city} />
              <Field label="State" name="address_state" defaultValue={p.address_state} />
              <Field label="ZIP Code" name="address_zip" defaultValue={p.address_zip} />
            </div>
          </div>
        </div>

        {/* ── Office Location ────────────────────────── */}
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Office Location</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Office Address" name="office_address" defaultValue={ps.office_address} placeholder="123 Main St, Suite 100" />
              <Field label="Office Phone" name="office_phone" defaultValue={ps.office_phone} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
        </div>

        {/* ── Notification Preferences ───────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Bell className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">Notification Preferences</h2>
          </div>
          <div className="space-y-2 p-5">
            <ToggleField
              label="New association added to portfolio"
              name="notify_new_association"
              defaultChecked={notifPrefs.new_association ?? true}
            />
            <ToggleField
              label="Delinquency alerts (high-risk associations)"
              name="notify_delinquency"
              defaultChecked={notifPrefs.delinquency_alert ?? true}
            />
            <ToggleField
              label="Work order status updates"
              name="notify_work_order"
              defaultChecked={notifPrefs.work_order_update ?? false}
            />
            <ToggleField
              label="New violation reports"
              name="notify_violation"
              defaultChecked={notifPrefs.violation_reported ?? false}
            />
            <ToggleField
              label="Billing and payment reminders"
              name="notify_billing"
              defaultChecked={notifPrefs.billing_reminder ?? true}
            />
          </div>
        </div>

        {/* ── Manager Defaults ───────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <UserCog className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">Manager Defaults</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Default Role</span>
                <select
                  name="default_role"
                  defaultValue={mgrDefaults.role ?? 'manager'}
                  className={inputCls}
                >
                  <option value="manager">Manager</option>
                  <option value="assistant_manager">Assistant Manager</option>
                  <option value="maintenance_supervisor">Maintenance Supervisor</option>
                  <option value="admin_assistant">Admin Assistant</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Default Permissions</span>
                <select
                  name="default_permissions"
                  defaultValue={mgrDefaults.permissions ?? 'standard'}
                  className={inputCls}
                >
                  <option value="standard">Standard</option>
                  <option value="elevated">Elevated</option>
                  <option value="full">Full Access</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* ── Branding ───────────────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Palette className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-950">Branding</h2>
          </div>
          <div className="space-y-4 p-5">
            <ToggleField
              label="Enable custom branding across the platform"
              name="branding_enabled"
              defaultChecked={ps.branding_enabled ?? false}
            />
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Brand Color</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  name="brand_color"
                  defaultValue={ps.branding_color ?? '#10B981'}
                  className="h-10 w-16 cursor-pointer rounded-xl border border-gray-200 bg-white"
                />
                <span className="text-sm text-gray-500">{ps.branding_color ?? '#10B981'}</span>
              </div>
            </label>
          </div>
        </div>

        {/* ── Save Button ────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Save className="h-4 w-4" />
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  )
}

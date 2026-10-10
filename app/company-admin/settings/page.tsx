import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Alert } from '@/components/ui/shell'
import { PendingSubmit } from '@/components/ui/pending-submit'
import { updateCompanySettings } from './actions'
import { AddressesCard, type CompanySenderRow } from './addresses-card'
import { Building2, Palette, Save } from 'lucide-react'

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

  // Explicit columns: portfolios also holds secrets (AI API keys) that this
  // page never needs.
  const [{ data: portfolio, error: portfolioError }, { data: sender, error: senderError }] = await Promise.all([
    db
      .from('portfolios')
      .select('id, company_name, phone_number, support_email, address_street, address_city, address_state, address_zip, brand_color, logo_url, slug, custom_domain')
      .eq('id', portfolioId)
      .maybeSingle(),
    // RLS lets the company's admins read their own row only.
    db
      .from('portfolio_email_domains')
      .select('domain, from_local_part, status, records, enabled, last_checked_at')
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
  ])
  // Saving a form rendered from a failed load would blank every field.
  const loadError = !portfolioId
    ? 'Your account is not linked to a company.'
    : portfolioError?.message ?? (!portfolio ? 'Company profile not found.' : null)

  const p = portfolio ?? {}

  function Field({ label, name, defaultValue, type = 'text', placeholder = '' }: {
    label: string
    name: string
    defaultValue?: string
    type?: string
    placeholder?: string
  }) {
    return (
      <label className="block">
        <span className="text-[13px] font-medium text-gray-500">{label}</span>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Settings</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Manage company settings for {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your portfolio'}
        </p>
      </div>

      {loadError && <Alert title="Could not load settings">{loadError} Reload the page before saving.</Alert>}
      {errorMsg && <Alert title="Settings not saved">{errorMsg}</Alert>}
      {saved && <Alert tone="success" title="Settings saved" />}

      {!loadError && <form action={updateCompanySettings} className="space-y-6">
        {/* ── Company Profile ────────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Company Profile</h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company Name" name="company_name" defaultValue={p.company_name} />
              <Field label="Phone Number" name="phone_number" defaultValue={p.phone_number} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt="Current company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[12.5px] font-medium text-gray-400">No logo</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Field label="Logo URL" name="logo_url" defaultValue={p.logo_url} placeholder="https://..." />
              </div>
            </div>
            <p className="-mt-2 text-xs text-gray-500">Shown in the sidebar and portals. Leave blank to remove the logo.</p>
            <Field label="Support Email" name="support_email" defaultValue={p.support_email} placeholder="support@company.com" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Street Address" name="address_street" defaultValue={p.address_street} />
              <Field label="City" name="address_city" defaultValue={p.address_city} />
              <Field label="State" name="address_state" defaultValue={p.address_state} />
              <Field label="ZIP Code" name="address_zip" defaultValue={p.address_zip} />
            </div>
          </div>
        </div>

        {/* ── Branding ───────────────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Palette className="h-4 w-4 text-gray-400" />
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Branding</h2>
          </div>
          <div className="space-y-4 p-5">
            <label className="block">
              <span className="text-[13px] font-medium text-gray-500">Brand Color</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  name="brand_color"
                  defaultValue={p.brand_color ?? '#10B981'}
                  className="h-10 w-16 cursor-pointer rounded-xl border border-gray-200 bg-white"
                />
                <span className="text-sm text-gray-500">{p.brand_color ?? '#10B981'}</span>
              </div>
            </label>
          </div>
        </div>

        {/* ── Save Button ────────────────────────────── */}
        <div className="flex justify-end">
          <PendingSubmit pendingLabel="Saving…">
            <Save className="h-4 w-4" />
            Save All Settings
          </PendingSubmit>
        </div>
      </form>}

      {!loadError && (
        <AddressesCard
          slug={p.slug ?? null}
          customDomain={p.custom_domain ?? null}
          sender={(sender as CompanySenderRow | null) ?? null}
          senderError={senderError?.message ?? null}
        />
      )}
    </div>
  )
}

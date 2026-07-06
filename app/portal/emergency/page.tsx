import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Siren, Phone, Mail, Wrench, Droplets, Flame, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function EmergencyInfoPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: occ } = await db
    .from('occupancies')
    .select('association_id, associations(name)')
    .eq('owner_id', me.owner_id)
    .eq('status', 'current')
    .limit(1)
    .maybeSingle()

  // Management contact — public branding fields only, resolved server-side.
  let support: { name: string | null; email: string | null; phone: string | null } | null = null
  if (occ?.association_id) {
    try {
      const svc = createServiceClient() as any
      const { data: assoc } = await svc.from('associations').select('portfolio_id').eq('id', occ.association_id).maybeSingle()
      if (assoc?.portfolio_id) {
        const { data: pf } = await svc.from('portfolios').select('company_name, support_email, support_phone').eq('id', assoc.portfolio_id).maybeSingle()
        if (pf) support = { name: pf.company_name ?? null, email: pf.support_email ?? null, phone: pf.support_phone ?? null }
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Emergency Information</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          What to do — and who to call — when something goes wrong{occ?.associations?.name ? ` at ${occ.associations.name}` : ''}
        </p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5">
        <div className="flex items-start gap-3">
          <Siren className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
          <div>
            <h2 className="text-sm font-semibold text-red-800">Life-threatening emergency? Call 911 first.</h2>
            <p className="mt-1 text-[13px] leading-5 text-red-700">
              Fire, gas smell, medical emergency, or anyone in danger — call 911 before contacting management.
            </p>
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Reach Your Management Company</h2>
        {support ? (
          <div className="space-y-2.5">
            {support.name && <div className="text-sm font-medium text-gray-900">{support.name}</div>}
            {support.phone && (
              <a href={`tel:${support.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-950 hover:underline">
                <Phone className="h-4 w-4 text-gray-400" /> {support.phone}
              </a>
            )}
            {support.email && (
              <a href={`mailto:${support.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-950 hover:underline">
                <Mail className="h-4 w-4 text-gray-400" /> {support.email}
              </a>
            )}
            <Link href="/portal/work-orders/new" className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">
              <Wrench className="h-4 w-4 text-gray-400" /> Submit an urgent maintenance request
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Contact details will appear here once your management company adds them.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          {
            icon: Droplets,
            title: 'Water Leak',
            steps: ['Shut off the water at your unit’s shutoff valve (usually under the kitchen sink or near the water heater).', 'If water is coming from another unit or a common area, notify management immediately.', 'Move belongings away from the water and document damage with photos.', 'Submit an urgent maintenance request with photos.'],
          },
          {
            icon: Flame,
            title: 'Fire or Smoke',
            steps: ['Evacuate immediately and call 911.', 'Pull the fire alarm on your way out if the building has one.', 'Do not use elevators.', 'Notify management after you are safe.'],
          },
          {
            icon: Zap,
            title: 'Power Outage',
            steps: ['Check your unit’s breaker panel first.', 'Check whether neighbors are also out — if so, report the outage to the utility.', 'Unplug sensitive electronics.', 'If only your unit is affected and the breaker is fine, submit a maintenance request.'],
          },
        ].map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className={card}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-950">{section.title}</h2>
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-5 text-gray-600">
                {section.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          )
        })}
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Building-specific procedures (water shutoff locations, access instructions) are published by your management
        company under <Link href="/portal/documents" className="underline">Documents</Link>.
      </p>
    </div>
  )
}

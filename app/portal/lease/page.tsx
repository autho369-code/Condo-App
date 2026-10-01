import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Alert, Badge, EmptyState, PageHeader, SectionTitle, Surface } from '@/components/ui/shell'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/

type TenantRow = {
  id: string
  unit_id: string
  unit_number: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  lease_start: string | null
  lease_end: string | null
  status: string | null
  insurance_expiration: string | null
}

// Lease dates for a tenant on one of the owner's own units. The RPC re-checks
// that the tenant's unit is currently owned by the signed-in owner.
async function updateTenantLease(formData: FormData) {
  'use server'
  await requireOwner()
  const fail = (msg: string): never => redirect(`/portal/lease?error=${encodeURIComponent(msg)}`)
  const tenantId = String(formData.get('tenant_id') ?? '')
  const start = String(formData.get('lease_start') ?? '')
  const end = String(formData.get('lease_end') ?? '')
  if (!UUID.test(tenantId)) fail('Choose a tenant.')
  if (!DAY.test(start)) fail('Enter the lease start date.')
  if (end && !DAY.test(end)) fail('Enter a valid lease end date.')
  const db = (await createClient()) as any
  const { error } = await db.rpc('owner_update_tenant_lease', {
    p_tenant_id: tenantId,
    p_lease_start: start,
    p_lease_end: end || null,
  })
  if (error) fail(error.message)
  revalidatePath('/portal/lease')
  redirect('/portal/lease?saved=1')
}

export default async function OwnerLeasePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const banner = await searchParams
  await requireOwner()
  const db = (await createClient()) as any
  const { data, error } = await db.rpc('owner_unit_tenants')
  const tenants = (data ?? []) as TenantRow[]

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Lease Information"
        description="Tenants renting your unit and their lease dates. Keep these current so the association can reach residents."
      />

      {banner.error && <Alert title="Not saved.">{banner.error}</Alert>}
      {banner.saved === '1' && <Alert tone="success" title="Lease dates updated." />}
      {error && <Alert title="Could not load your tenants.">{error.message}</Alert>}

      {tenants.length === 0 ? (
        <Surface padded={false}>
          <EmptyState
            icon={Key}
            title="No tenants on file for your units"
            description="If you rent out your unit, send management the tenant's name, contact details and lease dates so they can add them."
            action={<Link href="/portal/messages?compose=1" className="text-sm font-medium text-gray-900 underline underline-offset-4">Message management</Link>}
          />
        </Surface>
      ) : (
        tenants.map((t) => {
          const name = [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Tenant'
          return (
            <Surface key={t.id}>
              <SectionTitle
                title={name}
                description={`Unit ${t.unit_number ?? '—'}`}
                actions={t.status ? <Badge status={t.status}>{t.status.replace(/_/g, ' ')}</Badge> : undefined}
              />
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Email</dt><dd className="break-words text-gray-900">{t.email || '—'}</dd></div>
                <div><dt className="text-gray-500">Phone</dt><dd className="text-gray-900">{t.phone || '—'}</dd></div>
                <div><dt className="text-gray-500">Lease start</dt><dd className="text-gray-900">{date(t.lease_start)}</dd></div>
                <div><dt className="text-gray-500">Lease end</dt><dd className="text-gray-900">{t.lease_end ? date(t.lease_end) : 'Month to month'}</dd></div>
                <div><dt className="text-gray-500">Renter's insurance expires</dt><dd className="text-gray-900">{date(t.insurance_expiration)}</dd></div>
              </dl>
              <form action={updateTenantLease} className="mt-5 border-t border-gray-100 pt-5">
                <input type="hidden" name="tenant_id" value={t.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Lease start" htmlFor={`start-${t.id}`} required>
                    <Input id={`start-${t.id}`} type="date" name="lease_start" required defaultValue={t.lease_start ?? ''} />
                  </Field>
                  <Field label="Lease end" htmlFor={`end-${t.id}`} hint="Leave blank for month to month.">
                    <Input id={`end-${t.id}`} type="date" name="lease_end" defaultValue={t.lease_end ?? ''} />
                  </Field>
                </div>
                <Button type="submit" className="mt-4">Update lease dates</Button>
              </form>
            </Surface>
          )
        })
      )}
    </div>
  )
}

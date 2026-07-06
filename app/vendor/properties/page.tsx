import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, EmptyState } from '@/components/ui/shell';
import { Building2, Phone, Mail, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorPropertiesPage() {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;

  // Associations are visible to vendors only through their assigned work
  // orders (RLS: vendor_select_associations_units_via_work_orders).
  const { data: wos } = await db
    .from('work_orders')
    .select('association_id')
    .eq('vendor_id', me.vendor_id)
    .is('archived_at', null);

  const assocIds = [...new Set((wos ?? []).map((w: any) => w.association_id).filter(Boolean))];

  const { data: assocs } = assocIds.length
    ? await db
        .from('associations')
        .select('id, name, address, address_line_2, city, state, zip, maintenance_contact_name, maintenance_contact_email, maintenance_contact_phone, maintenance_phone, maintenance_notes, unit_entry_pre_authorized, site_manager, site_manager_phone')
        .in('id', assocIds)
        .order('name')
    : { data: [] as any[] };

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Access details and contacts for the properties you're assigned to work at."
      />

      {(assocs ?? []).length === 0 ? (
        <Surface padded={false}>
          <EmptyState
            icon={Building2}
            title="No assigned properties yet"
            description="Property details appear here once a management company assigns you a work order."
          />
        </Surface>
      ) : (
        <div className="space-y-5">
          {(assocs ?? []).map((a: any) => (
            <Surface key={a.id}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold text-gray-950">{a.name}</h2>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {[a.address, a.address_line_2, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' · ')}
                  </p>

                  <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    {(a.maintenance_contact_name || a.site_manager) && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">On-site Contact</dt>
                        <dd className="mt-0.5 text-sm text-gray-900">{a.maintenance_contact_name ?? a.site_manager}</dd>
                      </div>
                    )}
                    {(a.maintenance_contact_phone || a.maintenance_phone || a.site_manager_phone) && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Phone</dt>
                        <dd className="mt-0.5">
                          <a href={`tel:${a.maintenance_contact_phone ?? a.maintenance_phone ?? a.site_manager_phone}`} className="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:underline">
                            <Phone className="h-3.5 w-3.5 text-gray-400" /> {a.maintenance_contact_phone ?? a.maintenance_phone ?? a.site_manager_phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    {a.maintenance_contact_email && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Email</dt>
                        <dd className="mt-0.5">
                          <a href={`mailto:${a.maintenance_contact_email}`} className="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:underline">
                            <Mail className="h-3.5 w-3.5 text-gray-400" /> {a.maintenance_contact_email}
                          </a>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Unit Entry</dt>
                      <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-gray-900">
                        <KeyRound className="h-3.5 w-3.5 text-gray-400" />
                        {a.unit_entry_pre_authorized ? 'Pre-authorized by association' : 'Coordinate entry with the manager'}
                      </dd>
                    </div>
                  </dl>

                  {a.maintenance_notes && (
                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Access & Site Notes</div>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-gray-700">{a.maintenance_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-gray-400">
        Lockbox codes and keys are provided per job by the property manager — check the work order&apos;s access
        instructions or contact the manager listed above.
      </p>
    </div>
  );
}

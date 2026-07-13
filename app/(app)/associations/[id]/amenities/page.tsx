import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

type AmenityInsert = Database['public']['Tables']['association_amenities']['Insert'];

export default async function AmenitiesTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const sp = await searchParams;
  const showCreate = sp.new === '1';

  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: amenities } = await (supabase as any)
    .from('association_amenities')
    .select('id, name, image_url, description_html, opens_at, closes_at, allow_reservations, pricing_mode, price_amount, reserve_method, reservation_email, reservation_url, archived_at')
    .eq('association_id', id)
    .is('archived_at', null)
    .order('name');

  async function createAmenity(formData: FormData) {
    'use server';
    await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
    const supabase = await createClient();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) throw new Error('Title is required.');

    const allowReservations = formData.get('allow_reservations') === 'on';
    const pricingMode = parsePricingMode(formData.get('pricing_mode'));
    const priceRaw = String(formData.get('price_amount') ?? '').trim();
    const reserveMethod = parseReserveMethod(formData.get('reserve_method'));

    const payload: AmenityInsert = {
      association_id: id,
      name,
      description_html: (formData.get('description_html') as string) || null,
      opens_at: (formData.get('opens_at') as string) || null,
      closes_at: (formData.get('closes_at') as string) || null,
      allow_reservations: allowReservations,
      pricing_mode: allowReservations ? pricingMode as AmenityInsert['pricing_mode'] : null,
      price_amount: allowReservations && priceRaw ? Number(priceRaw) : null,
      reserve_method: allowReservations ? reserveMethod as AmenityInsert['reserve_method'] : null,
      reservation_email:
        allowReservations && reserveMethod === 'email'
          ? (formData.get('reservation_email') as string) || null : null,
      reservation_url:
        allowReservations && reserveMethod === 'platform_link'
          ? (formData.get('reservation_url') as string) || null : null,
    };

    const { error } = await (supabase as any).from('association_amenities').insert(payload);

    if (error) throw new Error(error.message);
    revalidatePath(`/associations/${id}/amenities`);
  }

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="amenities" />
          <WorkspaceHeader
            title="Amenity Settings"
            subtitle={assoc.name}
            actions={
              <Link href={`/associations/${id}/amenities?new=1`}>
                <Button size="sm">+ Create Amenity</Button>
              </Link>
            }
          />
        </>
      }
      rail={rail}
    >
      {(!amenities || amenities.length === 0) && !showCreate && (
        <Section padded>
          <p className="text-center text-sm italic text-gray-500">
            No amenities yet. Click &quot;+ Create Amenity&quot; to add one.
          </p>
        </Section>
      )}

      {(amenities ?? []).map((a: any) => (
        <Section key={a.id} padded>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="mb-1 text-base font-semibold text-gray-900">{a.name}</h3>
              {a.description_html && (
                <div className="mb-2 text-sm text-gray-700 [&_p]:m-0" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(a.description_html) }} />
              )}
              <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-sm">
                {(a.opens_at || a.closes_at) && (
                  <>
                    <dt className="text-gray-500">Hours</dt>
                    <dd className="text-gray-900">{formatHours(a.opens_at, a.closes_at)}</dd>
                  </>
                )}
                <dt className="text-gray-500">Reservations</dt>
                <dd className="text-gray-900">{a.allow_reservations ? 'Allowed' : 'Not allowed'}</dd>

                {a.allow_reservations && a.pricing_mode && (
                  <>
                    <dt className="text-gray-500">Pricing</dt>
                    <dd className="text-gray-900">
                      {a.pricing_mode === 'flat' ? 'Flat rate: ' : 'Hourly: '}
                      ${Number(a.price_amount ?? 0).toFixed(2)}
                      {a.pricing_mode === 'hourly' ? '/hr' : ''}
                    </dd>
                  </>
                )}

                {a.allow_reservations && a.reserve_method === 'email' && a.reservation_email && (
                  <>
                    <dt className="text-gray-500">Reserve via</dt>
                    <dd><a href={`mailto:${a.reservation_email}`} className="text-blue-700 hover:underline">{a.reservation_email}</a></dd>
                  </>
                )}

                {a.allow_reservations && a.reserve_method === 'platform_link' && a.reservation_url && (
                  <>
                    <dt className="text-gray-500">Reserve via</dt>
                    <dd><a href={a.reservation_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{a.reservation_url}</a></dd>
                  </>
                )}
              </dl>
            </div>
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt={a.name} className="h-24 w-32 rounded-lg border border-gray-200 object-cover" />
            )}
          </div>
        </Section>
      ))}

      {showCreate && (
        <Section
          title="Create Amenity"
          actions={<Link href={`/associations/${id}/amenities`} className="text-lg leading-none text-gray-400 hover:text-gray-600">×</Link>}
          padded
        >
          <form action={createAmenity as any} className="space-y-4">
            <FormRow label="Title" required>
              <input type="text" name="name" required placeholder="e.g. Tennis Court 1" className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </FormRow>

            <FormRow label="Image">
              <input type="file" name="image" disabled className="text-sm" />
              <div className="mt-1 text-xs text-gray-400">Image upload pending Storage bucket wiring</div>
            </FormRow>

            <FormRow label="Description" required>
              <textarea name="description_html" rows={4} className="w-full max-w-lg resize-y rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </FormRow>

            <fieldset className="border-t border-gray-200 pt-4">
              <legend className="mb-2 text-sm font-semibold text-gray-700">Hours of Operation</legend>
              <div className="flex items-end gap-4">
                <FormRow label="Opens">
                  <input type="time" name="opens_at" className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </FormRow>
                <FormRow label="Closes">
                  <input type="time" name="closes_at" className="w-44 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </FormRow>
              </div>
            </fieldset>

            <fieldset className="border-t border-gray-200 pt-4">
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="allow_reservations" defaultChecked />
                Allow Reservations
              </label>

              <div className="mb-3 flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="pricing_mode" value="flat" defaultChecked />
                  Flat Rate
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="pricing_mode" value="hourly" />
                  Hourly
                </label>
              </div>

              <div className="mb-4 flex items-center gap-1.5">
                <span className="text-gray-500">$</span>
                <input type="number" step="0.01" min="0" name="price_amount" defaultValue="0.00" className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>

              <div className="mb-2 text-sm font-semibold text-gray-700">&quot;Reserve&quot; button in resident portal</div>
              <div className="mb-3 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="reserve_method" value="email" defaultChecked />
                  Email Address
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="reserve_method" value="platform_link" />
                  Reservation Platform Link
                </label>
              </div>

              <FormRow label="Email Address">
                <input type="email" name="reservation_email" placeholder='e.g. "reservations@gmail.com"' className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </FormRow>

              <FormRow label="Platform URL">
                <input type="url" name="reservation_url" placeholder="https://..." className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </FormRow>
            </fieldset>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" size="sm">Create</Button>
              <Link href={`/associations/${id}/amenities`}>
                <Button type="button" size="sm" variant="secondary">Cancel</Button>
              </Link>
            </div>
          </form>
        </Section>
      )}
    </Workspace>
  );
}

function FormRow({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
      <label className="pt-1.5 text-sm text-gray-600">
        {label}{required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

function formatHours(opens: string | null, closes: string | null): string {
  if (!opens && !closes) return 'â€”';
  const fmt = (t: string | null) => {
    if (!t) return 'â€”';
    const [h, m] = t.split(':').map(Number);
    const hr12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(opens)} â€“ ${fmt(closes)}`;
}

function parsePricingMode(value: FormDataEntryValue | null): 'flat' | 'hourly' | null {
  return value === 'flat' || value === 'hourly' ? value : null;
}

function parseReserveMethod(value: FormDataEntryValue | null): 'email' | 'platform_link' | null {
  return value === 'email' || value === 'platform_link' ? value : null;
}

function sanitizeBasicHtml(html: string): string {
  return html
    .replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

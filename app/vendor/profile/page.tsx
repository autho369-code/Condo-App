import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { tradeLabel } from '@/lib/vendors/options';
import { firstVendorPhone, replaceFirstVendorPhone } from '@/lib/vendors/contact';

export const dynamic = 'force-dynamic';

export default async function VendorProfile({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: v, error: loadError } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, vendor_type, phone_numbers, emails, address_street, address_city, address_state, address_zip, payment_terms')
    .eq('id', me.vendor_id)
    .maybeSingle();

  // Phones are stored as plain strings or { number | value } objects.
  const phone = firstVendorPhone(v?.phone_numbers);
  const email = Array.isArray(v?.emails) && v.emails[0] ? (typeof v.emails[0] === 'string' ? v.emails[0] : v.emails[0].address ?? '') : '';

  async function save(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    const phoneVal = ((formData.get('phone') as string) || '').trim();
    const emailVal = ((formData.get('email') as string) || '').trim();
    // The form edits the first phone and email only; keep every other
    // number and address management has on file.
    const { data: current, error: loadError } = await (supabase2 as any)
      .from('vendors').select('phone_numbers, emails').eq('id', me2.vendor_id).maybeSingle();
    if (loadError || !current) redirect(`/vendor/profile?error=${encodeURIComponent(loadError?.message ?? 'Your vendor record was not found.')}`);
    const phones = replaceFirstVendorPhone(current.phone_numbers, phoneVal);
    const emails = Array.isArray(current.emails) ? [...current.emails] : [];
    if (emailVal) emails[0] = typeof emails[0] === 'object' && emails[0] ? { ...emails[0], address: emailVal } : emailVal;
    else if (emails.length > 1) emails.splice(0, 1);
    // Keep at least one email: sign-in can fall back to matching it.
    if (!emailVal && emails.length <= 1) redirect(`/vendor/profile?error=${encodeURIComponent('Keep an email address on file.')}`);
    const patch = {
      phone_numbers: phones,
      emails,
      address_street: ((formData.get('address_street') as string) || '').trim() || null,
      address_city: ((formData.get('address_city') as string) || '').trim() || null,
      address_state: ((formData.get('address_state') as string) || '').trim() || null,
      address_zip: ((formData.get('address_zip') as string) || '').trim() || null,
    };
    const { error } = await (supabase2 as any).from('vendors').update(patch).eq('id', me2.vendor_id);
    if (error) redirect(`/vendor/profile?error=${encodeURIComponent(error.message)}`);
    revalidatePath('/vendor/profile');
    redirect('/vendor/profile?saved=1');
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description={v?.name ? `${v.name}${v.trade ? ` · ${tradeLabel(v.trade)}` : ''}` : 'Your vendor profile'}
      />

      {loadError && <Alert tone="danger" title="Could not load your profile:" className="mb-5">{loadError.message}</Alert>}
      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Profile saved.</Alert>}

      <Surface>
        <SectionTitle title="Contact information" description="The management team uses this to reach you about work orders." />
        <form action={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" defaultValue={phone} placeholder="(773) 555-0100" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={email} placeholder="office@yourcompany.com" />
          </Field>
          <Field label="Street address" htmlFor="address_street" className="sm:col-span-2">
            <Input id="address_street" name="address_street" defaultValue={v?.address_street ?? ''} />
          </Field>
          <Field label="City" htmlFor="address_city">
            <Input id="address_city" name="address_city" defaultValue={v?.address_city ?? ''} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" htmlFor="address_state">
              <Input id="address_state" name="address_state" defaultValue={v?.address_state ?? ''} />
            </Field>
            <Field label="ZIP" htmlFor="address_zip">
              <Input id="address_zip" name="address_zip" defaultValue={v?.address_zip ?? ''} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}

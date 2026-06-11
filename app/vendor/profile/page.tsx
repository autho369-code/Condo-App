import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function VendorProfile({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: v } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, vendor_type, phone_numbers, emails, address_street, address_city, address_state, address_zip, payment_terms, notes')
    .eq('id', me.vendor_id)
    .maybeSingle();

  const phone = Array.isArray(v?.phone_numbers) && v.phone_numbers[0] ? (v.phone_numbers[0].number ?? v.phone_numbers[0].value ?? '') : '';
  const email = Array.isArray(v?.emails) && v.emails[0] ? (typeof v.emails[0] === 'string' ? v.emails[0] : v.emails[0].address ?? '') : '';

  async function save(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    const phoneVal = ((formData.get('phone') as string) || '').trim();
    const emailVal = ((formData.get('email') as string) || '').trim();
    const patch = {
      phone_numbers: phoneVal ? [{ type: 'work', number: phoneVal }] : [],
      emails: emailVal ? [emailVal] : [],
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
        description={v?.name ? `${v.name}${v.trade ? ` · ${String(v.trade).replace(/_/g, ' ')}` : ''}` : 'Your vendor profile'}
      />

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

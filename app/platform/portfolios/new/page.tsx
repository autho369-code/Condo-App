import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function createPortfolio(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const me = await requireStaff();
  if (!me.is_platform_operator) return { error: 'Access denied' };

  const companyName = formData.get('company_name') as string;
  if (!companyName) return { error: 'Company name required' };

  const { data: portfolio, error } = await (supabase as any).from('portfolios').insert({
    company_name: companyName,
    support_email: formData.get('support_email') as string || null,
    support_phone: formData.get('support_phone') as string || null,
    tier: formData.get('tier') || 'core',
    created_by: me.auth_user_id,
  }).select('id').single();

  if (error) return { error: error.message };

  revalidatePath('/platform/portfolios');
  redirect(`/platform/portfolios/${portfolio.id}`);
}

export default async function NewPortfolioPage() {
  const me = await requireStaff();
  if (!me.is_platform_operator) return <div className="p-8">Access denied.</div>;

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <div className="mb-6">
        <Link href="/platform/portfolios" className="text-sm text-blue-600 hover:underline">← Back to companies</Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">New Management Company</h1>
        <p className="text-sm text-gray-500 mt-1">Provision a new property management company on the platform.</p>
      </div>

      <form action={createPortfolio} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <Label htmlFor="company_name">Company name <span className="text-red-500">*</span></Label>
          <Input id="company_name" name="company_name" required placeholder="Stellar Property Management" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="support_email">Support email</Label>
            <Input id="support_email" name="support_email" type="email" placeholder="support@company.com" />
          </div>
          <div>
            <Label htmlFor="support_phone">Support phone</Label>
            <Input id="support_phone" name="support_phone" type="tel" placeholder="(312) 555-0100" />
          </div>
        </div>
        <div>
          <Label htmlFor="tier">Plan tier</Label>
          <select id="tier" name="tier" defaultValue="core" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="core">Core — $149/mo</option>
            <option value="plus">Plus — $299/mo</option>
            <option value="max">Max — $699/mo</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link href="/platform/portfolios"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit">Create company</Button>
        </div>
      </form>
    </div>
  );
}

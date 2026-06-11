import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { saveTemplate } from '@/lib/rpcs/sms';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { id } = await params;

  const { data: template } = await db
    .from('message_templates')
    .select('*')
    .eq('id', id)
    .eq('portfolio_id', me.portfolio?.id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/sms" className="transition-colors hover:text-gray-700">SMS</Link> / <Link href="/sms/templates" className="transition-colors hover:text-gray-700">Templates</Link> / {template.name}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Edit Template</h1>
          <Link href="/sms/templates" className="text-gray-400 hover:text-gray-600" aria-label="Close">&times;</Link>
        </div>

        <form action={saveTemplate as any} className="space-y-5 px-6 py-5">
          <input type="hidden" name="id" value={template.id} />

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Template name <span className="text-red-500">*</span>
            </label>
            <input id="name" name="name" required defaultValue={template.name} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="channel" className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
              <select id="channel" name="channel" defaultValue={template.channel} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select id="category" name="category" defaultValue={template.category ?? 'general'} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="general">General</option>
                <option value="payment">Payment</option>
                <option value="maintenance">Maintenance</option>
                <option value="violation">Violation</option>
                <option value="reminder">Reminder</option>
                <option value="announcement">Announcement</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">Subject (email only)</label>
            <input id="subject" name="subject" defaultValue={template.subject ?? ''} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Email subject line" />
          </div>

          <div>
            <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
              Message body <span className="text-red-500">*</span>
            </label>
            <textarea id="body" name="body" required rows={8} defaultValue={template.body} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono" />
            <p className="mt-2 text-xs text-gray-500">
              Available merge fields: {'{{'}owner_name{'}}'}, {'{{'}vendor_name{'}}'}, {'{{'}association_name{'}}'}, {'{{'}due_date{'}}'}, {'{{'}amount{'}}'}
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <Button type="submit">Save changes</Button>
            <Link href="/sms/templates" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

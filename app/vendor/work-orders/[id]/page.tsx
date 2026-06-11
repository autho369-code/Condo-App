import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const VENDOR_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Work complete' },
] as const;

export default async function VendorWorkOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireVendor();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: wo } = await db
    .from('work_orders')
    .select('id, number, title, status, priority, description, job_description, vendor_instructions, scheduled_date, scheduled_time, completed_date, created_at, associations(name, address, city, state), units(unit_number)')
    .eq('id', id)
    .eq('vendor_id', me.vendor_id)
    .maybeSingle();
  if (!wo) notFound();

  const { data: updates } = await db
    .from('work_order_updates')
    .select('id, note, new_status, created_at')
    .eq('work_order_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  async function postUpdate(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    const db2 = supabase2 as any;
    const woId = formData.get('work_order_id') as string;
    const newStatus = (formData.get('new_status') as string) || null;
    const note = ((formData.get('note') as string) || '').trim();

    if (!note && !newStatus) {
      redirect(`/vendor/work-orders/${woId}?error=${encodeURIComponent('Add a note or pick a status before posting.')}`);
    }

    const { error: insErr } = await db2.from('work_order_updates').insert({
      work_order_id: woId,
      note: note || (newStatus ? `Status changed to ${newStatus.replace(/_/g, ' ')}` : ''),
      new_status: newStatus,
      created_by: me2.auth_user_id,
    });
    if (insErr) redirect(`/vendor/work-orders/${woId}?error=${encodeURIComponent(insErr.message)}`);

    if (newStatus) {
      const patch: Record<string, any> = { status: newStatus };
      if (newStatus === 'done') patch.completed_date = new Date().toISOString().slice(0, 10);
      const { error: upErr } = await db2.from('work_orders').update(patch).eq('id', woId).eq('vendor_id', me2.vendor_id);
      if (upErr) redirect(`/vendor/work-orders/${woId}?error=${encodeURIComponent(upErr.message)}`);
    }

    revalidatePath(`/vendor/work-orders/${woId}`);
    redirect(`/vendor/work-orders/${woId}?saved=1`);
  }

  const assocLine = [wo.associations?.name, wo.units?.unit_number && `Unit ${wo.units.unit_number}`].filter(Boolean).join(' · ');
  const addressLine = [wo.associations?.address, [wo.associations?.city, wo.associations?.state].filter(Boolean).join(', ')].filter(Boolean).join(', ');

  return (
    <div>
      <Link href="/vendor/work-orders" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Work orders
      </Link>
      <PageHeader
        title={`${wo.number ? `#${wo.number} · ` : ''}${wo.title ?? 'Work order'}`}
        description={assocLine}
        actions={<Badge status={wo.status} className="px-3 py-1 text-[12px]" />}
      />

      {sp.error && <Alert tone="danger" title="Could not post update:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Update posted. The management team can see it immediately.</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Surface>
            <SectionTitle title="Job details" />
            <dl className="space-y-3 text-[13px] leading-5">
              {(wo.job_description || wo.description) && (
                <div>
                  <dt className="font-medium text-gray-500">Description</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{wo.job_description ?? wo.description}</dd>
                </div>
              )}
              {wo.vendor_instructions && (
                <div>
                  <dt className="font-medium text-gray-500">Instructions for you</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-800">{wo.vendor_instructions}</dd>
                </div>
              )}
              {addressLine && (
                <div>
                  <dt className="font-medium text-gray-500">Location</dt>
                  <dd className="mt-0.5 text-gray-800">{addressLine}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {wo.scheduled_date && (
                  <div>
                    <dt className="font-medium text-gray-500">Scheduled</dt>
                    <dd className="mt-0.5 text-gray-800">{date(wo.scheduled_date)}{wo.scheduled_time ? ` · ${wo.scheduled_time}` : ''}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-gray-500">Created</dt>
                  <dd className="mt-0.5 text-gray-800">{date(wo.created_at)}</dd>
                </div>
                {wo.completed_date && (
                  <div>
                    <dt className="font-medium text-gray-500">Completed</dt>
                    <dd className="mt-0.5 text-gray-800">{date(wo.completed_date)}</dd>
                  </div>
                )}
              </div>
            </dl>
          </Surface>

          <Surface>
            <SectionTitle title="Activity" description="Updates are visible to the management team." />
            {(updates ?? []).length === 0 ? (
              <p className="text-[13px] text-gray-400">No updates yet.</p>
            ) : (
              <ul className="space-y-4">
                {(updates ?? []).map((u: any) => (
                  <li key={u.id} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                    <div className="min-w-0">
                      <div className="text-[13px] leading-5 text-gray-800">{u.note}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                        {date(u.created_at)}
                        {u.new_status && <Badge status={u.new_status} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        <Surface className="h-fit">
          <SectionTitle title="Post an update" />
          <form action={postUpdate} className="space-y-4">
            <input type="hidden" name="work_order_id" value={wo.id} />
            <Field label="Status">
              <Select name="new_status" defaultValue="">
                <option value="">Keep current status</option>
                {VENDOR_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Note" hint="What was done, what's needed next, access issues, etc.">
              <Textarea name="note" placeholder="e.g. Replaced shut-off valve, testing for leaks tomorrow morning." />
            </Field>
            <Button type="submit" className="w-full">Post update</Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}

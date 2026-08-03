import { randomUUID } from 'node:crypto';
import { MessageSquare } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { sendResidentMessage } from '@/app/resident/actions';

export const dynamic = 'force-dynamic';

export default async function ResidentCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const banner = await searchParams;
  const me = await requireTenant();
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: announcements }, { data: messages }] = await Promise.all([
    db.from('communications_log').select('id, subject, body, created_at').eq('channel', 'announcement').order('created_at', { ascending: false }).limit(50),
    db.from('communications_log').select('id, subject, body, status, created_at').eq('sender_id', me.auth_user_id).order('created_at', { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="Send a secure message to management and read community announcements." />
      {banner.sent ? <Alert tone="success">Your message was sent to management.</Alert> : null}
      {banner.error ? <Alert>{banner.error}</Alert> : null}

      <Surface>
        <h2 className="text-[15px] font-semibold text-gray-950">Contact management</h2>
        <form action={sendResidentMessage as any} className="mt-4 space-y-4">
          <input type="hidden" name="request_key" value={randomUUID()} />
          <div><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required minLength={2} maxLength={200} /></div>
          <div><Label htmlFor="body">Message</Label><textarea id="body" name="body" required minLength={2} maxLength={10000} rows={5} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></div>
          <div className="flex justify-end"><Button type="submit"><MessageSquare className="h-4 w-4" /> Send message</Button></div>
        </form>
      </Surface>

      <div className="grid gap-5 lg:grid-cols-2">
        <Surface>
          <h2 className="text-[15px] font-semibold text-gray-950">Announcements</h2>
          {(announcements ?? []).length === 0 ? <EmptyState icon={MessageSquare} title="No announcements" /> : <div className="mt-4 divide-y divide-gray-100">{(announcements ?? []).map((item: any) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><div className="text-sm font-medium text-gray-900">{item.subject ?? 'Community update'}</div>{item.body ? <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-gray-600">{item.body}</p> : null}<div className="mt-1 text-xs text-gray-400">{date(item.created_at)}</div></div>)}</div>}
        </Surface>
        <Surface>
          <h2 className="text-[15px] font-semibold text-gray-950">Message history</h2>
          {(messages ?? []).length === 0 ? <EmptyState icon={MessageSquare} title="No messages sent" /> : <div className="mt-4 divide-y divide-gray-100">{(messages ?? []).map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><div className="text-sm font-medium text-gray-900">{item.subject}</div>{item.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.body}</p> : null}<div className="mt-1 text-xs text-gray-400">{date(item.created_at)}</div></div><Badge status={item.status} /></div>)}</div>}
        </Surface>
      </div>
    </div>
  );
}

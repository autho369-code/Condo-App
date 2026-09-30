import Link from 'next/link';
import { Inbox, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { responseState } from '@/lib/maintenance/intake';

export const dynamic = 'force-dynamic';

const QUEUES = [
  { key: 'open', label: 'Open' },
  { key: 'unread', label: 'Needs reply' },
  { key: 'overdue', label: 'Reply overdue' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'closed', label: 'Closed' },
  { key: 'sms', label: 'Text messages' },
] as const;
type Queue = (typeof QUEUES)[number]['key'];

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function residentName(t: any) {
  const owner = one<any>(t.owners);
  const tenant = one<any>(t.tenants);
  if (owner) return { name: owner.full_name ?? 'Owner', role: 'Owner' };
  if (tenant) return { name: `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || 'Tenant', role: 'Tenant' };
  return { name: 'Resident', role: '' };
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const queue: Queue = (QUEUES.find((x) => x.key === sp.q)?.key ?? 'open') as Queue;
  const db = (await createClient()) as any;
  const nowIso = new Date().toISOString();

  const count = (build: (q: any) => any) =>
    build(db.from('message_threads').select('id', { count: 'exact', head: true }).eq('status', 'open'));

  let list = db.from('message_threads')
    .select('id, subject, status, last_message_at, last_message_preview, last_message_role, staff_unread, first_response_due_at, acknowledged_at, owners(full_name), tenants(first_name, last_name), associations(name), units(unit_number), assignee:assigned_to(full_name, email)');
  if (queue === 'closed') list = list.eq('status', 'closed');
  else {
    list = list.eq('status', 'open');
    if (queue === 'unread') list = list.eq('staff_unread', true);
    if (queue === 'overdue') list = list.is('acknowledged_at', null).lt('first_response_due_at', nowIso);
    if (queue === 'mine') list = list.eq('assigned_to', me.auth_user_id);
  }

  const [threadsRes, smsRes, openRes, unreadRes, overdueRes, mineRes] = await Promise.all([
    queue === 'sms' ? Promise.resolve({ data: [] }) : list.order('last_message_at', { ascending: false }).limit(300),
    queue === 'sms'
      ? db.from('sms_messages').select('id, direction, body, from_number, to_number, status, sent_at').order('sent_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    count((q) => q),
    count((q) => q.eq('staff_unread', true)),
    count((q) => q.is('acknowledged_at', null).lt('first_response_due_at', nowIso)),
    count((q) => q.eq('assigned_to', me.auth_user_id)),
  ]);
  const threads = (threadsRes.data ?? []) as any[];
  const sms = (smsRes.data ?? []) as any[];

  return (
    <DataWorkspace title="Inbox" description="Conversations with owners and tenants, plus text messages. Residents write from their portal; your replies are emailed to them.">
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Open conversations', value: openRes.count ?? 0 },
          { label: 'Needs reply', value: unreadRes.count ?? 0, sublabel: 'Resident wrote last' },
          { label: 'Reply overdue', value: overdueRes.count ?? 0, sublabel: 'Past the 48-hour reply time' },
          { label: 'Assigned to me', value: mineRes.count ?? 0 },
        ]} />

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {QUEUES.map((x) => (
            <Link key={x.key} href={`/inbox?q=${x.key}`}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${x.key === queue ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {x.label}
            </Link>
          ))}
        </nav>

        {queue === 'sms' ? (
          sms.length > 0 ? (
            <Table>
              <THead><tr><TH>When</TH><TH>Direction</TH><TH>From</TH><TH>To</TH><TH>Message</TH><TH>Status</TH></tr></THead>
              <tbody>
                {sms.map((m) => (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap">{date(m.sent_at)}</TD>
                    <TD><Badge tone={m.direction === 'inbound' ? 'open' : 'inactive'}>{m.direction}</Badge></TD>
                    <TD className="font-mono text-xs">{m.from_number}</TD>
                    <TD className="font-mono text-xs">{m.to_number}</TD>
                    <TD className="max-w-md truncate">{m.body}</TD>
                    <TD className="text-xs capitalize text-gray-500">{m.status}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white">
              <EmptyState icon={Inbox} title="No text messages" description="Two-way SMS appears here once the texting number is live." />
            </div>
          )
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white">
            <EmptyState icon={MessageSquare} title="Nothing here" description="Owners and tenants can message you from their portal. Start a conversation from an owner's page." />
          </div>
        ) : (
          <Table>
            <THead><TR><TH>Conversation</TH><TH>Resident</TH><TH>Property</TH><TH>Assigned</TH><TH>Last message</TH></TR></THead>
            <tbody>
              {threads.map((t) => {
                const who = residentName(t);
                const state = t.status === 'open' ? responseState({ status: 'open', acknowledged_at: t.acknowledged_at, first_response_due_at: t.first_response_due_at }) : null;
                const assignee = one<any>(t.assignee);
                return (
                  <TR key={t.id}>
                    <TD className="max-w-md">
                      <Link href={`/inbox/${t.id}`} className="flex items-center gap-2">
                        {t.staff_unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Needs reply" /> : null}
                        <span className={`truncate ${t.staff_unread ? 'font-semibold text-gray-950' : 'font-medium text-gray-900'} hover:underline`}>{t.subject}</span>
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{t.last_message_role === 'staff' ? 'You: ' : ''}{t.last_message_preview}</p>
                      {state && !t.acknowledged_at ? <div className="mt-1"><StatusChip tone={state.tone}>{state.label}</StatusChip></div> : null}
                    </TD>
                    <TD><div className="font-medium text-gray-900">{who.name}</div><div className="text-xs text-gray-500">{who.role}</div></TD>
                    <TD><div className="text-gray-900">{one<any>(t.associations)?.name ?? '—'}</div><div className="text-xs text-gray-500">{one<any>(t.units)?.unit_number ? `Unit ${one<any>(t.units).unit_number}` : ''}</div></TD>
                    <TD className="text-sm text-gray-700">{assignee ? (assignee.full_name ?? assignee.email) : <span className="text-gray-400">—</span>}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{new Date(t.last_message_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}

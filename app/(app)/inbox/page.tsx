import { formatInZone } from '@/lib/time/zoned';
import Link from 'next/link';
import { Inbox, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { responseState } from '@/lib/maintenance/intake';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { descNullsLast, unionSearch } from '@/lib/supabase/search-union';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ q?: string; association?: string; search?: string }> }) {
  const me = await requireWorkspaceStaff();
  const sp = await searchParams;
  const queue: Queue = (QUEUES.find((x) => x.key === sp.q)?.key ?? 'open') as Queue;
  const db = (await createClient()) as any;
  const nowIso = new Date().toISOString();
  const associationId = sp.association && UUID.test(sp.association) ? sp.association : '';
  const term = (sp.search ?? '').replace(/[%_,()*"\\]/g, ' ').trim();
  // Queue tabs keep the association filter and search.
  const keep = new URLSearchParams();
  if (associationId) keep.set('association', associationId);
  if (sp.search) keep.set('search', sp.search);
  const tabHref = (key: string) => `/inbox?q=${key}${keep.size ? `&${keep}` : ''}`;

  const count = (build: (q: any) => any) =>
    build(db.from('message_threads').select('id', { count: 'exact', head: true }).eq('status', 'open'));

  const THREAD_COLUMNS = 'id, subject, status, last_message_at, last_message_preview, last_message_role, staff_unread, first_response_due_at, acknowledged_at, owners(full_name), tenants(first_name, last_name), associations(name), units(unit_number), assignee:assigned_to(full_name, email)';
  const listQuery = (extraColumns = '') => {
    let q = db.from('message_threads').select(THREAD_COLUMNS + extraColumns);
    if (associationId) q = q.eq('association_id', associationId);
    if (queue === 'closed') q = q.eq('status', 'closed');
    else {
      q = q.eq('status', 'open');
      // "Needs reply" = the resident wrote last (reading a thread doesn't answer it).
      if (queue === 'unread') q = q.eq('last_message_role', 'resident');
      if (queue === 'overdue') q = q.is('acknowledged_at', null).lt('first_response_due_at', nowIso);
      if (queue === 'mine') q = q.eq('assigned_to', me.auth_user_id);
    }
    return q.order('last_message_at', { ascending: false }).limit(300);
  };
  // Search: subject, homeowner, tenant or unit, one query per match type
  // merged by id (see unionSearch).
  const threadsQuery: PromiseLike<{ data: any[] | null; error: any }> = term
    ? unionSearch<any>([
        listQuery().ilike('subject', `%${term}%`),
        listQuery(', s_o:owners!message_threads_owner_id_fkey!inner(full_name)').ilike('s_o.full_name', `%${term}%`),
        listQuery(', s_t:tenants!message_threads_tenant_id_fkey!inner(first_name)').ilike('s_t.first_name', `%${term}%`),
        listQuery(', s_l:tenants!message_threads_tenant_id_fkey!inner(last_name)').ilike('s_l.last_name', `%${term}%`),
        listQuery(', s_u:units!message_threads_unit_id_fkey!inner(unit_number)').ilike('s_u.unit_number', term),
      ], (x, y) => descNullsLast(x.last_message_at, y.last_message_at), 300).then(({ rows, error }) => ({ data: rows, error }))
    : listQuery();

  const [threadsRes, smsRes, openRes, unreadRes, overdueRes, mineRes, { data: associations }] = await Promise.all([
    queue === 'sms' ? Promise.resolve({ data: [], error: null }) : threadsQuery,
    queue === 'sms'
      ? db.from('sms_messages').select('id, direction, body, from_number, to_number, status, sent_at').order('sent_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    count((q) => q),
    count((q) => q.eq('last_message_role', 'resident')),
    count((q) => q.is('acknowledged_at', null).lt('first_response_due_at', nowIso)),
    count((q) => q.eq('assigned_to', me.auth_user_id)),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
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
            <Link key={x.key} href={tabHref(x.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${x.key === queue ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {x.label}
            </Link>
          ))}
        </nav>

        {queue !== 'sms' && (
          <FilterBar action="/inbox" searchName="search" searchDefault={sp.search ?? ''} searchPlaceholder="Search subject, homeowner, tenant or unit">
            <input type="hidden" name="q" value={queue} />
            <FilterSelect label="Association" name="association" defaultValue={associationId}>
              <option value="">All</option>
              {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </FilterSelect>
          </FilterBar>
        )}
        {threadsRes.error && <Alert tone="danger" title="Could not load conversations:">{threadsRes.error.message ?? String(threadsRes.error)}</Alert>}

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
        ) : threadsRes.error ? null : threads.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white">
            <EmptyState icon={MessageSquare} title={term || associationId ? 'No conversations match' : 'Nothing here'} description="Owners and tenants can message you from their portal. Start a conversation from an owner's page." />
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
                        {t.staff_unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" /> : null}
                        <span className={`truncate ${t.staff_unread ? 'font-semibold text-gray-950' : 'font-medium text-gray-900'} hover:underline`}>{t.subject}</span>
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{t.last_message_role === 'staff' ? 'You: ' : ''}{t.last_message_preview}</p>
                      {state && !t.acknowledged_at ? <div className="mt-1"><StatusChip tone={state.tone}>{state.label}</StatusChip></div> : null}
                    </TD>
                    <TD><div className="font-medium text-gray-900">{who.name}</div><div className="text-[13px] text-gray-500">{who.role}</div></TD>
                    <TD><div className="text-gray-900">{one<any>(t.associations)?.name ?? '—'}</div><div className="text-[13px] text-gray-500">{one<any>(t.units)?.unit_number ? `Unit ${one<any>(t.units).unit_number}` : ''}</div></TD>
                    <TD className="text-sm text-gray-700">{assignee ? (assignee.full_name ?? assignee.email) : <span className="text-gray-400">—</span>}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{formatInZone(t.last_message_at)}</TD>
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

import { formatInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { sanitizeSearchTerm } from '@/lib/search/global';
import { displayTimeZone } from '@/lib/time/display-zone';
import { sendCommunication } from './actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const TABS = [
  { key: 'emails', label: 'Emails' },
  { key: 'texts', label: 'Text messages' },
  { key: 'letters', label: 'Mailed letters' },
  { key: 'drafts', label: 'Drafts and approvals' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const STATUS_OPTIONS: Record<TabKey, { value: string; label: string }[]> = {
  emails: [
    { value: 'pending', label: 'Waiting to send' },
    { value: 'sent', label: 'Sent' },
    { value: 'opened', label: 'Opened' },
    { value: 'bounced', label: 'Bounced' },
    { value: 'failed', label: 'Failed' },
  ],
  texts: [
    { value: 'queued', label: 'Queued' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'undelivered', label: 'Undelivered' },
    { value: 'failed', label: 'Failed' },
  ],
  letters: [
    { value: 'queued', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'in_transit', label: 'In transit' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'returned', label: 'Returned' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  drafts: [
    { value: 'draft', label: 'Draft' },
    { value: 'queued', label: 'Queued' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'canceled', label: 'Canceled' },
  ],
};

function when(value: string | null) {
  return value ? formatInZone(value) : '—';
}

/** A YYYY-MM-DD that is a real calendar day, else '' (an impossible date is ignored). */
function realDate(raw: string | undefined) {
  if (!raw || !DATE.test(raw)) return '';
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? raw : '';
}

function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

export default async function CommunicationCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string; error?: string; status?: string; notice?: string; tab?: string; q?: string; association?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  // Old links (?status=failed) pointed at the drafts queue.
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : sp.status === 'failed' && !sp.tab ? 'drafts' : 'emails';
  const status = STATUS_OPTIONS[tab].some((o) => o.value === sp.status) ? sp.status! : '';
  const association = UUID.test(sp.association ?? '') ? sp.association! : '';
  const from = realDate(sp.from);
  const to = realDate(sp.to);
  const q = sanitizeSearchTerm(sp.q);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const zone = displayTimeZone();
  const startOf = (day: string) => (zonedWallTimeToUtc(day, '00:00', zone) ?? new Date(`${day}T00:00:00Z`)).toISOString();
  const db = (await createClient()) as any;

  const { rows: associations } = await fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id'));

  /** Date range on a timestamp column, in the company time zone. */
  const dated = (query: any, column: string) => {
    let qy = query;
    if (from) qy = qy.gte(column, startOf(from));
    if (to) qy = qy.lt(column, startOf(addDays(to, 1)));
    return qy;
  };
  const range = (query: any) => query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  let rows: any[] = [];
  let total = 0;
  let loadError: string | null = null;

  if (tab === 'emails') {
    let query = db.from('email_queue')
      .select('id, to_email, to_name, subject, status, delivery_status, error_message, created_at, sent_at, delivered_at, open_count, first_opened_at, bounced_at, associations(name)', { count: 'exact' });
    if (association) query = query.eq('association_id', association);
    // A provider can report a failure after accepting an email: the queue row
    // stays 'sent' and delivery_status becomes 'failed'.
    if (status === 'pending') query = query.eq('status', 'pending');
    if (status === 'sent') query = query.eq('status', 'sent').or('delivery_status.is.null,delivery_status.neq.failed');
    if (status === 'failed') query = query.or('status.eq.failed,delivery_status.eq.failed');
    if (status === 'opened') query = query.gt('open_count', 0);
    if (status === 'bounced') query = query.not('bounced_at', 'is', null);
    if (q) query = query.or(`to_email.ilike."%${q}%",to_name.ilike."%${q}%",subject.ilike."%${q}%"`);
    const { data, count, error } = await range(dated(query, 'created_at').order('created_at', { ascending: false }).order('id'));
    rows = data ?? []; total = count ?? 0; loadError = error?.message ?? null;
  } else if (tab === 'texts') {
    let query = db.from('sms_messages')
      .select('id, direction, body, from_number, to_number, status, error_message, created_at, sent_at, delivered_at, sms_conversations!inner(with_name, association_id, associations(name))', { count: 'exact' });
    if (association) query = query.eq('sms_conversations.association_id', association);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(`body.ilike."%${q}%",to_number.ilike."%${q}%",from_number.ilike."%${q}%"`);
    const { data, count, error } = await range(dated(query, 'created_at').order('created_at', { ascending: false }).order('id'));
    rows = data ?? []; total = count ?? 0; loadError = error?.message ?? null;
  } else if (tab === 'letters') {
    let query = db.from('physical_mail_deliveries')
      .select('id, recipient_name, address_line1, address_city, address_state, address_zip, description, mail_class, status, error_message, created_at, submitted_at, expected_delivery_date, delivered_at, associations(name)', { count: 'exact' });
    if (association) query = query.eq('association_id', association);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(`recipient_name.ilike."%${q}%",description.ilike."%${q}%",address_line1.ilike."%${q}%"`);
    const { data, count, error } = await range(dated(query, 'created_at').order('created_at', { ascending: false }).order('id'));
    rows = data ?? []; total = count ?? 0; loadError = error?.message ?? null;
  } else {
    let query = db.from('communication_messages')
      .select('id, channel, status, recipient_group, recipient_email, recipient_phone, subject, body, error_message, created_at, sent_at, associations(name)', { count: 'exact' });
    if (association) query = query.eq('association_id', association);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(`subject.ilike."%${q}%",body.ilike."%${q}%",recipient_email.ilike."%${q}%"`);
    const { data, count, error } = await range(dated(query, 'created_at').order('created_at', { ascending: false }).order('id'));
    rows = data ?? []; total = count ?? 0; loadError = error?.message ?? null;
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const params = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { tab: tab === 'emails' ? '' : tab, status, association, from, to, q, page: page > 1 ? String(page) : '' };
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) p.set(k, v);
    return p.toString() ? `/communication-center?${p}` : '/communication-center';
  };
  const filtering = !!(status || association || from || to || q);

  return (
    <DataWorkspace
      title="Communication Center"
      description="Every email, text message and mailed letter sent to owners, vendors and boards, and messages waiting for approval."
      actions={
        <>
          <Link href="/letters"><Button variant="secondary">Letters</Button></Link>
          <Link href="/sms"><Button variant="secondary">Send text</Button></Link>
          <Link href="/send-email"><Button>Compose email</Button></Link>
        </>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not send">{sp.error}</Alert>}
        {loadError && <Alert tone="danger" title="Could not load communications">{loadError}</Alert>}
        {sp.notice === 'already_sent' && <Alert tone="warning" title="Already sent.">That message was already submitted; it was not sent a second time.</Alert>}
        {sp.queued && <Alert tone="success" title="Message queued">{`Queued for delivery to ${sp.queued} recipient${sp.queued === '1' ? '' : 's'} via email.`}</Alert>}

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'emails' ? '/communication-center' : `/communication-center?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.key ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <FilterBar action="/communication-center" searchDefault={sp.q ?? ''} searchPlaceholder={tab === 'texts' ? 'Search message or phone...' : tab === 'letters' ? 'Search recipient or address...' : 'Search recipient or subject...'}>
          {tab !== 'emails' && <input type="hidden" name="tab" value={tab} />}
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All</option>
            {STATUS_OPTIONS[tab].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <label className="text-[12px] font-medium text-gray-500">
            From
            <input type="date" name="from" defaultValue={from} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input type="date" name="to" defaultValue={to} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
        </FilterBar>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>{total.toLocaleString()} {tab === 'emails' ? 'email' : tab === 'texts' ? 'text message' : tab === 'letters' ? 'letter' : 'message'}{total === 1 ? '' : 's'}{filtering ? ' match' : ''}</span>
          {totalPages > 1 && (
            <span className="flex items-center gap-3">
              {page > 1 ? <Link href={params({ page: String(page - 1) })} className="text-gray-900 underline underline-offset-4">Newer</Link> : <span className="text-gray-300">Newer</span>}
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              {page < totalPages ? <Link href={params({ page: String(page + 1) })} className="text-gray-900 underline underline-offset-4">Older</Link> : <span className="text-gray-300">Older</span>}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={MessageSquare}
              title={filtering ? 'Nothing matches these filters' : 'Nothing here yet'}
              description={tab === 'drafts' ? 'Calendar events and notices create draft messages here for approval.' : 'Messages appear here once they are sent.'}
            />
          </div>
        ) : tab === 'emails' ? (
          <Table>
            <THead>
              <TR>
                <TH>Sent</TH>
                <TH>To</TH>
                <TH>Subject</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Opened</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{when(m.sent_at ?? m.created_at)}</TD>
                  <TD className="text-sm">
                    <div className="text-gray-900">{m.to_name || m.to_email}</div>
                    {m.to_name && <div className="text-[13px] text-gray-500">{m.to_email}</div>}
                  </TD>
                  <TD className="max-w-md text-sm">
                    <Link href={`/communication-center/emails/${m.id}`} className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">{m.subject || 'No subject'}</Link>
                  </TD>
                  <TD className="text-sm text-gray-600">{m.associations?.name ?? '—'}</TD>
                  <TD>
                    {m.bounced_at ? <StatusChip tone="danger">Bounced</StatusChip>
                      : m.status === 'failed' || m.delivery_status === 'failed' ? <StatusChip tone="danger">Failed</StatusChip>
                      : m.status === 'pending' ? <StatusChip tone="warning">Waiting to send</StatusChip>
                      : m.delivered_at ? <StatusChip tone="success">Delivered</StatusChip>
                      : <StatusChip tone="info">Sent</StatusChip>}
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">
                    {(m.open_count ?? 0) > 0 ? `${when(m.first_opened_at)}${m.open_count > 1 ? ` (${m.open_count}×)` : ''}` : '—'}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : tab === 'texts' ? (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>With</TH>
                <TH>Direction</TH>
                <TH>Message</TH>
                <TH>Association</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{when(m.sent_at ?? m.created_at)}</TD>
                  <TD className="text-sm">
                    <div className="text-gray-900">{m.sms_conversations?.with_name ?? '—'}</div>
                    <div className="text-[13px] text-gray-500">{m.direction === 'inbound' ? m.from_number : m.to_number}</div>
                  </TD>
                  <TD className="text-sm capitalize text-gray-600">{m.direction === 'inbound' ? 'Received' : 'Sent'}</TD>
                  <TD className="max-w-md text-sm text-gray-800"><span className="line-clamp-2">{m.body}</span></TD>
                  <TD className="text-sm text-gray-600">{m.sms_conversations?.associations?.name ?? '—'}</TD>
                  <TD>
                    <StatusChip tone={['failed', 'undelivered'].includes(m.status) ? 'danger' : m.status === 'queued' ? 'warning' : 'success'}>{String(m.status).replace(/_/g, ' ')}</StatusChip>
                    {m.error_message && <div className="mt-1 text-xs text-red-600">{m.error_message}</div>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : tab === 'letters' ? (
          <Table>
            <THead>
              <TR>
                <TH>Created</TH>
                <TH>Recipient</TH>
                <TH>Letter</TH>
                <TH>Association</TH>
                <TH>Expected delivery</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{when(m.created_at)}</TD>
                  <TD className="text-sm">
                    <div className="text-gray-900">{m.recipient_name}</div>
                    <div className="text-[13px] text-gray-500">{[m.address_line1, m.address_city, m.address_state, m.address_zip].filter(Boolean).join(', ')}</div>
                  </TD>
                  <TD className="text-sm text-gray-800">{m.description ?? '—'}<div className="text-xs capitalize text-gray-500">{String(m.mail_class ?? '').replace(/_/g, ' ')}</div></TD>
                  <TD className="text-sm text-gray-600">{m.associations?.name ?? '—'}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{m.delivered_at ? `Delivered ${when(m.delivered_at)}` : m.expected_delivery_date ?? '—'}</TD>
                  <TD>
                    <StatusChip tone={['failed', 'returned'].includes(m.status) ? 'danger' : m.status === 'delivered' ? 'success' : m.status === 'cancelled' ? 'neutral' : 'info'}>{String(m.status).replace(/_/g, ' ')}</StatusChip>
                    {m.error_message && <div className="mt-1 text-xs text-red-600">{m.error_message}</div>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Created</TH>
                <TH>Channel</TH>
                <TH>Recipients</TH>
                <TH>Association</TH>
                <TH>Subject / Message</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((message) => (
                <TR key={message.id}>
                  <TD className="whitespace-nowrap">{when(message.created_at)}</TD>
                  <TD className="text-xs font-semibold uppercase text-gray-600">{message.channel}</TD>
                  <TD>
                    <div className="capitalize text-gray-900">{String(message.recipient_group ?? '').replaceAll('_', ' ')}</div>
                    <div className="text-[13px] text-gray-500">{message.recipient_email ?? message.recipient_phone ?? 'Resolved at send time'}</div>
                  </TD>
                  <TD>{message.associations?.name ?? 'Portfolio-wide'}</TD>
                  <TD className="max-w-xl">
                    <div className="font-medium text-gray-900">{message.subject ?? 'No subject'}</div>
                    <div className="mt-1 line-clamp-2 text-gray-500">{message.body}</div>
                    {message.status === 'failed' && message.error_message && <div className="mt-1 text-xs text-red-600">{message.error_message}</div>}
                  </TD>
                  <TD><Badge status={message.status} /></TD>
                  <TD className="text-right">
                    {message.channel === 'email' && !['queued', 'sent', 'canceled'].includes(message.status) ? (
                      <form action={sendCommunication}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          {message.status === 'failed' ? 'Retry' : 'Approve & send'}
                        </Button>
                      </form>
                    ) : message.channel === 'sms' && message.status !== 'sent' ? (
                      <Link href="/sms" className="text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">SMS console →</Link>
                    ) : (
                      <span className="text-[13px] text-gray-500">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}

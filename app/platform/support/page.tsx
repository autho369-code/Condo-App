import { createClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/workspace/shell';
import { Card, CardBody } from '@/components/ui/card';
import { Table, THead, TR, TH } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { addInternalNote, markTicketResolved } from './actions';
import { TicketRowClient } from './ticket-row';
import {
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Data Types                                                                */
/* -------------------------------------------------------------------------- */

interface TicketRow {
  id: number;
  propertyId: number | null;
  companyId: number | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  reportedById: string | null;
  assignedToId: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CommentRow {
  id: number;
  ticket_id: number;
  body: string;
  author_id: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Dark Stat Tile                                                            */
/* -------------------------------------------------------------------------- */

function StatDark({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    slate: 'from-slate-600/20 to-slate-600/5 border-slate-700',
  };
  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent]} p-5`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`ml-3 mt-0.5 rounded-lg bg-white/5 p-2 ${iconColorMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q || '';
  const activeTab = sp.tab || 'all';

  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { data: tickets },
    { data: portfolios },
    { data: profiles },
    { data: comments },
  ] = await Promise.all([
    (supabase as any)
      .from('tickets')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(500),
    (supabase as any)
      .from('portfolios')
      .select('id, company_name')
      .is('archived_at', null)
      .order('company_name'),
    (supabase as any)
      .from('profiles')
      .select('id, full_name, email'),
    (supabase as any)
      .from('ticket_comments')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(2000),
  ]);

  const allTickets: TicketRow[] = tickets ?? [];
  const allComments: CommentRow[] = comments ?? [];

  // Build lookup maps
  const portfolioById = new Map<string, string>(
    (portfolios ?? []).map((p: any) => [String(p.id), p.company_name]),
  );
  const profileById = new Map<string, string>(
    (profiles ?? []).map((p: any) => [String(p.id), p.full_name ?? p.email ?? 'Unknown']),
  );

  // Group comments by ticket_id
  const commentsByTicket = new Map<number, CommentRow[]>();
  for (const c of allComments) {
    const list = commentsByTicket.get(c.ticket_id) ?? [];
    list.push(c);
    commentsByTicket.set(c.ticket_id, list);
  }

  // Compute stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const openTickets = allTickets.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress',
  );
  const criticalTickets = allTickets.filter(
    (t) =>
      t.priority === 'Critical' &&
      t.status !== 'Resolved' &&
      t.status !== 'Closed',
  );
  const overdueTickets = allTickets.filter((t) => {
    if (!t.dueDate) return false;
    if (t.status === 'Resolved' || t.status === 'Closed') return false;
    return new Date(t.dueDate) < now;
  });
  const resolvedToday = allTickets.filter((t) => {
    if (!t.resolvedAt) return false;
    return new Date(t.resolvedAt) >= todayStart;
  });

  // Filter tabs
  let filtered = allTickets;
  if (activeTab === 'open') {
    filtered = filtered.filter(
      (t) => t.status === 'Open' || t.status === 'In Progress',
    );
  } else if (activeTab === 'critical') {
    filtered = filtered.filter(
      (t) =>
        t.priority === 'Critical' &&
        t.status !== 'Resolved' &&
        t.status !== 'Closed',
    );
  } else if (activeTab === 'resolved') {
    filtered = filtered.filter(
      (t) => t.status === 'Resolved' || t.status === 'Closed',
    );
  }

  // Search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q),
    );
  }

  // Tab definitions
  const tabs = [
    { key: 'all', label: 'All', count: allTickets.length },
    { key: 'open', label: 'Open', count: openTickets.length },
    { key: 'critical', label: 'Critical', count: criticalTickets.length },
    {
      key: 'resolved',
      label: 'Resolved',
      count: allTickets.filter(
        (t) => t.status === 'Resolved' || t.status === 'Closed',
      ).length,
    },
  ];

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="[&_h1]:text-white [&_.text-gray-500]:text-slate-400 [&_.text-gray-900]:text-white">
          <WorkspaceHeader
            eyebrow="Customer Support"
            title="Support / Help Desk"
            subtitle="Manage support tickets across all management companies. Track, prioritize, and resolve issues from a single dashboard."
          />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatDark
            label="Open Tickets"
            value={openTickets.length}
            sub={`${criticalTickets.length} critical`}
            icon={Ticket}
            accent={openTickets.length > 10 ? 'amber' : 'slate'}
          />
          <StatDark
            label="Critical"
            value={criticalTickets.length}
            sub="Requires immediate attention"
            icon={AlertTriangle}
            accent={criticalTickets.length > 0 ? 'red' : 'slate'}
          />
          <StatDark
            label="Overdue"
            value={overdueTickets.length}
            sub="Past due date"
            icon={Clock}
            accent={overdueTickets.length > 0 ? 'red' : 'slate'}
          />
          <StatDark
            label="Resolved Today"
            value={resolvedToday.length}
            sub={
              resolvedToday.length > 0
                ? `${resolvedToday.length} resolved`
                : 'No resolutions today'
            }
            icon={CheckCircle2}
            accent={resolvedToday.length > 0 ? 'emerald' : 'slate'}
          />
        </div>

        {/* Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Tabs */}
          <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const params = new URLSearchParams();
              if (tab.key !== 'all') params.set('tab', tab.key);
              if (search) params.set('q', search);
              const qs = params.toString();
              const href = `/platform/support${qs ? `?${qs}` : ''}`;
              return (
                <a
                  key={tab.key}
                  href={href}
                  className={`relative rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/[0.08] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 text-xs ${
                      isActive ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Search */}
          <form className="flex-1 sm:max-w-sm" method="GET" action="/platform/support">
            {activeTab !== 'all' && (
              <input type="hidden" name="tab" value={activeTab} />
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                name="q"
                placeholder="Search by title or description..."
                defaultValue={search}
                className="border-gray-700 bg-gray-900 pl-10 text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </form>

          {search && (
            <a
              href={`/platform/support${activeTab !== 'all' ? `?tab=${activeTab}` : ''}`}
              className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              Clear search
            </a>
          )}
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-gray-800 bg-gray-900 shadow-none">
          <CardBody className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Ticket className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">
                  {search || activeTab !== 'all'
                    ? 'No tickets match your current filters.'
                    : 'No support tickets found.'}
                </p>
                {(search || activeTab !== 'all') && (
                  <a
                    href="/platform/support"
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Clear all filters
                  </a>
                )}
              </div>
            ) : (
              <Table className="border-0">
                <THead
                  className="text-xs uppercase tracking-wider text-slate-400"
                  style={{ backgroundColor: '#141720' }}
                >
                  <TR className="border-gray-800">
                    <TH className="w-20">ID</TH>
                    <TH>Title</TH>
                    <TH>Company</TH>
                    <TH>Category</TH>
                    <TH>Priority</TH>
                    <TH>Status</TH>
                    <TH>Assigned To</TH>
                    <TH>Due Date</TH>
                    <TH>Updated</TH>
                    <TH>Created</TH>
                  </TR>
                </THead>
                <tbody>
                  {filtered.map((ticket) => (
                    <TicketRowClient
                      key={ticket.id}
                      ticket={ticket}
                      companyName={
                        portfolioById.get(String(ticket.companyId)) ?? '—'
                      }
                      assignedToName={
                        ticket.assignedToId
                          ? profileById.get(String(ticket.assignedToId)) ?? null
                          : null
                      }
                      comments={commentsByTicket.get(ticket.id) ?? []}
                      addInternalNote={addInternalNote}
                      markTicketResolved={markTicketResolved}
                    />
                  ))}
                </tbody>
              </Table>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3 text-xs text-slate-500">
                <span>
                  Showing {filtered.length} of {allTickets.length} ticket
                  {allTickets.length !== 1 ? 's' : ''}
                  {(search || activeTab !== 'all') && ' (filtered)'}
                </span>
                {allTickets.length >= 500 && (
                  <span className="text-slate-600">Limited to 500 results</span>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { PenLine, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { buttonClass } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { RequestStatus, SUBJECT_LABEL } from './status';

export const dynamic = 'force-dynamic';

const LIST_LIMIT = 500;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Awaiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'voided', label: 'Voided' },
];

export default async function SignaturesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.value === sp.status) ? sp.status! : 'all';
  const db = (await createClient()) as any;
  // The filter runs in the query and the tiles are counted in the database,
  // so neither is limited to the newest LIST_LIMIT requests.
  let listQuery = db
    .from('signature_requests')
    .select('id, title, subject_type, status, expires_at, sent_at, completed_at, associations(name), signature_signers(status)', { count: 'exact' });
  if (filter !== 'all') listQuery = listQuery.eq('status', filter);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const head = () => db.from('signature_requests').select('id', { count: 'exact', head: true });
  const [list, awaiting, done30, declined] = await Promise.all([
    listQuery.order('sent_at', { ascending: false }).order('id', { ascending: false }).limit(LIST_LIMIT),
    head().eq('status', 'sent'),
    head().eq('status', 'completed').gt('completed_at', since30),
    head().eq('status', 'declined'),
  ]);
  const rows = (list.data ?? []) as any[];
  const total = list.count ?? rows.length;
  const loadError = [list, awaiting, done30, declined].find((r) => r.error)?.error;

  return (
    <DataWorkspace
      title="E-signatures"
      description="Board resolutions, architectural decisions, and agreements signed electronically with a tamper-evident audit trail."
      actions={<Link href="/signatures/new" className={buttonClass()}><Plus className="h-4 w-4" /> Request signatures</Link>}
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Awaiting signatures', value: awaiting.count ?? 0 },
          { label: 'Completed (30 days)', value: done30.count ?? 0 },
          { label: 'Declined', value: declined.count ?? 0 },
        ]} />
        {loadError && <Alert tone="danger" title="Could not load signature requests.">{loadError.message ?? String(loadError)}</Alert>}
        <nav className="flex flex-wrap gap-1" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Link key={f.value} href={f.value === 'all' ? '/signatures' : `/signatures?status=${f.value}`}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        {total > rows.length && (
          <p className="text-[13px] text-gray-500">Showing the newest {rows.length.toLocaleString()} of {total.toLocaleString()} requests.{filter === 'all' ? ' Filter by status to find older ones.' : ''}</p>
        )}
        {rows.length ? (
          <Table>
            <THead>
              <TR><TH>Title</TH><TH>Type</TH><TH>Association</TH><TH>Signed</TH><TH>Status</TH><TH>Sent</TH></TR>
            </THead>
            <tbody>
              {rows.map((r) => {
                const signers = (r.signature_signers ?? []) as { status: string }[];
                return (
                  <TR key={r.id}>
                    <TD className="font-medium text-gray-900"><Link href={`/signatures/${r.id}`} className="hover:text-gray-600">{r.title}</Link></TD>
                    <TD className="text-sm text-gray-600">{SUBJECT_LABEL[r.subject_type] ?? 'Document'}</TD>
                    <TD className="text-sm text-gray-600">{r.associations?.name ?? '—'}</TD>
                    <TD className="tabular-nums text-sm text-gray-700">{signers.filter((x) => x.status === 'signed').length} / {signers.length}</TD>
                    <TD><RequestStatus status={r.status} expiresAt={r.expires_at} /></TD>
                    <TD className="text-sm text-gray-600">{date(r.sent_at)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState icon={PenLine} title="No signature requests yet" description="Send a board resolution, architectural decision, or agreement for electronic signature."
              action={<Link href="/signatures/new" className={buttonClass()}><Plus className="h-4 w-4" /> Request signatures</Link>} />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

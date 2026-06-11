import Link from 'next/link';
import { FileText } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type DocTab = 'templates' | 'generated' | 'notices';

const DOC_TABS: Array<{ key: DocTab; label: string }> = [
  { key: 'templates', label: 'Templates' },
  { key: 'generated', label: 'Generated Documents' },
  { key: 'notices', label: 'Notices' },
];

function parseTab(value: string | undefined): DocTab {
  switch (value) {
    case 'templates':
    case 'generated':
    case 'notices':
      return value;
    default:
      return 'templates';
  }
}

function noticeStatusDisplay(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'draft': return { label: 'Draft', tone: 'neutral' };
    case 'sent': return { label: 'Sent', tone: 'info' };
    case 'delivered': return { label: 'Delivered', tone: 'success' };
    case 'failed': return { label: 'Failed', tone: 'danger' };
    default: return { label: status, tone: 'neutral' };
  }
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; type?: string }>;
}) {
  await requireStaff();
  const { tab: tabParam, q = '', type = '' } = await searchParams;
  const tab = parseTab(tabParam);

  const supabase = await createClient();
  const db = supabase as any;

  // Fetch all data in parallel
  const [
    { data: templates },
    { data: documents },
    { data: notices },
    { data: associations },
  ] = await Promise.all([
    db.from('document_templates')
      .select('id, name, letter_type, template_category, subject, active, created_at, updated_at')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(500),
    db.from('documents')
      .select('id, doc_type, entity_type, entity_id, file_name, uploaded_at, expires_at')
      .order('uploaded_at', { ascending: false })
      .limit(500),
    db.from('notices')
      .select('id, association_id, notice_type, status, subject, channel, sent_at, created_at, template_id, associations(name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
  ]);

  const allTemplates = (templates ?? []) as any[];
  const allDocuments = (documents ?? []) as any[];
  const allNotices = (notices ?? []) as any[];

  // Filter by search query
  let filteredTemplates = allTemplates;
  let filteredDocuments = allDocuments;
  let filteredNotices = allNotices;

  if (q) {
    const ql = q.toLowerCase();
    filteredTemplates = filteredTemplates.filter((t: any) =>
      (t.name ?? '').toLowerCase().includes(ql) ||
      (t.letter_type ?? '').toLowerCase().includes(ql) ||
      (t.subject ?? '').toLowerCase().includes(ql)
    );
    filteredDocuments = filteredDocuments.filter((d: any) =>
      (d.file_name ?? '').toLowerCase().includes(ql) ||
      (d.doc_type ?? '').toLowerCase().includes(ql)
    );
    filteredNotices = filteredNotices.filter((n: any) =>
      (n.subject ?? '').toLowerCase().includes(ql) ||
      (n.notice_type ?? '').toLowerCase().includes(ql) ||
      (n.associations?.name ?? '').toLowerCase().includes(ql)
    );
  }

  if (type) {
    filteredTemplates = filteredTemplates.filter((t: any) => t.letter_type === type);
    filteredNotices = filteredNotices.filter((n: any) => n.notice_type === type);
  }

  // Metrics
  const activeTemplates = allTemplates.filter((t: any) => t.active).length;
  const totalDocs = allDocuments.length;
  const noticesThisMonth = allNotices.filter((n: any) => {
    if (!n.sent_at) return false;
    const d = new Date(n.sent_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const metrics: Metric[] = [
    { label: 'Active Templates', value: activeTemplates, sublabel: `${allTemplates.length} total` },
    { label: 'Documents', value: totalDocs, sublabel: 'Generated & uploaded' },
    { label: 'Notices This Month', value: noticesThisMonth, sublabel: 'Sent & delivered' },
  ];

  return (
    <DataWorkspace
      title="Documents"
      description="Create, manage, and send violation notices, welcome letters, assessment letters, and board packets."
      actions={
        <>
          <Link href="/documents/generate">
            <Button>Generate document</Button>
          </Link>
          <Link href="/documents/templates/new">
            <Button variant="secondary">New template</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {DOC_TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (q) params.set('q', q);
            return (
              <Link
                key={t.key}
                href={`/documents?${params.toString()}`}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-gray-950 text-gray-950'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <FilterBar
          action="/documents"
          searchDefault={q}
          searchPlaceholder="Search documents, templates, notices..."
        >
          <FilterSelect label="Type" name="type" defaultValue={type}>
            <option value="">All</option>
            <option value="violation_notice">Violation Notice</option>
            <option value="welcome_letter">Welcome Letter</option>
            <option value="assessment_letter">Assessment Letter</option>
            <option value="board_packet">Board Packet</option>
            <option value="general">General</option>
          </FilterSelect>
        </FilterBar>

        {/* ── TAB: TEMPLATES ── */}
        {tab === 'templates' && (
          <>
            {filteredTemplates.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Type</TH>
                    <TH>Category</TH>
                    <TH>Subject</TH>
                    <TH>Status</TH>
                    <TH>Updated</TH>
                    <TH className="w-10"></TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredTemplates.map((t: any) => (
                    <TR key={t.id}>
                      <TD className="font-medium">
                        <Link href={`/documents/templates/${t.id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                          {t.name}
                        </Link>
                      </TD>
                      <TD className="text-sm capitalize text-gray-600">
                        {(t.letter_type ?? 'general').replace(/_/g, ' ')}
                      </TD>
                      <TD className="text-sm text-gray-600">{t.template_category ?? '—'}</TD>
                      <TD className="max-w-xs truncate text-sm text-gray-700">{t.subject ?? '—'}</TD>
                      <TD>
                        <StatusChip tone={t.active ? 'success' : 'neutral'}>
                          {t.active ? 'Active' : 'Inactive'}
                        </StatusChip>
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(t.updated_at)}</TD>
                      <TD>
                        <Link
                          href={`/documents/generate?template=${t.id}`}
                          className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-950"
                        >
                          Use →
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No document templates found"
                  description="Templates will appear here once created."
                  action={
                    <Link href="/documents/templates/new">
                      <Button>Create your first template</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </>
        )}

        {/* ── TAB: GENERATED DOCUMENTS ── */}
        {tab === 'generated' && (
          <>
            {filteredDocuments.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>File Name</TH>
                    <TH>Type</TH>
                    <TH>Entity</TH>
                    <TH>Uploaded</TH>
                    <TH>Expires</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredDocuments.map((d: any) => (
                    <TR key={d.id}>
                      <TD className="font-medium max-w-xs truncate">
                        <span className="text-gray-900">{d.file_name}</span>
                      </TD>
                      <TD className="text-sm capitalize text-gray-600">
                        {(d.doc_type ?? 'document').replace(/_/g, ' ')}
                      </TD>
                      <TD className="text-sm text-gray-600 capitalize">{d.entity_type ?? '—'}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(d.uploaded_at)}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">
                        {d.expires_at ? date(d.expires_at) : 'Never'}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No generated documents yet"
                  description="Generated documents will appear here once created from templates."
                  action={
                    <Link href="/documents/generate">
                      <Button>Generate a document</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </>
        )}

        {/* ── TAB: NOTICES ── */}
        {tab === 'notices' && (
          <>
            {filteredNotices.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Subject</TH>
                    <TH>Type</TH>
                    <TH>Association</TH>
                    <TH>Channel</TH>
                    <TH>Status</TH>
                    <TH>Sent</TH>
                    <TH>Created</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredNotices.map((n: any) => {
                    const sd = noticeStatusDisplay(n.status);
                    return (
                      <TR key={n.id}>
                        <TD className="font-medium max-w-xs truncate">
                          <Link href={`/documents/notices/${n.id}`} className="text-gray-900 hover:text-gray-950 hover:underline">
                            {n.subject}
                          </Link>
                        </TD>
                        <TD className="text-sm capitalize text-gray-600">
                          {(n.notice_type ?? 'general').replace(/_/g, ' ')}
                        </TD>
                        <TD className="text-sm text-gray-700">{n.associations?.name ?? '—'}</TD>
                        <TD className="text-sm capitalize text-gray-600">{n.channel ?? '—'}</TD>
                        <TD>
                          <StatusChip tone={sd.tone}>{sd.label}</StatusChip>
                        </TD>
                        <TD className="whitespace-nowrap text-sm text-gray-600">{date(n.sent_at)}</TD>
                        <TD className="whitespace-nowrap text-sm text-gray-600">{date(n.created_at)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No notices have been sent yet"
                  description="Notices will appear here once generated and sent."
                  action={
                    <Link href="/documents/generate">
                      <Button>Generate a notice</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { FilterBar } from '@/components/operations/filter-bar';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
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
        <div className="flex gap-2">
          <Link href="/documents/generate">
            <Button>Generate Document</Button>
          </Link>
          <Link href="/documents/templates/new">
            <Button variant="secondary">New Template</Button>
          </Link>
        </div>
      }
      rail={<DocumentsRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex flex-wrap gap-1 border-b border-gray-200">
          {DOC_TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (q) params.set('q', q);
            return (
              <Link
                key={t.key}
                href={`/documents?${params.toString()}`}
                className={`border-b-2 px-4 py-2 text-sm transition ${
                  active
                    ? 'border-brand-600 font-medium text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
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
          <label className="text-xs font-medium uppercase text-gray-500">
            Type
            <select
              name="type"
              defaultValue={type}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"
            >
              <option value="">All</option>
              <option value="violation_notice">Violation Notice</option>
              <option value="welcome_letter">Welcome Letter</option>
              <option value="assessment_letter">Assessment Letter</option>
              <option value="board_packet">Board Packet</option>
              <option value="general">General</option>
            </select>
          </label>
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
                        <Link href={`/documents/templates/${t.id}`} className="text-blue-700 hover:underline">
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
                          className="text-xs font-medium text-brand-600 hover:text-brand-800"
                        >
                          Use
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No document templates found. Templates will appear here once created.{' '}
                <Link href="/documents/templates/new" className="text-blue-700 hover:underline">
                  Create your first template
                </Link>
                .
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
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No generated documents yet. Generated documents will appear here once created from templates.{' '}
                <Link href="/documents/generate" className="text-blue-700 hover:underline">
                  Generate a document
                </Link>
                .
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
                          <Link href={`/documents/notices/${n.id}`} className="text-blue-700 hover:underline">
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
              <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                No notices have been sent yet. Notices will appear here once generated and sent.{' '}
                <Link href="/documents/generate" className="text-blue-700 hover:underline">
                  Generate a notice
                </Link>
                .
              </div>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── Right Rail: Task Panel ──

function DocumentsRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/documents/generate" label="Generate Document" />
          <RailLink href="/documents/templates/new" label="New Template" />
          <RailLink href="/documents/generate?type=violation_notice" label="Violation Notice" />
          <RailLink href="/documents/generate?type=welcome_letter" label="Welcome Letter" />
          <RailLink href="/documents/generate?type=assessment_letter" label="Assessment Letter" />
          <RailLink href="/documents/generate?type=board_packet" label="Board Packet" />
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Quick Links</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/documents?tab=templates" label="All Templates" />
          <RailLink href="/documents?tab=generated" label="Generated Documents" />
          <RailLink href="/documents?tab=notices" label="Notices History" />
          <RailLink href="/violations" label="Violations" />
          <RailLink href="/owners" label="Owners" />
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Document Types</h2>
        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400"></span>
            Violation Notice
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            Welcome Letter
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            Assessment Letter
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            Board Packet
          </div>
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { findMisplacedAssociationDocuments } from '@/lib/documents/misplaced';
import { repairMisplacedAssociationDocuments } from '@/lib/rpcs/document-repair';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { isEntityDocumentStoragePath } from '@/lib/security/storage-paths';
import { noticeTypeForLetterType } from '@/lib/documents/notice-type';
import { descNullsLast, unionSearch } from '@/lib/supabase/search-union';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

type DocTab = 'templates' | 'generated' | 'notices';

const LIST_LIMIT = 500;
const NOTICE_TYPES = ['general', 'violation', 'meeting', 'payment_reminder', 'maintenance_update', 'annual_meeting', 'board_packet', 'emergency', 'other'];

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
  searchParams: Promise<{ tab?: string; q?: string; type?: string; repaired?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const { tab: tabParam, q = '', type = '', repaired, error: pageError } = await searchParams;
  // Files stored outside associations/<id>/ are hidden by RLS; offer a fix.
  const misplaced = me.portfolio?.id ? await findMisplacedAssociationDocuments(me.portfolio.id) : [];
  const tab = parseTab(tabParam);

  const supabase = await createClient();
  const db = supabase as any;

  // Filters run in the query, counts in the database: the lists show the
  // newest LIST_LIMIT matches and say so when there are more.
  const term = q.replace(/[%_,()*"\\]/g, ' ').trim();
  const noticeType = type ? noticeTypeForLetterType(type) : '';
  const zone = displayTimeZone();
  const today = todayInZone(zone);
  const monthStart = zonedWallTimeToUtc(`${today.slice(0, 8)}01`, '00:00', zone)?.toISOString() ?? `${today.slice(0, 8)}01T00:00:00Z`;

  const templatesQuery = () => {
    let query = db.from('document_templates')
      .select('id, name, letter_type, template_category, subject, active, created_at, updated_at', { count: 'exact' })
      .is('archived_at', null);
    if (type) query = query.eq('letter_type', type);
    if (term) query = query.or(`name.ilike.%${term}%,letter_type.ilike.%${term}%,subject.ilike.%${term}%`);
    return query.order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(LIST_LIMIT);
  };
  const documentsQuery = () => {
    let query = db.from('documents')
      .select('id, doc_type, entity_type, entity_id, file_name, file_url, uploaded_at, expires_at', { count: 'exact' });
    if (term) query = query.or(`file_name.ilike.%${term}%,doc_type.ilike.%${term}%`);
    return query.order('uploaded_at', { ascending: false }).order('id', { ascending: false }).limit(LIST_LIMIT);
  };
  const noticeColumns = 'id, association_id, notice_type, status, subject, channel, sent_at, created_at, template_id, associations(name)';
  const noticesBase = (extra = '', count = false) => {
    let query = db.from('notices').select(noticeColumns + extra, count ? { count: 'exact' } : undefined).is('archived_at', null);
    if (noticeType) query = query.eq('notice_type', noticeType);
    return query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(LIST_LIMIT);
  };
  // Search: subject, association name or type, each its own query (see unionSearch).
  const noticesQuery = (): PromiseLike<{ data: any[] | null; error: any; count: number | null }> => {
    if (!term) return noticesBase('', true);
    const typeMatches = NOTICE_TYPES.filter((t) => t.replace(/_/g, ' ').includes(term.toLowerCase()));
    return unionSearch<any>([
      noticesBase().ilike('subject', `%${term}%`),
      noticesBase(', s_a:associations!inner(name)').ilike('s_a.name', `%${term}%`),
      ...(typeMatches.length ? [noticesBase().in('notice_type', typeMatches)] : []),
    ], (a, b) => descNullsLast(a.created_at, b.created_at), LIST_LIMIT)
      .then(({ rows, error }) => ({ data: rows, error: error ? { message: error } : null, count: null }));
  };
  const empty = Promise.resolve({ data: [] as any[], error: null, count: 0 });
  const head = (table: string) => db.from(table).select('id', { count: 'exact', head: true });

  const [templatesRes, documentsRes, noticesRes, activeTemplates, templateTotal, documentTotal, noticesThisMonth] = await Promise.all([
    tab === 'templates' ? templatesQuery() : empty,
    tab === 'generated' ? documentsQuery() : empty,
    tab === 'notices' ? noticesQuery() : empty,
    head('document_templates').is('archived_at', null).eq('active', true),
    head('document_templates').is('archived_at', null),
    head('documents'),
    head('notices').is('archived_at', null).gte('sent_at', monthStart),
  ]);

  // A failed read must not look like an empty library.
  const loadErrors = [
    templatesRes.error && `templates (${templatesRes.error.message})`,
    documentsRes.error && `documents (${documentsRes.error.message})`,
    noticesRes.error && `notices (${noticesRes.error.message})`,
    (activeTemplates.error || templateTotal.error || documentTotal.error || noticesThisMonth.error) && 'counts',
  ].filter(Boolean) as string[];
  const filteredTemplates = (templatesRes.data ?? []) as any[];
  const filteredDocuments = (documentsRes.data ?? []) as any[];
  const filteredNotices = (noticesRes.data ?? []) as any[];
  const shown = tab === 'templates' ? filteredTemplates.length : tab === 'generated' ? filteredDocuments.length : filteredNotices.length;
  const matching = tab === 'templates' ? templatesRes.count : tab === 'generated' ? documentsRes.count : noticesRes.count;
  const capNotice = matching != null
    ? (matching > shown ? `Showing the newest ${shown.toLocaleString()} of ${matching.toLocaleString()}. Search or filter to find older ones.` : null)
    : (shown >= LIST_LIMIT ? `Showing the newest ${LIST_LIMIT.toLocaleString()} matches. Narrow the search to see older ones.` : null);

  const documentLinks = new Map<string, string>();
  const storedDocuments = filteredDocuments.filter((document: any) =>
    isEntityDocumentStoragePath(document.file_url, document.entity_type, document.entity_id));
  if (storedDocuments.length) {
    const service = createServiceClient() as any;
    const { data: signed } = await service.storage.from('association-documents')
      .createSignedUrls(storedDocuments.map((document: any) => document.file_url), 3600);
    const signedByPath = new Map((signed ?? []).filter((item: any) => item.path && item.signedUrl)
      .map((item: any) => [item.path, item.signedUrl]));
    storedDocuments.forEach((document: any) => {
      const url = signedByPath.get(document.file_url);
      if (typeof url === 'string') documentLinks.set(document.id, url);
    });
  }

  const metrics: Metric[] = [
    { label: 'Active Templates', value: activeTemplates.count ?? 0, sublabel: `${(templateTotal.count ?? 0).toLocaleString()} total` },
    { label: 'Documents', value: documentTotal.count ?? 0, sublabel: 'Generated & uploaded' },
    { label: 'Notices This Month', value: noticesThisMonth.count ?? 0, sublabel: 'Sent & delivered' },
  ];

  return (
    <DataWorkspace
      title="Documents"
      description="Create, manage, and send violation notices, welcome letters, assessment letters, and board packets."
      actions={
        <>
          <Link href="/documents/generate" className={buttonClass()}>Generate document</Link>
          <Link href="/documents/templates/new" className={buttonClass('secondary')}>New template</Link>
        </>
      }
    >
      <div className="space-y-6">
        {loadErrors.length > 0 && <Alert tone="danger" title="Some documents could not be loaded.">Could not load {loadErrors.join(', ')}. Reload the page to try again.</Alert>}
        {pageError && <Alert tone="danger" title="Some files were not fixed.">{pageError}</Alert>}
        {repaired && !pageError && <Alert tone="success" title="File locations fixed.">{repaired} document{repaired === '1' ? ' is' : 's are'} visible again.</Alert>}
        {misplaced.length > 0 && (
          <Alert tone="warning" title={`${misplaced.length} document${misplaced.length === 1 ? ' is' : 's are'} hidden by a storage problem.`}>
            <span className="block">
              {misplaced.map((d) => d.file_name ?? d.file_url).join(', ')} {misplaced.length === 1 ? 'is' : 'are'} stored outside the association&apos;s folder, so staff and owners can&apos;t open {misplaced.length === 1 ? 'it' : 'them'}.
            </span>
            <form action={repairMisplacedAssociationDocuments} className="mt-2">
              <Button type="submit" size="sm">Fix file locations</Button>
            </form>
          </Alert>
        )}
        <MetricStrip metrics={metrics} />

        {/* ── TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {DOC_TABS.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set('tab', t.key);
            if (q) params.set('q', q);
            if (type) params.set('type', type);
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
          <input type="hidden" name="tab" value={tab} />
          {/* Uploaded documents have no letter type: the Type filter is for templates and notices. */}
          {tab !== 'generated' && (
            <FilterSelect label="Type" name="type" defaultValue={type}>
              <option value="">All</option>
              <option value="violation_notice">Violation Notice</option>
              <option value="welcome_letter">Welcome Letter</option>
              <option value="assessment_letter">Assessment Letter</option>
              <option value="board_packet">Board Packet</option>
              <option value="general">General</option>
            </FilterSelect>
          )}
        </FilterBar>

        {capNotice && <p className="text-[13px] text-gray-500">{capNotice}</p>}

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
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No document templates found"
                  description="Templates will appear here once created."
                  action={
                    <Link href="/documents/templates/new" className={buttonClass()}>Create your first template</Link>
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
                        {documentLinks.has(d.id) ? (
                          <a href={documentLinks.get(d.id)} target="_blank" rel="noreferrer" className="text-gray-900 hover:underline">
                            {d.file_name}
                          </a>
                        ) : (
                          <span className="text-gray-500">{d.file_name} (file unavailable)</span>
                        )}
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
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No generated documents yet"
                  description="Generated documents will appear here once created from templates."
                  action={
                    <Link href="/documents/generate" className={buttonClass()}>Generate a document</Link>
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
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={FileText}
                  title="No notices have been sent yet"
                  description="Notices will appear here once generated and sent."
                  action={
                    <Link href="/documents/generate" className={buttonClass()}>Generate a notice</Link>
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

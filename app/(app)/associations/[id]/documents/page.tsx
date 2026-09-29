import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, FolderOpen, ShieldCheck } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { OPERATING_DOCS, OPERATING_TYPES } from '@/lib/associations/operating-docs';
import { DEFAULT_FOLDERS, SHARE_LABEL, SHARE_SCOPES, SHARE_TONE, orderedFolders, type ShareScope } from '@/lib/associations/document-sharing';
import { deleteAssociationDocument, updateAssociationDocument, uploadAssociationDocument } from '@/lib/rpcs/association-documents';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, Badge, EmptyState } from '@/components/ui/shell';
import { date } from '@/lib/utils';
import { isScopedStoragePath } from '@/lib/security/storage-paths';

export const dynamic = 'force-dynamic';

const BUCKET = 'association-documents';
const UNFILED = '__unfiled__';
const fileInput =
  'block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-3.5 file:py-1.5 file:text-[13px] file:font-medium file:text-white hover:file:bg-gray-800';

export default async function AssociationDocumentsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; folder?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const ref = association.slug ?? id;
  const sp = await searchParams;

  const db = (await createClient()) as any;
  const { data: assoc } = await db.from('associations').select('id, name').eq('id', id).maybeSingle();
  if (!assoc) notFound();

  const { data: docsData, error: docsError } = await db
    .from('documents')
    .select('id, doc_type, file_name, file_url, uploaded_at, folder, share_scope, description')
    .eq('entity_type', 'association')
    .eq('entity_id', id)
    .order('uploaded_at', { ascending: false });
  const docs = (docsData ?? []) as any[];

  const latestByType = new Map<string, any>();
  for (const d of docs) if (OPERATING_TYPES.includes(d.doc_type) && !latestByType.has(d.doc_type)) latestByType.set(d.doc_type, d);
  const requiredOnFile = OPERATING_DOCS.filter((o) => o.required && latestByType.has(o.type)).length;
  const requiredTotal = OPERATING_DOCS.filter((o) => o.required).length;

  const folders = orderedFolders(docs.map((d) => d.folder));
  const unfiledCount = docs.filter((d) => !d.folder).length;
  const active = sp.folder && (sp.folder === UNFILED || folders.includes(sp.folder)) ? sp.folder : null;
  const shown = active ? docs.filter((d) => (active === UNFILED ? !d.folder : d.folder === active)) : docs;
  const folderOptions = [...new Set([...DEFAULT_FOLDERS, ...folders])];
  const sharedWithOwners = docs.filter((d) => d.share_scope === 'owners').length;

  // Signed viewing links (private bucket; some legacy rows hold full URLs).
  const links = new Map<string, string>();
  const toSign: { id: string; path: string }[] = [];
  for (const d of docs) {
    const url = (d.file_url ?? '').trim();
    if (/^https?:\/\//i.test(url)) links.set(d.id, url);
    else if (isScopedStoragePath(url, 'associations', id)) toSign.push({ id: d.id, path: url });
  }
  if (toSign.length) {
    try {
      const svc = createServiceClient() as any;
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(toSign.map((p) => p.path), 3600);
      const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.path && x?.signedUrl).map((x: any) => [x.path, x.signedUrl]));
      for (const p of toSign) { const u = byPath.get(p.path); if (u) links.set(p.id, u); }
    } catch {}
  }

  const hidden = (folder?: string | null) => (
    <>
      <input type="hidden" name="association_id" value={id} />
      <input type="hidden" name="association_ref" value={ref} />
      {folder ? <input type="hidden" name="return_folder" value={folder} /> : null}
    </>
  );
  const folderHref = (f: string | null) => `/associations/${ref}/documents${f ? `?folder=${encodeURIComponent(f)}` : ''}`;
  const chip = (label: string, count: number, f: string | null) => (
    <Link
      key={label}
      href={folderHref(f)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${
        active === f ? 'bg-gray-950 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}<span className={active === f ? 'text-gray-300' : 'text-gray-400'}>{count}</span>
    </Link>
  );

  return (
    <Workspace header={<WorkspaceHeader title={assoc.name} subtitle="Association documents — organized in folders, shared only when you choose" />}>
      <AssociationTabs associationId={assocParam} active="documents" />
      <datalist id="doc-folders">{folderOptions.map((f) => <option key={f} value={f} />)}</datalist>

      <div className="space-y-5">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && sp.saved !== '1' && <Alert tone="success">{sp.saved}</Alert>}
        {docsError && <Alert tone="danger">Documents could not be loaded: {docsError.message}</Alert>}

        <Section
          title="Operating documents"
          padded
          actions={<StatusChip tone={requiredOnFile === requiredTotal ? 'success' : 'warning'}>{requiredOnFile} of {requiredTotal} required on file</StatusChip>}
        >
          <p className="mb-4 text-sm text-gray-500">
            Every association needs these on file. They are shared with the board and owners by default; change that per file below.
          </p>
          <ul className="divide-y divide-gray-100">
            {OPERATING_DOCS.map((o) => {
              const doc = latestByType.get(o.type);
              return (
                <li key={o.type} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <ShieldCheck className={`h-5 w-5 flex-shrink-0 ${doc ? 'text-emerald-600' : o.required ? 'text-amber-500' : 'text-gray-300'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {o.label}
                        {!o.required && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
                      </div>
                      {doc ? (
                        <div className="truncate text-xs text-gray-500">
                          {links.has(doc.id) ? (
                            <a href={links.get(doc.id)} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-600 hover:text-gray-950 hover:underline">{doc.file_name}</a>
                          ) : doc.file_name}
                          {doc.uploaded_at ? ` · ${date(doc.uploaded_at)}` : ''} · {SHARE_LABEL[(doc.share_scope ?? 'owners') as ShareScope]}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">{o.required ? 'Missing — required for every association' : 'Not on file'}</div>
                      )}
                    </div>
                  </div>
                  <form action={uploadAssociationDocument} className="flex flex-wrap items-center gap-2">
                    {hidden(active)}
                    <input type="hidden" name="doc_type" value={o.type} />
                    <input type="hidden" name="share_scope" value="owners" />
                    <input type="file" name="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" aria-label={`File for ${o.label}`} className={`${fileInput} max-w-64`} />
                    <Button type="submit" size="sm" variant="secondary">{doc ? 'Replace' : 'Upload'}</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          title="All documents"
          subtitle={`${docs.length} file${docs.length === 1 ? '' : 's'} · ${sharedWithOwners} shared with owners`}
        >
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">
            {chip('All', docs.length, null)}
            {folders.map((f) => chip(f, docs.filter((d) => d.folder === f).length, f))}
            {unfiledCount > 0 && chip('Unfiled', unfiledCount, UNFILED)}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={FolderOpen} title={active ? 'This folder is empty' : 'No documents yet'} description="Upload a file below." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {shown.map((d) => {
                const scope = (d.share_scope ?? 'owners') as ShareScope;
                return (
                  <li key={d.id} className="px-5 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          {links.has(d.id) ? (
                            <a href={links.get(d.id)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-900 hover:underline">{d.file_name}</a>
                          ) : (
                            <span className="block truncate text-sm font-medium text-gray-900">{d.file_name}</span>
                          )}
                          <div className="text-xs text-gray-500">
                            {d.folder ?? 'Unfiled'} · {(d.doc_type ?? 'document').replace(/_/g, ' ')}{d.uploaded_at ? ` · ${date(d.uploaded_at)}` : ''}
                          </div>
                          {d.description && <div className="mt-0.5 text-xs text-gray-600">{d.description}</div>}
                        </div>
                      </div>
                      <Badge tone={SHARE_TONE[scope]}>{SHARE_LABEL[scope]}</Badge>
                    </div>
                    <details className="mt-2 pl-6">
                      <summary className="cursor-pointer text-[12px] font-medium text-gray-500 hover:text-gray-900">Edit folder, sharing or delete</summary>
                      <form action={updateAssociationDocument} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {hidden(active)}
                        <input type="hidden" name="document_id" value={d.id} />
                        <Field label="Folder" htmlFor={`folder-${d.id}`}>
                          <Input id={`folder-${d.id}`} name="folder" list="doc-folders" defaultValue={d.folder ?? ''} maxLength={60} />
                        </Field>
                        <Field label="Who can see it" htmlFor={`scope-${d.id}`}>
                          <Select id={`scope-${d.id}`} name="share_scope" defaultValue={scope}>
                            {SHARE_SCOPES.map((v) => <option key={v} value={v}>{SHARE_LABEL[v]}</option>)}
                          </Select>
                        </Field>
                        <Field label="Description" htmlFor={`desc-${d.id}`}>
                          <Input id={`desc-${d.id}`} name="description" defaultValue={d.description ?? ''} maxLength={500} />
                        </Field>
                        <div className="sm:col-span-3"><Button type="submit" size="sm" variant="secondary">Save</Button></div>
                      </form>
                      <form action={deleteAssociationDocument} className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                        {hidden(active)}
                        <input type="hidden" name="document_id" value={d.id} />
                        <label className="flex min-h-10 items-center gap-2 text-[13px] text-gray-600">
                          <input type="checkbox" name="confirm" className="h-4 w-4 rounded border-gray-300" /> Permanently delete this file
                        </label>
                        <Button type="submit" size="sm" variant="danger">Delete</Button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={uploadAssociationDocument} className="grid grid-cols-1 gap-3 border-t border-gray-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            {hidden(active)}
            <input type="hidden" name="doc_type" value="association_document" />
            <Field label="File (max 10 MB)" htmlFor="upload-file" className="sm:col-span-2 lg:col-span-1">
              <input id="upload-file" type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.heic" className={fileInput} />
            </Field>
            <Field label="Folder" htmlFor="upload-folder">
              <Input id="upload-folder" name="folder" list="doc-folders" maxLength={60} defaultValue={active && active !== UNFILED ? active : ''} placeholder="e.g. Contracts" />
            </Field>
            <Field label="Who can see it" htmlFor="upload-scope" hint="Files stay private until you share them.">
              <Select id="upload-scope" name="share_scope" defaultValue="staff">
                {SHARE_SCOPES.map((v) => <option key={v} value={v}>{SHARE_LABEL[v]}</option>)}
              </Select>
            </Field>
            <Field label="Description (optional)" htmlFor="upload-desc">
              <Input id="upload-desc" name="description" maxLength={500} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Upload</Button></div>
          </form>
        </Section>

        <p className="text-xs text-gray-400">
          Letters generated for specific owners are saved here as management-only. Templates live in{' '}
          <Link href="/documents" className="font-medium text-gray-500 hover:text-gray-950 hover:underline">Documents</Link>.
        </p>
      </div>
    </Workspace>
  );
}

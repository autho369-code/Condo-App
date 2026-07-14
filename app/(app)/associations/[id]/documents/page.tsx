import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FileText, ShieldCheck, Upload } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { OPERATING_DOCS, OPERATING_TYPES } from '@/lib/associations/operating-docs';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BUCKET = 'association-documents';

export default async function AssociationDocumentsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const sp = await searchParams;
  const backSeg = association.slug ?? id;

  const supabase = await createClient();
  const { data: assoc } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (!assoc) notFound();

  const { data: docsData } = await (supabase as any)
    .from('documents')
    .select('id, doc_type, file_name, file_url, uploaded_at')
    .eq('entity_type', 'association')
    .eq('entity_id', id)
    .order('uploaded_at', { ascending: false });
  const docs = docsData ?? [];

  // Latest document per operating type + everything else
  const latestByType = new Map<string, any>();
  const otherDocs: any[] = [];
  for (const d of docs) {
    if (OPERATING_TYPES.includes(d.doc_type)) {
      if (!latestByType.has(d.doc_type)) latestByType.set(d.doc_type, d);
    } else {
      otherDocs.push(d);
    }
  }

  const requiredOnFile = OPERATING_DOCS.filter((o) => o.required && latestByType.has(o.type)).length;
  const requiredTotal = OPERATING_DOCS.filter((o) => o.required).length;

  // Signed viewing links (private bucket; some legacy rows hold full URLs)
  const linkByDocId = new Map<string, string>();
  const pathsToSign: { id: string; path: string }[] = [];
  for (const d of [...latestByType.values(), ...otherDocs]) {
    const url = (d.file_url ?? '').trim();
    if (!url) continue;
    if (/^https?:\/\//i.test(url)) linkByDocId.set(d.id, url);
    else pathsToSign.push({ id: d.id, path: url });
  }
  if (pathsToSign.length > 0) {
    try {
      const svc = createServiceClient() as any;
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(pathsToSign.map((p) => p.path), 3600);
      const byPath = new Map<string, string>();
      for (const s of signed ?? []) if (s?.path && s?.signedUrl) byPath.set(s.path, s.signedUrl);
      for (const p of pathsToSign) {
        const u = byPath.get(p.path);
        if (u) linkByDocId.set(p.id, u);
      }
    } catch {}
  }

  async function uploadDoc(formData: FormData) {
    'use server';
    const me = await (await import('@/lib/auth/me')).requireStaff();
    const back = `/associations/${backSeg}/documents`;
    const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);

    const docType = (formData.get('doc_type') as string) || 'other';
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) fail('Choose a file to upload.');
    if (file!.size > 10 * 1024 * 1024) fail('Each document must be under 10 MB — upload files one at a time.');

    const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `associations/${id}/operating/${docType}-${Date.now()}-${safeName}`;
    const svc = createServiceClient() as any;
    const { error: upErr } = await svc.storage.from(BUCKET).upload(path, file!, { contentType: file!.type || undefined });
    if (upErr) fail(`Upload failed: ${upErr.message}`);

    const supabase2 = await createClient();
    const { error } = await (supabase2 as any).from('documents').insert({
      entity_type: 'association',
      entity_id: id,
      doc_type: docType,
      file_name: file!.name,
      file_url: path,
      uploaded_at: new Date().toISOString(),
      uploaded_by: me.auth_user_id,
    });
    if (error) fail(error.message);

    revalidatePath(back);
    revalidatePath('/onboard');
    redirect(`${back}?saved=1`);
  }

  const fileInput =
    'block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-3.5 file:py-1.5 file:text-[13px] file:font-medium file:text-white hover:file:bg-gray-800';

  return (
    <Workspace header={<WorkspaceHeader title={assoc.name} subtitle="Operating documents and association records" />}>
      <AssociationTabs associationId={assocParam} active="documents" />

      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not upload:">{sp.error}</Alert>}
        {sp.saved === '1' && <Alert tone="success">Document saved to the association records.</Alert>}

        <Section
          title="Operating documents"
          padded
          actions={
            <StatusChip tone={requiredOnFile === requiredTotal ? 'success' : 'warning'}>
              {requiredOnFile} of {requiredTotal} required on file
            </StatusChip>
          }
        >
          <p className="mb-4 text-sm text-gray-500">
            Every client must have its operating documents on file. Owners and board members
            see these under Governing Documents in their portals. Upload one file at a time (max 10 MB).
          </p>
          <ul className="divide-y divide-gray-100">
            {OPERATING_DOCS.map((o) => {
              const doc = latestByType.get(o.type);
              return (
                <li key={o.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ShieldCheck className={`h-5 w-5 flex-shrink-0 ${doc ? 'text-emerald-600' : o.required ? 'text-amber-500' : 'text-gray-300'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {o.label}
                        {!o.required && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
                      </div>
                      {doc ? (
                        <div className="truncate text-xs text-gray-500">
                          {linkByDocId.has(doc.id) ? (
                            <a href={linkByDocId.get(doc.id)} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-600 hover:text-gray-950 hover:underline">
                              {doc.file_name}
                            </a>
                          ) : (
                            doc.file_name
                          )}
                          {doc.uploaded_at ? ` · ${date(doc.uploaded_at)}` : ''}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">{o.required ? 'Missing — required for every client' : 'Not on file'}</div>
                      )}
                    </div>
                  </div>
                  <form action={uploadDoc as any} className="flex items-center gap-2">
                    <input type="hidden" name="doc_type" value={o.type} />
                    <input type="file" name="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className={fileInput} />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-800 shadow-sm transition hover:bg-gray-50">
                      <Upload className="h-3.5 w-3.5 text-gray-400" /> {doc ? 'Replace' : 'Upload'}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Other documents on file" padded>
          {otherDocs.length === 0 ? (
            <p className="text-sm text-gray-400">No other association documents yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {otherDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      {linkByDocId.has(d.id) ? (
                        <a href={linkByDocId.get(d.id)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-800 hover:text-gray-950 hover:underline">
                          {d.file_name ?? d.doc_type}
                        </a>
                      ) : (
                        <span className="block truncate text-sm font-medium text-gray-800">{d.file_name ?? d.doc_type}</span>
                      )}
                      <div className="text-xs text-gray-400">
                        {(d.doc_type ?? 'document').replace(/_/g, ' ')}{d.uploaded_at ? ` · ${date(d.uploaded_at)}` : ''}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form action={uploadDoc as any} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <input type="hidden" name="doc_type" value="association_document" />
            <input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className={fileInput} />
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-800 shadow-sm transition hover:bg-gray-50">
              <Upload className="h-3.5 w-3.5 text-gray-400" /> Upload
            </button>
          </form>
        </Section>

        <p className="text-xs text-gray-400">
          Generated letters and notices live in <Link href="/documents" className="font-medium text-gray-500 hover:text-gray-950 hover:underline">Documents</Link>.
        </p>
      </div>
    </Workspace>
  );
}

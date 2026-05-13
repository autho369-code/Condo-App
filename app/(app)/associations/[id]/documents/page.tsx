import { notFound } from 'next/navigation';

import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section, Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { requireStaff } from '@/lib/auth/me';
import { attachSignedDocumentUrls } from '@/lib/documents/association-documents';
import { uploadAssociationDocument } from '@/lib/rpcs/association-documents';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AssociationDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ document_uploaded?: string; document_error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: association, error }, { data: rows }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').eq('id', id).maybeSingle(),
    (supabase as any)
      .from('association_attachments')
      .select('id, file_name, folder, storage_path, shared_with_owner, content_type, byte_size, created_at')
      .eq('association_id', id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  ]);
  if (error || !association) notFound();

  const documents = await attachSignedDocumentUrls(supabase as any, rows ?? []);

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="documents" />
          <WorkspaceHeader title="Documents" subtitle={association.name} />
        </>
      }
    >
      {sp.document_uploaded && (
        <div className="mb-4 rounded-md border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          Document uploaded.
        </div>
      )}
      {sp.document_error && (
        <div className="mb-4 rounded-md border border-bordeaux-200 bg-bordeaux-50 px-4 py-3 text-sm text-bordeaux-700">
          {sp.document_error}
        </div>
      )}

      <Section title="Upload shared document" padded>
        <form action={uploadAssociationDocument.bind(null, id) as any} className="grid gap-4 md:grid-cols-[1fr_220px_180px_auto] md:items-end">
          <div>
            <Label htmlFor="file">Document</Label>
            <Input id="file" name="file" type="file" required />
          </div>
          <div>
            <Label htmlFor="folder">Category</Label>
            <select id="folder" name="folder" defaultValue="governing_documents" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="governing_documents">Governing documents</option>
              <option value="meeting_minutes">Meeting minutes</option>
              <option value="notices">Notices</option>
              <option value="related_files">Related files</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-700">
            <input name="shared_with_owner" type="checkbox" defaultChecked />
            Share with owners
          </label>
          <Button type="submit">Upload</Button>
        </form>
      </Section>

      <Section title="Shared document library">
        {documents.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Category</th>
                <th className="px-4 py-2 text-left font-semibold">Shared</th>
                <th className="px-4 py-2 text-left font-semibold">Uploaded</th>
                <th className="px-4 py-2 text-right font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document: any) => (
                <tr key={document.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink-900">{document.file_name}</td>
                  <td className="px-4 py-3 text-ink-600">{folderLabel(document.folder)}</td>
                  <td className="px-4 py-3 text-ink-600">{document.shared_with_owner ? 'Owners and board' : 'Managers only'}</td>
                  <td className="px-4 py-3 text-ink-600">{date(document.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {document.signed_url ? (
                      <a href={document.signed_url} className="text-champagne-700 hover:underline">Download</a>
                    ) : (
                      <span className="text-ink-400">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No shared documents uploaded yet.</p>
        )}
      </Section>
    </Workspace>
  );
}

function folderLabel(value: string | null) {
  switch (value) {
    case 'governing_documents': return 'Governing documents';
    case 'meeting_minutes': return 'Meeting minutes';
    case 'notices': return 'Notices';
    case 'related_files': return 'Related files';
    default: return value ?? 'Uncategorized';
  }
}

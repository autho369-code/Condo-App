import { requireOwnerPortal } from '@/lib/auth/me';
import { attachSignedDocumentUrls } from '@/lib/documents/association-documents';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PortalDocumentsPage() {
  const me = await requireOwnerPortal();
  const supabase = await createClient();
  const associationIds = [...new Set([...(me.resident_association_ids ?? []), ...(me.board_association_ids ?? [])])];

  const { data: rows } = associationIds.length > 0
    ? await (supabase as any)
        .from('association_attachments')
        .select('id, association_id, file_name, folder, storage_path, created_at, associations(name)')
        .in('association_id', associationIds)
        .eq('shared_with_owner', true)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
    : { data: [] };
  const documents = await attachSignedDocumentUrls(supabase as any, rows ?? []);

  return (
    <div className="space-y-6">
      <header className="border-b border-ink-100 pb-7">
        <div className="eyebrow">Owner portal</div>
        <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Documents</h1>
        <p className="mt-2 text-[15px] text-ink-500">Governing documents, meeting minutes, notices, and files shared by your association.</p>
      </header>

      <section className="overflow-hidden rounded border border-ink-100 bg-white">
        {documents.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Document</th>
                <th className="px-4 py-2 text-left font-semibold">Association</th>
                <th className="px-4 py-2 text-left font-semibold">Category</th>
                <th className="px-4 py-2 text-left font-semibold">Uploaded</th>
                <th className="px-4 py-2 text-right font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document: any) => (
                <tr key={document.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink-900">{document.file_name}</td>
                  <td className="px-4 py-3 text-ink-600">{document.associations?.name ?? 'Association'}</td>
                  <td className="px-4 py-3 text-ink-600">{String(document.folder ?? 'Document').replaceAll('_', ' ')}</td>
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
          <p className="px-5 py-8 text-center text-sm text-ink-500">No documents have been shared with your account yet.</p>
        )}
      </section>
    </div>
  );
}

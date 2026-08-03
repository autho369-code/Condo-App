import { File, Scale, ShieldCheck } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { date } from '@/lib/utils';
import { isEntityDocumentStoragePath, isScopedStoragePath } from '@/lib/security/storage-paths';
import { RESIDENT_SHARED_DOCUMENT_TYPES } from '@/lib/associations/operating-docs';

export const dynamic = 'force-dynamic';

const BUCKET = 'association-documents';

type DocumentRow = {
  id: string;
  doc_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  file_name: string | null;
  file_url: string | null;
  uploaded_at: string | null;
};

function category(docType: string | null) {
  return docType === 'master_insurance_policy' ? 'insurance' : 'governing';
}

const sections = [
  { id: 'governing', title: 'Governing documents', icon: Scale },
  { id: 'insurance', title: 'Community insurance', icon: ShieldCheck },
] as const;

export default async function ResidentDocumentsPage() {
  const me = await requireTenant();
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: documentRows }, { data: tenant }] = await Promise.all([
    db.from('documents')
      .select('id, doc_type, entity_type, entity_id, file_name, file_url, uploaded_at')
      .in('doc_type', RESIDENT_SHARED_DOCUMENT_TYPES)
      .order('uploaded_at', { ascending: false }),
    db.from('tenants')
      .select('id, lease_document_url, insurance_document_url')
      .eq('id', me.tenant_id)
      .maybeSingle(),
  ]);
  const docs = (documentRows ?? []) as DocumentRow[];

  const directLinks = new Map<string, string>();
  const paths: string[] = [];
  for (const doc of docs) {
    const path = doc.file_url?.trim();
    if (!path) continue;
    if (/^https?:\/\//i.test(path)) directLinks.set(doc.id, path);
    else if (isEntityDocumentStoragePath(path, doc.entity_type, doc.entity_id)) paths.push(path);
  }
  const privateDocs = [
    { id: 'lease', label: 'Lease document', path: tenant?.lease_document_url as string | null },
    { id: 'insurance', label: 'Renter insurance', path: tenant?.insurance_document_url as string | null },
  ].filter((item) => item.path && isScopedStoragePath(item.path, 'tenants', me.tenant_id));
  paths.push(...privateDocs.map((item) => item.path as string));

  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const service = createServiceClient() as any;
    const { data: signed } = await service.storage.from(BUCKET).createSignedUrls(Array.from(new Set(paths)), 3600);
    for (const item of signed ?? []) if (item?.path && item?.signedUrl) signedByPath.set(item.path, item.signedUrl);
  }
  for (const doc of docs) {
    const signed = doc.file_url ? signedByPath.get(doc.file_url) : null;
    if (signed) directLinks.set(doc.id, signed);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Community records and private occupancy documents shared with you." />

      {privateDocs.length > 0 ? (
        <Surface>
          <h2 className="text-[15px] font-semibold text-gray-950">My occupancy documents</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {privateDocs.map((item) => {
              const href = signedByPath.get(item.path as string);
              return (
                <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 text-sm text-gray-800">
                    <File className="h-4 w-4 text-gray-400" />{item.label}
                  </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-700 hover:underline">View &rarr;</a>
                  ) : <span className="text-xs text-gray-400">Unavailable</span>}
                </div>
              );
            })}
          </div>
        </Surface>
      ) : null}

      {docs.length === 0 && privateDocs.length === 0 ? (
        <Surface padded={false}>
          <EmptyState icon={File} title="No documents shared" description="Governing documents and community insurance records will appear here when management publishes them." />
        </Surface>
      ) : (
        sections.map((section) => {
          const items = docs.filter((doc) => category(doc.doc_type) === section.id);
          return (
            <Surface key={section.id} padded={false}>
              <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
                <section.icon className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-950">{section.title}</h2>
              </div>
              {items.length === 0 ? <div className="px-5 py-6 text-sm text-gray-400">No documents in this section.</div> : (
                <div className="divide-y divide-gray-100">
                  {items.map((doc) => {
                    const href = directLinks.get(doc.id);
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{doc.file_name ?? 'Untitled document'}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{doc.uploaded_at ? `Uploaded ${date(doc.uploaded_at)}` : String(doc.doc_type ?? 'Document').replace(/_/g, ' ')}</div>
                        </div>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-gray-700 hover:underline">View &rarr;</a>
                        ) : <span className="shrink-0 text-xs text-gray-400">Unavailable</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Surface>
          );
        })
      )}
    </div>
  );
}

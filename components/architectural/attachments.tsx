// Documents card shared by the owner / manager / board architectural detail
// pages. Files upload ONE AT A TIME (each submit is its own request, 10 MB
// cap) so large plan sets don't overload a single POST. Server component —
// signs private-bucket URLs at render time.
import { FileText, Paperclip, X } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { addArchitecturalAttachment, removeArchitecturalAttachment } from '@/lib/rpcs/architectural';

const BUCKET = 'association-documents';
// Keep in sync with MAX_ARCH_ATTACHMENTS in lib/rpcs/architectural.ts
// (that file is 'use server' and may only export async functions).
export const MAX_DOCS = 10;

export type ArcAttachment = {
  name: string;
  path: string;
  size?: number;
  uploaded_at?: string;
  uploaded_by_name?: string | null;
};

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function ArcAttachments({
  requestId,
  basePath,
  attachments,
  canUpload,
  canRemove,
}: {
  requestId: string;
  basePath: string;
  attachments: ArcAttachment[];
  canUpload: boolean;
  canRemove: boolean;
}) {
  const docs = (attachments ?? []).filter((a) => a?.path);

  // Sign viewing links for the private bucket
  const linkByPath = new Map<string, string>();
  if (docs.length > 0) {
    try {
      const svc = createServiceClient() as any;
      const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.path), 3600);
      for (const s of signed ?? []) if (s?.path && s?.signedUrl) linkByPath.set(s.path, s.signedUrl);
    } catch {}
  }

  const uploadAction = addArchitecturalAttachment.bind(null, requestId, basePath);
  const removeAction = removeArchitecturalAttachment.bind(null, requestId, basePath);

  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400">No documents uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => (
            <li key={d.path} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0">
                  {linkByPath.has(d.path) ? (
                    <a href={linkByPath.get(d.path)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-800 hover:text-gray-950 hover:underline">
                      {d.name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium text-gray-800">{d.name}</span>
                  )}
                  <div className="text-xs text-gray-400">
                    {[formatSize(d.size), d.uploaded_by_name ?? null].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              {canRemove && (
                <form action={removeAction as any}>
                  <input type="hidden" name="path" value={d.path} />
                  <button type="submit" title="Remove document" className="rounded-md p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && docs.length < MAX_DOCS && (
        <form action={uploadAction as any} className="space-y-2 border-t border-gray-100 pt-3">
          <label className="block text-sm font-medium text-gray-700" htmlFor={`arc-doc-${requestId}`}>
            Add a document
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`arc-doc-${requestId}`}
              type="file"
              name="document"
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx"
              className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
            />
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50">
              <Paperclip className="h-4 w-4 text-gray-400" /> Upload
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Upload one document at a time — plans, drawings, contractor quotes, photos. Up to {MAX_DOCS} documents, max 10 MB each. Uploading one by one keeps large files from failing.
          </p>
        </form>
      )}
    </div>
  );
}

'use client';

// Photos / files on a service request or work order. Files upload
// browser → private storage through a signed URL, one at a time, then are
// recorded server-side (lib/rpcs/maintenance-attachments.ts).
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, FileText, LoaderCircle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  createMaintenanceUpload, recordMaintenanceUpload, removeMaintenanceAttachment,
  type MaintenanceParentKind,
} from '@/lib/rpcs/maintenance-attachments';
import type { MaintenanceAttachmentView } from '@/lib/maintenance/attachments';
import { Alert } from '@/components/ui/shell';

const ROLE_LABEL: Record<string, string> = { staff: 'Staff', resident: 'Resident', vendor: 'Vendor' };

export function MaintenanceAttachments({
  kind, parentId, items, canUpload, currentUserId, canRemoveAny, emptyText = 'No photos or files yet.',
}: {
  kind: MaintenanceParentKind;
  parentId: string;
  items: MaintenanceAttachmentView[];
  canUpload: boolean;
  currentUserId: string | null;
  canRemoveAny: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: File[]) {
    if (!files.length) return;
    setError(null);
    const supabase = createClient();
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const signed = await createMaintenanceUpload(kind, parentId, { name: file.name, size: file.size, type: file.type });
        if (signed.error || !signed.path || !signed.token) { failed.push(signed.error ?? file.name); continue; }
        const { error: upErr } = await supabase.storage.from('association-documents')
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
        if (upErr) { failed.push(`${file.name}: ${upErr.message}`); continue; }
        const rec = await recordMaintenanceUpload(kind, parentId, { path: signed.path, name: file.name, size: file.size, type: file.type });
        if (rec.error) failed.push(rec.error);
      } catch {
        failed.push(file.name);
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    if (failed.length) setError(`${failed.length} file${failed.length === 1 ? '' : 's'} not added: ${failed.join('; ')}`);
    startTransition(() => router.refresh());
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeMaintenanceAttachment(id);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  const busy = Boolean(progress) || pending;

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      {items.length === 0 ? <p className="text-sm text-gray-500">{emptyText}</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const isImage = (item.content_type ?? '').startsWith('image/');
            // Non-staff may remove their own files only while they can still add files (the job is open).
            const removable = canRemoveAny || (canUpload && currentUserId && item.uploaded_by === currentUserId);
            return (
              <li key={item.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <a href={item.url ?? '#'} target="_blank" rel="noreferrer" className="block aspect-[4/3]">
                  {isImage && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.file_name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-gray-400">
                      <FileText className="h-8 w-8" />
                    </span>
                  )}
                </a>
                <div className="border-t border-gray-200 bg-white px-2.5 py-1.5">
                  <div className="truncate text-xs font-medium text-gray-800" title={item.file_name}>{item.file_name}</div>
                  <div className="text-[12.5px] text-gray-500">{ROLE_LABEL[item.uploader_role] ?? ''} · {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                {removable ? (
                  <button type="button" onClick={() => remove(item.id)} disabled={busy} aria-label={`Remove ${item.file_name}`}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canUpload ? (
        <>
          <label htmlFor={`maint-files-${parentId}`}
            className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" /> : <Camera className="h-4 w-4 text-gray-400" />}
            {progress ?? (pending ? 'Updating…' : 'Add photos or files')}
          </label>
          <input id={`maint-files-${parentId}`} ref={input} type="file" multiple className="sr-only" disabled={busy}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            onChange={(e) => upload(Array.from(e.target.files ?? []))} />
          <p className="text-xs text-gray-400">Photos (JPG, PNG, HEIC, WebP) or PDFs · up to 20 MB each · 12 per record</p>
        </>
      ) : null}
    </div>
  );
}

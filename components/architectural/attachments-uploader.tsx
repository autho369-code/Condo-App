'use client';

// Multi-file uploader for architectural requests. Pick several documents at
// once (plans, drawings, quotes, photos); each uploads directly
// browser→Supabase Storage via a signed URL — one at a time so nothing is
// overloaded, and far past Vercel's ~4.5 MB server-action body cap.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createArchAttachmentUpload, recordArchAttachment } from '@/lib/rpcs/architectural';

const BUCKET = 'association-documents';

type FileStatus = { name: string; state: 'uploading' | 'done' | 'error'; message?: string };

export function ArcAttachmentsUploader({
  requestId,
  basePath,
  remaining,
}: {
  requestId: string;
  basePath: string;
  remaining: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);

  async function handleUpload() {
    const files = Array.from(inputRef.current?.files ?? []);
    if (files.length === 0) return;
    if (files.length > remaining) {
      setStatuses([{ name: `Only ${remaining} more document${remaining === 1 ? '' : 's'} can be added to this request`, state: 'error' }]);
      return;
    }
    setBusy(true);
    setStatuses(files.map((f) => ({ name: f.name, state: 'uploading' })));
    const supabase = createClient();

    // Sequential on purpose — one file in flight at a time.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fail = (message: string) =>
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'error', message } : s)));
      try {
        const signed = await createArchAttachmentUpload(requestId, file.name, file.size);
        if (signed.error || !signed.path || !signed.token) { fail(signed.error ?? 'Could not authorize upload'); continue; }
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
        if (upErr) { fail(upErr.message); continue; }
        const rec = await recordArchAttachment(requestId, basePath, { path: signed.path, name: file.name, size: file.size });
        if (rec.error) { fail(rec.error); continue; }
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'done' } : s)));
      } catch (e: any) {
        fail(e?.message ?? 'Upload failed');
      }
    }

    if (inputRef.current) inputRef.current.value = '';
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <label className="block text-sm font-medium text-gray-700" htmlFor={`arc-docs-${requestId}`}>
        Add documents
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`arc-docs-${requestId}`}
          ref={inputRef}
          type="file"
          multiple
          disabled={busy}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx"
          className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? <Upload className="h-4 w-4 animate-pulse text-gray-400" /> : <Paperclip className="h-4 w-4 text-gray-400" />}
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {statuses.length > 0 && (
        <ul className="space-y-1 text-xs">
          {statuses.map((s, i) => (
            <li key={i} className={s.state === 'error' ? 'text-red-600' : s.state === 'done' ? 'text-emerald-700' : 'text-gray-500'}>
              {s.state === 'done' ? '✓ ' : s.state === 'error' ? '✗ ' : '… '}
              {s.name}
              {s.message ? ` — ${s.message}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400">
        Select several at once — plans, drawings, contractor quotes, photos. Up to {remaining} more, max 25 MB each; files upload one at a time so large sets don&apos;t fail.
      </p>
    </div>
  );
}

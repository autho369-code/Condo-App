'use client';

// One-screen architectural request: the owner attaches documents RIGHT HERE,
// hits Submit once, and the request is created + files stream to storage
// one-by-one (signed URLs — reliable for large plans/photos, no size choke).
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Paperclip, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  createArchitecturalRequest,
  createArchAttachmentUpload,
  recordArchAttachment,
} from '@/lib/rpcs/architectural';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const BUCKET = 'association-documents';
const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

const selectCls =
  'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export type UnitOption = { value: string; label: string };

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'exterior_paint', label: 'Exterior paint / color' },
  { value: 'fence',          label: 'Fence / wall' },
  { value: 'landscaping',    label: 'Landscaping' },
  { value: 'roof',           label: 'Roof' },
  { value: 'addition',       label: 'Addition / structural' },
  { value: 'deck_patio',     label: 'Deck / patio' },
  { value: 'windows_doors',  label: 'Windows / doors' },
  { value: 'solar',          label: 'Solar panels' },
  { value: 'pool',           label: 'Pool / spa' },
  { value: 'other',          label: 'Other' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewArchitecturalRequestForm({ unitOptions }: { unitOptions: UnitOption[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { setError(`Up to ${MAX_FILES} documents per request.`); break; }
      if (f.size > MAX_BYTES) { setError(`"${f.name}" is over 25 MB.`); continue; }
      if (f.size === 0) continue;
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);

    try {
      setPhase('Submitting request…');
      const created = await createArchitecturalRequest({
        unitId: String(fd.get('unit_id') ?? ''),
        title: String(fd.get('title') ?? ''),
        description: String(fd.get('description') ?? ''),
        category: String(fd.get('category') ?? 'other'),
      });
      if (created.error || !created.id) throw new Error(created.error ?? 'Failed to submit request');

      // Stream the attached documents one at a time (reliability for large files)
      const failed: string[] = [];
      const supabase = createClient();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setPhase(`Uploading document ${i + 1} of ${files.length}: ${file.name}`);
        try {
          const signed = await createArchAttachmentUpload(created.id, file.name, file.size);
          if (signed.error || !signed.path || !signed.token) { failed.push(file.name); continue; }
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
          if (upErr) { failed.push(file.name); continue; }
          const rec = await recordArchAttachment(created.id, '/portal/architectural', {
            path: signed.path, name: file.name, size: file.size,
          });
          if (rec.error) failed.push(file.name);
        } catch {
          failed.push(file.name);
        }
      }

      const params = new URLSearchParams({ submitted: '1' });
      if (failed.length > 0) params.set('error', `These documents did not upload — add them below: ${failed.join(', ')}`);
      router.push(`/portal/architectural/${created.id}?${params.toString()}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Could not submit the request');
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}

      <div>
        <Label htmlFor="unit_id">Unit</Label>
        {unitOptions.length === 1 ? (
          <>
            <input type="hidden" name="unit_id" value={unitOptions[0].value} />
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">{unitOptions[0].label}</div>
          </>
        ) : (
          <select id="unit_id" name="unit_id" required className={selectCls} defaultValue="">
            <option value="">Choose a unit…</option>
            {unitOptions.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={120} placeholder="e.g. Repaint front door and trim" />
      </div>

      <div>
        <Label htmlFor="category">Type of modification</Label>
        <select id="category" name="category" defaultValue="other" className={selectCls}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="description">Describe the work</Label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          rows={6}
          placeholder="What are you changing, what materials/colors, dimensions, and where on the property? The more detail, the faster the review."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        />
      </div>

      {/* Documents — attached right here, uploaded on submit */}
      <div>
        <Label htmlFor="documents">Supporting documents</Label>
        <p className="mb-2 text-xs text-gray-500">
          Plans, drawings, contractor quotes, photos — up to {MAX_FILES} files, 25 MB each. They upload one at a time when you submit, so large files are fine.
        </p>
        {files.length > 0 && (
          <ul className="mb-2 divide-y divide-gray-100 rounded-xl border border-gray-200/70">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-gray-800">
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{f.name}</span>
                  <span className="flex-shrink-0 text-xs text-gray-400">{formatSize(f.size)}</span>
                </span>
                {!busy && (
                  <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    title="Remove" className="rounded-md p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <input
          id="documents"
          ref={fileInputRef}
          type="file"
          multiple
          disabled={busy || files.length >= MAX_FILES}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx"
          onChange={(e) => addFiles(e.target.files)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800 disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <a href="/portal/architectural" className="text-sm text-gray-600 hover:underline">Cancel</a>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2"><Paperclip className="h-4 w-4 animate-pulse" /> {phase ?? 'Submitting…'}</span>
          ) : files.length > 0 ? `Submit request + ${files.length} document${files.length === 1 ? '' : 's'}` : 'Submit request'}
        </Button>
      </div>
    </form>
  );
}

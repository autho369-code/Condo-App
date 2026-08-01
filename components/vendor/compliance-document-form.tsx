'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createVendorUpload, saveVendorComplianceDocument } from '@/lib/rpcs/vendor-submissions';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'association-documents';
const inputClass = 'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export function ComplianceDocumentForm({ requests }: { requests: Array<{ id: string; name: string; doc_type: string }> }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Select a document to upload.');
      const signed = await createVendorUpload(file.name, file.size, 'compliance');
      if (signed.error || !signed.path || !signed.token) throw new Error(signed.error ?? 'Could not authorize the upload.');
      const { error: uploadError } = await createClient().storage.from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);
      const saved = await saveVendorComplianceDocument({
        path: signed.path,
        fileName: file.name,
        documentType: String(values.get('document_type') ?? ''),
        expiresAt: String(values.get('expires_at') ?? '') || null,
        requestId: String(values.get('request_id') ?? '') || null,
      });
      if (saved.error) throw new Error(saved.error);
      form.reset();
      router.push('/vendor/compliance?saved_document=1');
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message ?? 'Could not upload the document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-gray-700">Document type</span>
          <select name="document_type" required className={inputClass}>
            <option value="workers_comp">Workers compensation</option>
            <option value="general_liability">General liability</option>
            <option value="auto_insurance">Auto insurance</option>
            <option value="epa_certification">EPA certification</option>
            <option value="state_license">State license</option>
            <option value="contract">Contract</option>
            <option value="w9">W-9</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Expiration date</span>
          <input type="date" name="expires_at" className={inputClass} />
        </label>
      </div>
      {requests.length > 0 && (
        <label className="block"><span className="text-sm font-medium text-gray-700">Related request</span>
          <select name="request_id" className={inputClass}>
            <option value="">Not tied to a request</option>
            {requests.map((request) => <option key={request.id} value={request.id}>{request.name} ({request.doc_type.replace(/_/g, ' ')})</option>)}
          </select>
        </label>
      )}
      <label className="block"><span className="text-sm font-medium text-gray-700">Document</span>
        <input ref={fileRef} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx" disabled={busy}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50" />
        <span className="mt-1 block text-xs text-gray-400">Private upload, maximum 25 MB.</span>
      </label>
      <button type="submit" disabled={busy} className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  );
}

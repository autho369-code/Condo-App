'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createResidentInsuranceUpload, saveResidentInsuranceDocument } from '@/app/resident/actions';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';

const BUCKET = 'association-documents';
const inputClass = 'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export function ResidentInsuranceUploadForm({
  tenantId,
  policyNumber,
  expirationDate,
}: {
  tenantId: string;
  policyNumber?: string | null;
  expirationDate?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Select your insurance document.');
      setPhase(`Uploading ${file.name}…`);
      const signed = await createResidentInsuranceUpload(file.name, file.size);
      if (signed.error || !signed.path || !signed.token) throw new Error(signed.error ?? 'Could not authorize the upload.');
      const { error: uploadError } = await createClient().storage.from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      setPhase('Saving policy…');
      const saved = await saveResidentInsuranceDocument({
        tenantId,
        path: signed.path,
        policyNumber: String(values.get('insurance_policy_number') ?? '') || null,
        expirationDate: String(values.get('insurance_expiration') ?? '') || null,
      });
      if (saved.error) throw new Error(saved.error);
      form.reset();
      router.push('/resident/profile?saved_document=1');
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The insurance document could not be uploaded.');
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Policy number</span>
          <input name="insurance_policy_number" defaultValue={policyNumber ?? ''} maxLength={200} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Expiration date</span>
          <input name="insurance_expiration" type="date" defaultValue={expirationDate ?? ''} className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Insurance document</span>
        <input ref={fileRef} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic" disabled={busy} className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50" />
        <span className="mt-1 block text-xs text-gray-400">Private browser upload, maximum 25 MB.</span>
      </label>
      <Button type="submit" size="lg" disabled={busy}>{busy ? (phase ?? 'Saving…') : 'Upload insurance'}</Button>
    </form>
  );
}

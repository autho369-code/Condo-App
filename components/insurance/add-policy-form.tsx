'use client';

// Owner "Add Insurance Policy" form. Certificate uploads browser→storage via
// a signed URL (large PDFs OK), then the policy record is saved.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createInsuranceCertUpload, saveInsurancePolicy } from '@/lib/rpcs/insurance';

const BUCKET = 'association-documents';

const input =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export function AddInsurancePolicyForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      let cert: { path: string; name: string } | null = null;
      const file = fileRef.current?.files?.[0] ?? null;
      if (file && file.size > 0) {
        setPhase(`Uploading ${file.name}…`);
        const signed = await createInsuranceCertUpload(file.name, file.size);
        if (signed.error || !signed.path || !signed.token) throw new Error(signed.error ?? 'Could not authorize the upload');
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
        if (upErr) throw new Error(upErr.message);
        cert = { path: signed.path, name: file.name };
      }

      setPhase('Saving policy…');
      const res = await saveInsurancePolicy({
        carrier: String(fd.get('carrier') ?? ''),
        policyNumber: String(fd.get('policy_number') ?? ''),
        coverageAmount: String(fd.get('coverage_amount') ?? ''),
        effectiveDate: String(fd.get('effective_date') ?? ''),
        expirationDate: String(fd.get('expiration_date') ?? ''),
        remindOwner: fd.get('remind_owner') === 'on',
        remindManager: fd.get('remind_manager') === 'on',
        cert,
      });
      if (res.error) throw new Error(res.error);

      router.push('/portal/insurance?saved=1');
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save the policy');
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <label className="block"><span className="text-sm font-medium text-gray-700">Insurance Carrier <span className="text-red-600">*</span></span>
        <input name="carrier" required className={input} placeholder="e.g. State Farm" /></label>
      <label className="block"><span className="text-sm font-medium text-gray-700">Policy Number <span className="text-red-600">*</span></span>
        <input name="policy_number" required className={input} /></label>
      <label className="block"><span className="text-sm font-medium text-gray-700">Coverage Amount</span>
        <input name="coverage_amount" inputMode="decimal" className={input} placeholder="e.g. 300,000" /></label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-gray-700">Policy Start Date <span className="text-red-600">*</span></span>
          <input type="date" name="effective_date" required className={input} /></label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Policy End Date <span className="text-red-600">*</span></span>
          <input type="date" name="expiration_date" required className={input} /></label>
      </div>
      <label className="block"><span className="text-sm font-medium text-gray-700">Policy Document (PDF or photo)</span>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic" disabled={busy}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800 disabled:opacity-50" />
        <span className="mt-1 block text-xs text-gray-400">Max 25 MB. Uploads directly to your association&apos;s records — large PDFs are fine.</span></label>
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2.5 text-sm text-gray-700">
          <input type="checkbox" name="remind_owner" defaultChecked className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-blue-500/30" />
          Email me 30 and 15 days before expiration
        </label>
        <label className="flex items-center gap-2.5 text-sm text-gray-700">
          <input type="checkbox" name="remind_manager" defaultChecked className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-blue-500/30" />
          Also notify my property manager
        </label>
      </div>
      <button type="submit" disabled={busy}
        className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">
        {busy ? (phase ?? 'Saving…') : 'Save Policy'}
      </button>
    </form>
  );
}

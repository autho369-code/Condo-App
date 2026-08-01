'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { createVendorUpload, submitVendorInvoice } from '@/lib/rpcs/vendor-submissions';

const BUCKET = 'association-documents';
const inputClass = 'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

type WorkOrderOption = { id: string; label: string };

export function InvoiceSubmissionForm({ workOrders }: { workOrders: WorkOrderOption[] }) {
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
      if (!file) throw new Error('Attach the invoice document.');
      const signed = await createVendorUpload(file.name, file.size, 'invoice');
      if (signed.error || !signed.path || !signed.token) throw new Error(signed.error ?? 'Could not authorize the upload.');
      const { error: uploadError } = await createClient().storage.from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);
      const saved = await submitVendorInvoice({
        workOrderId: String(values.get('work_order_id') ?? ''),
        invoiceNumber: String(values.get('invoice_number') ?? ''),
        invoiceDate: String(values.get('invoice_date') ?? ''),
        dueDate: String(values.get('due_date') ?? '') || null,
        amount: String(values.get('amount') ?? ''),
        memo: String(values.get('memo') ?? '') || null,
        attachment: { path: signed.path, name: file.name },
      });
      if (saved.error) throw new Error(saved.error);
      form.reset();
      router.push('/vendor/payments?submitted=1');
      router.refresh();
    } catch (cause: any) {
      setError(cause?.message ?? 'Could not submit the invoice.');
    } finally {
      setBusy(false);
    }
  }

  if (workOrders.length === 0) {
    return <p className="text-sm text-gray-500">An invoice can be submitted after the management team assigns a work order to your company.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <label className="block"><span className="text-sm font-medium text-gray-700">Work order</span>
        <select name="work_order_id" required className={inputClass} defaultValue="">
          <option value="" disabled>Select an assigned work order</option>
          {workOrders.map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.label}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-gray-700">Invoice number</span>
          <input name="invoice_number" required maxLength={100} className={inputClass} /></label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Amount</span>
          <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputClass} /></label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Invoice date</span>
          <input name="invoice_date" type="date" required className={inputClass} /></label>
        <label className="block"><span className="text-sm font-medium text-gray-700">Due date</span>
          <input name="due_date" type="date" className={inputClass} /></label>
      </div>
      <label className="block"><span className="text-sm font-medium text-gray-700">Memo</span>
        <textarea name="memo" maxLength={1000} rows={3} className={inputClass} /></label>
      <label className="block"><span className="text-sm font-medium text-gray-700">Invoice document</span>
        <input ref={fileRef} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx" disabled={busy}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50" />
        <span className="mt-1 block text-xs text-gray-400">Private upload, maximum 25 MB. Duplicate invoice numbers are rejected.</span>
      </label>
      <button type="submit" disabled={busy} className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? 'Submitting…' : 'Submit invoice for approval'}
      </button>
    </form>
  );
}

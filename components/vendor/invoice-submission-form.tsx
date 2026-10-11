'use client';

import { useRef, useState } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { createVendorUpload, submitVendorInvoice } from '@/lib/rpcs/vendor-submissions';

const BUCKET = 'association-documents';

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
      // Stored under the work order's own vendor record (one per association).
      const signed = await createVendorUpload(file.name, file.size, 'invoice', String(values.get('work_order_id') ?? ''));
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
    return <p className="text-sm text-gray-500">An invoice can be submitted once you mark an assigned job as work complete.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Work order" htmlFor="vi-work-order" required>
        <Select id="vi-work-order" name="work_order_id" required defaultValue="">
          <option value="" disabled>Select a completed work order</option>
          {workOrders.map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.label}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice number" htmlFor="vi-number" required>
          <Input id="vi-number" name="invoice_number" required maxLength={100} />
        </Field>
        <Field label="Amount" htmlFor="vi-amount" required>
          <Input id="vi-amount" name="amount" required inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Invoice date" htmlFor="vi-date" required>
          <Input id="vi-date" name="invoice_date" type="date" required />
        </Field>
        <Field label="Due date" htmlFor="vi-due">
          <Input id="vi-due" name="due_date" type="date" />
        </Field>
      </div>
      <Field label="Memo" htmlFor="vi-memo">
        <Textarea id="vi-memo" name="memo" maxLength={1000} rows={3} />
      </Field>
      <label className="block"><span className="text-[13.5px] font-medium text-gray-700">Invoice document</span>
        <input ref={fileRef} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx" disabled={busy}
          className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white disabled:opacity-50" />
        <span className="mt-1 block text-xs text-gray-400">Private upload, maximum 25 MB. Duplicate invoice numbers are rejected.</span>
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit invoice for approval'}
      </Button>
    </form>
  );
}

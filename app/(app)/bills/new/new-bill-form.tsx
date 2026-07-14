'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { SectionTitle, Surface } from '@/components/ui/shell';
import { createBill } from '@/lib/rpcs/bills';

// ── types ──────────────────────────────────────────────────────────────────

interface ExtractedLineItem {
  description?: string | null;
  amount?: number | null;
}

interface ExtractedInvoice {
  vendor_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  total_amount?: number | null;
  line_items?: ExtractedLineItem[] | null;
  suggested_gl_hint?: string | null;
  confidence?: number | null;
}

interface Props {
  vendors: any[];
  associations: any[];
  gls: any[];
  banks: any[];
  portfolioId: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Match the AI-read vendor name against the portfolio's vendors list. */
function matchVendorId(name: string | null | undefined, vendors: any[]): string {
  if (!name) return '';
  const n = normalize(name);
  if (!n) return '';
  const exact = vendors.find((v: any) => normalize(v.name ?? '') === n);
  if (exact) return exact.id;
  const partial = vendors.filter((v: any) => {
    const vn = normalize(v.name ?? '');
    return vn.length > 2 && (vn.includes(n) || n.includes(vn));
  });
  return partial.length === 1 ? partial[0].id : '';
}

/** Match the AI's GL hint against the expense GL accounts (single match only). */
function matchGlId(hint: string | null | undefined, gls: any[]): string {
  if (!hint) return '';
  const h = normalize(hint);
  if (!h) return '';
  const matches = gls.filter((g: any) => {
    const gn = normalize(g.name ?? '');
    return gn.length > 2 && (gn.includes(h) || h.includes(gn));
  });
  return matches.length === 1 ? matches[0].id : '';
}

/** Only trust dates the model returned in strict YYYY-MM-DD form. */
function safeDate(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function money(n: number | null | undefined): string {
  return n == null ? '' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── component ──────────────────────────────────────────────────────────────

export default function NewBillForm({ vendors, associations, gls, banks, portfolioId }: Props) {
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedInvoice | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── AI extraction ────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setExtracting(true);
    setExtractError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/extract-invoice', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setExtractError(json.error || json.hint || 'AI extraction failed');
        return;
      }

      setExtracted(json.data as ExtractedInvoice);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to connect to AI service');
    } finally {
      setExtracting(false);
      // allow re-selecting the same file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── prefill mapping ──────────────────────────────────────────────────

  const d = extracted;
  const matchedVendorId = matchVendorId(d?.vendor_name, vendors);
  const matchedGlId = matchGlId(d?.suggested_gl_hint, gls);
  const lineItems = (d?.line_items ?? []).filter((li) => li && (li.description || li.amount != null));
  const defaultMemo = d
    ? (lineItems.map((li) => li.description).filter(Boolean).join('; ') ||
        [d.vendor_name, d.invoice_number ? `invoice ${d.invoice_number}` : null].filter(Boolean).join(' — '))
    : '';

  return (
    <div className="space-y-6">
      {/* AI extraction panel */}
      <section className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">
          {extracting ? 'Extracting invoice data…' : 'Extract from invoice (AI)'}
        </h3>
        <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
          {extracting
            ? 'AI is reading the invoice. This may take a few seconds.'
            : 'Drop a PDF or photo of the vendor invoice. AI will pre-fill vendor, amount, dates, and description — you review everything before saving.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
            id="invoice-upload"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
          >
            {extracting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                Extracting…
              </span>
            ) : (
              'Choose file'
            )}
          </Button>
          {fileName && !extracting && <span className="text-sm text-gray-600">{fileName}</span>}
        </div>

        {extractError && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[13px] leading-5 text-red-800" role="alert">
            {extractError}{' '}
            {/AI not configured/i.test(extractError) && (
              <Link href="/settings/ai" className="font-semibold underline">Open Settings → AI</Link>
            )}
          </div>
        )}

        {d && !extracting && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left">
            <p className="text-sm font-medium text-emerald-800">
              AI extraction complete{d.confidence != null ? ` (${d.confidence}% confidence)` : ''}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              The form below has been pre-filled. Review and edit every field before saving.
            </p>
            {lineItems.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs text-emerald-900">
                  <tbody>
                    {lineItems.map((li, i) => (
                      <tr key={i} className="border-t border-emerald-200/70">
                        <td className="py-1 pr-2">{li.description ?? '—'}</td>
                        <td className="py-1 text-right tabular-nums">{money(li.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-emerald-200/70 font-semibold">
                      <td className="py-1 pr-2">Invoice total</td>
                      <td className="py-1 text-right tabular-nums">{money(d.total_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <Surface>
        <SectionTitle title="Bill details" />
        {/* Remount the form when extraction lands so defaultValues (incl. selects) apply. */}
        <form key={d ? 'ai-prefilled' : 'manual'} action={createBill as any} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="portfolio_id" value={portfolioId} />

          {/* VENDOR */}
          <div className="sm:col-span-2">
            <Label htmlFor="vendor_id">Vendor *</Label>
            <Select id="vendor_id" name="vendor_id" required defaultValue={matchedVendorId}>
              <option value="">Select a vendor…</option>
              {(vendors ?? []).map((v: any) => (
                <option key={v.id} value={v.id}>{v.name} — {v.trade} ({v.payment_type})</option>
              ))}
            </Select>
            {d?.vendor_name && !matchedVendorId && (
              <p className="mt-1 text-xs text-amber-700">
                AI read the vendor as &ldquo;{d.vendor_name}&rdquo; but found no matching vendor — select one manually.
              </p>
            )}
          </div>

          {/* ASSOCIATION */}
          <div>
            <Label htmlFor="association_id">Association</Label>
            <Select id="association_id" name="association_id">
              <option value="">— None (portfolio-wide) —</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-500">The HOA the bill is billed to.</p>
          </div>

          {/* AMOUNT */}
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <Input
                id="amount" name="amount" type="number" step="0.01" min="0" required className="pl-6"
                defaultValue={d?.total_amount != null ? String(d.total_amount) : ''}
              />
            </div>
          </div>

          {/* BILL NUMBER / REFERENCE */}
          <div>
            <Label htmlFor="bill_number">Invoice / reference #</Label>
            <Input id="bill_number" name="bill_number" placeholder="e.g. INV-4521" defaultValue={d?.invoice_number ?? ''} />
          </div>

          {/* DATES */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="bill_date">Bill date *</Label>
              <Input
                id="bill_date" name="bill_date" type="date" required
                defaultValue={safeDate(d?.invoice_date) || new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={safeDate(d?.due_date)} />
            </div>
          </div>

          {/* GL ACCOUNT */}
          <div>
            <Label htmlFor="gl_account_id">Expense GL account</Label>
            <Select id="gl_account_id" name="gl_account_id" defaultValue={matchedGlId}>
              <option value="">—</option>
              {(gls ?? []).map((g: any) => (
                <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
              ))}
            </Select>
            {d?.suggested_gl_hint && !matchedGlId && (
              <p className="mt-1 text-xs text-gray-500">AI suggests: {d.suggested_gl_hint}</p>
            )}
          </div>

          {/* BANK */}
          <div>
            <Label htmlFor="bank_account_id">Pay from bank account</Label>
            <Select id="bank_account_id" name="bank_account_id">
              <option value="">—</option>
              {(banks ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `(${b.bank_name})` : ''}</option>
              ))}
            </Select>
          </div>

          {/* MEMO — prints on the check */}
          <div className="sm:col-span-2">
            <Label htmlFor="memo">Memo (prints on check) *</Label>
            <Textarea id="memo" name="memo" rows={2}
              placeholder="e.g. Dec 2026 gas utility — Granville Tower"
              defaultValue={defaultMemo} />
            <p className="mt-1 text-xs text-gray-500">This shows on the printed check&apos;s memo line and on the check stub.</p>
          </div>

          {/* STATUS + APPROVAL */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="pending_approval">
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending approval</option>
              <option value="approved">Approved</option>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="approval_required" defaultChecked /> Requires board approval
            </label>
          </div>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">Save bill</Button>
            <Link href="/bills"><Button variant="secondary" type="button">Cancel</Button></Link>
          </div>
        </form>
      </Surface>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section } from '@/components/workspace/shell';

// ── types ──────────────────────────────────────────────────────────────────

interface ExtractedData {
  policy_number?: string | null;
  insurance_company?: string | null;
  insured_name?: string | null;
  coverage_amount?: number | null;
  liability_amount?: number | null;
  deductible_amount?: number | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  property_address?: string | null;
  confidence?: number;
}

interface Props {
  owners: any[];
  associations: any[];
  addPolicy: (formData: FormData) => Promise<{ error?: string }>;
}

// ── component ──────────────────────────────────────────────────────────────

export default function NewInsuranceForm({ owners, associations, addPolicy }: Props) {
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

      const res = await fetch('/api/ai/extract-certificate', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setExtractError(json.error || json.hint || 'AI extraction failed');
        return;
      }

      setExtractedData(json.data);
    } catch (err: any) {
      setExtractError(err.message || 'Failed to connect to AI service');
    } finally {
      setExtracting(false);
    }
  }

  // ── form submit ──────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const fd = new FormData(e.currentTarget);
    const result = await addPolicy(fd);
    if (result?.error) {
      setSubmitError(result.error);
    }
    // On success the server action redirects, so we don't need to do anything
  }

  // ── render ───────────────────────────────────────────────────────────

  const d = extractedData;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
      <div>
        <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Link href="/insurance" className="hover:text-ink-700">Insurance</Link>
          <span className="mx-2">/</span>
          New policy
        </nav>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">Add insurance policy</h1>
        <p className="mt-1 text-sm text-ink-500">
          Upload an HO6 certificate for AI extraction, or enter details manually.
        </p>
      </div>

      {/* AI Upload zone */}
      <section className="rounded-lg border-2 border-dashed border-ink-200 bg-cream-50 p-8 text-center">
        <div className="text-3xl mb-2">{extracting ? '⏳' : '📄'}</div>
        <h3 className="font-medium text-ink-900">
          {extracting ? 'Extracting policy data...' : 'Upload certificate for AI extraction'}
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          {extracting
            ? 'AI is reading the certificate. This may take a few seconds.'
            : 'Drop a PDF or image of the HO6 certificate. AI will extract policy number, coverage, dates, and insurance company automatically.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
            id="certificate-upload"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
          >
            {extracting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-ink-600" />
                Extracting…
              </span>
            ) : (
              'Choose file'
            )}
          </Button>
          {fileName && !extracting && (
            <span className="text-sm text-ink-600">{fileName}</span>
          )}
        </div>

        {extractError && (
          <p className="mt-3 text-sm text-red-600">{extractError}</p>
        )}

        {d && !extracting && (
          <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-3 text-left">
            <p className="text-sm font-medium text-green-800">
              ✓ AI extraction complete{d.confidence != null ? ` (${d.confidence}% confidence)` : ''}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Fields below have been pre-filled. Review and edit as needed before saving.
            </p>
          </div>
        )}
      </section>

      {/* Manual entry form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Policy details" padded>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="owner_id">Owner <span className="text-red-500">*</span></Label>
              <select
                id="owner_id"
                name="owner_id"
                required
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm"
              >
                <option value="">Select owner</option>
                {(owners ?? []).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="association_id">Association</Label>
              <select
                id="association_id"
                name="association_id"
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm"
              >
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="policy_number">Policy number <span className="text-red-500">*</span></Label>
              <Input
                id="policy_number"
                name="policy_number"
                required
                placeholder="HO6-2026-001234"
                defaultValue={d?.policy_number ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="insurance_company">Insurance company <span className="text-red-500">*</span></Label>
              <Input
                id="insurance_company"
                name="insurance_company"
                required
                placeholder="State Farm, Allstate, etc."
                defaultValue={d?.insurance_company ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="coverage_amount">Coverage amount ($)</Label>
              <Input
                id="coverage_amount"
                name="coverage_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="100000"
                defaultValue={d?.coverage_amount != null ? String(d.coverage_amount) : ''}
              />
            </div>

            <div>
              <Label htmlFor="liability_amount">Liability amount ($)</Label>
              <Input
                id="liability_amount"
                name="liability_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="300000"
                defaultValue={d?.liability_amount != null ? String(d.liability_amount) : ''}
              />
            </div>

            <div>
              <Label htmlFor="deductible_amount">Deductible ($)</Label>
              <Input
                id="deductible_amount"
                name="deductible_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="1000"
                defaultValue={d?.deductible_amount != null ? String(d.deductible_amount) : ''}
              />
            </div>

            <div>
              <Label htmlFor="effective_date">Effective date <span className="text-red-500">*</span></Label>
              <Input
                id="effective_date"
                name="effective_date"
                type="date"
                required
                defaultValue={d?.effective_date ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="expiration_date">Expiration date <span className="text-red-500">*</span></Label>
              <Input
                id="expiration_date"
                name="expiration_date"
                type="date"
                required
                defaultValue={d?.expiration_date ?? ''}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
                placeholder="Additional coverage details, lender requirements, etc."
              />
            </div>
          </div>
        </Section>

        {submitError && (
          <p className="text-sm text-red-600">Error: {submitError}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Save policy</Button>
          <Link href="/insurance" className="text-sm text-ink-500 hover:text-ink-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

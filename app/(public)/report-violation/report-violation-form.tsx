'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

// ── types ──────────────────────────────────────────────────────────────────

interface AIAnalysis {
  violation_type?: string | null;
  severity?: string | null;
  description?: string | null;
  matched_house_rule_id?: string | null;
  matched_rule_explanation?: string | null;
  confidence?: number | null;
}

interface HouseRule {
  id: string;
  rule_number: string;
  title: string;
  description: string;
  category: string;
  penalty_type: string;
  fine_amount: number | null;
}

interface Association {
  id: string;
  name: string;
}

interface Props {
  associations: Association[];
  rules: HouseRule[];
  assocId: string | undefined;
  submitReport: (formData: FormData) => Promise<void>;
}

// ── violation types & severity labels ─────────────────────────────────────

const VIOLATION_TYPES: Record<string, string> = {
  noise: 'Noise / disturbance',
  construction: 'Unauthorized construction / alteration',
  pet: 'Pet violation',
  parking: 'Parking / vehicle issue',
  harassment: 'Harassment',
  smoking: 'Smoking in prohibited area',
  waste: 'Improper waste disposal',
  subletting: 'Unauthorized subletting / Airbnb',
  balcony: 'Balcony / patio violation',
  other: 'Other',
};

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

// ── component ──────────────────────────────────────────────────────────────

export default function ReportViolationForm({ associations, rules, assocId, submitReport }: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedAssoc, setSelectedAssoc] = useState<string>(assocId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── AI photo analysis ────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setAnalyzing(true);
    setAnalyzeError(null);

    // Need an association selected to analyze
    const assoc = selectedAssoc;
    if (!assoc) {
      setAnalyzeError('Please select an association first before uploading a photo.');
      setAnalyzing(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('association_id', assoc);

      const res = await fetch('/api/ai/analyze-violation-photo', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setAnalyzeError(json.error || json.hint || 'AI analysis failed');
        return;
      }

      setAnalysis(json.data);
    } catch (err: any) {
      setAnalyzeError(err.message || 'Failed to connect to AI service');
    } finally {
      setAnalyzing(false);
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setFileName(null);
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── render ───────────────────────────────────────────────────────────

  const a = analysis;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Violation Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Per the Illinois Condominium Property Act. For emergencies, call 911.
        </p>
      </header>

      {/* ── AI Photo Upload ──────────────────────────────────────────── */}
      <section className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center">
        <div className="text-3xl mb-2">{analyzing ? '⏳' : '📸'}</div>
        <h3 className="font-medium text-gray-900">
          {analyzing
            ? 'Analyzing photo with AI...'
            : 'Upload a photo for AI analysis'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {analyzing
            ? 'AI is detecting the violation type, severity, and matching house rules. This may take a few seconds.'
            : 'Take a photo of the violation. AI will auto-detect type, severity, and match the closest house rule.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id="violation-photo-upload"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={analyzing}
            onClick={() => fileInputRef.current?.click()}
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                Analyzing…
              </span>
            ) : (
              'Choose photo'
            )}
          </Button>
          {fileName && !analyzing && (
            <span className="text-sm text-gray-600">{fileName}</span>
          )}
          {a && !analyzing && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAnalysis}>
              Clear
            </Button>
          )}
        </div>

        {analyzeError && (
          <p className="mt-3 text-sm text-red-600">{analyzeError}</p>
        )}

        {a && !analyzing && (
          <div className="mt-4 rounded-md bg-white border border-blue-200 p-4 text-left">
            <p className="text-sm font-medium text-blue-800">
              ✓ AI analysis complete{a.confidence != null ? ` (${a.confidence}% confidence)` : ''}
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Detected type:</span>{' '}
                <span className="font-medium">{VIOLATION_TYPES[a.violation_type || ''] || a.violation_type || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Severity:</span>{' '}
                {a.severity && SEVERITY_LABELS[a.severity] ? (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_LABELS[a.severity].color}`}>
                    {SEVERITY_LABELS[a.severity].label}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
              {a.description && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Description:</span>{' '}
                  <span>{a.description}</span>
                </div>
              )}
              {a.matched_rule_explanation && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Rule match:</span>{' '}
                  <span>{a.matched_rule_explanation}</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Fields below have been pre-filled with AI results. Review and edit before submitting.
            </p>
          </div>
        )}
      </section>

      {/* ── Main Form ─────────────────────────────────────────────────── */}
      <form action={submitReport} className="space-y-8">
        {/* Association (moved to top for photo analysis dependency) */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Association</h2>
          <div>
            <Label htmlFor="association_id">Select your association *</Label>
            <select
              id="association_id"
              name="association_id"
              required
              value={selectedAssoc}
              onChange={(e) => setSelectedAssoc(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select association</option>
              {associations.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Select your association first to enable AI photo analysis with your community&apos;s house rules.
            </p>
          </div>
        </section>

        {/* Reporter */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Reporter Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reporter_name">Your Name *</Label>
              <Input id="reporter_name" name="reporter_name" required placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="reporter_unit">Unit Address *</Label>
              <Input id="reporter_unit" name="reporter_unit" required placeholder="Unit 301, 123 Main St" />
            </div>
            <div>
              <Label htmlFor="reporter_contact">Phone / Email *</Label>
              <Input id="reporter_contact" name="reporter_contact" required placeholder="Phone or email" />
            </div>
            <div>
              <Label>Are you an owner? *</Label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2"><input type="radio" name="reporter_is_owner" value="yes" defaultChecked /> Yes</label>
                <label className="flex items-center gap-2"><input type="radio" name="reporter_is_owner" value="no" /> No</label>
              </div>
            </div>
          </div>
        </section>

        {/* Violator */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Violator Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="violator_name">Name (if known)</Label>
              <Input id="violator_name" name="violator_name" placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="violator_unit">Unit Number</Label>
              <Input id="violator_unit" name="violator_unit" placeholder="Unit 205" />
            </div>
          </div>
        </section>

        {/* Violation Type & House Rules */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Nature of Violation</h2>

          <div className="mb-4">
            <Label htmlFor="violation_type">Type *</Label>
            <select
              id="violation_type"
              name="violation_type"
              required
              defaultValue={a?.violation_type ?? ''}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select type</option>
              {Object.entries(VIOLATION_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {a?.violation_type && (
              <p className="mt-1 text-xs text-blue-600">Pre-filled by AI — you can change if needed.</p>
            )}
          </div>

          {rules.length > 0 && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
              <Label htmlFor="house_rule_id">Applicable House Rule (select exact rule)</Label>
              <select
                id="house_rule_id"
                name="house_rule_id"
                defaultValue={a?.matched_house_rule_id ?? ''}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">-- Select the exact rule being violated --</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    Rule {r.rule_number} — {r.title} ({r.penalty_type === 'fine' ? `Up to $${r.fine_amount}` : r.penalty_type})
                  </option>
                ))}
              </select>
              {a?.matched_house_rule_id && (
                <p className="mt-1 text-xs text-blue-600">
                  AI matched this rule: {a.matched_rule_explanation || 'Best match based on photo analysis.'}
                </p>
              )}
              {!a?.matched_house_rule_id && (
                <p className="mt-1 text-xs text-blue-700">You must reference the exact House Rule. View all rules at the bottom of this page.</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="violation_description">Details (dates, times, witnesses) *</Label>
            <textarea
              id="violation_description"
              name="violation_description"
              required
              rows={5}
              defaultValue={a?.description ?? ''}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Please provide detailed information including specific dates, times, and any witnesses..."
            />
            {a?.description && (
              <p className="mt-1 text-xs text-blue-600">Pre-filled by AI — edit or add your own details.</p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label htmlFor="dates_times">Specific Dates/Times</Label><Input id="dates_times" name="dates_times" placeholder="e.g. June 5, 2026 at 11:30 PM" /></div>
            <div><Label htmlFor="witnesses">Witnesses</Label><Input id="witnesses" name="witnesses" placeholder="Names of witnesses if any" /></div>
          </div>

          <div className="mt-4">
            <Label>Have you reported this before? *</Label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="previously_reported" value="yes" /> Yes</label>
              <label className="flex items-center gap-2"><input type="radio" name="previously_reported" value="no" defaultChecked /> No</label>
            </div>
          </div>

          {/* Severity (from AI) - hidden field for data collection */}
          {a?.severity && (
            <input type="hidden" name="ai_severity" value={a.severity} />
          )}
          {a?.confidence != null && (
            <input type="hidden" name="ai_confidence" value={String(a.confidence)} />
          )}
        </section>

        {/* Requested Action */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Requested Action</h2>
          <select name="requested_action" defaultValue="warning" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="warning">Warning</option>
            <option value="fine">Fine</option>
            <option value="hearing">Formal Hearing</option>
          </select>
        </section>

        {/* Signature */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Signature</h2>
          <div>
            <Label htmlFor="reporter_signature">Type your full name as signature *</Label>
            <Input id="reporter_signature" name="reporter_signature" required placeholder="Type your full name" />
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_share_info" required className="mt-1" />
              <span>I understand this report may be shared with the association board, management company, or other relevant parties. *</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_true_accurate" required className="mt-1" />
              <span>I certify the information provided is true and accurate to the best of my knowledge. *</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ack_may_contact" required className="mt-1" />
              <span>I understand I may be contacted for additional information. *</span>
            </label>
          </div>
        </section>

        <Button type="submit" size="lg" className="w-full">Submit Violation Report</Button>
        <p className="text-center text-xs text-gray-400">* Required fields. This report is delivered to management for review.</p>
      </form>

      {/* House Rules Reference */}
      {rules.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">House Rules & Regulations</h2>
          <div className="space-y-4">
            {rules.map((r) => (
              <div key={r.id} className="border-b border-gray-200 pb-3">
                <h3 className="font-medium text-gray-900">Rule {r.rule_number} — {r.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{r.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                  <span>Category: {r.category}</span>
                  <span>Penalty: {r.penalty_type === 'fine' ? `Up to $${r.fine_amount}` : r.penalty_type}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Violation Reporting & Resolution Process</h2>
        <p className="text-sm text-gray-600 mb-4">Maintaining community standards requires consistent, fair enforcement of association rules per the Illinois Condominium Property Act.</p>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">Common Violations</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
              <li>Noise disturbances and quiet hours violations</li>
              <li>Unauthorized modifications to common areas</li>
              <li>Parking and vehicle violations</li>
              <li>Pet policy violations</li>
              <li>Improper waste disposal</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Due Process</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
              <li>Written notice of alleged violation with specific rule reference</li>
              <li>10-day period to respond or request hearing</li>
              <li>Formal hearing before the Board if requested</li>
              <li>Board must respond to hearing request within 10 days</li>
              <li>No fine applied until final determination</li>
              <li>Appeal process available for disputed violations</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

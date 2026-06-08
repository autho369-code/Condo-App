'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const LETTER_TYPES = [
  { value: 'violation_notice', label: 'Violation Notice' },
  { value: 'welcome_letter', label: 'Welcome Letter' },
  { value: 'assessment_letter', label: 'Assessment Letter' },
  { value: 'board_packet', label: 'Board Packet' },
  { value: 'general', label: 'General' },
];

export default function GenerateDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<'select' | 'fill' | 'preview' | 'sent'>('select');
  const [letterType, setLetterType] = useState(searchParams.get('type') ?? '');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [associations, setAssociations] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);

  // Merge variable values
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Notice sending
  const [sendAsNotice, setSendAsNotice] = useState(false);
  const [selectedAssociation, setSelectedAssociation] = useState('');
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Load templates when type changes
  useEffect(() => {
    if (!letterType) return;
    loadTemplates(letterType);
    loadAssociations();
  }, [letterType]);

  // Load owners
  useEffect(() => {
    loadAllOwners();
  }, []);

  // Load violation data if violation notice type
  useEffect(() => {
    if (letterType === 'violation_notice' && selectedAssociation) {
      loadViolations(selectedAssociation);
    }
  }, [letterType, selectedAssociation]);

  async function loadTemplates(type: string) {
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('document_templates')
      .select('id, name, letter_type, subject, body, merge_variables')
      .eq('letter_type', type)
      .is('archived_at', null)
      .eq('active', true)
      .order('name');
    setTemplates((data ?? []) as any[]);
    setLoadingTemplates(false);

    const templateId = searchParams.get('template');
    if (templateId && data) {
      const t = data.find((t: any) => t.id === templateId);
      if (t) selectTemplate(t);
    }
  }

  async function loadAssociations() {
    const { data } = await supabase
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name');
    setAssociations((data ?? []) as any[]);
  }

  async function loadAllOwners() {
    const { data } = await supabase
      .from('owners')
      .select('id, first_name, last_name, email')
      .is('archived_at', null)
      .order('last_name')
      .limit(500);
    setOwners((data ?? []) as any[]);
  }

  async function loadViolations(associationId: string) {
    const { data } = await supabase
      .from('violations')
      .select('id, title, violation_type, reported_date, cure_deadline, fine_amount, status')
      .eq('association_id', associationId)
      .is('archived_at', null)
      .in('status', ['open', 'notice_sent'])
      .order('reported_date', { ascending: false })
      .limit(50);
    setViolations((data ?? []) as any[]);
  }

  function selectTemplate(template: any) {
    setSelectedTemplate(template);
    setSubject(template.subject ?? '');
    setBody(template.body ?? '');

    // Initialize variables from merge_variables
    const mergeVars = template.merge_variables ?? {};
    const initial: Record<string, string> = {};
    if (Array.isArray(mergeVars)) {
      mergeVars.forEach((v: any) => {
        initial[v.key ?? v.name ?? v] = '';
      });
    } else if (typeof mergeVars === 'object') {
      Object.keys(mergeVars).forEach((k) => {
        initial[k] = '';
      });
    }
    setVariables(initial);
    setStep('fill');
  }

  function updateVariable(key: string, value: string) {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }

  function applyMergeVariables() {
    let result = body;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, value || `[${key}]`);
    });
    return result;
  }

  function handlePreview() {
    setBody(applyMergeVariables());
    setStep('preview');
  }

  async function handleGenerate() {
    setSending(true);
    const finalBody = applyMergeVariables();

    try {
      // Save to documents table
      const fileName = `${(letterType ?? 'document').replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
      const { error: docErr } = await supabase.from('documents').insert({
        entity_type: selectedAssociation ? 'association' : 'general',
        entity_id: selectedAssociation || '00000000-0000-0000-0000-000000000000',
        doc_type: letterType,
        file_name: fileName,
        file_url: '',
        uploaded_at: new Date().toISOString(),
      });
      if (docErr) console.error('Failed to save document:', docErr);

      // If sending as notice
      if (sendAsNotice && selectedAssociation) {
        const { error: noticeErr } = await supabase.from('notices').insert({
          association_id: selectedAssociation,
          notice_type: letterType as any,
          status: 'draft',
          subject,
          body: finalBody,
          send_to: selectedOwners.length > 0 ? 'selected_owners' : 'all_owners',
          channel: 'email',
          template_id: selectedTemplate?.id ?? null,
        });

        if (noticeErr) {
          console.error('Failed to create notice:', noticeErr);
        } else {
          setStep('sent');
          return;
        }
      }

      setStep('sent');
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setSending(false);
    }
  }

  function renderVariableInput(key: string, value: string) {
    // Smart field type detection by key name
    const isDate = key.includes('date') || key.includes('deadline');
    const isAmount = key.includes('amount') || key.includes('fee') || key.includes('fine');
    const isLong = key.includes('description') || key.includes('body') || key.includes('details');

    if (isLong) {
      return (
        <textarea
          value={value}
          onChange={(e) => updateVariable(key, e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm h-20"
          placeholder={`Enter ${key.replace(/_/g, ' ')}...`}
        />
      );
    }

    return (
      <input
        type={isDate ? 'date' : 'text'}
        value={value}
        onChange={(e) => updateVariable(key, e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        placeholder={isAmount ? '0.00' : `Enter ${key.replace(/_/g, ' ')}...`}
      />
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">Generate Document</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Create violation notices, welcome letters, assessment letters, and board packets from templates.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/documents">
              <Button variant="secondary">Back to Documents</Button>
            </Link>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex gap-4">
          {['select', 'fill', 'preview', 'sent'].map((s, i) => (
            <div key={s} className={`flex items-center gap-2 text-sm ${
              step === s ? 'font-medium text-brand-600' : 'text-gray-400'
            }`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</span>
              {s === 'select' ? 'Select Template' : s === 'fill' ? 'Fill Variables' : s === 'preview' ? 'Preview' : 'Done'}
            </div>
          ))}
        </div>

        {/* ── STEP 1: SELECT ── */}
        {step === 'select' && (
          <div className="space-y-6">
            {/* Letter type selector */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-950">Document Type</h2>
              <div className="flex flex-wrap gap-2">
                {LETTER_TYPES.map((lt) => (
                  <button
                    key={lt.value}
                    onClick={() => {
                      setLetterType(lt.value);
                      setSelectedTemplate(null);
                      setStep('select');
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm transition ${
                      letterType === lt.value
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {lt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template list */}
            {letterType && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-950">
                  {loadingTemplates ? 'Loading templates...' : templates.length > 0 ? 'Select a Template' : 'No Templates Available'}
                </h2>
                {templates.length > 0 ? (
                  <div className="grid gap-2">
                    {templates.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className="rounded border border-gray-200 px-4 py-3 text-left text-sm hover:border-brand-200 hover:bg-brand-50"
                      >
                        <div className="font-medium text-gray-900">{t.name}</div>
                        {t.subject && <div className="text-xs text-gray-500 mt-0.5">{t.subject}</div>}
                      </button>
                    ))}
                  </div>
                ) : (
                  !loadingTemplates && (
                    <div className="rounded border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-gray-500">
                      No {LETTER_TYPES.find((lt) => lt.value === letterType)?.label} templates found.{' '}
                      <Link href="/documents/templates/new" className="text-blue-700 hover:underline">
                        Create one
                      </Link>
                      .
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: FILL ── */}
        {step === 'fill' && selectedTemplate && (
          <div className="space-y-6">
            {/* Association / Owner context */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-950">Context (Optional)</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-medium text-gray-700">
                  Association
                  <select
                    value={selectedAssociation}
                    onChange={(e) => setSelectedAssociation(e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select association...</option>
                    {associations.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>

                {owners.length > 0 && (
                  <label className="text-xs font-medium text-gray-700">
                    Owners
                    <select
                      multiple
                      value={selectedOwners}
                      onChange={(e) => setSelectedOwners(Array.from(e.target.selectedOptions, (o) => o.value))}
                      className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm h-28"
                    >
                      {owners.map((o: any) => (
                        <option key={o.id} value={o.id}>
                          {o.last_name}, {o.first_name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-gray-400">Ctrl+click for multi-select</span>
                  </label>
                )}
              </div>

              {/* Auto-fill from violations */}
              {violations.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-700">
                    Link to Violation (auto-fills variables)
                    <select
                      onChange={(e) => {
                        const v = violations.find((v: any) => v.id === e.target.value);
                        if (v) {
                          updateVariable('violation_title', v.title ?? '');
                          updateVariable('violation_type', (v.violation_type ?? '').replace(/_/g, ' '));
                          updateVariable('violation_date', v.reported_date ?? '');
                          updateVariable('cure_deadline', v.cure_deadline ?? '');
                          updateVariable('fine_amount', v.fine_amount ?? '');
                        }
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select a violation...</option>
                      {violations.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.title} ({v.violation_type?.replace(/_/g, ' ') ?? 'N/A'})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* Merge variables */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-950">Merge Variables</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(variables).map(([key, value]) => (
                  <label key={key} className="text-xs font-medium text-gray-700">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    {renderVariableInput(key, value)}
                  </label>
                ))}
              </div>
              {Object.keys(variables).length === 0 && (
                <p className="text-sm text-gray-500">This template has no merge variables. You can proceed directly to preview.</p>
              )}
            </div>

            {/* Subject override */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <label className="text-sm font-semibold text-gray-950">
                Subject
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Document subject..."
                />
              </label>
            </div>

            {/* Send as notice toggle */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={sendAsNotice}
                  onChange={(e) => setSendAsNotice(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>
                  <span className="font-medium text-gray-900">Send as notice</span>
                  <span className="block text-xs text-gray-500">Creates a notice record and optionally emails to selected owners.</span>
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePreview}>Preview Document</Button>
              <Button variant="secondary" onClick={() => setStep('select')}>Back</Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PREVIEW ── */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-950">Subject: {subject}</h2>
              <div className="rounded border border-gray-100 bg-gray-50 p-6">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">{body}</pre>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={sending}>
                {sending ? 'Generating...' : sendAsNotice ? 'Generate & Create Notice' : 'Generate Document'}
              </Button>
              <Button variant="secondary" onClick={() => setStep('fill')}>Back to Edit</Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: SENT ── */}
        {step === 'sent' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-emerald-900">Document Generated Successfully</h2>
            <p className="mt-1 text-sm text-emerald-700">
              {sendAsNotice ? 'The notice has been created and is ready to send.' : 'The document has been saved.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/documents?tab=notices">
                <Button>View Notices</Button>
              </Link>
              <Link href="/documents/generate">
                <Button variant="secondary" onClick={() => {
                  setStep('select');
                  setSelectedTemplate(null);
                  setVariables({});
                  setSubject('');
                  setBody('');
                  setSendAsNotice(false);
                }}>
                  Generate Another
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

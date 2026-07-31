'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageShell, PageHeader, SectionTitle, Surface } from '@/components/ui/shell';
import { createClient } from '@/lib/supabase/client';
import { generateAndStoreDocument } from '@/lib/rpcs/documents';

const LETTER_TYPES = [
  { value: 'violation_notice', label: 'Violation Notice' },
  { value: 'welcome_letter', label: 'Welcome Letter' },
  { value: 'assessment_letter', label: 'Assessment Letter' },
  { value: 'board_packet', label: 'Board Packet' },
  { value: 'general', label: 'General' },
];

export default function GenerateDocumentPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

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
  const [generationError, setGenerationError] = useState('');

  const selectTemplate = useCallback((template: any) => {
    setSelectedTemplate(template);
    setSubject(template.subject ?? '');
    setBody(template.body ?? '');
    const mergeVars = template.merge_variables ?? {};
    const initial: Record<string, string> = {};
    if (Array.isArray(mergeVars)) {
      mergeVars.forEach((value: any) => { initial[value.key ?? value.name ?? value] = ''; });
    } else if (typeof mergeVars === 'object') {
      Object.keys(mergeVars).forEach((key) => { initial[key] = ''; });
    }
    setVariables(initial);
    setStep('fill');
  }, []);

  const loadTemplates = useCallback(async (type: string) => {
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
  }, [searchParams, selectTemplate, supabase]);

  const loadAssociations = useCallback(async () => {
    const { data } = await supabase
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name');
    setAssociations((data ?? []) as any[]);
  }, [supabase]);

  const loadAssociationOwners = useCallback(async (associationId: string) => {
    const { data } = await supabase
      .from('occupancies')
      .select('owners!owner_id(id, first_name, last_name, email)')
      .eq('association_id', associationId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .limit(500);
    const unique = new Map<string, any>();
    (data ?? []).forEach((row: any) => {
      if (row.owners?.id) unique.set(row.owners.id, row.owners);
    });
    setOwners([...unique.values()].sort((a, b) => String(a.last_name ?? '').localeCompare(String(b.last_name ?? ''))));
  }, [supabase]);

  const loadViolations = useCallback(async (associationId: string) => {
    const { data } = await supabase
      .from('violations')
      .select('id, title, violation_type, reported_date, cure_deadline, fine_amount, status')
      .eq('association_id', associationId)
      .is('archived_at', null)
      .in('status', ['open', 'notice_sent'])
      .order('reported_date', { ascending: false })
      .limit(50);
    setViolations((data ?? []) as any[]);
  }, [supabase]);

  useEffect(() => {
    if (!letterType) return;
    void loadTemplates(letterType);
    void loadAssociations();
  }, [letterType, loadAssociations, loadTemplates]);

  useEffect(() => {
    setSelectedOwners([]);
    if (selectedAssociation) void loadAssociationOwners(selectedAssociation);
    else setOwners([]);
  }, [loadAssociationOwners, selectedAssociation]);

  useEffect(() => {
    if (letterType === 'violation_notice' && selectedAssociation) {
      void loadViolations(selectedAssociation);
    } else {
      setViolations([]);
    }
  }, [letterType, loadViolations, selectedAssociation]);

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
    setGenerationError('');
    const finalBody = applyMergeVariables();

    try {
      await generateAndStoreDocument({
        templateId: selectedTemplate?.id ?? null,
        associationId: selectedAssociation,
        ownerIds: selectedOwners,
        letterType,
        subject,
        body: finalBody,
        createDraftNotice: sendAsNotice,
      });
      setStep('sent');
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Document generation failed.');
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
        <Textarea
          value={value}
          onChange={(e) => updateVariable(key, e.target.value)}
          className="min-h-[80px]"
          placeholder={`Enter ${key.replace(/_/g, ' ')}...`}
        />
      );
    }

    return (
      <Input
        type={isDate ? 'date' : 'text'}
        value={value}
        onChange={(e) => updateVariable(key, e.target.value)}
        placeholder={isAmount ? '0.00' : `Enter ${key.replace(/_/g, ' ')}...`}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Generate document"
        description="Create violation notices, welcome letters, assessment letters, and board packets from templates."
        actions={
          <Link href="/documents">
            <Button variant="secondary">Back to documents</Button>
          </Link>
        }
      />

      {/* Step indicator */}
      <div className="mb-6 flex flex-wrap gap-4">
        {['select', 'fill', 'preview', 'sent'].map((s, i) => (
          <div key={s} className={`flex items-center gap-2 text-sm ${
            step === s ? 'font-medium text-gray-950' : 'text-gray-400'
          }`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              step === s ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</span>
            {s === 'select' ? 'Select template' : s === 'fill' ? 'Fill variables' : s === 'preview' ? 'Preview' : 'Done'}
          </div>
        ))}
      </div>

      {/* ── STEP 1: SELECT ── */}
      {step === 'select' && (
        <div className="space-y-6">
          {/* Letter type selector */}
          <Surface>
            <SectionTitle title="Document type" />
            <div className="flex flex-wrap gap-2">
              {LETTER_TYPES.map((lt) => (
                <button
                  key={lt.value}
                  onClick={() => {
                    setLetterType(lt.value);
                    setSelectedTemplate(null);
                    setStep('select');
                  }}
                  className={`h-10 rounded-lg border px-4 text-sm transition-colors ${
                    letterType === lt.value
                      ? 'border-gray-950 bg-gray-950 font-medium text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {lt.label}
                </button>
              ))}
            </div>
          </Surface>

          {/* Template list */}
          {letterType && (
            <Surface>
              <SectionTitle
                title={loadingTemplates ? 'Loading templates…' : templates.length > 0 ? 'Select a template' : 'No templates available'}
              />
              {templates.length > 0 ? (
                <div className="grid gap-2">
                  {templates.map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{t.name}</div>
                      {t.subject && <div className="mt-0.5 text-xs text-gray-500">{t.subject}</div>}
                    </button>
                  ))}
                </div>
              ) : (
                !loadingTemplates && (
                  <div className="px-6 py-8 text-center text-sm text-gray-500">
                    No {LETTER_TYPES.find((lt) => lt.value === letterType)?.label} templates found.{' '}
                    <Link href="/documents/templates/new" className="font-medium text-gray-700 hover:text-gray-950 hover:underline">
                      Create one
                    </Link>
                    .
                  </div>
                )
              )}
            </Surface>
          )}
        </div>
      )}

      {/* ── STEP 2: FILL ── */}
      {step === 'fill' && selectedTemplate && (
        <div className="space-y-6">
          {/* Association / Owner context */}
          <Surface>
            <SectionTitle title="Association and recipients" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Association">
                <Select
                  value={selectedAssociation}
                  onChange={(e) => setSelectedAssociation(e.target.value)}
                >
                  <option value="">Select association…</option>
                  {associations.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </Field>

              {selectedAssociation && owners.length > 0 && (
                <Field label="Owners" hint="Ctrl+click for multi-select">
                  <select
                    multiple
                    value={selectedOwners}
                    onChange={(e) => setSelectedOwners(Array.from(e.target.selectedOptions, (o) => o.value))}
                    className="block h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {owners.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.last_name}, {o.first_name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {/* Auto-fill from violations */}
            {violations.length > 0 && (
              <div className="mt-4">
                <Field label="Link to violation (auto-fills variables)">
                  <Select
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
                  >
                    <option value="">Select a violation…</option>
                    {violations.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.violation_type?.replace(/_/g, ' ') ?? 'N/A'})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </Surface>

          {/* Merge variables */}
          <Surface>
            <SectionTitle title="Merge variables" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(variables).map(([key, value]) => (
                <Field key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
                  {renderVariableInput(key, value)}
                </Field>
              ))}
            </div>
            {Object.keys(variables).length === 0 && (
              <p className="text-sm text-gray-500">This template has no merge variables. You can proceed directly to preview.</p>
            )}
          </Surface>

          {/* Subject override */}
          <Surface>
            <Field label="Subject">
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Document subject…"
              />
            </Field>
          </Surface>

          {/* Draft notice toggle */}
          <Surface>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={sendAsNotice}
                onChange={(e) => setSendAsNotice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>
                <span className="font-medium text-gray-900">Create a draft notice</span>
                <span className="block text-xs text-gray-500">Creates a reviewable notice draft. No email is sent until the notice is approved and sent.</span>
              </span>
            </label>
          </Surface>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={!selectedAssociation || !subject.trim()}>Preview document</Button>
            <Button variant="secondary" onClick={() => setStep('select')}>Back</Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW ── */}
      {step === 'preview' && (
        <div className="space-y-6">
          {generationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{generationError}</div>
          )}
          <Surface>
            <SectionTitle title={`Subject: ${subject}`} className="mb-2" />
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{body}</pre>
            </div>
          </Surface>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={sending}>
              {sending ? 'Generating…' : sendAsNotice ? 'Generate PDF & draft notice' : 'Generate PDF'}
            </Button>
            <Button variant="secondary" onClick={() => setStep('fill')}>Back to edit</Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: SENT ── */}
      {step === 'sent' && (
        <Surface className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-[15px] font-semibold text-gray-950">Document generated successfully</h2>
          <p className="mt-1 text-sm text-gray-500">
            {sendAsNotice ? 'The PDF is saved and the notice draft is ready for review.' : 'The PDF has been saved securely.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={sendAsNotice ? '/documents?tab=notices' : '/documents?tab=generated'}>
              <Button>{sendAsNotice ? 'View notices' : 'View generated documents'}</Button>
            </Link>
            <Button variant="secondary" onClick={() => {
              setStep('select');
              setSelectedTemplate(null);
              setVariables({});
              setSubject('');
              setBody('');
              setSendAsNotice(false);
            }}>
              Generate another
            </Button>
          </div>
        </Surface>
      )}
    </PageShell>
  );
}

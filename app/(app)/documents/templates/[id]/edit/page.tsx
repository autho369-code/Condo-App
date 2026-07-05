'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const LETTER_TYPES = [
  { value: 'violation_notice', label: 'Violation Notice' },
  { value: 'welcome_letter', label: 'Welcome Letter' },
  { value: 'assessment_letter', label: 'Assessment Letter' },
  { value: 'board_packet', label: 'Board Packet' },
  { value: 'general', label: 'General' },
];

// template_category is a DB enum (association|owner|vendor|applicant|statement|generic),
// distinct from letter_type — inserting the letter_type value fails the enum check.
const TEMPLATE_CATEGORY_FOR_LETTER_TYPE: Record<string, string> = {
  violation_notice: 'owner',
  welcome_letter: 'owner',
  assessment_letter: 'owner',
  board_packet: 'association',
  general: 'generic',
};

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [letterType, setLetterType] = useState('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mergeVarInput, setMergeVarInput] = useState('');
  const [mergeVariables, setMergeVariables] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: template } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (!template) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const t = template as any;
      setName(t.name ?? '');
      setLetterType(t.letter_type ?? 'general');
      setSubject(t.subject ?? '');
      setBody(t.body ?? '');
      setActive(t.active ?? true);
      const mv = t.merge_variables ?? [];
      setMergeVariables(
        Array.isArray(mv) ? mv.map((v: any) => v.key ?? v.name ?? v).filter(Boolean) : Object.keys(mv),
      );
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function addMergeVariable() {
    const v = mergeVarInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!v || mergeVariables.includes(v)) return;
    setMergeVariables([...mergeVariables, v]);
    setMergeVarInput('');
  }

  function removeMergeVariable(v: string) {
    setMergeVariables(mergeVariables.filter((m) => m !== v));
  }

  function insertVariable(v: string) {
    setBody(body + `{{${v}}}`);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    setError('');
    setSaving(true);

    const mergeVarsObj = mergeVariables.map((v) => ({ key: v }));

    const { error: updateErr } = await (supabase as any)
      .from('document_templates')
      .update({
        name: name.trim(),
        letter_type: letterType,
        template_category: TEMPLATE_CATEGORY_FOR_LETTER_TYPE[letterType] ?? 'generic',
        subject: subject.trim(),
        body: body.trim(),
        merge_variables: mergeVarsObj,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (updateErr) {
      console.error('Failed to update template:', updateErr);
      setError('Failed to save changes. Please try again.');
      return;
    }

    router.push(`/documents/templates/${id}`);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading template…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full bg-gray-50">
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <p className="text-sm text-gray-500">Template not found. It may have been deleted or archived.</p>
            <Link href="/documents?tab=templates" className="mt-3 inline-block text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
              Back to templates →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">Edit Template</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Update this document template. Changes apply to future documents only — previously generated documents keep their original content.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/documents/templates/${id}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </div>

        <div className="max-w-3xl space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
          )}

          {/* Basic info */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-700">
                Template Name *
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g., Standard Violation Notice"
                />
              </label>

              <label className="text-xs font-medium text-gray-700">
                Document Type
                <select
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {LETTER_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-700">
              Default Subject
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="e.g., Notice of Violation — {{violation_title}}"
              />
            </label>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-gray-700">Active (available for use)</span>
            </label>
          </div>

          {/* Merge variables */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 className="mb-4 text-sm font-semibold text-gray-950">Merge Variables</h2>
            <p className="text-xs text-gray-500 mb-4">
              Variables are placeholders like{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{'{{owner_name}}'}</code> that
              get replaced with actual values when generating a document.
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={mergeVarInput}
                onChange={(e) => setMergeVarInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addMergeVariable();
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="e.g., owner_name"
              />
              <Button variant="secondary" onClick={addMergeVariable}>Add</Button>
            </div>

            {mergeVariables.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {mergeVariables.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15"
                  >
                    {'{{'}
                    {v}
                    {'}}'}
                    <button
                      onClick={() => removeMergeVariable(v)}
                      className="ml-0.5 text-blue-400 transition-colors hover:text-red-500"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No merge variables added yet.</p>
            )}
          </div>

          {/* Body editor */}
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-950">Template Body</h2>
              <div className="flex gap-1">
                {mergeVariables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="rounded-lg border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-100"
                    title="Insert variable"
                  >
                    {'{{'}
                    {v}
                    {'}}'}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="h-80 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Write your template body here. Use {{variable_name}} for merge fields."
            />
            <p className="mt-2 text-xs text-gray-400">
              Use <code className="rounded bg-gray-100 px-1 text-xs">{'{{variable_name}}'}</code> syntax
              for merge fields. Variables will be automatically detected and available when generating documents.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pb-8">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Link href={`/documents/templates/${id}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

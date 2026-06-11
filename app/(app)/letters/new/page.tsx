'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import MergeFieldEditor, { MERGE_FIELDS } from '@/components/letters/merge-field-editor';

const CATEGORIES = ['association', 'owner', 'vendor', 'applicant', 'statement', 'generic'];

export default function NewLetterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('generic');
  const [letterType, setLetterType] = useState('');
  const [body, setBody] = useState('<p></p>');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mergeVars = MERGE_FIELDS.map((f) => f.key);

  async function handleSave(active = true) {
    if (!name.trim()) { setError('Template name is required.'); return; }
    setSaving(true);
    setError('');

    const supabase = createClient();

    // Get current user's portfolio_id
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = await supabase
      .from('profiles')
      .select('portfolio_id')
      .eq('id', session?.user?.id ?? '')
      .single();
    const portfolioId = (profile as any)?.portfolio_id;

    if (!portfolioId) {
      setError('Could not determine your portfolio. Please try again.');
      setSaving(false);
      return;
    }

    const { error: err } = await supabase.from('document_templates').insert({
      portfolio_id: portfolioId,
      name: name.trim(),
      subject: subject.trim() || null,
      template_category: category as any,
      letter_type: (letterType.trim() || null) as any,
      body,
      merge_variables: mergeVars,
      active,
      // portfolio_id will be auto-set by RLS or trigger
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    router.push('/letters');
    router.refresh();
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-8 py-6">
      <nav className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/letters" className="transition-colors hover:text-gray-700">Letters</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">New template</span>
      </nav>

      <h1 className="mb-6 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">New letter template</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
      )}

      <div className="space-y-6">
        {/* Metadata fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Template name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Late Fee Notice"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Type / code</label>
            <input
              type="text"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
              placeholder="e.g., late_fee_notice"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm capitalize text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Subject line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Important: Late Assessment Notice for {{owner_name}}"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-gray-400">Use {'{{field_key}}'} for merge fields in subject.</p>
          </div>
        </div>

        {/* WYSIWYG editor */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-gray-700">Letter body</label>
          <MergeFieldEditor
            value={body}
            onChange={setBody}
            placeholder="Dear {{owner_name}},&#10;&#10;This notice is regarding your account at {{association_name}}..."
          />
        </div>

        {/* Merge field reference */}
        <details className="rounded-xl border border-gray-200 bg-gray-50/60">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-gray-700">Available merge fields</summary>
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
              {MERGE_FIELDS.map((f) => (
                <div key={f.key} className="text-xs">
                  <code className="text-blue-700">{`{{${f.key}}}`}</code>
                  <span className="ml-1 text-gray-400">— {f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <Link href="/letters">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save letter'}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save & publish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

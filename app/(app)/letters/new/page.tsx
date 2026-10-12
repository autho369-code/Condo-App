'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, buttonClass } from '@/components/ui/button';
import MergeFieldEditor, { MERGE_FIELDS } from '@/components/letters/merge-field-editor';
import { Field, Input, Select } from '@/components/ui/input';

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
      <nav className="mb-4 text-[13px] font-semibold text-gray-700">
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
          <Field label="Template name" required htmlFor="letter-name">
            <Input
              id="letter-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Late Fee Notice"
            />
          </Field>
          <Field label="Type / code" htmlFor="letter-type">
            <Input
              id="letter-type"
              type="text"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
              placeholder="e.g., late_fee_notice"
            />
          </Field>
          <Field label="Category" htmlFor="letter-category">
            <Select
              id="letter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subject line" htmlFor="letter-subject" hint={<>Use {'{{field_key}}'} for merge fields in subject.</>}>
            <Input
              id="letter-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Important: Late Assessment Notice for {{owner_name}}"
            />
          </Field>
        </div>

        {/* WYSIWYG editor */}
        <div>
          <p id="letter-body-label" className="mb-1.5 block text-[13.5px] font-medium text-gray-700">Letter body</p>
          <MergeFieldEditor
            labelledBy="letter-body-label"
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
          <Link href="/letters" className={buttonClass('ghost')}>Cancel</Link>
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

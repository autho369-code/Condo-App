'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import MergeFieldEditor, { MERGE_FIELDS } from '@/components/letters/merge-field-editor';

const CATEGORIES = ['association', 'owner', 'vendor', 'applicant', 'statement', 'generic'];

export default function EditLetterPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('generic');
  const [letterType, setLetterType] = useState('');
  const [body, setBody] = useState('<p></p>');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (err || !data) {
        setError('Template not found.');
        setLoading(false);
        return;
      }

      setName(data.name);
      setSubject(data.subject || '');
      setCategory(data.template_category || 'generic');
      setLetterType(data.letter_type || '');
      setBody(data.body);
      setActive(data.active);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(newActive = active) {
    if (!name.trim()) { setError('Template name is required.'); return; }
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase
      .from('document_templates')
      .update({
        name: name.trim(),
        subject: subject.trim() || null,
        template_category: category as any,
        letter_type: (letterType.trim() || null) as any,
        body,
        active: newActive,
      })
      .eq('id', id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    router.push('/letters');
    router.refresh();
  }

  async function handleArchive() {
    if (!confirm('Archive this template? It will no longer appear in the active list.')) return;
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('document_templates')
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq('id', id);
    if (err) { setError(err.message); setSaving(false); return; }
    router.push('/letters');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-gray-200" />
          <div className="h-10 w-64 rounded bg-gray-200" />
          <div className="h-[400px] rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-6">
        <p className="text-red-600">{error}</p>
        <Link href="/letters" className="mt-4 inline-block text-sm text-emerald-600 hover:underline">Back to letters</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-8 py-6">
      <nav className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/letters" className="hover:text-emerald-600">Letters</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{name || 'Edit template'}</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Edit template</h1>
        <div className="flex items-center gap-2">
          {active ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inactive</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">Template name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">Type / code</label>
            <input
              type="text"
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm capitalize focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">Subject line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">Letter body</label>
          <MergeFieldEditor value={body} onChange={setBody} />
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <div className="flex gap-2">
            <Link href="/letters">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button variant="ghost" onClick={handleArchive} className="text-red-600 hover:bg-red-50 hover:text-red-700">
              Archive
            </Button>
          </div>
          <div className="flex gap-3">
            <Link href={`/letters/${id}/preview`}>
              <Button variant="secondary">Preview &amp; send</Button>
            </Link>
            <Button onClick={() => handleSave(active)} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

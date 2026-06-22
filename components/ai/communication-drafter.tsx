'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/input';

type Tone = 'professional' | 'friendly' | 'urgent' | 'formal';

/**
 * Communications copilot — drafts an email subject + body from a short
 * instruction and fills the page's Subject/Message fields. Used as a client
 * island inside the otherwise-server Send Email page.
 */
export function CommunicationDrafter({
  subjectId,
  bodyId,
}: {
  subjectId: string;
  bodyId: string;
}) {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  function fillField(id: string, value: string) {
    const el = document.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!el) return;
    // Use the native setter so React/uncontrolled inputs pick up the change.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function draft() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch('/api/ai/draft-communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'AI not configured') {
          setNotConfigured(true);
        } else {
          setError(data?.hint || data?.error || 'Could not draft this email.');
        }
        return;
      }
      if (data.subject) fillField(subjectId, data.subject);
      if (data.body) fillField(bodyId, data.body);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Draft with AI</h2>
      </div>

      <Field label="What do you want to say?" htmlFor="ai-draft-prompt">
        <Textarea
          id="ai-draft-prompt"
          rows={3}
          placeholder="e.g. Remind owners that the pool reopens for the season and to keep gates locked."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Field>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Tone" htmlFor="ai-draft-tone" className="sm:w-44">
          <Select
            id="ai-draft-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="urgent">Urgent</option>
            <option value="formal">Formal</option>
          </Select>
        </Field>
        <Button
          type="button"
          onClick={draft}
          disabled={loading || !prompt.trim()}
          className="sm:mb-0"
        >
          {loading ? 'Drafting…' : 'Draft'}
        </Button>
      </div>

      {notConfigured && (
        <p className="mt-3 text-sm text-gray-700">
          AI isn’t set up yet.{' '}
          <a
            href="/settings/ai"
            className="font-medium text-blue-600 underline-offset-4 hover:underline"
          >
            Set up AI in Settings → AI
          </a>
          .
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <p className="mt-3 text-[12px] leading-4 text-gray-400">
        AI draft — review before sending.
      </p>
    </div>
  );
}

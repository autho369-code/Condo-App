'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

type State = 'idle' | 'loading' | 'ready' | 'error' | 'unconfigured';

export function ViolationLetterDrafter({ violationId }: { violationId: string }) {
  const [state, setState] = useState<State>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function draft() {
    setState('loading');
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/ai/draft-violation-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violation_id: violationId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 400 && data?.error === 'AI not configured') {
          setState('unconfigured');
          return;
        }
        setError(data?.error || data?.hint || 'Could not draft the letter.');
        setState('error');
        return;
      }

      setText(data?.text ?? '');
      setState('ready');
    } catch {
      setError('Network error — please try again.');
      setState('error');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-950">Violation letter</h2>
          <p className="mt-1 text-sm text-gray-500">
            Generate a draft notice letter to the homeowner using AI.
          </p>
        </div>
        <Button onClick={draft} disabled={state === 'loading'}>
          {state === 'loading'
            ? 'Drafting…'
            : state === 'ready'
              ? 'Regenerate'
              : 'Draft letter with AI'}
        </Button>
      </div>

      {state === 'unconfigured' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI is not configured for this association.{' '}
          <Link href="/settings/ai" className="font-medium underline underline-offset-2">
            Set it up in Settings → AI
          </Link>
          .
        </div>
      )}

      {state === 'error' && error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[320px] font-mono text-[13px] leading-6"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-gray-400">
              AI-generated draft — review before sending.
            </p>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

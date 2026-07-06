'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Turn = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'How much are we owed in total?',
  'Which units are delinquent?',
  'How many work orders are open?',
  'What bills need approval?',
  "What's on the calendar this week?",
];

export function PortfolioAssistant({
  endpoint = '/api/ai/assistant',
  title = 'Portfolio Assistant',
  subtitle = 'Ask about receivables, work orders, bills, violations, and more.',
  starters = STARTERS,
  configureHint,
}: {
  endpoint?: string;
  title?: string;
  subtitle?: string;
  starters?: string[];
  configureHint?: React.ReactNode;
} = {}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    setError(null);
    setNotConfigured(false);
    setInput('');

    // History is the conversation BEFORE this new question (cap to last 6 turns).
    const history = messages.slice(-6);
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === 'AI not configured') {
          setNotConfigured(true);
        } else {
          setError(data?.hint || data?.error || 'Could not answer that.');
        }
        return;
      }
      setMessages([...next, { role: 'assistant', content: data.answer || 'No answer returned.' }]);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-gray-950">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="max-h-[52vh] min-h-[280px] space-y-4 overflow-y-auto px-5 py-5">
        {empty ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-600">Ask a question about your portfolio to get started.</p>
            <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gray-950 px-4 py-2.5 text-sm leading-6 text-white'
                    : 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm leading-6 text-gray-800'
                }
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
              Thinking…
            </div>
          </div>
        )}

        {notConfigured && (
          <p className="text-sm text-gray-700">
            {configureHint ?? (
              <>
                AI isn&apos;t set up yet.{' '}
                <a href="/settings/ai" className="font-medium text-blue-600 underline-offset-4 hover:underline">
                  Set up AI in Settings → AI
                </a>
                .
              </>
            )}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-gray-100 px-5 py-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder="Ask about your portfolio…"
            className="min-h-[44px] max-h-32 w-full resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-6 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-11 shrink-0">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
        <p className="mt-2 text-[12px] leading-4 text-gray-400">
          AI answers from your live data — verify before acting.
        </p>
      </form>
    </div>
  );
}

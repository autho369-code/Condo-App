'use client';

import { useEffect, useRef, useState } from 'react';

// =============================================================================
// Portier Copilot — slide-over AI assistant
// =============================================================================
// Floats a small launcher in the bottom-right of the staff workspace.
// Click (or press Cmd+J / Ctrl+J) to open a slide-over with four ready
// actions and a free-form input. Streams from /api/ai/copilot.
// =============================================================================

type Mode = 'free' | 'draft_board' | 'summarize_financials' | 'classify_maintenance' | 'draft_violation';

const MODES: Array<{ id: Mode; label: string; eyebrow: string; placeholder: string }> = [
  { id: 'free',                  label: 'Ask anything',          eyebrow: 'Free-form',     placeholder: 'How is delinquency trending across the portfolio?' },
  { id: 'draft_board',           label: 'Draft a board response', eyebrow: 'Communication', placeholder: "The treasurer asked why the reserve study was deferred…" },
  { id: 'summarize_financials',  label: 'Summarize financials',  eyebrow: 'Reporting',     placeholder: 'Beacon Hill HOA — May 2026 close' },
  { id: 'classify_maintenance',  label: 'Classify a maintenance request', eyebrow: 'Triage', placeholder: "Tenant says the kitchen faucet won't shut off, water everywhere" },
  { id: 'draft_violation',       label: 'Draft a violation notice', eyebrow: 'Compliance', placeholder: 'Patio furniture stored on common-area lawn for 14+ days' },
];

export function Copilot() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('free');
  const [instruction, setInstruction] = useState('');
  const [context, setContext] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Cmd+J / Ctrl+J launcher
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Auto-scroll output as it streams
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  function reset() {
    aborter.current?.abort();
    setOutput('');
    setErr(null);
    setBusy(false);
  }

  async function run() {
    reset();
    if (!instruction.trim() && mode !== 'summarize_financials') {
      setErr('Add a question or instruction.');
      return;
    }
    setBusy(true);
    aborter.current = new AbortController();
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, instruction, context }),
        signal: aborter.current.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `AI service responded with ${res.status}.`);
        setBusy(false);
        return;
      }

      // Parse Anthropic SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const ev = JSON.parse(json);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              setOutput((o) => o + ev.delta.text);
            }
          } catch { /* tolerate partial frames */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setErr(e.message ?? 'Something went sideways.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher pill */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[80] inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 shadow-soft-lg hover:bg-ink-800 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(18,17,16,0.30)]"
        aria-label="Open Portier copilot"
      >
        <Sparkle />
        <span>Copilot</span>
        <kbd className="hidden rounded border border-cream-300/30 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-cream-300 sm:inline-block">⌘J</kbd>
      </button>

      {/* Slide-over */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Portier copilot"
          className="fixed inset-0 z-[110] flex"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="flex-1 bg-ink-950/40 backdrop-blur-sm" />
          <aside className="flex h-full w-full max-w-[520px] flex-col bg-cream-50 shadow-soft-lg" onMouseDown={(e) => e.stopPropagation()}>
            {/* Header */}
            <header className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-champagne-shimmer text-ink-900">
                    <Sparkle />
                  </span>
                  <span className="font-display text-2xl tracking-editorial text-ink-900">Copilot</span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-500">An assistant that drafts, classifies, and summarises — grounded in your portfolio's data.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Mode picker */}
            <div className="border-b border-ink-100 px-6 py-4">
              <div className="eyebrow">What can I do?</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMode(m.id); setOutput(''); setErr(null); }}
                    className={
                      'inline-flex items-center rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ' +
                      (mode === m.id
                        ? 'border-ink-900 bg-ink-900 text-cream-50'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-cream-100')
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4 border-b border-ink-100 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                  {MODES.find((m) => m.id === mode)?.eyebrow ?? 'Ask'}
                </label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={MODES.find((m) => m.id === mode)?.placeholder}
                  className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
                />
              </div>

              <details className="group">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500 hover:text-ink-700">
                  <span>Add context</span>
                  <span className="text-ink-400 transition-transform group-open:rotate-90">›</span>
                </summary>
                <textarea
                  rows={4}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Paste a financial summary, a board email, a maintenance ticket — anything you want grounded in the answer."
                  className="mt-2 w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
                />
              </details>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-500">
                  Cmd+J to toggle · Esc to close
                </p>
                <button
                  type="button"
                  onClick={run}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-5 py-2 text-sm font-medium text-cream-50 hover:bg-ink-800 transition-colors disabled:opacity-50"
                >
                  {busy ? 'Drafting…' : 'Run'}
                  <Sparkle small />
                </button>
              </div>
            </div>

            {/* Output */}
            <div ref={outputRef} className="flex-1 overflow-y-auto px-6 py-5">
              {err && (
                <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">{err}</div>
              )}
              {!err && !output && !busy && (
                <div className="rounded-md border border-dashed border-ink-200 bg-white p-6 text-center">
                  <div className="font-display text-base text-ink-900 tracking-editorial">Your draft will appear here.</div>
                  <p className="mt-2 text-[12.5px] text-ink-500 leading-relaxed">
                    Pick a task above, fill in the prompt, and Run. Every output is yours
                    to edit — Portier never sends or saves anything until you do.
                  </p>
                </div>
              )}
              {(output || busy) && (
                <div className="rounded-md border border-ink-100 bg-white p-5 shadow-soft-sm">
                  <div className="eyebrow mb-2">Draft</div>
                  <div className="whitespace-pre-wrap font-serif text-[14.5px] leading-relaxed text-ink-900">
                    {output}
                    {busy && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-champagne-500 align-middle" />}
                  </div>
                  {output && !busy && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(output)}
                        className="inline-flex items-center rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-ink-300 hover:bg-cream-100 transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-ink-300 hover:bg-cream-100 transition-colors"
                      >
                        Clear
                      </button>
                      <span className="ml-auto text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
                        Drafted by Portier · review before sending
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Sparkle({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
      <path d="M19 14l.6 1.8L21 16.4l-1.4.6L19 19l-.6-2L17 16.4l1.4-.6L19 14z" opacity=".7" />
    </svg>
  );
}

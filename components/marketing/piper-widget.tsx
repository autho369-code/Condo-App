'use client';

// Piper on the website — same brain as the phone line. Floating bubble on
// every marketing page; opens a chat panel talking to /api/piper (DeepSeek +
// the teachable knowledge base). Also opens via a window 'open-piper' event
// so page sections can deep-link into the chat.
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Phone, Send, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const GREETING =
  "Hi, I'm Piper — ask me anything about Portier369: features, pricing, onboarding, or switching from AppFolio. I can also book you a personal demo. Prefer to talk? Call me at (872) 269-8818 — yes, the same Piper answers the phone.";

export function PiperWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string>('');

  useEffect(() => {
    sessionRef.current = `web-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const openHandler = () => setOpen(true);
    window.addEventListener('open-piper', openHandler);
    return () => window.removeEventListener('open-piper', openHandler);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const r = await fetch('/api/piper', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionRef.current, messages: next.slice(-20) }),
      });
      const data = await r.json();
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply ?? 'Sorry — try me again in a moment.' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'I lost connection for a second — please try again, or call me at (872) 269-8818.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Piper"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#1E3A5F] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(30,58,95,0.4)] transition hover:bg-[#162D4A] print:hidden"
        >
          <MessageCircle className="h-5 w-5" />
          Chat with Piper
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] max-h-[calc(100vh-40px)] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] print:hidden">
          <div className="flex items-center justify-between bg-[#1E3A5F] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">P</div>
              <div>
                <div className="text-sm font-semibold text-white">Piper</div>
                <div className="text-[11px] text-white/70">AI Receptionist · answers 24/7</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a href="tel:+18722698818" aria-label="Call Piper" className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
                <Phone className="h-4 w-4" />
              </a>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50/60 p-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ' +
                    (m.role === 'user'
                      ? 'rounded-br-md bg-[#1E3A5F] text-white'
                      : 'rounded-bl-md border border-gray-200/80 bg-white text-gray-800 shadow-sm')
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-gray-200/80 bg-white px-4 py-3 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {msgs.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-white px-3 pt-2.5">
              {['What does it cost?', 'Book me a demo', 'How do I switch from AppFolio?'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-[#1E3A5F]/40 hover:text-[#1E3A5F]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-white p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              maxLength={600}
              placeholder="Ask Piper anything…"
              className="max-h-24 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#1E3A5F]/50 focus:ring-2 focus:ring-[#1E3A5F]/10"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F] text-white transition hover:bg-[#162D4A] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

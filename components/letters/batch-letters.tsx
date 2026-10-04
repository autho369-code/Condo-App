'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { escapeHtmlText, sanitizeRichTextHtml } from '@/lib/security/rich-text';

export type BatchLetter = {
  key: string;
  recipient: string;
  /** Mailing address lines for the window-envelope block. */
  addressLines: string[];
  unitLabel: string;
  subject: string;
  /** Merged HTML (merge values already escaped); sanitized here before use. */
  bodyUnsafe: string;
};

export function BatchLetters({ letters, title }: { letters: BatchLetter[]; title: string }) {
  const [addressBlock, setAddressBlock] = useState(true);
  // DOMPurify is browser-only: sanitize after mount.
  const [safe, setSafe] = useState<string[] | null>(null);
  useEffect(() => {
    setSafe(letters.map((l) => sanitizeRichTextHtml(l.bodyUnsafe)));
  }, [letters]);

  function addressHtml(l: BatchLetter) {
    return [l.recipient, ...l.addressLines].map((line) => escapeHtmlText(line)).join('<br>');
  }

  function handlePrint() {
    const bodies = letters.map((l) => sanitizeRichTextHtml(l.bodyUnsafe));
    const pages = letters.map((l, i) => `
      <section class="letter">
        ${addressBlock ? `<p class="address">${addressHtml(l)}</p>` : ''}
        ${l.subject ? `<p class="subject"><strong>${escapeHtmlText(l.subject)}</strong></p>` : ''}
        ${bodies[i]}
      </section>`).join('');
    const doc = `<!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <meta name="referrer" content="no-referrer">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
        <title>${escapeHtmlText(title)}</title>
        <style>
          body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; margin: 0; }
          .letter { max-width: 650px; margin: 2rem auto; padding: 0 2rem; page-break-after: always; break-after: page; }
          .letter:last-child { page-break-after: auto; break-after: auto; }
          .address { margin: 0 0 2.5rem; min-height: 5.5em; }
          .subject { margin-bottom: 1.25rem; }
          @media print { .letter { margin: 0 auto; padding: 0.5in 0.75in; } }
        </style>
      </head><body>${pages}
        <script>window.addEventListener('load', function () { window.print(); });<\/script>
      </body></html>`;
    // Blob document + noopener: no document.write into a same-origin popup;
    // every stored or merged value has passed the DOMPurify allowlist above.
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:p-4">
        <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={addressBlock} onChange={(e) => setAddressBlock(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Print the mailing address on each letter (window envelopes)
        </label>
        <div className="sm:ml-auto">
          <Button type="button" onClick={handlePrint} disabled={!safe || letters.length === 0}>
            <Printer className="h-4 w-4" /> Print {letters.length} letter{letters.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {letters.map((l, i) => (
          <article key={l.key} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-3">
              <p className="text-sm font-semibold text-gray-950">{l.recipient}</p>
              <p className="text-xs text-gray-500">{l.unitLabel}</p>
            </div>
            {addressBlock && (
              <p className="mb-6 text-sm leading-6 text-gray-700">
                {[l.recipient, ...l.addressLines].map((line, j) => <span key={j} className="block">{line}</span>)}
                {l.addressLines.length === 0 && <span className="block text-gray-400">No mailing address on file</span>}
              </p>
            )}
            {l.subject && <p className="mb-4 text-sm font-semibold text-gray-950">{l.subject}</p>}
            {safe ? (
              <div className="text-sm leading-6 text-gray-800 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: safe[i] ?? '' }} />
            ) : (
              <p className="text-sm text-gray-400">Preparing preview…</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './button';

/**
 * Copies `value` to the clipboard and says so ("Copied" for two seconds), or
 * says it couldn't (no clipboard access) so the person selects it by hand.
 */
export function CopyButton({ value, label = 'Copy link' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  }
  return (
    <>
      <Button type="button" variant="secondary" onClick={copy}>
        {state === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed: select the link' : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed. Select the link to copy it.' : ''}
      </span>
    </>
  );
}

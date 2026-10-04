'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Label, Textarea } from '@/components/ui/input';
import { mergeTemplate } from '@/lib/letters/merge';

export type ReplyTemplate = { id: string; name: string; body: string };

/**
 * Reply box with a saved-reply picker. Picking a template fills in its merge
 * fields ({{owner_name}}, {{association_name}}, {{owner_unit}}, …) and inserts
 * it at the cursor; the text stays editable before sending.
 */
export function ReplyComposer({
  recipientName,
  templates,
  mergeValues,
}: {
  recipientName: string;
  templates: ReplyTemplate[];
  mergeValues: Record<string, string>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insert(id: string) {
    const t = templates.find((x) => x.id === id);
    const el = ref.current;
    if (!t || !el) return;
    const text = mergeTemplate(t.body, mergeValues, { html: false });
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`.slice(0, 5000);
    el.focus();
    const caret = Math.min(start + text.length, el.value.length);
    el.setSelectionRange(caret, caret);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Label htmlFor="body" className="mb-0">Message to {recipientName}</Label>
        {templates.length > 0 ? (
          <select
            aria-label="Insert a saved reply"
            defaultValue=""
            onChange={(e) => { insert(e.target.value); e.target.value = ''; }}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Insert a saved reply…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <Link href="/sms/templates/new?channel=email" className="text-xs font-medium text-gray-500 hover:text-gray-900">Create a saved reply</Link>
        )}
      </div>
      <Textarea ref={ref} id="body" name="body" rows={5} required maxLength={5000} />
    </div>
  );
}

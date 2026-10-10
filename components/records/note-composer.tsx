'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import type { MentionableStaff } from '@/lib/records/types';

/**
 * Notes textarea with @mentions: typing "@" opens a colleague picker; picking
 * one inserts "@Name" and notifies that person by email when the note is saved.
 * A mention is only sent while its "@Name" is still in the text.
 */
export function NoteComposer({ staff, currentUserId }: { staff: MentionableStaff[]; currentUserId?: string | null }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [text, setText] = React.useState('');
  const [picked, setPicked] = React.useState<MentionableStaff[]>([]);
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);

  const people = staff.filter((p) => p.id !== currentUserId);
  const matches =
    query === null
      ? []
      : people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const mentioned = picked.filter((p) => text.includes(`@${p.name}`));

  function detect(value: string, caret: number) {
    const m = /(^|\s)@([\w.'-]{0,30})$/.exec(value.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  }

  function choose(p: MentionableStaff) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\w.'-]{0,30})$/, `@${p.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setPicked((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        name="body"
        rows={3}
        required
        maxLength={5000}
        value={text}
        aria-label="Note"
        placeholder={people.length ? 'Add a note… type @ to notify a colleague' : 'Add a note…'}
        onChange={(e) => {
          setText(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(matches[active]); }
          else if (e.key === 'Escape') setQuery(null);
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg sm:right-auto sm:w-72">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                className={`flex min-h-10 w-full flex-col items-start px-3 py-1.5 text-left ${i === active ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <span className="text-sm font-medium text-gray-900">{p.name}</span>
                <span className="text-[13px] text-gray-500">{p.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mentioned.map((p) => <input key={p.id} type="hidden" name="mention_ids" value={p.id} />)}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-gray-500">
          {mentioned.length ? <>Will email {mentioned.map((p) => p.name).join(', ')}</> : 'Notes are visible to staff only.'}
        </p>
        <Button type="submit" variant="secondary" size="sm">Add note</Button>
      </div>
    </div>
  );
}

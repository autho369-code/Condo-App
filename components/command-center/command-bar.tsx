'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Basic search routing — searches within the app
    router.push(`/dashboard?search=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-[560px] max-w-[90vw]">
        <form onSubmit={handleSubmit}>
          <div className="rounded-xl bg-[#141417] border border-[#27272a] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-14">
              <span className="text-[#52525b] text-lg">⌘</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search owner, unit, violation, vendor, invoice, document..."
                className="flex-1 bg-transparent text-[15px] text-[#e4e4e7] placeholder:text-[#52525b] outline-none"
              />
              <kbd className="text-[11px] text-[#52525b] bg-[#1a1b1e] px-2 py-0.5 rounded-md font-mono">ESC</kbd>
            </div>
            <div className="border-t border-[#1a1b1e] px-4 py-3">
              <div className="flex items-center gap-4 text-[12px] text-[#52525b]">
                <span>Type to search across owners, units, violations, vendors, and invoices</span>
                <span className="ml-auto">Press Enter to search</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

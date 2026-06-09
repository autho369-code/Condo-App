'use client';

import { useState } from 'react';
import Link from 'next/link';

const ACTIONS = [
  { label: 'New Violation', href: '/violations/new', icon: '⚠' },
  { label: 'New Work Order', href: '/work-orders/new', icon: '🔧' },
  { label: 'New Invoice', href: '/bills/new', icon: '$' },
  { label: 'New Owner', href: '/owners/new', icon: '👤' },
  { label: 'New Vendor', href: '/vendors/new', icon: '🏗️' },
  { label: 'Send Notice', href: '/letters/new', icon: '✉' },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 space-y-1">
          {ACTIONS.map((action, i) => (
            <Link
              key={i}
              href={action.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#141417] border border-[#27272a] text-sm text-[#d4d4d8] hover:bg-[#1a1b1e] hover:border-[#3f3f46] hover:text-white transition-all shadow-lg shadow-black/20"
              onClick={() => setOpen(false)}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all shadow-lg shadow-black/30 ${
          open
            ? 'bg-[#27272a] text-white rotate-45'
            : 'bg-[#18181b] text-[#e4e4e7] hover:bg-[#27272a] border border-[#27272a]'
        }`}
      >
        +
      </button>
    </div>
  );
}

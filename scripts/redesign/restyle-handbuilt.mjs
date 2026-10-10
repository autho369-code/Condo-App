// Restyles hand-built pages to the shared design system by replacing exact,
// whole className values that copy the old kit (header, tables, cards,
// figures) with what the shared components now render. Class-only: no markup,
// text, link, handler or field changes. Usage:
//   node scripts/redesign/restyle-handbuilt.mjs app/company-admin [more dirs]
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const CLASS_MAP = {
  // Page title and description (PageHeader)
  'text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]':
    'font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]',
  'mt-1.5 text-sm leading-6 text-gray-500': 'mt-2 max-w-3xl text-[15px] leading-6 text-gray-500',
  'mt-1.5 max-w-2xl text-sm leading-6 text-gray-500': 'mt-2 max-w-3xl text-[15px] leading-6 text-gray-500',
  // Section titles inside cards
  'text-sm font-semibold text-gray-950': 'font-display text-[16px] font-semibold tracking-[-0.01em] text-ink',
  'text-[15px] font-semibold text-gray-950': 'font-display text-[16px] font-semibold tracking-[-0.01em] text-ink',
  // Cards
  'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]':
    'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
  'overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]':
    'overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
  'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]':
    'rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
  'border-b border-gray-100 px-5 py-4': 'border-b border-line px-5 py-4',
  'flex items-center justify-between border-b border-gray-100 px-5 py-4': 'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
  // Figures (Metric / MetricStrip)
  'text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400': 'text-[13px] font-medium text-gray-500',
  'truncate text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400': 'text-[13px] font-medium leading-5 text-gray-500',
  'mt-1.5 text-2xl font-semibold tabular-nums text-gray-950': 'mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink',
  'mt-1 text-2xl font-semibold tabular-nums text-gray-950': 'mt-1 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink',
  // Small text
  'text-xs font-medium text-gray-500': 'text-[13px] font-medium text-gray-500',
  'mt-0.5 text-xs text-gray-500': 'mt-0.5 text-[13px] text-gray-500',
  'text-xs text-gray-500': 'text-[13px] text-gray-500',
  'mt-1 text-xs text-gray-500': 'mt-1 text-[13px] text-gray-500',
  // Tables (THead / TR / TH / TD)
  'border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500': 'border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500',
  'border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500': 'border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500',
  'border-b border-gray-50 last:border-0 hover:bg-gray-50/60': 'border-b border-line/70 last:border-0 hover:bg-gray-50/70',
  'px-4 py-2.5 text-left font-medium': 'whitespace-nowrap px-4 py-3 text-left font-medium',
  'px-5 py-2.5 text-left font-medium': 'whitespace-nowrap px-5 py-3 text-left font-medium',
  'px-4 py-2.5 text-right font-medium': 'whitespace-nowrap px-4 py-3 text-right font-medium',
  'px-5 py-2.5 text-right font-medium': 'whitespace-nowrap px-5 py-3 text-right font-medium',
  'px-4 py-3': 'px-4 py-3.5',
  'px-5 py-3': 'px-5 py-3.5',
  'px-4 py-3 text-[13px] text-gray-700': 'px-4 py-3.5 text-sm text-gray-700',
  'px-5 py-3 text-[13px] text-gray-700': 'px-5 py-3.5 text-sm text-gray-700',
  'px-4 py-3 text-[13px] tabular-nums text-gray-700': 'px-4 py-3.5 text-sm tabular-nums text-gray-700',
  'px-5 py-3 text-[13px] tabular-nums text-gray-700': 'px-5 py-3.5 text-sm tabular-nums text-gray-700',
  'px-4 py-3 text-right tabular-nums text-gray-700': 'px-4 py-3.5 text-right tabular-nums text-gray-700',
  'px-5 py-3 text-right tabular-nums text-gray-700': 'px-5 py-3.5 text-right tabular-nums text-gray-700',
  // Portal-era extras
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15':
    'mt-1.5 block h-10 w-full rounded-[10px] border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  'rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]':
    'rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6',
  'rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]':
    'rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
  'text-xs text-gray-400': 'text-[13px] text-gray-500',
  'divide-y divide-gray-100': 'divide-y divide-line',
  'px-5 py-2 text-right font-medium': 'whitespace-nowrap px-5 py-3 text-right font-medium',
  'px-5 py-2 text-left font-medium': 'whitespace-nowrap px-5 py-3 text-left font-medium',
  'text-sm font-medium text-gray-700': 'text-[13.5px] font-medium text-gray-700',
  'flex items-center justify-between border-b border-gray-100 px-4 py-3': 'flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5',
  // Uppercase labels and table heads (older pages)
  'text-xs uppercase tracking-wider text-gray-500': 'text-[13px] text-gray-500',
  'text-[12.5px] uppercase tracking-wider text-gray-500': 'text-[13px] text-gray-500',
  'bg-gray-50 text-xs uppercase tracking-wide text-gray-600': 'border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500',
  'border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600': 'border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500',
  'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500': 'mb-2 text-[13px] font-semibold text-gray-700',
  'mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500': 'mb-3 text-[13px] font-semibold text-gray-700',
  'mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500': 'mb-4 text-[13px] font-semibold text-gray-700',
  'text-xs font-semibold uppercase tracking-wider text-gray-500': 'text-[13px] font-semibold text-gray-700',
  'text-xs font-medium uppercase tracking-wide text-gray-400': 'text-[13px] font-medium text-gray-500',
  'text-xs font-semibold uppercase text-gray-400 mb-3': 'mb-3 text-[13px] font-semibold text-gray-700',
  'mb-3 text-xs font-semibold uppercase text-gray-500': 'mb-3 text-[13px] font-semibold text-gray-700',
  'text-[12.5px] font-semibold uppercase tracking-[0.08em] text-gray-400': 'text-[13px] font-semibold text-gray-700',
  'mr-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-400': 'mr-1 text-[13px] font-medium text-gray-500',
};

// Section-title styles apply only to headings, so item names in lists keep
// their item look.
const HEADING_ONLY = new Set(['text-sm font-semibold text-gray-950', 'text-[15px] font-semibold text-gray-950']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

export function restyle(src) {
  let changed = 0;
  const out = src.replace(/className="([^"]*)"/g, (whole, cls, offset) => {
    const next = CLASS_MAP[cls];
    if (!next) return whole;
    if (HEADING_ONLY.has(cls)) {
      const tag = /<([A-Za-z0-9]+)[^<]*$/.exec(src.slice(Math.max(0, offset - 300), offset))?.[1] ?? '';
      if (!/^h[1-4]$/.test(tag)) return whole;
    }
    changed++;
    return `className="${next}"`;
  });
  return { out, changed };
}

if (process.argv[1] && process.argv[1].endsWith('restyle-handbuilt.mjs')) {
  let files = 0, total = 0;
  for (const dir of process.argv.slice(2)) {
    if (!statSync(dir).isDirectory()) continue;
    for (const f of walk(dir)) {
      if (/[\\/](print|pdf)[\\/]|certificate/.test(f)) continue;
      const src = readFileSync(f, 'utf8');
      const { out, changed } = restyle(src);
      if (changed) { writeFileSync(f, out); files++; total += changed; }
    }
  }
  console.log(`restyled ${total} class lists in ${files} files`);
}

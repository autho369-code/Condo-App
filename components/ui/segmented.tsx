import Link from 'next/link';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';

// One segmented control for the whole app: a row of 40px pills, the current
// one filled. SegmentedLinks for choices that are URLs (server pages),
// SegmentedButtons for choices handled in the page (client components).

const group = 'inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const pill = 'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-1';
const on = 'bg-gray-950 text-white';
const off = 'text-gray-500 hover:bg-gray-50 hover:text-gray-900';

export function SegmentedLinks({
  items,
  current,
  label,
  className,
}: {
  items: { id: string; label: string; href: string }[];
  current: string | null;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(group, className)}>
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={item.id === current ? 'page' : undefined}
          className={cn(pill, item.id === current ? on : off)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SegmentedButtons({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { id: string; label: string; icon?: ElementType }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn(group, className)}>
      {items.map(({ id, label: text, icon: Icon }) => (
        <button key={id} type="button" aria-pressed={id === value} onClick={() => onChange(id)}
          className={cn(pill, id === value ? on : off)}>
          {Icon && <Icon className="h-4 w-4" />}
          {text}
        </button>
      ))}
    </div>
  );
}

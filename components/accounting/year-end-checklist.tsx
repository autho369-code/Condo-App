import { Check, X } from 'lucide-react';

type Item = { key: string; label: string; detail: string; ok: boolean; required: boolean };

export function YearEndChecklist({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((i) => (
        <li key={i.key} className="flex items-start gap-3 px-5 py-3">
          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i.ok ? 'bg-gray-900 text-white' : i.required ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}`}>
            {i.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          <div className="min-w-0">
            <div className="text-sm text-gray-900">{i.label}{!i.required && <span className="ml-2 text-[11px] text-gray-400">recommended</span>}</div>
            <div className="text-[12px] text-gray-500">{i.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

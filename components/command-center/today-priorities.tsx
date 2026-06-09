import Link from 'next/link';
import { date } from '@/lib/utils';

type PriorityItem = {
  title: string;
  association: string;
  dueDate?: string;
  count?: number;
  link: string;
  type: 'violation' | 'bill' | 'inspection' | 'hearing' | 'contract';
};

export function TodaysPriorities({ items }: { items?: PriorityItem[] }) {
  const defaults: PriorityItem[] = items ?? [
    { title: 'Violations Awaiting Review', association: 'Lakeview Towers', count: 5, dueDate: '2026-06-10', link: '/violations', type: 'violation' },
    { title: 'Bills Awaiting Approval', association: 'Multiple', count: 4, dueDate: '2026-06-09', link: '/bills', type: 'bill' },
    { title: 'Elevator Inspection Overdue', association: 'Lincoln Square', dueDate: '2026-06-01', link: '/inspections', type: 'inspection' },
    { title: 'Hearings Scheduled This Week', association: 'Park Place', count: 2, dueDate: '2026-06-12', link: '/hearings', type: 'hearing' },
    { title: 'Vendor Contracts Expiring', association: 'Multiple', count: 3, dueDate: '2026-06-30', link: '/vendors', type: 'contract' },
  ];

  const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
    violation: { bg: 'bg-red-500/5', border: 'border-red-500/10', icon: '⚠' },
    bill: { bg: 'bg-amber-500/5', border: 'border-amber-500/10', icon: '$' },
    inspection: { bg: 'bg-red-500/5', border: 'border-red-500/10', icon: '🔧' },
    hearing: { bg: 'bg-purple-500/5', border: 'border-purple-500/10', icon: '⚖' },
    contract: { bg: 'bg-blue-500/5', border: 'border-blue-500/10', icon: '📋' },
  };

  return (
    <div className="rounded-2xl bg-[#0a0b0d] border border-[#1a1b1e] p-6">
      <h2 className="text-sm font-semibold text-[#e4e4e7] mb-4">Today&apos;s Priorities</h2>
      <div className="space-y-2">
        {defaults.map((item, i) => {
          const style = typeStyles[item.type];
          return (
            <Link
              key={i}
              href={item.link}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${style.bg} ${style.border} hover:border-[#27272a] transition-colors group`}
            >
              <span className="text-lg flex-shrink-0">{style.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e4e4e7] group-hover:text-white transition-colors">
                    {item.title}
                  </span>
                  {item.count && (
                    <span className="text-[11px] font-semibold text-[#a1a1aa] bg-[#18181b] px-1.5 py-0.5 rounded-md">
                      {item.count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[12px] text-[#71717a]">{item.association}</span>
                  {item.dueDate && (
                    <span className="text-[12px] text-[#52525b]">{date(item.dueDate)}</span>
                  )}
                </div>
              </div>
              <span className="text-[#52525b] group-hover:text-[#a1a1aa] transition-colors text-sm">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

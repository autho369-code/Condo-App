import Link from 'next/link';
import { date } from '@/lib/utils';

type PriorityItem = {
  title: string;
  association: string;
  dueDate?: string;
  count?: number;
  link: string;
  type: 'violation' | 'bill' | 'inspection' | 'hearing' | 'contract';
  priority?: 'critical' | 'high' | 'normal';
};

export function TodaysPriorities({ items }: { items?: PriorityItem[] }) {
  const defaults: PriorityItem[] = items ?? [];

  const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
    violation: { bg: 'bg-red-500/5', border: 'border-red-500/10', icon: '⚠' },
    bill: { bg: 'bg-amber-500/5', border: 'border-amber-500/10', icon: '$' },
    inspection: { bg: 'bg-red-500/5', border: 'border-red-500/10', icon: '🔧' },
    hearing: { bg: 'bg-purple-500/5', border: 'border-purple-500/10', icon: '⚖' },
    contract: { bg: 'bg-blue-500/5', border: 'border-blue-500/10', icon: '📋' },
  };

  const priorityStyles: Record<string, string> = {
    critical: 'border-l-2 border-l-red-400 bg-red-500/[0.03]',
    high: 'border-l-2 border-l-amber-400 bg-amber-500/[0.03]',
    normal: '',
  };

  const priorityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    normal: 'Normal',
  };

  const priorityLabelColors: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10',
    high: 'text-amber-400 bg-amber-400/10',
    normal: 'text-[#71717a] bg-[#18181b]',
  };

  // Sort by priority
  const sorted = [...defaults].sort((a, b) => {
    const order = { critical: 0, high: 1, normal: 2 };
    return (order[a.priority || 'normal'] || 2) - (order[b.priority || 'normal'] || 2);
  });

  return (
    <div className="rounded-2xl bg-[#0a0b0d] border border-[#1a1b1e] p-6">
      <h2 className="text-sm font-semibold text-[#e4e4e7] mb-4">Today&apos;s Priorities</h2>
      <div className="space-y-2">
        {sorted.map((item, i) => {
          const style = typeStyles[item.type];
          const priStyle = priorityStyles[item.priority || 'normal'];
          return (
            <Link
              key={i}
              href={item.link}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${style.bg} ${style.border} ${priStyle} hover:border-[#27272a] transition-colors group`}
            >
              <span className="text-lg flex-shrink-0">{style.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e4e4e7] group-hover:text-white transition-colors">
                    {item.title}
                  </span>
                  {item.count != null && (
                    <span className="text-[11px] font-semibold text-[#a1a1aa] bg-[#18181b] px-1.5 py-0.5 rounded-md">
                      {item.count}
                    </span>
                  )}
                  {item.priority && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityLabelColors[item.priority]}`}>
                      {priorityLabels[item.priority]}
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

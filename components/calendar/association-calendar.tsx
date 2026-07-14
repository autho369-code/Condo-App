// Shared association-calendar renderer — used by BOTH the owner portal and
// the board portal so everyone sees the same calendar, presented identically.
import { Calendar, CalendarDays, MapPin, Truck, Wrench } from 'lucide-react';
import type { AssociationCalendarItem } from '@/lib/calendar/association-feed';

const ICON = { meeting: CalendarDays, vendor: Truck, maintenance: Wrench, event: Calendar } as const;

export function AssociationCalendar({ items }: { items: AssociationCalendarItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-500">Nothing scheduled in the next 90 days.</p>
      </div>
    );
  }

  // Group by month
  const grouped = new Map<string, AssociationCalendarItem[]>();
  for (const item of items) {
    const key = new Date(item.when).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([month, monthItems]) => (
        <div key={month}>
          <h2 className="mb-4 border-b border-gray-200 pb-2 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{month}</h2>
          <div className="space-y-2">
            {monthItems.map((item) => {
              const d = new Date(item.when);
              const Icon = ICON[item.kind];
              return (
                <div key={item.key} className="flex items-start gap-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300">
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-2xl font-semibold tabular-nums text-blue-600">{d.getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate font-medium text-gray-900">{item.title}</span>
                    </div>
                    <div className="mt-0.5 text-sm capitalize text-gray-500">{item.detail}</div>
                    <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {item.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.location}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

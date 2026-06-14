import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { computeReminders } from '@/lib/reminders';

export async function RemindersWidget({ portfolioId }: { portfolioId: string | undefined }) {
  const supabase = await createClient();
  const groups = (await computeReminders(supabase as any, portfolioId)).filter((g) => g.items.length > 0);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-gray-950">Reminders &amp; alerts</h2>
          {total > 0 && (
            <span className="rounded-full bg-gray-950 px-2 py-0.5 text-xs font-medium tabular-nums text-white">{total}</span>
          )}
        </div>
        <Link href="/reminders" className="text-[13px] font-medium text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline">Configure</Link>
      </div>

      {total === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">Nothing due in your reminder windows. You&apos;re all caught up.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {groups.map((g) => (
            <div key={g.key} className="px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">{g.label}</h3>
                <span className="text-xs text-gray-400">{g.items.length}</span>
              </div>
              <ul className="space-y-1">
                {g.items.slice(0, 5).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                      <span className="truncate text-sm font-medium text-gray-900">{item.title}</span>
                      <span className="shrink-0 text-xs text-gray-500">{item.detail}</span>
                    </Link>
                  </li>
                ))}
                {g.items.length > 5 && (
                  <li className="px-2 pt-1 text-xs text-gray-400">+{g.items.length - 5} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

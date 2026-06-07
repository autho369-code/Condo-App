import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export async function InsuranceExpirationWidget() {
  const supabase = await createClient();
  const db = supabase as any;

  const { data: expiring } = await db
    .from('v_upcoming_expirations')
    .select('*')
    .lte('days_remaining', 30)
    .gt('days_remaining', 0)
    .order('expiration_date', { ascending: true })
    .limit(5);

  const { count: totalExpiring } = await db
    .from('v_upcoming_expirations')
    .select('*', { count: 'exact', head: true })
    .lte('days_remaining', 30)
    .gte('days_remaining', 0);

  if (!expiring?.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
            ⚠ Insurance expiring
          </div>
          <div className="mt-1 font-display text-2xl text-amber-900">
            {totalExpiring ?? expiring.length} polic{totalExpiring === 1 ? 'y' : 'ies'}
          </div>
          <div className="text-xs text-amber-600">expiring within 30 days</div>
        </div>
        <Link href="/insurance" className="text-sm font-medium text-amber-800 hover:text-amber-900 underline">
          View all →
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {expiring.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm border border-amber-100">
            <div>
              <span className="font-medium text-ink-900">{p.owner_name}</span>
              <span className="mx-2 text-ink-300">·</span>
              <span className="text-ink-500">{p.insurance_company}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700 font-medium">{p.days_remaining}d left</span>
              <span className="text-xs text-ink-400">{date(p.expiration_date)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

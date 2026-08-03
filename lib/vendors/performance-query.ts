import 'server-only';

import { VENDOR_PERFORMANCE_WINDOW_DAYS, type VendorPerformanceWorkOrder } from '@/lib/vendors/performance';

const PAGE_SIZE = 500;
const DAY_MS = 86_400_000;
const OPEN_STATUS_FILTER = 'new,assigned,scheduled,in_progress';

/**
 * Read every scoped work order needed for management scorecards. The explicit
 * portfolio predicate is defense-in-depth on top of RLS and pagination avoids
 * silently truncating a larger management-company history at PostgREST's row cap.
 */
export async function loadPortfolioVendorPerformanceRows(
  db: any,
  portfolioId: string,
  vendorIds: string[],
  options: { asOf?: Date; windowDays?: number } = {},
): Promise<VendorPerformanceWorkOrder[]> {
  if (!portfolioId || vendorIds.length === 0) return [];

  const asOf = options.asOf ?? new Date();
  const windowDays = options.windowDays ?? VENDOR_PERFORMANCE_WINDOW_DAYS;
  const windowStart = new Date(asOf.getTime() - windowDays * DAY_MS).toISOString().slice(0, 10);
  const rows: VendorPerformanceWorkOrder[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('work_orders')
      .select('id, vendor_id, number, title, status, priority, created_at, scheduled_date, completed_date')
      .eq('portfolio_id', portfolioId)
      .in('vendor_id', vendorIds)
      .is('archived_at', null)
      .or(`status.in.(${OPEN_STATUS_FILTER}),completed_date.gte.${windowStart}`)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not load vendor performance history: ${error.message}`);
    const page = (data ?? []) as VendorPerformanceWorkOrder[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

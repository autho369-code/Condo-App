/**
 * GET /api/reports/publish-board-packages
 * Daily cron. For every association with automatic board reports, publishes
 * last month's package once the configured publish day has arrived, unless it
 * is already published (catches up after a missed run). Service role only;
 * authenticated by the cron secret.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { boardPackagePath, previousMonth, publishBoardPackage } from '@/lib/reports/board-package';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  const svc = createServiceClient() as any;
  const today = new Date();
  const period = previousMonth(today);

  // Every due association (paged), skipping already-published ones before
  // spending time; a capped "first 200" list starved the rest forever.
  const { rows: due, error } = await fetchAllRows<any>(() => svc
    .from('association_board_report_settings')
    .select('association_id, sections, share_scope, notify_board, publish_day, associations!inner(id, name, portfolio_id, archived_at, portfolios(company_name))')
    .eq('auto_publish', true)
    .lte('publish_day', today.getUTCDate())
    .is('associations.archived_at', null)
    .order('association_id'));
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });

  const results: any[] = [];
  const deadline = Date.now() + 240_000;  // stop before maxDuration; the next run continues
  for (const row of due) {
    if (Date.now() > deadline) { results.push({ status: 'deferred', remaining: true }); break; }
    const a = row.associations;
    const { data: existing } = await svc.from('documents').select('id')
      .eq('entity_type', 'association').eq('entity_id', a.id).eq('file_url', boardPackagePath(a.id, period.to)).maybeSingle();
    if (existing) continue;
    try {
      const r = await publishBoardPackage({
        dataClient: svc, svc,
        association: { id: a.id, name: a.name, portfolio_id: a.portfolio_id, company_name: a.portfolios?.company_name },
        dateFrom: period.from, dateTo: period.to,
        sections: row.sections, shareScope: row.share_scope, notify: row.notify_board,
        actorId: null, source: 'scheduled',
      });
      results.push({ association: a.id, status: 'published', emailed: r.emailed });
    } catch (e: any) {
      results.push({ association: a.id, status: 'failed', error: e?.message });
    }
  }
  return NextResponse.json({ ok: true, period, published: results.filter((r) => r.status === 'published').length, results });
}

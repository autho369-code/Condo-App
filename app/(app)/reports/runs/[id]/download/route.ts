import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import {
  REPORT_RUN_ID,
  reportRunContentType,
  reportRunFileName,
  reportRunStoragePath,
} from '@/lib/reports/run-files';

export const dynamic = 'force-dynamic';

/**
 * Download a finished report run's file. Read with the signed-in user's own
 * session: report_runs and the `reports` bucket only show a run to people the
 * report's access rule allows (company, association scope, finance-only and
 * people-data reports), checked on every download.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  // The run page shows the error; an unknown id goes to the Reports index.
  const back = (message: string) => NextResponse.redirect(
    new URL(`${REPORT_RUN_ID.test(id) ? `/reports/runs/${id}` : '/reports'}?error=${encodeURIComponent(message)}`, _request.url),
    303,
  );
  if (!REPORT_RUN_ID.test(id)) return back('Report run not found.');

  const db = (await createClient()) as any;
  const { data: run, error } = await db
    .from('report_runs')
    .select('id, portfolio_id, status, output_format, finished_at, report_definitions(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) return back(error.message);
  if (!run) return back('Report run not found.');
  if (run.status !== 'succeeded') return back('This report has no file to download yet.');

  const path = reportRunStoragePath(run);
  if (!path) return back('This report file has an unknown format.');
  const { data: file, error: downloadError } = await db.storage.from('reports').download(path);
  if (downloadError || !file) return back('The report file could not be found. Run the report again.');

  return new NextResponse(Buffer.from(await file.arrayBuffer()), {
    headers: {
      'Content-Type': reportRunContentType(run.output_format),
      'Content-Disposition': `attachment; filename="${reportRunFileName(run.report_definitions?.name, run.output_format, run.finished_at)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReportCsv } from '@/lib/reports/generator';
import { canonicalReportSlug } from '@/lib/reports/routing';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await (supabase as any)
    .from('report_runs')
    .select('id, parameters, report_definitions(slug, name)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: 'Report run not found' }, { status: 404 });
  }

  const { csv } = await generateReportCsv(supabase, run);
  const definition = run.report_definitions as { slug?: string | null; name?: string | null } | null;
  const slug = canonicalReportSlug(definition?.slug ?? 'report');

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}-${id.slice(0, 8)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

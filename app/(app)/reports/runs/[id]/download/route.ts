import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReportOutput } from '@/lib/reports/generator';
import { reportContentType, reportFileExtension, type ReportFormat } from '@/lib/reports/exporter';
import { canonicalReportSlug } from '@/lib/reports/routing';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await (supabase as any)
    .from('report_runs')
    .select('id, parameters, output_format, report_definitions(slug, name)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: 'Report run not found' }, { status: 404 });
  }

  const format = parseFormat(run.output_format);
  const { body } = await generateReportOutput(supabase, run, format);
  const definition = run.report_definitions as { slug?: string | null; name?: string | null } | null;
  const slug = canonicalReportSlug(definition?.slug ?? 'report');
  const extension = reportFileExtension(format);

  return new NextResponse(body, {
    headers: {
      'content-type': reportContentType(format),
      'content-disposition': `attachment; filename="${slug}-${id.slice(0, 8)}.${extension}"`,
      'cache-control': 'no-store',
    },
  });
}

function parseFormat(value: unknown): ReportFormat {
  return value === 'xlsx' || value === 'csv' || value === 'json' || value === 'html' || value === 'pdf'
    ? value
    : 'pdf';
}

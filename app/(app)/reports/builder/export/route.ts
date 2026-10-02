import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import {
  BUILDER_EXPORT_MAX_ROWS,
  buildBuilderQuery,
  parseBuilderRequest,
  rowsToCsv,
} from '@/lib/reports/builder-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await requireStaff();

  const url = new URL(request.url);
  const params = {
    source: url.searchParams.get('source') ?? undefined,
    cols: url.searchParams.get('cols') ?? undefined,
    association: url.searchParams.get('association') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  };

  // Same whitelist validation as the page — unknown source / columns are rejected/dropped.
  const req = parseBuilderRequest(params);
  if (!req) {
    return NextResponse.json({ error: 'Unknown or missing data source.' }, { status: 400 });
  }

  const supabase = await createClient();
  // Page past PostgREST's 1,000-row cap (the export used to stop at 500 rows).
  const { rows, truncated, error } = await fetchAllRows<Record<string, unknown>>(
    () => buildBuilderQuery(supabase as any, req, null),
    { maxRows: BUILDER_EXPORT_MAX_ROWS },
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (truncated) {
    return NextResponse.json(
      { error: `More than ${BUILDER_EXPORT_MAX_ROWS.toLocaleString()} rows match. Narrow the filters and export again.` },
      { status: 413 },
    );
  }

  const csv = rowsToCsv(req.columns, rows);
  const filename = `${req.source.key}-report.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

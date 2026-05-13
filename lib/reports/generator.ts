import {
  buildReportCsv,
  buildReportHtml,
  buildReportPdf,
  type ReportFormat,
} from '@/lib/reports/exporter';

type ReportRunLike = {
  id: string;
  parameters: Record<string, unknown> | null;
  report_definitions?: {
    slug?: string | null;
    name?: string | null;
  } | null;
};

export async function generateReportCsv(db: any, run: ReportRunLike) {
  const { body, rowCount } = await generateReportOutput(db, run, 'csv');
  return { csv: body.toString('utf8'), rowCount };
}

export async function generateReportOutput(db: any, run: ReportRunLike, format: ReportFormat) {
  const definition = run.report_definitions;
  const slug = definition?.slug ?? 'report';
  const title = definition?.name ?? 'Report';
  const rows = await loadReportRows(db, slug, run.parameters ?? {});
  const input = {
    title,
    generatedAt: new Date().toISOString(),
    parameters: run.parameters ?? {},
    rows,
  };

  if (format === 'pdf') return { body: buildReportPdf(input), rowCount: rows.length };
  if (format === 'json') return { body: Buffer.from(JSON.stringify(input, null, 2), 'utf8'), rowCount: rows.length };
  if (format === 'html' || format === 'xlsx') return { body: Buffer.from(buildReportHtml(input), 'utf8'), rowCount: rows.length };
  return { body: Buffer.from(buildReportCsv(input), 'utf8'), rowCount: rows.length };
}

async function loadReportRows(db: any, slug: string, parameters: Record<string, unknown>) {
  if (slug === 'ar_aging' || slug.includes('aging') || slug.includes('delinquency')) {
    return selectRows(scopedQuery(db.from('aged_receivables').select('*'), parameters, 'association_id').order('due_date'));
  }

  if (slug.includes('work_order')) {
    return selectRows(scopedQuery(db.from('work_orders').select('*'), parameters, 'association_id').order('created_at', { ascending: false }).limit(1000));
  }

  if (slug.includes('vendor')) {
    return selectRows(db.from('vendors').select('*').is('archived_at', null).order('name').limit(1000));
  }

  if (slug.includes('owner') || slug.includes('homeowner')) {
    return selectRows(db.from('owners').select('*').is('archived_at', null).order('full_name').limit(1000));
  }

  if (slug.includes('unit') || slug.includes('assessment') || slug.includes('dues')) {
    return selectRows(scopedQuery(db.from('v_unit_account_summary').select('*'), parameters, 'association_id').limit(1000));
  }

  if (slug.includes('bill') || slug.includes('payable') || slug.includes('check')) {
    return selectRows(db.from('v_check_writing_queue').select('*').limit(1000));
  }

  const associations = await selectRows(db.from('associations').select('*').is('archived_at', null).order('name').limit(1000));
  return associations.length > 0 ? associations : [{ report: slug, note: 'No portfolio rows matched this report.' }];
}

function scopedQuery(query: any, parameters: Record<string, unknown>, column: string) {
  const associationId = parameters.association_id;
  return typeof associationId === 'string' && associationId ? query.eq(column, associationId) : query;
}

async function selectRows(query: any) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Record<string, unknown>>;
}

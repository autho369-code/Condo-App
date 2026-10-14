import { isSupportedReportOutputFormat } from '@/lib/reports/formats';

// Where a report run's file lives and how users reach it. The file sits in the
// private `reports` bucket; people download it through the run's download
// route (signed in, allowed to see the run), never through a stored or
// emailed signed link that keeps working after their access ends.

export const REPORT_RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** App path that downloads a run's file. */
export function reportRunDownloadPath(runId: string): string {
  return `/reports/runs/${runId}/download`;
}

/** Storage object path of a run's file, or null for an unknown format. */
export function reportRunStoragePath(run: { id: string; portfolio_id: string; output_format: unknown }): string | null {
  if (!isSupportedReportOutputFormat(run.output_format)) return null;
  return `${run.portfolio_id}/${run.id}.${run.output_format}`;
}

const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  json: 'application/json',
};

export function reportRunContentType(format: string): string {
  return CONTENT_TYPES[format] ?? 'application/octet-stream';
}

/** A safe download file name from the report's name. */
export function reportRunFileName(name: string | null | undefined, format: string, finishedAt?: string | null): string {
  const base = String(name ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  const day = typeof finishedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(finishedAt) ? `-${finishedAt.slice(0, 10)}` : '';
  return `${base}${day}.${format}`;
}

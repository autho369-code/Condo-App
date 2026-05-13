type ReportCsvInput = {
  title: string;
  generatedAt: string;
  parameters?: unknown;
  rows: Array<Record<string, unknown>>;
};

export function reportDownloadPath(runId: string) {
  return `/reports/runs/${runId}/download`;
}

export function buildReportCsv({ title, generatedAt, parameters, rows }: ReportCsvInput) {
  const preamble = [
    ['Report', title],
    ['Generated At', generatedAt],
    ['Parameters', JSON.stringify(parameters ?? {})],
  ];

  const columns = collectColumns(rows);
  const body = rows.length
    ? [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    : [['Message'], ['No rows matched the selected report filters.']];

  return [...preamble, [], ...body]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

function collectColumns(rows: Array<Record<string, unknown>>) {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return Array.from(columns);
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type ReportCsvInput = {
  title: string;
  generatedAt: string;
  parameters?: unknown;
  rows: Array<Record<string, unknown>>;
};

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json' | 'html';

const FORMAT_PRIORITY: ReportFormat[] = ['pdf', 'xlsx', 'csv', 'html', 'json'];

export function reportDownloadPath(runId: string) {
  return `/reports/runs/${runId}/download`;
}

export function orderedReportFormats(formats: unknown): ReportFormat[] {
  const allowed = new Set<ReportFormat>();
  if (Array.isArray(formats)) {
    for (const format of formats) {
      if (isReportFormat(format)) allowed.add(format);
    }
  }
  if (allowed.size === 0) allowed.add('pdf');
  return FORMAT_PRIORITY.filter((format) => allowed.has(format));
}

export function defaultReportFormat(formats: unknown): ReportFormat {
  return orderedReportFormats(formats)[0] ?? 'pdf';
}

export function reportContentType(format: ReportFormat) {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.ms-excel; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    case 'csv':
    default:
      return 'text/csv; charset=utf-8';
  }
}

export function reportFileExtension(format: ReportFormat) {
  return format === 'xlsx' ? 'xls' : format;
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

export function buildReportPdf(input: ReportCsvInput) {
  const lines = reportTextLines(input);
  const pages = chunkLines(lines, 54);
  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const content = [
      'BT',
      '/F1 10 Tf',
      '50 770 Td',
      '14 TL',
      ...pageLines.map((line, index) => `${index === 0 ? '' : 'T* '}${pdfText(line)}`.trim()),
      'ET',
    ].join('\n');
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  }
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export function buildReportHtml(input: ReportCsvInput) {
  const columns = collectColumns(input.rows);
  const rows = input.rows.length ? input.rows : [{ Message: 'No rows matched the selected report filters.' }];
  const htmlColumns = input.rows.length ? columns : ['Message'];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${html(input.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2933; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { margin-bottom: 20px; color: #5b6472; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f7f4ef; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${html(input.title)}</h1>
  <div class="meta">Generated ${html(input.generatedAt)} | Parameters ${html(JSON.stringify(input.parameters ?? {}))}</div>
  <table>
    <thead><tr>${htmlColumns.map((column) => `<th>${html(column)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${htmlColumns.map((column) => `<td>${html(row[column])}</td>`).join('')}</tr>`).join('\n')}
    </tbody>
  </table>
</body>
</html>`;
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

function isReportFormat(value: unknown): value is ReportFormat {
  return value === 'pdf' || value === 'xlsx' || value === 'csv' || value === 'json' || value === 'html';
}

function reportTextLines({ title, generatedAt, parameters, rows }: ReportCsvInput) {
  const lines = [
    title,
    `Generated: ${generatedAt}`,
    `Parameters: ${JSON.stringify(parameters ?? {})}`,
    '',
  ];

  if (rows.length === 0) {
    lines.push('No rows matched the selected report filters.');
    return lines;
  }

  rows.forEach((row, index) => {
    const text = Object.entries(row)
      .map(([key, value]) => `${key}: ${stringValue(value)}`)
      .join(' | ');
    lines.push(`${index + 1}. ${text}`);
  });
  return lines.flatMap(wrapLine);
}

function wrapLine(line: string) {
  const width = 92;
  if (line.length <= width) return [line];
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    chunks.push(remaining.slice(0, width));
    remaining = `  ${remaining.slice(width)}`;
  }
  chunks.push(remaining);
  return chunks;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += size) chunks.push(lines.slice(i, i + size));
  return chunks.length ? chunks : [['']];
}

function pdfText(value: unknown) {
  return `(${stringValue(value)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')}) Tj`;
}

function html(value: unknown) {
  return stringValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

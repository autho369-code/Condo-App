type ReportCsvInput = {
  title: string;
  generatedAt: string;
  parameters?: unknown;
  rows: Array<Record<string, unknown>>;
};

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json' | 'html';

export const STANDARD_REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
const FORMAT_PRIORITY: ReportFormat[] = [...STANDARD_REPORT_FORMATS, 'html', 'json'];

export function reportDownloadPath(runId: string) {
  return `/reports/runs/${runId}/download`;
}

export function orderedReportFormats(formats: unknown): ReportFormat[] {
  return [...STANDARD_REPORT_FORMATS];
}

export function defaultReportFormat(formats: unknown): ReportFormat {
  return orderedReportFormats(formats)[0] ?? 'pdf';
}

export function reportContentType(format: ReportFormat) {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
  return format;
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

export function buildReportXlsx(input: ReportCsvInput) {
  const columns = collectColumns(input.rows);
  const bodyRows = input.rows.length
    ? [columns, ...input.rows.map((row) => columns.map((column) => row[column]))]
    : [['Message'], ['No rows matched the selected report filters.']];
  const rows = [
    ['Report', input.title],
    ['Generated At', input.generatedAt],
    ['Parameters', JSON.stringify(input.parameters ?? {})],
    [],
    ...bodyRows,
  ];

  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => worksheetCell(value, columnIndex + 1, rowIndex + 1)).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
</worksheet>`;

  return zipStore([
    {
      name: '[Content_Types].xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    { name: 'xl/worksheets/sheet1.xml', body: sheet },
  ]);
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

function worksheetCell(value: unknown, column: number, row: number) {
  const ref = `${columnName(column)}${row}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function columnName(index: number) {
  let name = '';
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
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

function xml(value: unknown) {
  return stringValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function zipStore(files: Array<{ name: string; body: string | Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const body = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body, 'utf8');
    const crc = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

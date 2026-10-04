// Report file formats the report processor can create. Kept free of the
// PDF/Excel libraries so client components can import the list cheaply.

export const SUPPORTED_REPORT_OUTPUT_FORMATS = ['csv', 'xlsx', 'pdf', 'json'] as const;
export type SupportedReportOutputFormat = (typeof SUPPORTED_REPORT_OUTPUT_FORMATS)[number];

const LABELS: Record<SupportedReportOutputFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
  json: 'JSON',
};

export function reportFormatLabel(format: string): string {
  return LABELS[format as SupportedReportOutputFormat] ?? format.toUpperCase();
}

export function isSupportedReportOutputFormat(value: unknown): value is SupportedReportOutputFormat {
  return typeof value === 'string' && (SUPPORTED_REPORT_OUTPUT_FORMATS as readonly string[]).includes(value);
}

/** Keep catalog metadata honest: never offer a format this service cannot create. */
export function supportedReportOutputFormats(values: unknown): SupportedReportOutputFormat[] {
  const requested = Array.isArray(values) ? values : [];
  const supported = requested.filter(isSupportedReportOutputFormat);
  return supported.length > 0 ? [...new Set(supported)] : ['csv'];
}

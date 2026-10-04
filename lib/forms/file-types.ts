// Form file rules shared by the browser picker and the server actions.
// Within the association-documents bucket's allowed MIME types and size limit.

export const FORM_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const FORM_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** A form file lives at forms/<portfolio_id>/<uuid>.<ext>, nothing else. */
export function isFormFilePath(path: unknown, portfolioId: string): path is string {
  if (typeof path !== 'string' || !new RegExp(`^${UUID}$`, 'i').test(portfolioId)) return false;
  const exts = [...new Set(Object.values(FORM_FILE_TYPES))].join('|');
  return new RegExp(`^forms/${portfolioId}/${UUID}\\.(${exts})$`, 'i').test(path);
}

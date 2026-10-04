import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export const FORMS_BUCKET = 'association-documents';

export const FORM_AUDIENCES = [
  { value: 'homeowner', label: 'Homeowners (owner portal)' },
  { value: 'vendor', label: 'Vendors (staff use)' },
  { value: 'internal', label: 'Internal (staff only)' },
] as const;

export function audienceLabel(value: string | null | undefined): string {
  return FORM_AUDIENCES.find((a) => a.value === value)?.label.replace(/ \(.*\)$/, '') ?? 'Homeowners';
}

/**
 * Short-lived download links for form files. Call only with rows the caller
 * already read through their own RLS-scoped client; this signs with the
 * service client and checks each path sits in its form's portfolio folder.
 */
export async function signFormFiles(
  rows: Array<{ id: string; portfolio_id: string; file_path: string | null }>,
  expiresIn = 600,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const valid = rows.filter((r) => r.file_path && r.file_path.startsWith(`forms/${r.portfolio_id}/`) && !r.file_path.includes('..'));
  if (valid.length === 0) return links;
  const { data } = await (createServiceClient() as any).storage
    .from(FORMS_BUCKET)
    .createSignedUrls(valid.map((r) => r.file_path), expiresIn);
  for (const [i, r] of valid.entries()) {
    const url = data?.[i]?.signedUrl;
    if (url) links.set(r.id, url);
  }
  return links;
}

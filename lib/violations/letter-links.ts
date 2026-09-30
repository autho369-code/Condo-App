import 'server-only';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { createServiceClient } from '@/lib/supabase/server';

export type ViolationLetterRow = {
  id: string;
  violation_id: string;
  step_name: string;
  subject: string;
  pdf_path: string;
  delivery_methods: string[];
  emailed_to: string | null;
  email_status: string;
  mail_status: string;
  mailed_at: string | null;
  created_at: string;
};

export const VIOLATION_LETTER_COLUMNS =
  'id, violation_id, step_name, subject, pdf_path, delivery_methods, emailed_to, email_status, mail_status, mailed_at, created_at';

/**
 * Sign PDF links for letter rows the caller could already read through RLS.
 * Only paths under the letter's own violation are signed.
 */
export async function signLetterLinks(letters: ViolationLetterRow[]): Promise<Map<string, string>> {
  const paths = letters
    .filter((l) => isScopedStoragePath(l.pdf_path, 'violations', l.violation_id))
    .map((l) => l.pdf_path);
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data } = await (createServiceClient() as any).storage.from('association-documents').createSignedUrls(paths, 3600);
  for (const s of data ?? []) if (s?.path && s?.signedUrl) links.set(s.path, s.signedUrl);
  return links;
}

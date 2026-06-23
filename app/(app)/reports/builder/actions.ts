'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { parseBuilderRequest } from '@/lib/reports/builder-catalog';

// Fail-loud helper: bounce back to the builder with ?error= (and preserve the query).
function failTo(query: string, message: string): never {
  const sep = query ? '&' : '';
  redirect(`/reports/builder?${query}${sep}error=${encodeURIComponent(message)}`);
}

export async function saveReportView(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const query = String(formData.get('query') ?? '');

  if (!name) failTo(query, 'Enter a name for the saved report.');

  const params = Object.fromEntries(new URLSearchParams(query));
  const req = parseBuilderRequest(params);
  if (!req) failTo(query, 'Run a valid report before saving.');

  const me = await getMe();
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) failTo(query, 'No portfolio in scope — cannot save.');

  const supabase = await createClient();
  const { error } = await (supabase as any).from('saved_report_views').insert({
    portfolio_id: portfolioId,
    created_by: me.auth_user_id,
    name,
    source_key: req.source.key,
    columns: req.columns.map((c) => c.key),
    filters: req.filters,
  });

  if (error) failTo(query, error.message);

  revalidatePath('/reports/builder');
  const sep = query ? '&' : '';
  redirect(`/reports/builder?${query}${sep}saved=1`);
}

export async function deleteReportView(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const query = String(formData.get('query') ?? '');
  if (!id) failTo(query, 'Missing report id.');

  const supabase = await createClient();
  const { error } = await (supabase as any).from('saved_report_views').delete().eq('id', id);
  if (error) failTo(query, error.message);

  revalidatePath('/reports/builder');
  const sep = query ? '&' : '';
  redirect(`/reports/builder?${query}${sep}deleted=1`);
}

'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceOrPortfolioAdmin, requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// Every RPC re-checks finance/admin permission and association scope.
const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath('/accounting/year-end');
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}

export async function generateYearEndPackage(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const associationId = s(formData, 'association_id');
  const year = Number(s(formData, 'fiscal_year'));
  const back = `/accounting/year-end?association_id=${associationId}&year=${year}`;
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('generate_year_end_package', {
    p_association_id: associationId, p_fiscal_year: year, p_notes: s(formData, 'notes') || null,
  });
  if (error) go(back, 'error', error.message);
  go(`/accounting/year-end/${data}`, 'saved', 'Draft package prepared from the current books. Review it, then finalize.');
}

export async function finalizeYearEndPackage(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const id = s(formData, 'id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('finalize_year_end_package', { p_package_id: id });
  if (error) go(`/accounting/year-end/${id}`, 'error', error.message);
  go(`/accounting/year-end/${id}`, 'saved', 'Finalized. This package is now permanent and visible to the board.');
}

export async function supersedeYearEndPackage(formData: FormData) {
  await requirePortfolioAdmin();
  const id = s(formData, 'id');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('supersede_year_end_package', { p_package_id: id, p_reason: s(formData, 'reason') });
  if (error) go(`/accounting/year-end/${id}`, 'error', error.message);
  go(`/accounting/year-end/${id}`, 'saved', 'Superseded. Prepare a revised package for the same year.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

function fail(message: string): never {
  redirect(`/accounting-periods?error=${encodeURIComponent(message)}`);
}

export async function initializeAccountingYear(formData: FormData) {
  const me = await requireFinanceOrPortfolioAdmin();
  const portfolioId = me.portfolio?.id;
  const fiscalYear = Number(formData.get('fiscal_year'));
  if (!portfolioId) fail('A portfolio is required.');
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) fail('Enter a valid fiscal year.');

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('initialize_accounting_year', {
    p_portfolio_id: portfolioId,
    p_fiscal_year: fiscalYear,
  });
  if (error) fail(error.message);
  revalidatePath('/accounting-periods');
  redirect(`/accounting-periods?year=${fiscalYear}&initialized=${Number(data ?? 0)}`);
}

export async function changeAccountingPeriodStatus(periodId: string, nextStatus: string, formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  if (!['open', 'soft_closed', 'closed'].includes(nextStatus)) fail('Invalid accounting period status.');
  const note = String(formData.get('note') ?? '').trim();
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('set_accounting_period_status', {
    p_period_id: periodId,
    p_status: nextStatus,
    p_note: note || null,
  });
  if (error) fail(error.message);
  revalidatePath('/accounting-periods');
  redirect('/accounting-periods?updated=1');
}

'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// Every RPC re-checks finance permission and association scope
// (can_mutate_association_budget) in the database.

const s = (fd: FormData, k: string) => ((fd.get(k) as string) ?? '').trim();
const REF_RE = /^[a-z0-9-]{1,80}$/i;

function base(fd: FormData) {
  const ref = s(fd, 'association_ref');
  return `/associations/${REF_RE.test(ref) ? ref : s(fd, 'association_id')}/budget`;
}
function go(path: string, key: 'error' | 'saved', msg: string): never {
  revalidatePath(path.split('?')[0]);
  redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
}
function year(fd: FormData) {
  const y = Number(s(fd, 'fiscal_year'));
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
}

export async function saveBudgetWorksheet(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const fy = year(formData);
  const to = `${base(formData)}?fiscal_year=${fy ?? ''}`;
  if (!fy) go(to, 'error', 'Choose a fiscal year.');
  let lines: unknown;
  try {
    lines = JSON.parse(s(formData, 'lines') || '[]');
  } catch {
    go(to, 'error', 'The worksheet could not be read. Reload and try again.');
  }
  if (!Array.isArray(lines)) go(to, 'error', 'The worksheet could not be read. Reload and try again.');
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('save_budget_worksheet', {
    p_association_id: s(formData, 'association_id'), p_fiscal_year: fy, p_lines: lines,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', `Saved FY${fy} budget (${data} line${data === 1 ? '' : 's'}).`);
}

export async function adoptBudget(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const fy = year(formData);
  const to = `${base(formData)}?fiscal_year=${fy ?? ''}`;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('adopt_budget', {
    p_association_id: s(formData, 'association_id'), p_fiscal_year: fy, p_note: s(formData, 'note') || null,
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', `FY${fy} budget adopted and locked. You can now update assessments from it.`);
}

export async function reopenBudget(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const fy = year(formData);
  const to = `${base(formData)}?fiscal_year=${fy ?? ''}`;
  const db = (await createClient()) as any;
  const { error } = await db.rpc('reopen_budget', {
    p_association_id: s(formData, 'association_id'), p_fiscal_year: fy, p_reason: s(formData, 'reason'),
  });
  if (error) go(to, 'error', error.message);
  go(to, 'saved', `FY${fy} budget reopened for changes.`);
}

export async function applyAssessmentUpdate(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const fy = year(formData);
  const params = new URLSearchParams({
    fiscal_year: String(fy ?? ''),
    gl: s(formData, 'budget_gl_account_id'),
    category: s(formData, 'charge_category_id'),
    method: s(formData, 'method'),
    frequency: s(formData, 'frequency'),
    effective: s(formData, 'effective_date'),
  });
  const to = `${base(formData)}/assessments?${params.toString()}`;
  if (formData.get('confirm') !== 'on') go(to, 'error', 'Tick the confirmation box to update assessments.');
  const db = (await createClient()) as any;
  const { error } = await db.rpc('apply_assessment_update', {
    p_association_id: s(formData, 'association_id'),
    p_fiscal_year: fy,
    p_budget_gl_account_id: s(formData, 'budget_gl_account_id'),
    p_charge_category_id: s(formData, 'charge_category_id'),
    p_method: s(formData, 'method'),
    p_frequency: s(formData, 'frequency'),
    p_effective_date: s(formData, 'effective_date') || null,
  });
  if (error) go(to, 'error', error.message);
  go(`${base(formData)}/assessments?fiscal_year=${fy}`, 'saved',
    `Assessments updated. New recurring charges start ${s(formData, 'effective_date')}; owners' dues now show the new amount.`);
}

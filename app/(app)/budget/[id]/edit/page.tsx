import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

// Individual budget lines are edited inside the association's worksheet.
export default async function EditBudgetLineRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = (await createClient()) as any;
  const { data } = await db.from('budget_lines').select('fiscal_year, associations(id, slug)').eq('id', id).maybeSingle();
  const a = data?.associations;
  if (!a) redirect('/budget');
  redirect(`/associations/${a.slug ?? a.id}/budget?fiscal_year=${data.fiscal_year}`);
}

import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';

// Budgets are edited as a whole-year worksheet on the association's Budget
// tab; /budget handles the association lookup and redirect.
export default async function NewBudgetRedirect({ searchParams }: { searchParams: Promise<{ association?: string; year?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.association) q.set('association', sp.association);
  if (sp.year) q.set('year', sp.year);
  redirect(`/budget${q.size ? `?${q.toString()}` : ''}`);
}

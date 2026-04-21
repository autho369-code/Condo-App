import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

// Pass-through — each page owns its own right panel so the detail page
// (association detail) can show different Tasks than the list page.
export default async function AssociationsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="h-screen bg-[#faf6f1]">{children}</div>;
}

import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

// Pass-through — page.tsx renders its own ContextPanel so it can be search-aware.
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="h-screen bg-[#faf6f1]">{children}</div>;
}

import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function BillsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="h-full">{children}</div>;
}

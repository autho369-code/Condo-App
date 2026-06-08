import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="h-screen bg-[#060B18]">{children}</div>;
}

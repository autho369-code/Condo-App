import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

// Pass-through layout. The right context panel is rendered inside each page
// so it can vary by ?view=association vs ?view=property.
export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="h-screen bg-[#faf6f1]">{children}</div>;
}

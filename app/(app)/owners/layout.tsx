import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

export default async function OwnersLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return children;
}

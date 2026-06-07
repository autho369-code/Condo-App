import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  if (!me.is_platform_operator) {
    return <div className="p-8 text-gray-500">Access denied. Platform operators only.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/platform/portfolios" className="text-sm font-semibold text-gray-900">Platform</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/platform/portfolios" className="text-gray-600 hover:text-gray-900">Companies</Link>
            <Link href="/platform/portfolios/new" className="text-gray-600 hover:text-gray-900">+ New</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{me.email}</span>
          <Link href="/dashboard" className="text-blue-600 hover:underline">App</Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

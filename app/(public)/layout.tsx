import Link from 'next/link';
import { headers } from 'next/headers';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { signInMetadata } from '@/lib/tenant/metadata';

// Token pages (signing, vendor uploads, violation reports): branded and kept
// out of search results on a company's own address.
export const generateMetadata = signInMetadata;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = tenantFromHeaders(await headers());
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-gray-900">{tenant?.companyName ?? 'Portier'}</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}

import Link from 'next/link';
import { headers } from 'next/headers';
import { NEUTRAL_COMPANY_NAME, tenantFromHeaders } from '@/lib/tenant/resolve';
import type { Metadata } from 'next';
import { brandedMetadata, signInMetadata } from '@/lib/tenant/metadata';

// Token pages (signing, vendor uploads, violation reports): branded on a
// company's own address, neutral on the platform address (never "· Portier369"
// in the tab or link preview), and kept out of search results either way.
export async function generateMetadata(): Promise<Metadata> {
  if (tenantFromHeaders(await headers())) return signInMetadata();
  return { ...brandedMetadata(NEUTRAL_COMPANY_NAME), robots: { index: false, follow: false } };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = tenantFromHeaders(await headers());
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-gray-900">{tenant?.companyName ?? NEUTRAL_COMPANY_NAME}</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}

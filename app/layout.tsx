import './globals.css';
import { Fraunces, Inter } from 'next/font/google';
import { currentTenant } from '@/lib/tenant/server';
import { Toaster } from '@/components/toast/toaster';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const serif = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '500', '600'],
  axes: ['SOFT', 'opsz'],
});

/**
 * Tenant-aware metadata + favicon.
 *
 * Next.js calls generateMetadata() at request time, so when a request arrives
 * at beacon.portier369.com the title becomes "Beacon Hill Management" and the
 * favicon swaps to the tenant's uploaded one. Apex (portier369.com) and
 * preview hosts continue to show the default Portier branding.
 */
export async function generateMetadata() {
  const tenant = await currentTenant();
  if (tenant) {
    return {
      title: {
        default: tenant.company_name,
        template: `%s · ${tenant.company_name}`,
      },
      description: `${tenant.company_name} — workspace and resident portal, powered by Portier.`,
      icons: tenant.favicon_url
        ? { icon: [{ url: tenant.favicon_url }] }
        : undefined,
    };
  }
  return {
    title: 'Portier — Property management, refined.',
    description:
      'A premium operating platform for community managers — accounting, maintenance, owner services, and reporting in one editorial workspace.',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="antialiased"><Toaster>{children}</Toaster></body>
    </html>
  );
}

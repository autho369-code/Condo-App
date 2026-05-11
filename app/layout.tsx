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

// Fraunces is a variable font. To use the SOFT and opsz axes (which give
// the editorial softness), the weight axis must be 'variable' — every
// weight from 100–900 is then available via plain CSS font-weight.
const serif = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: 'variable',
  axes: ['SOFT', 'opsz'],
});

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

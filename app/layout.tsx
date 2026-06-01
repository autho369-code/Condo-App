import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Portier369 — HOA & Condo Management Software | Save Up To 60%',
    template: '%s | Portier369',
  },
  description: 'The most affordable HOA and condominium management software. Assessment billing, work orders, violation tracking, owner & board portals. Save up to 60% vs AppFolio, Buildium & Vantaca. Starting at $157/month.',
  keywords: [
    'HOA management software',
    'condo management software',
    'condominium management platform',
    'property management software',
    'HOA billing software',
    'association management',
    'community association management',
    'AppFolio alternative',
    'Buildium alternative',
    'Vantaca alternative',
    'affordable HOA software',
    'HOA payment processing',
    'assessment billing',
    'HOA dues collection',
    'HOA violation tracking',
    'work order management',
    'owner portal',
    'board portal',
  ],
  authors: [{ name: 'Portier369' }],
  creator: 'Portier369',
  publisher: 'Portier369',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Portier369',
    title: 'Portier369 — HOA & Condo Management Software | Save Up To 60%',
    description: 'The most affordable HOA and condominium management software. Save up to 60% vs AppFolio, Buildium & Vantaca.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Portier369 — HOA & Condo Management Software' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portier369 — HOA & Condo Management Software | Save Up To 60%',
    description: 'The most affordable HOA and condominium management software. Save up to 60% vs AppFolio, Buildium & Vantaca.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

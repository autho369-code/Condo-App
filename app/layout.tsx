import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata, Viewport } from 'next'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-inter' })

export const metadata: Metadata = {
  metadataBase: new URL('https://portier369.com'),
  title: {
    default: 'Portier369 — Property Management Software for HOAs & Condos',
    template: '%s · Portier369',
  },
  description:
    'All-in-one property management software for condominium and HOA management companies. Work orders, violations, maintenance, accounting, board and owner portals, and vendor management in one platform.',
  keywords: [
    'property management software',
    'HOA management software',
    'condo management software',
    'community association management',
    'HOA accounting software',
    'violation tracking software',
    'board portal',
    'owner portal',
    'CAM software',
  ],
  authors: [{ name: 'Portier369' }],
  creator: 'Portier369',
  applicationName: 'Portier369',
  appleWebApp: {
    capable: true,
    title: 'Portier369',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://portier369.com',
    siteName: 'Portier369',
    title: 'Portier369 — Property Management Software for HOAs & Condos',
    description:
      'Run your entire property management company from one platform. Built from 29 years of real condominium and HOA operations.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Portier369 — property management platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portier369 — Property Management Software for HOAs & Condos',
    description: 'Run your entire property management company from one platform.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1E3A5F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
